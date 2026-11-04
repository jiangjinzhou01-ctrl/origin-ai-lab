# 部署

本交付完成本地应用、可部署产物和静态子路径模拟。后续用户已授权 GitHub 发布，源码已推送至 `jiangjinzhou01-ctrl/origin-ai-lab`，云端完整 CI 已通过。目前 Pages 首次启用被 GitHub 令牌权限阻止；网站尚未上线。详细实测记录见 github-deployment.md。

## 本地静态模式

```bash
npm ci
npm run dev
```

前端默认 loopback `http://127.0.0.1:5173/`。无需 Python。生产构建 `npm run build`，部署 `apps/web/dist/` 到标准静态服务器。支持 `#home`、`#explore`、`#architecture`、`#about`，刷新不会要求服务端解析子路由。

## 仓库子路径模拟

```bash
VITE_BASE_PATH=/origin-ai-lab/ npm run build
python scripts/serve-pages.py
ORIGIN_TEST_URL=http://127.0.0.1:4180/origin-ai-lab/ npm run test:e2e
```

该服务器只提供静态文件，不代理 API。Vite 会把 JS、CSS、favicon 和实验路径加上同一前缀。更改 base 后必须重新构建；不要把子路径产物放到根路径并期望相对资源自动修复。

## GitHub Pages

1. 用户选择或创建自己的远程仓库，并将本地已检查的代码推送过去。
2. 仓库 Settings → Pages 将构建来源设为 GitHub Actions。
3. 手动运行 `.github/workflows/pages.yml`。
4. 工作流自动根据实际仓库名称设置 VITE_BASE_PATH；`*.github.io` 仓库使用根路径。
5. Actions 成功后以实际 deployment output 的 page_url 为准。工作流配置本身不代表发布成功。

Pages 只运行静态内容，不运行 Python。默认使用预计算模式，不需要任何密钥。未配置 HTTPS 实时 API 时，保留静态模式即可。

## 本地实时 API

```bash
cd services/model-api
uv sync --frozen
HF_HUB_DISABLE_XET=1 uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

首次加载需网络与约 0.55 GB 的权重缓存，依赖和虚拟环境还需要额外磁盘。之后会复用 Hugging Face 缓存。`/api/health` 返回 ready 后可分析。`/api/models` 返回固定模型及实际配置，`/docs` 为 OpenAPI 文档。

FastAPI 模型在后台加载，服务健康响应不意味着模型已就绪，必须检查 `model_ready`。输入限制在真实 Tokenizer 后执行。不接受任意模型名、路径或 URL。

| 环境变量 | 默认值 / 说明 |
| --- | --- |
| ORIGIN_DEVICE | cpu；GPU 路径尚未在本交付验证 |
| ORIGIN_CPU_THREADS | 2 |
| ORIGIN_MAX_TOKENS | 64，可调低，不可突破协议的 64 上限 |
| ORIGIN_RATE_LIMIT | 每客户端每分钟 12 次，单进程 |
| ORIGIN_CORS_ORIGINS | http://localhost:5173,http://127.0.0.1:5173；不允许 `*` |
| VITE_API_URL | 前端构建时变量，默认 http://127.0.0.1:8000 |

使用 shell 环境变量或进程管理器传入后端配置；`.env.example` 是示例，API 不会自动加载它。Vite 的 `.env.local` 在 `apps/web/` 中生效，不能把私钥放在任何 VITE_ 变量中。

## 公开实时 API 的部署边界

使用独立 Linux 主机 / 容器、至少 2 GB 可用内存和持久模型缓存。V1 每进程一份模型；不要直接增加 Uvicorn workers 来扩大并发，否则会复制权重并绕过单进程资源配额。

生产入口应提供 HTTPS、精确的前端 Origin 白名单、网关级速率与请求体限制、整体 CPU / 内存配额、服务监控。反向代理设置 60 秒左右的 HTTP 超时，API 本身等待推理最多 45 秒。不要在公开日志里记录 POST 正文，不把输入写进 URL。内存缓存会短暂保留最多 8 组输入及结果，服务重启清空；需要更严格隐私策略时再增加关闭缓存配置。

HTTPS 页面不能连接普通 HTTP 后端；部署实时前端时必须设置 HTTPS 的 VITE_API_URL 并重建。没有进行任何云端真实 API 部署，也没有将本地 dev server 公开到公网。

## CI

- `ci.yml`：类型、Lint、单元、生成协议一致性、静态 E2E。
- `model-integration.yml`：手动 / 每周运行真实模型集成、启动真实 API 再运行实时 E2E。
- `pages.yml`：显式手动发布静态版本。

完整 CI 已在 GitHub 成功执行；Pages 工作流的检查和构建通过，但首次启用 Pages 的操作被 GitHub 拒绝。仓库 Settings → Pages 的 Source 设为 GitHub Actions 后，可再次运行发布工作流。
