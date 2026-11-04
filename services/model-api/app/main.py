"""Bounded, local-first HTTP API. Model loading and inference never block the event loop."""

import asyncio
import logging
import os
import time
from collections import OrderedDict, deque
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.analysis.engine import MODEL_ID, REVISION, AnalysisError, ModelEngine
from app.serializers.schema import Analysis

logger = logging.getLogger("origin")


def error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class BodyLimit:
    def __init__(self, app, limit: int = 16384):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            chunk = await receive()
            if chunk["type"] == "http.disconnect":
                return
            body.extend(chunk.get("body", b""))
            if len(body) > self.limit:
                response = error("request_too_large", "请求体超过 16 KiB。", 413)
                return await response(scope, receive, send)
            if not chunk.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=1, max_length=8192)
    model_id: Literal["openai-community/gpt2"] = MODEL_ID
    top_k: int = Field(default=8, ge=1, le=20)


def create_app(engine_factory: Callable | None = ModelEngine) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        async def load():
            try:
                app.state.engine = await asyncio.to_thread(engine_factory)
                app.state.status = "ready"
            except Exception:
                logger.exception("Model initialization failed")
                app.state.status = "error"

        load_task = asyncio.create_task(load()) if engine_factory else None
        yield
        if load_task:
            await load_task
        if app.state.tasks:
            await asyncio.gather(*app.state.tasks, return_exceptions=True)
        app.state.cache.clear()

    app = FastAPI(title="ORIGIN model analysis", version="1.0.0", lifespan=lifespan)
    app.state.engine = None
    app.state.status = "loading" if engine_factory else "unavailable"
    app.state.lock = asyncio.Lock()
    app.state.cache = OrderedDict()
    app.state.tasks = set()
    app.state.requests = {}
    app.add_middleware(BodyLimit)
    origins = [
        x.strip()
        for x in os.getenv(
            "ORIGIN_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if x.strip()
    ]
    if "*" in origins:
        raise ValueError("ORIGIN_CORS_ORIGINS must be an explicit allowlist")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Do not echo validation inputs: they may contain private user text.
        return error(
            "invalid_request",
            "请求格式无效。仅支持 GPT-2；text 为非空字符串，top_k 为 1–20 的整数。",
            422,
        )

    @app.get("/api/health")
    async def health():
        return {
            "status": app.state.status,
            "model_ready": app.state.engine is not None,
            "version": "1.0.0",
            "schema_version": "origin.analysis.v1",
            "busy": app.state.lock.locked(),
        }

    @app.get("/api/models")
    async def models():
        engine = app.state.engine
        return {
            "models": [
                {
                    "id": MODEL_ID,
                    "revision": REVISION,
                    "status": app.state.status,
                    "max_tokens": engine.max_tokens if engine else 64,
                    "config": engine.info.model_dump() if engine else None,
                }
            ]
        }

    @app.post("/api/analyze", response_model=Analysis)
    async def analyze(body: AnalyzeRequest, request: Request):
        engine = app.state.engine
        if engine is None:
            return error("model_not_ready", "模型尚未就绪。可继续使用预计算实验，稍后重试。", 503)
        if not body.text.strip():
            return error("empty_text", "请输入非空文本。", 422)
        now = time.monotonic()
        buckets = app.state.requests
        for host in list(buckets):
            if not buckets[host] or now - buckets[host][-1] > 60:
                del buckets[host]
        host = request.client.host if request.client else "local"
        bucket = buckets.setdefault(host, deque())
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= max(1, int(os.getenv("ORIGIN_RATE_LIMIT", "12"))):
            return error("rate_limit", "每分钟请求次数已达上限，请稍后重试。", 429)
        bucket.append(now)
        key = (body.text, body.top_k)
        if key in app.state.cache:
            data = app.state.cache[key].model_copy(deep=True)
            app.state.cache.move_to_end(key)
            data.runtime.cache_hit = True
            return data
        if app.state.lock.locked():
            return error("busy", "模型正在分析另一个请求，请稍后重试。", 429)
        await app.state.lock.acquire()

        async def compute():
            try:
                data = await asyncio.to_thread(engine.analyze, body.text, "live", body.top_k)
                app.state.cache[key] = data
                if len(app.state.cache) > 8:
                    app.state.cache.popitem(last=False)
                return data
            finally:
                app.state.lock.release()

        task = asyncio.create_task(compute())
        app.state.tasks.add(task)

        def finish(t):
            app.state.tasks.discard(t)
            if not t.cancelled():
                t.exception()  # Consume exceptions even if the HTTP request timed out/disconnected.

        task.add_done_callback(finish)
        try:
            return await asyncio.wait_for(asyncio.shield(task), timeout=45)
        except TimeoutError:
            return error(
                "analysis_timeout", "分析超过 45 秒；正在完成的任务仍占用计算锁，请稍后重试。", 504
            )
        except AnalysisError as exc:
            return error(exc.code, exc.message, exc.status)
        except Exception:
            logger.exception("Analysis failed")
            return error(
                "inference_failed", "模型计算失败，未生成分析数据。请重试或选择预计算实验。", 500
            )

    return app


app = create_app()
