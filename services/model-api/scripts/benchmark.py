"""Reproducible real-model benchmark, with environment and payload sizes."""

import gzip
import json
import platform
import statistics
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]


def main():
    result = {
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "logical_cpus": __import__("os").cpu_count(),
            "device": "cpu",
            "threads": 2,
        },
        "method": "HTTP to a reused local model process. Three uncached distinct prompts per size; no GPU. Timing includes actual JSON transfer. Cache time measured separately.",
        "measurements": [],
    }
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=60) as client:
        for n in [5, 16, 64]:
            samples = []
            for i, word in enumerate(["word", "tree", "sky"]):
                text = (" " + word) * n
                start = time.perf_counter()
                response = client.post("/api/analyze", json={"text": text})
                wall = (time.perf_counter() - start) * 1000
                response.raise_for_status()
                data = response.json()
                if data["runtime"]["cache_hit"]:
                    raise RuntimeError(
                        "Restart API before benchmarking to avoid warmed response cache"
                    )
                assert data["input"]["sequence_length"] == n
                samples.append(
                    {
                        "wall_ms": wall,
                        "inference_ms": data["runtime"]["inference_ms"],
                        "serialization_validation_ms": data["runtime"]["serialization_ms"],
                        "bytes": len(response.content),
                        "gzip_bytes": len(gzip.compress(response.content)),
                        "rss_mb": data["runtime"]["process_rss_mb"],
                    }
                )
            result["model_load_ms"] = data["runtime"]["model_load_ms"]
            result["measurements"].append(
                {
                    "tokens": n,
                    "samples": samples,
                    "median_inference_ms": statistics.median(s["inference_ms"] for s in samples),
                    "median_wall_ms": statistics.median(s["wall_ms"] for s in samples),
                }
            )
            print(n, result["measurements"][-1]["median_wall_ms"], flush=True)
        start = time.perf_counter()
        cached = client.post("/api/analyze", json={"text": text})
        result["cached_64_tokens_wall_ms"] = (time.perf_counter() - start) * 1000
        assert cached.json()["runtime"]["cache_hit"]
    (ROOT / "docs/backend-performance.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
