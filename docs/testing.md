# 实际测试记录

本记录只包含实际执行的结果。完整 P0 对照见 acceptance.md；性能原始结果另存 JSON。

## 环境

Linux x86_64，3 个可见逻辑 CPU、约 9.7 GiB 内存；Python 3.12.14 / uv 0.13.4；Node.js 24.22.1 / npm 11.9.0。浏览器使用环境提供的 Chromium，Playwright 1.64.1。桌面 1440×1000，手机 390×844 的 Chromium 触控模拟。真实 GPT-2 在 CPU / 2 线程上执行，没有 GPU。

## 已执行并通过

| 检查 | 命令 | 实际结果 |
| --- | --- | --- |
| 独立技术验证 | `PYTHONPATH=. HF_HUB_DISABLE_XET=1 uv run python scripts/verify_model.py` | 真实权重、全部 Hook、BOS、维度、因果遮罩、归一化、重复结果通过 |
| 静态导出 | `PYTHONPATH=. HF_HUB_DISABLE_XET=1 uv run python scripts/generate_fixtures.py` | 三个真实实验与 Manifest 生成成功 |
| Python 完整测试 | `HF_HUB_DISABLE_XET=1 uv run pytest -q` | 36 项通过，包含 4 项真实模型集成测试 |
| Python Lint / Format | `uv run ruff check app tests scripts` / `uv run ruff format --check app tests scripts` | 通过 |
| TypeScript | `npm run check` | 严格检查通过，包含应用、单元及 E2E 源码 |
| 前端 Lint | `npm run lint` | 通过，无关闭 Hook 检查 |
| 前端单元 | `npm test` | 24 项通过 |
| 生产构建 | `VITE_BASE_PATH=/origin-ai-lab/ npm run build` | 成功；保留三维大块体积提示，不伪装为零警告 |
| 真实实时 E2E | `ORIGIN_LIVE_TEST=1 npm run test:e2e` | 桌面 / 手机共 14 项通过 |
| npm 依赖审计 | `npm audit` | 0 已知漏洞 |

最终执行 `npm ci` 成功。Python 服务停止后，从真实生产构建 `/origin-ai-lab/` 运行静态 E2E：10 项通过、4 项实时专用测试明确跳过；这些实时测试已在另一次真实 API 运行中通过。证据见 e2e-live-result.json 与 e2e-static-result.json。Hash 页面刷新、About 与静态资源另有独立检查记录。矩阵的 101 个色阶及 9 组基础文字 / 表面组合通过对比度检查，基础组合最小对比度为 5.49。

## 覆盖内容

后端包括空白 / 非法输入、UTF-8 大小限制、真实 Token 限制、模型信息、Attention 形状、数值与归一化、因果遮罩、摘要层级、预测概率、序列化、Schema、Provenance、错误响应、CORS、限流、并发拒绝与恢复。真实集成额外对照独立未插桩的 HF eager 模型，检查 Attention、隐藏状态 RMS、Logits 和概率，测试 Unicode / 特殊 Token、确定性和真实导出。

前端包括目录 / 数据读取、格式与科学数值拒绝、文件完整性、Layer / Head / Token 更新、无效索引、异步竞态、API 断线、旧记录保留及静态恢复、回放步骤 / 定时器清理、数据标签。

E2E 实际读取 fixture 中的指定数值并与 DOM 比较，不仅检查页面能打开。覆盖桌面 / 手机、静态无 API 请求、模型组件联动、Token / Head / Layer、预测 Logit 表、关联图、回放控制、WebGL 不可用、降低动态效果、键盘选择、API 断开后不伪造成功，以及真实短文本 / 64 Token Canvas。每例收集未捕获异常、控制台 error 和资源失败；仅在故障用例允许明确预期的 API 连接失败，保留其他错误检查。

## 修复过的真实问题

- Transformers 5 不再提供旧 config `_commit_hash`；改为检查固定 Hub snapshot。
- Bridge 默认 BOS 与前端输入潜在不一致；改为显式 ID Tensor，不自动加 BOS。
- 插桩后参数遍历重复计数；改用公开原始参数计数并和独立模型比较。
- 分析代码哈希扫描范围过大；限定 app/ 并在模型初始化时缓存。
- Drei Html 在 React 严格模式卸载时产生根节点竞争警告；移除嵌套 HTML 根，用外部语义面板标注。
- 表头缺少明确 scope 导致浏览器辅助语义不一致；显式设置列头。
- 共享 chunk 导致移动端也预加载 Three；改为真正的独立懒加载块。
- 矩阵中间色阶的文字对比度及连续键盘移动进行了针对性修复。

没有删除失败测试、关闭类型检查、替换为随机数据或吞掉模型异常。

## 未执行的环境

GitHub Actions / Pages 远程执行、公开 API 部署、物理手机、Safari、Firefox、GPU 推理以及跨操作系统安装尚未验证。移动视口测试不等于真实中端手机 30 FPS 证明；没有编造 FPS 或 Lighthouse 分数。
