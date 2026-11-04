# 许可证与素材

项目源代码为 MIT。未提交权重、账号凭据、字体二进制、外部图片或第三方三维模型；图形与场景由项目代码构造，字体使用浏览器 / 操作系统字体栈。

## 主要依赖

| 组件 | 许可 |
| --- | --- |
| GPT-2 权重与 Tokenizer | MIT；官方模型卡与 OpenAI 仓库，见 GPT2-LICENSE.txt |
| React / Vite / TypeScript / Three.js / R3F / Drei / Zustand | MIT |
| TransformerLens / FastAPI / Pydantic | MIT |
| Transformers | Apache-2.0 |
| PyTorch / NumPy | BSD-3-Clause |
| Playwright | Apache-2.0 |
| Lucide | ISC |
| GSAP | Standard No Charge License；不是 MIT 或 OSI 开源许可证 |

GSAP 依照任务指定技术栈使用，只负责本产品的相机过渡。其标准许可证允许在网站中使用和按条款分发，但对竞争性动画构建工具等用途存在限制；未来若将 ORIGIN 改成动画编辑器或 SDK，需要重新检查该许可。不能把整个依赖集合概括为“全部 MIT”。原始许可文本保留在分发的 third-party-notices.txt。

已从实际安装包元数据检查前端及 Python 依赖。完整清单为 `npm-license-inventory.json` 与 `python-license-inventory.json`，锁文件保留具体版本和依赖来源。`webgl-constants` 元数据未声明 SPDX，但实际 LICENSE 文件为 MIT，已包含于分发许可文本。构建期还包括 CC-BY-4.0 的 caniuse-lite 数据和 MPL-2.0 的 lightningcss；本项目未修改这些库，其许可证继续保留在安装包中。

`scripts/license-inventory.mjs` 从已安装包收集生产依赖的 LICENSE / NOTICE / COPYING 文件到 `apps/web/public/third-party-notices.txt`。构建产物会保留此文件。可重新执行该脚本更新清单。

## 维护记录

本轮更新了 Vite、Vitest、Ajv 和相关工具的稳定补丁版本，并显式把开发工具使用的 minimatch 约束到修复已知 glob 放大问题的 11.0.4。此 override 超出上游的 10.x 声明范围，已实际运行 ESLint、TypeScript、Vitest 和 Playwright 验证当前用法；升级上游工具时应重新检查并在不需要时移除。npm 在 workspace 依赖树输出中可能仍把这一有意 override 显示为 range mismatch；锁文件安装和实际检查是本项目的验证依据。

最终实际 `npm audit` 结果为 0 项已知漏洞。这是检查时数据库的结果，不是对未来漏洞或全部 Python 依赖安全性的保证。没有宣称执行过未运行的 Python 漏洞扫描。
