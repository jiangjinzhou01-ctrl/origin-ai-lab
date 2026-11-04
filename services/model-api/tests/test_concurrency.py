from concurrent.futures import ThreadPoolExecutor
from threading import Event

from fastapi.testclient import TestClient

from app.main import create_app


def test_inference_lock_rejects_concurrent_work_and_recovers(analysis):
    entered, release = Event(), Event()

    class SlowTestEngine:
        max_tokens = 64
        info = analysis.model

        def analyze(self, text, mode, top_k):
            entered.set()
            if not release.wait(timeout=5):
                raise RuntimeError("test release missing")
            result = analysis.model_copy(deep=True)
            result.source_mode = mode
            return result

    app = create_app(None)
    app.state.engine = SlowTestEngine()
    app.state.status = "ready"
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(client.post, "/api/analyze", json={"text": "first"})
        try:
            assert entered.wait(timeout=3)
            second = client.post("/api/analyze", json={"text": "second"})
            assert second.status_code == 429
            assert second.json()["error"]["code"] == "busy"
            assert client.get("/api/health").json()["busy"]
        finally:
            release.set()
        assert first.result(timeout=5).status_code == 200
        assert not client.get("/api/health").json()["busy"]
        assert client.post("/api/analyze", json={"text": "third"}).status_code == 200
