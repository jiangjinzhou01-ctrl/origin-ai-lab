# ORIGIN V1.0 最终交付与 P0 验收

结论：**本地可验证的 P0 功能、工程与静态部署准备已完成。** 真实模型、三组静态实验、实时 API、前端与手机核心交互均有实际测试结果。远程发布未执行；P1 Comparison Lab 未实现。

## 1. 完成情况

| 范围 | 实际结果与依据 |
| --- | --- |
| 真实 GPT-2 加载 / 前向 | 通过；独立 Phase 0 记录和 4 项真实模型集成测试 |
| Token / 特殊 Token / BOS | 通过；Byte-level BPE、ID Tensor、UTF-8 重建及 Unicode / 特殊 Token 集成 |
| 真实 Attention / 预测 / 激活摘要 | 通过；数值验证、独立 HF eager 对照、L2/RMS 定义、完整词表 Softmax |
| 静态实验与 Provenance | 通过；三个真实实验、固定 Revision、代码 / 文件 / 张量哈希、Manifest |
| 首页与实验选择 | 通过；桌面、手机 E2E 与实际截图 |
| 模型 → Block → Component → Head / Matrix | 通过；稳定组件 ID、共享 Layer / Head 状态、二维替代及镜头聚焦 |
| Layer / Head / Token / Query / Key | 通过；矩阵标签和真实指定值断言；非法索引拒绝，换实验后归一化 |
| Attention Matrix / Causal Mask / 关联图 | 通过；明确行列轴、数值 Tooltip、0–1 色阶、同源关系及显示阈值 |
| 预测概率 / Logits / 剩余质量 | 通过；所有 Token 位置都有记录，UI 提供 ID 与 Logit 表 |
| 推理回放 | 通过；28 步，播放 / 暂停 / 前后 / 重置 / 定位，每步显示对应真实记录；明示非实时逐层推理 |
| 实时分析 / 故障恢复 | 通过；真实短文本与 64 Token E2E；断开 API 不伪造成功，可恢复静态实验 |
| 类型 / Lint / 构建 / 单元 | 通过；严格 TS 覆盖应用、单元和 E2E 源码；24 个前端、36 个后端测试 |
| E2E | 真实 API 14 项通过；Python 停止后的子路径静态 10 项通过，4 项实时专用明确跳过 |
| 资源与性能 | 按需渲染、事件 / tween / 定时器清理；稳定后 2 秒 0 WebGL draw calls；5 轮导航 GC 后 heap +2.07 MB，未宣称长期无泄漏 |
| 桌面 / 手机 / 无溢出 | 通过；1440×1000 与 390×844 触控视口；矩阵内部滚动不扩大页面 |
| WebGL 不可用 / 降低动态效果 | 通过；核心分析可在二维完成，不依赖 Hover |
| 文字与非三维读取 | 通过；可访问控件、焦点、键盘移动、行数据表、说明、9 组基础对比度 ≥5.49，矩阵 101 色阶 ≥4.5 |
| 静态部署 | 构建与 `/origin-ai-lab/` 真实 HTTP 子路径检查通过，JS / CSS / 实验 / favicon / 许可文本及 Hash 刷新已检查 |
| 部署工作流与文档 | 完成；README、架构、方法、来源、部署、测试、性能、许可证与本报告 |

上述结论不把远程云部署或物理手机性能计为已验证。项目没有以这些外部环境的缺失替换或降低模型真实性与本地验收标准。

## 2. 技术实现

- React 19.3.1、TypeScript 5.9.3 strict、Vite 8.3.5、Three.js 0.181.2、R3F 9.8.2、Drei 10.7.7、GSAP 3.14.2、Zustand 5.0.8。
- Python 3.12.14、PyTorch 2.10.0+cpu、Transformers 5.22.1、TransformerLens 4.3.0、FastAPI 0.141.1、Pydantic 2.13.4。
- 模型 `openai-community/gpt2@607a30d783dfa663caf39e06633721c8d4cfcd7e`；同一 Tokenizer Revision。
- 实际使用 `TransformerBridge.boot_transformers` / `run_with_cache`，未使用旧 HookedTransformer，也未伪装回退后端。
- Attention Hook：`blocks.{i}.attn.hook_pattern`；Residual：`blocks.{i}.hook_out`。只采集所需 Hook，统计位置均有明确记录。
- `origin.analysis.v1`：Pydantic 单一来源 → JSON Schema → 生成 TypeScript；静态与实时同一结构，前后端均验证。
- CPU、eval、无梯度、eager、最多 64 实际 Token；API 单计算锁、请求大小、超时、白名单、限流、复用模型和有界内存缓存。

## 3. 实际命令与结果

```text
uv sync --frozen                                           成功，97 个锁定 Python 包
PYTHONPATH=. uv run python scripts/verify_model.py           真实模型与 Hook 验证成功
PYTHONPATH=. uv run python scripts/export_schema.py          成功
PYTHONPATH=. uv run python scripts/generate_fixtures.py      三个真实实验成功
uv run pytest -q                                           36 passed
uv run ruff check app tests scripts                         通过
uv run ruff format --check app tests scripts                通过
npm ci                                                     成功
npm run schema:types                                       成功
npm run check                                              通过
npm run lint                                               通过
npm test                                                   24 passed
VITE_BASE_PATH=/origin-ai-lab/ npm run build                 成功
ORIGIN_LIVE_TEST=1 npm run test:e2e                          14 passed，0 skipped
ORIGIN_TEST_URL=http://127.0.0.1:4180/origin-ai-lab/ ...      10 passed，4 实时专用 skipped
npm audit                                                  0 已知漏洞
```

模型命令在 `services/model-api/` 执行；完整浏览器命令见测试文档。最终检查包含当前 fixture 的分析代码 SHA-256 与当前 app/ 源码一致、生成协议一致、工作流 YAML 解析、文件完整性和浏览器控制台 / 资源失败。

实测共享 Linux 环境 3 个可见 CPU，模型设 2 线程；HTTP 的 5 / 16 / 64 Token 前向中位数为 261 / 485 / 425 ms，完整 HTTP 中位数 293 / 514 / 702 ms，负载不隔离。正式短英文 fixture 的另次前向为 87–103 ms。64 Token JSON 约 4.45 MB，RSS 约 1.03–1.16 GB。详细方法、缓存未体现 HTTP 提速的事实、浏览器测量及原始 JSON 均见 performance.md。

## 4. 访问方式

```bash
cd /workspace/origin-ai-lab
npm ci
npm run dev
# http://127.0.0.1:5173/

cd services/model-api
uv sync --frozen
HF_HUB_DISABLE_XET=1 uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
# health: http://127.0.0.1:8000/api/health
```

静态子路径模拟：仓库根目录 `VITE_BASE_PATH=/origin-ai-lab/ npm run build`，再执行 `python scripts/serve-pages.py`，访问 `http://127.0.0.1:4180/origin-ai-lab/`。这些是本执行环境中实际检查过的本地地址，不能解释为公网部署地址。

## 5. 文件与 Git

独立项目目录 `/workspace/origin-ai-lab`，本地分支 `main`。未触碰其他项目，未配置或推送远程仓库。交付采用本地提交，确切提交 ID 和最终状态由终端最终报告给出。

关键入口：`apps/web/src/App.tsx`、`features/`、`store/lab.ts`、`visualization/AttentionMatrix.tsx`、`scenes/SpatialScene.tsx`；后端 `app/analysis/engine.py`、`validation.py`、`serializers/schema.py`、`main.py`；导出 `scripts/generate_fixtures.py`；共享协议 `schemas/origin.analysis.v1.json`。两套测试、依赖锁和三份部署 / CI 工作流均包含在源码中。

尚需仓库拥有者决定的外部操作只有：选择远程仓库、推送、启用 Pages 并运行发布，以及提供真实 API 的部署主机和 HTTPS 配置。没有为这些操作擅自创建资源，也没有把配置完成称为部署成功。

## 6. 已知限制与未运行范围

- P1 Comparison Lab 未实现，不显示无功能的 Compare 导航。
- 三维代码块较大，约 975 KB / gzip 272 KB；已懒加载并保留构建体积提示。
- 物理手机、Safari / Firefox、GPU、其他操作系统、真实公网 API 与 GitHub Actions 远程执行未验证；未编造 FPS 或 Lighthouse 分数。
- 内置限流 / 模型锁 / 缓存仅覆盖单进程。公开 API 需要 TLS、网关配额和运营配置。
- 64 Token 最大响应约 4.45 MB；缓存目前避免计算但深拷贝 / JSON 仍有成本，实测不保证端到端更快。
- minimatch 有意安全 override 超出上游声明范围，已通过锁文件重装与实际工具测试；后续升级应重新确认。
- 当前没有已知阻断本地 P0 使用的问题。短期 GC 与空闲渲染检查不能证明长期绝无资源增长。

## 7. 后续升级

先实施 P1 的并排实验比较，并明确不同 Token 数量 / 位置的对齐规则。再优化不可变结果与编码响应缓存，补充物理手机与多浏览器性能回归。任何因果干预功能应在额外科学验证后单独设计，不把当前注意力观察升级叙述为因果解释。
