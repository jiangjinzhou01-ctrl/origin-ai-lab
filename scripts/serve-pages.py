"""Serve a built static site under a repository subpath, without an API."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4180)
parser.add_argument("--base", default="origin-ai-lab")
args = parser.parse_args()
dist = Path(__file__).resolve().parents[1] / "apps/web/dist"
base = f"/{args.base.strip('/')}/"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Use the standard handler's normalized path resolution inside dist.
        if path.startswith(base):
            return super().translate_path(path[len(base) - 1:])
        return str(dist / "__not_found__")


print(f"Static laboratory: http://127.0.0.1:{args.port}{base}", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), lambda *a, **kw: Handler(*a, directory=str(dist), **kw)).serve_forever()
