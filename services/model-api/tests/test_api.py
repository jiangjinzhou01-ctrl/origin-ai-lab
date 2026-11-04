import pytest
from fastapi.testclient import TestClient

from app.analysis.engine import AnalysisError
from app.main import create_app


@pytest.fixture
def client(analysis):
    # Explicit test double only: API transport tests reuse a verified fixture.
    class TestEngine:
        max_tokens = 64
        info = analysis.model

        def analyze(self, text, source, top_k):
            if text == "fail":
                raise RuntimeError("unit test failure")
            if text == "over-limit":
                raise AnalysisError("token_limit", "Token 超出上限")
            value = analysis.model_copy(deep=True)
            value.source_mode = source
            return value

    app = create_app(None)
    app.state.engine = TestEngine()
    app.state.status = "ready"
    with TestClient(app) as c:
        yield c


def test_health_models(client):
    assert client.get("/api/health").json()["model_ready"]
    assert client.get("/api/models").json()["models"][0]["config"]["layers"] == 12


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": ""},
        {"text": "  "},
        {"text": 3},
        {"text": "hi", "model_id": "../../evil"},
        {"text": "hi", "top_k": 0},
        {"text": "hi", "extra": True},
    ],
)
def test_invalid_request(client, body):
    response = client.post("/api/analyze", json=body)
    assert response.status_code == 422
    assert "error" in response.json()


def test_success_and_bounded_cache(client):
    first = client.post("/api/analyze", json={"text": "The cat sat on the"})
    assert first.status_code == 200
    assert first.json()["source_mode"] == "live"
    cached = client.post("/api/analyze", json={"text": "The cat sat on the"})
    assert cached.json()["runtime"]["cache_hit"]


def test_unavailable():
    with TestClient(create_app(None)) as c:
        assert not c.get("/api/health").json()["model_ready"]
        assert c.post("/api/analyze", json={"text": "hi"}).status_code == 503


@pytest.mark.parametrize(
    "text,status,code", [("fail", 500, "inference_failed"), ("over-limit", 422, "token_limit")]
)
def test_structured_failure(client, text, status, code):
    response = client.post("/api/analyze", json={"text": text})
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_request_size_and_rate_limit(client, monkeypatch):
    assert client.post("/api/analyze", content=b"x" * 17000).status_code == 413
    monkeypatch.setenv("ORIGIN_RATE_LIMIT", "1")
    assert client.post("/api/analyze", json={"text": "a"}).status_code == 200
    assert client.post("/api/analyze", json={"text": "b"}).status_code == 429


def test_cors(client):
    assert (
        client.options(
            "/api/analyze",
            headers={
                "Origin": "https://untrusted.invalid",
                "Access-Control-Request-Method": "POST",
            },
        ).status_code
        == 400
    )
    assert (
        client.options(
            "/api/analyze",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
        ).status_code
        == 200
    )
