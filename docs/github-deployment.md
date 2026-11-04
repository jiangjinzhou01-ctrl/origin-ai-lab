# GitHub 部署实测记录

源码已推送：https://github.com/jiangjinzhou01-ctrl/origin-ai-lab

## 已完成

- 检查目标为空仓库，无历史内容需要覆盖；保留其他仓库。
- 推送全部源代码、真实实验、依赖锁、文档和工作流。
- GitHub 完整 CI 成功：https://github.com/jiangjinzhou01-ctrl/origin-ai-lab/actions/runs/41831256796
- 云端完成 npm ci、uv sync、协议一致性、严格 TS、Lint、前端测试、构建、后端非模型单元测试、桌面和移动静态 E2E。

## 当前发布阻碍

首次 Pages 发布：https://github.com/jiangjinzhou01-ctrl/origin-ai-lab/actions/runs/41831256885

检查和生产构建成功。GitHub Pages 尚未在目标仓库启用，连接器及工作流 GITHUB_TOKEN 的首次创建请求均返回 `403 Resource not accessible by integration`。安装页面的“所有存储库”选项表示仓库访问范围，不增加应用清单之外的 Pages 管理权限。

官方 configure-pages action 说明其 enablement 参数需要具有相应权限的额外令牌，默认 GITHUB_TOKEN 不适用于首次启用。已移除这一不适用的自动启用参数，保留标准发布流程。

仓库拥有者可在 https://github.com/jiangjinzhou01-ctrl/origin-ai-lab/settings/pages 把 Build and deployment 的 Source 设为 GitHub Actions。随后重新运行 pages.yml；只在实际成功部署和 HTTP 验证后记录线上地址。Python API 不由 Pages 托管。
