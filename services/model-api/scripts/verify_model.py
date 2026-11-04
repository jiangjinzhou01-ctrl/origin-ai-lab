"""Independent Phase 0 probe. No fixtures or simulated model data."""

import json
import time
from importlib import metadata
from pathlib import Path

import torch
from transformer_lens.model_bridge import TransformerBridge

MODEL = "openai-community/gpt2"
REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e"
torch.set_num_threads(2)
start = time.perf_counter()
bridge = TransformerBridge.boot_transformers(MODEL, revision=REVISION, device="cpu")
bridge.eval()
load_seconds = time.perf_counter() - start
print("loaded", round(load_seconds, 3), flush=True)
tokenizer = bridge.tokenizer
text = "The cat sat on the"
ids = tokenizer(text, add_special_tokens=False, return_tensors="pt")["input_ids"]
bridge_ids = bridge.to_tokens(text, prepend_bos=False)
assert torch.equal(ids, bridge_ids)
n_layers = bridge.cfg.n_layers
required = [f"blocks.{i}.attn.hook_pattern" for i in range(n_layers)]
required += [f"blocks.{i}.hook_out" for i in range(n_layers)]
missing = [name for name in required if name not in bridge.hook_dict]
assert not missing, missing
start = time.perf_counter()
with torch.inference_mode():
    logits, cache = bridge.run_with_cache(ids, names_filter=required, return_cache_object=False)
    logits2, cache2 = bridge.run_with_cache(ids, names_filter=required, return_cache_object=False)
assert torch.equal(logits, logits2)
assert logits.shape[:2] == ids.shape
for i in range(n_layers):
    attention = cache[f"blocks.{i}.attn.hook_pattern"]
    residual = cache[f"blocks.{i}.hook_out"]
    assert attention.shape == (1, bridge.cfg.n_heads, ids.shape[1], ids.shape[1])
    assert residual.shape == (1, ids.shape[1], bridge.cfg.d_model)
    assert torch.isfinite(attention).all() and torch.isfinite(residual).all()
    assert torch.allclose(attention.sum(-1), torch.ones_like(attention.sum(-1)), atol=1e-5)
    assert torch.triu(attention, diagonal=1).abs().max() < 1e-7
    assert torch.equal(residual, cache2[f"blocks.{i}.hook_out"])
report = {
    "model_id": MODEL,
    "revision": REVISION,
    "backend": "transformer_lens.TransformerBridge",
    "versions": {
        name: metadata.version(name) for name in ["torch", "transformers", "transformer-lens"]
    },
    "load_seconds": load_seconds,
    "two_forwards_seconds": time.perf_counter() - start,
    "input": text,
    "token_ids": ids[0].tolist(),
    "decoded_tokens": [
        tokenizer.decode([int(x)], clean_up_tokenization_spaces=False) for x in ids[0]
    ],
    "bos_id": tokenizer.bos_token_id,
    "bos_inserted": False,
    "default_bridge_bos_tokens": bridge.to_tokens(text).tolist(),
    "config": {"layers": n_layers, "heads": bridge.cfg.n_heads, "hidden_size": bridge.cfg.d_model},
    "logits_shape": list(logits.shape),
    "attention_shape": list(attention.shape),
    "residual_shape": list(residual.shape),
    "verified_hooks": required,
    "repeat_exact": True,
    "causal_mask_valid": True,
    "rows_normalized": True,
    "available_embedding_hooks": [
        name for name in bridge.hook_dict if "embed" in name or "ln_final" in name
    ],
    "top_prediction_id": int(logits[0, -1].argmax()),
}
path = Path("../../docs/phase-0-model-verification.json")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2), flush=True)
