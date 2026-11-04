"""Real GPT-2 analysis. A single bridge is reused; callers serialize access."""

import hashlib
import os
import time
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path

import numpy as np
import psutil
import torch
from huggingface_hub import hf_hub_download
from transformer_lens.model_bridge import TransformerBridge

from app.analysis.architecture import build_architecture
from app.analysis.validation import validate_analysis
from app.serializers.schema import Analysis, ModelInfo

MODEL_ID = "openai-community/gpt2"
REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e"
CODE_VERSION = "origin-analysis-1.0.0"


class AnalysisError(ValueError):
    def __init__(self, code: str, message: str, status: int = 422):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def visible(text: str) -> str:
    return text.replace(" ", "␠").replace("\n", "↵").replace("\t", "⇥").replace("\r", "␍")


def byte_decoder() -> dict[str, int]:
    # The reversible byte alphabet used by GPT-2, not word splitting.
    alphabet = list(range(ord("!"), ord("~") + 1))
    alphabet += list(range(ord("¡"), ord("¬") + 1))
    alphabet += list(range(ord("®"), ord("ÿ") + 1))
    codepoints = alphabet.copy()
    extra = 0
    for b in range(256):
        if b not in alphabet:
            alphabet.append(b)
            codepoints.append(256 + extra)
            extra += 1
    return dict(zip(map(chr, codepoints), alphabet, strict=True))


def code_digest() -> str:
    base = Path(__file__).resolve().parents[1]  # app/, never .venv or tests
    sha = hashlib.sha256()
    for p in sorted(base.rglob("*.py")):
        sha.update(p.relative_to(base).as_posix().encode())
        sha.update(p.read_bytes())
    return sha.hexdigest()


class ModelEngine:
    def __init__(self):
        self.max_tokens = min(64, max(1, int(os.getenv("ORIGIN_MAX_TOKENS", "64"))))
        self.cpu_threads = max(1, int(os.getenv("ORIGIN_CPU_THREADS", "2")))
        self.device = os.getenv("ORIGIN_DEVICE", "cpu")
        torch.set_num_threads(self.cpu_threads)
        start = time.perf_counter()
        self.bridge = TransformerBridge.boot_transformers(
            MODEL_ID,
            revision=REVISION,
            device=self.device,
            dtype=torch.float32,
            trust_remote_code=False,
        )
        self.bridge.eval()
        self.bridge.original_model.eval()
        self.load_ms = (time.perf_counter() - start) * 1000
        self.tokenizer = self.bridge.tokenizer
        cfg = self.bridge.original_model.config
        # Transformers 5 no longer retains _commit_hash on GPT2Config. Verify the
        # actual pinned Hub snapshot instead of inventing that removed attribute.
        config_path = Path(hf_hub_download(MODEL_ID, "config.json", revision=REVISION))
        weight_path = Path(hf_hub_download(MODEL_ID, "model.safetensors", revision=REVISION))
        tokenizer_path = Path(hf_hub_download(MODEL_ID, "tokenizer.json", revision=REVISION))
        if any(p.parent.name != REVISION for p in [config_path, weight_path, tokenizer_path]):
            raise RuntimeError("Model/tokenizer snapshot revision mismatch")
        self.info = ModelInfo(
            id=MODEL_ID,
            revision=REVISION,
            tokenizer_revision=REVISION,
            model_type=cfg.model_type,
            layers=cfg.n_layer,
            heads=cfg.n_head,
            hidden_size=cfg.n_embd,
            intermediate_size=cfg.n_inner or 4 * cfg.n_embd,
            vocab_size=cfg.vocab_size,
            context_length=cfg.n_positions,
            # Public bridge property counts the raw model before instrumentation
            # adds Q/K/V component views; summing afterward double-counts them.
            parameter_count=self.bridge.n_params_total,
            activation_function=cfg.activation_function,
            layer_norm_epsilon=cfg.layer_norm_epsilon,
            tied_embeddings=cfg.tie_word_embeddings,
        )
        self.config_digest = hashlib.sha256(config_path.read_bytes()).hexdigest()
        self.attn_hooks = [f"blocks.{i}.attn.hook_pattern" for i in range(self.info.layers)]
        self.residual_hooks = ["embed.hook_out", "pos_embed.hook_out"]
        self.residual_hooks += [f"blocks.{i}.hook_out" for i in range(self.info.layers)]
        self.residual_hooks += ["ln_final.hook_out"]
        for name in self.attn_hooks + self.residual_hooks:
            if name not in self.bridge.hook_dict:
                raise RuntimeError(f"Required hook unavailable: {name}")
        self._byte_decoder = byte_decoder()
        self.code_sha256 = code_digest()

    def tokenize(self, text: str) -> torch.Tensor:
        if not isinstance(text, str) or not text.strip():
            raise AnalysisError("empty_text", "请输入非空文本。")
        if len(text.encode("utf-8")) > 8192:
            raise AnalysisError("input_too_large", "输入最多为 8192 UTF-8 字节。", 413)
        ids = self.tokenizer(text, add_special_tokens=False, return_tensors="pt")["input_ids"]
        if ids.shape[1] > self.max_tokens:
            raise AnalysisError(
                "token_limit",
                f"实际分词为 {ids.shape[1]} 个 Token，上限 {self.max_tokens}；输入未被截断。",
            )
        return ids.to(self.device)

    def analyze(self, text: str, source_mode: str = "live", top_k: int = 8) -> Analysis:
        if not 1 <= top_k <= 20:
            raise AnalysisError("invalid_top_k", "top_k 必须为 1 至 20。")
        ids = self.tokenize(text)
        n = ids.shape[1]
        start = time.perf_counter()
        with torch.inference_mode():
            logits, cache = self.bridge.run_with_cache(
                ids,
                names_filter=self.attn_hooks + self.residual_hooks,
                return_cache_object=False,
                prepend_bos=False,
            )
        inference_ms = (time.perf_counter() - start) * 1000
        start = time.perf_counter()
        attention = torch.stack([cache[h][0] for h in self.attn_hooks]).cpu().numpy()
        digest = hashlib.sha256()
        digest.update(attention.astype("<f4").tobytes())
        digest.update(logits.cpu().numpy().astype("<f4").tobytes())
        summaries = []
        for j, hook in enumerate(self.residual_hooks):
            t = cache[hook].float().cpu()
            if t.shape != (1, n, self.info.hidden_size):
                raise RuntimeError(f"Unexpected {hook} shape {t.shape}")
            digest.update(t.numpy().astype("<f4").tobytes())
            layer = j - 2 if 2 <= j < self.info.layers + 2 else None
            sid = (
                f"block-{layer}"
                if layer is not None
                else ["embedding", "position", "final-norm"][0 if j == 0 else 1 if j == 1 else 2]
            )
            summaries.append(
                {
                    "id": sid,
                    "layer": layer,
                    "hook": hook,
                    "location": "post-block residual (after MLP addition)"
                    if layer is not None
                    else sid,
                    "tensor_shape": list(t.shape),
                    "l2": t.norm(dim=-1)[0].tolist(),
                    "rms": t.square().mean(dim=-1).sqrt()[0].tolist(),
                }
            )
        tokens = []
        for position, token_id in enumerate(ids[0].tolist()):
            piece = self.tokenizer.convert_ids_to_tokens(token_id)
            decoded = self.tokenizer.decode([token_id], clean_up_tokenization_spaces=False)
            raw_bytes = bytes(self._byte_decoder[c] for c in piece)
            tokens.append(
                {
                    "position": position,
                    "id": token_id,
                    "text": decoded,
                    "display": visible(decoded),
                    "raw_piece": piece,
                    "byte_hex": raw_bytes.hex(),
                    "is_special": token_id in self.tokenizer.all_special_ids,
                }
            )
        probs = torch.softmax(logits[0].float(), dim=-1)
        values, indices = probs.topk(top_k, dim=-1)
        predictions = []
        for position in range(n):
            candidates = []
            for prob, idx in zip(
                values[position].tolist(), indices[position].tolist(), strict=True
            ):
                decoded = self.tokenizer.decode([idx], clean_up_tokenization_spaces=False)
                candidates.append(
                    {
                        "id": idx,
                        "text": decoded,
                        "display": visible(decoded),
                        "logit": float(logits[0, position, idx]),
                        "probability": prob,
                    }
                )
            predictions.append(
                {
                    "position": position,
                    "candidates": candidates,
                    "remaining_probability": max(0, 1 - sum(c["probability"] for c in candidates)),
                }
            )
        payload = {
            "schema_version": "origin.analysis.v1",
            "analysis_id": "gpt2-"
            + hashlib.sha256((text + REVISION + str(top_k)).encode()).hexdigest()[:16],
            "source_mode": source_mode,
            "input": {
                "text": text,
                "sequence_length": n,
                "add_special_tokens": False,
                "bos_inserted": False,
                "bos_token_id": self.tokenizer.bos_token_id,
                "tokenization": "byte-level BPE",
            },
            "model": self.info,
            "runtime": {
                "backend": "transformer_lens.TransformerBridge",
                "device": self.device,
                "dtype": "float32",
                "eval_mode": True,
                "inference_mode": True,
                "attention_implementation": "eager",
                "max_tokens": self.max_tokens,
                "cpu_threads": self.cpu_threads,
                "model_load_ms": self.load_ms,
                "inference_ms": inference_ms,
                "serialization_ms": 0,
                "process_rss_mb": psutil.Process().memory_info().rss / 1024**2,
                "cache_hit": False,
            },
            "tokens": tokens,
            "architecture": build_architecture(self.info, n),
            "attention": {
                "axes": ["layer", "head", "query", "key"],
                "shape": list(attention.shape),
                "values": np.round(attention.astype(np.float64), 8).tolist(),
                "hooks": self.attn_hooks,
                "precision": "float32, rounded to 8 decimal places",
                "causal": True,
            },
            "activation_summaries": summaries,
            "next_token_predictions": {
                "distribution": "softmax over full vocabulary, temperature=1, no sampling",
                "top_k": top_k,
                "by_position": predictions,
            },
            "provenance": {
                "generated_at": datetime.now(UTC).isoformat(),
                "analysis_code_version": CODE_VERSION,
                "analysis_code_sha256": self.code_sha256,
                "dependencies": {
                    p: metadata.version(p)
                    for p in [
                        "torch",
                        "transformers",
                        "transformer-lens",
                        "numpy",
                        "tokenizers",
                        "huggingface-hub",
                        "pydantic",
                    ]
                },
                "model_config_sha256": self.config_digest,
                "tensor_sha256": digest.hexdigest(),
                "checksum_definition": "SHA256 of little-endian float32 attention, raw logits, and cached residuals in hook order",
                "index_base": 0,
                "rounding_decimals": 8,
                "validation": "schema + finite + shape + normalization + causal mask + byte reconstruction",
                "model_license": "MIT",
            },
        }
        data = Analysis.model_validate(payload)
        validate_analysis(data)
        data.model_dump_json()  # Measure actual serialization as part of the recorded cost.
        data.runtime.serialization_ms = (time.perf_counter() - start) * 1000
        return data
