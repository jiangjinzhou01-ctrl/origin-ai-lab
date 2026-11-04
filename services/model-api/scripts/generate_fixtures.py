"""Run actual pinned weights; verify and export small, independently usable experiments."""

import argparse
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from app.analysis.engine import ModelEngine

ROOT = Path(__file__).resolve().parents[3]
EXPERIMENTS = [
    ("language", "语言的下一步", "The cat sat on the", "一个短句，观察上下文如何分配注意力。"),
    ("sunset", "日落之后", "When the sun goes down", "从条件从句观察序列中的位置与关系。"),
    (
        "intelligence",
        "关于智能",
        "Artificial intelligence can",
        "Byte-level BPE 如何拆分一个抽象概念。",
    ),
]


def generate(output: Path, limit: int = 3) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    schema = json.loads((ROOT / "schemas/origin.analysis.v1.json").read_text())
    engine = ModelEngine()
    manifest = {"schema_version": "origin.manifest.v1", "experiments": []}
    for slug, title, text, description in EXPERIMENTS[:limit]:
        data = engine.analyze(text, source_mode="static")
        Draft202012Validator(schema).validate(data.model_dump(mode="json"))
        raw = data.model_dump_json().encode()
        (output / f"{slug}.json").write_bytes(raw)
        manifest["experiments"].append(
            {
                "id": slug,
                "title": title,
                "description": description,
                "text": text,
                "path": f"{slug}.json",
                "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "tokens": data.input.sequence_length,
            }
        )
        print(
            f"{slug}: {data.input.sequence_length} tokens, {len(raw)} bytes, {data.runtime.inference_ms:.1f} ms",
            flush=True,
        )
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "apps/web/public/data")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()
    generate(args.output, args.limit)
