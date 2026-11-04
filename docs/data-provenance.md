# 数据来源与复现

正式实验只来自本仓库 `generate_fixtures.py` 对真实 GPT-2 权重的前向计算。没有随机 Attention 或用于演示的模型替身。

| 项目 | 固定值 |
| --- | --- |
| Model ID | openai-community/gpt2 |
| 权重 Revision | 607a30d783dfa663caf39e06633721c8d4cfcd7e |
| Tokenizer Revision | 同上 |
| 后端 | transformer_lens.TransformerBridge |
| Torch | 2.10.0+cpu |
| Transformers / TransformerLens | 5.22.1 / 4.3.0 |
| 精度 | float32，Attention JSON 四舍五入到 8 位小数 |
| 默认 Token 设置 | add_special_tokens=False，未自动插入 BOS |
| 模型许可证 | MIT，权重不随项目分发 |

模型与 Tokenizer 的固定 Hub snapshot 路径在加载时检查；模型配置 SHA-256 来自实际下载的 config.json。Transformers 5 的 GPT2Config 不保留旧 `_commit_hash` 属性，因此没有依赖该属性编造版本。

## 正式实验

| 文件 | 输入 | 实际 Token ID |
| --- | --- | --- |
| language.json | The cat sat on the | 464, 3797, 3332, 319, 262 |
| sunset.json | When the sun goes down | 由文件中真实 Tokenizer 输出记录 |
| intelligence.json | Artificial intelligence can | 由文件中真实 Tokenizer 输出记录 |

每份数据记录生成时间、完整 Revision、代码版本、分析应用源文件 SHA-256、Python 依赖版本、CPU 线程和设备、推理配置、耗时、精度与数值验证方法。

`analysis_code_sha256` 按相对路径排序，对 `services/model-api/app/` 的 `.py` 文件名和字节依次更新 SHA-256。它不包含虚拟环境、测试、模型缓存或绝对机器路径。依赖版本单独记录。该值在模型加载时计算，避免每次推理扫描磁盘。

`tensor_sha256` 按以下顺序校验未舍入张量的 little-endian float32 字节：全部 Attention（layer/head/query/key），完整 logits，随后按 Hook 顺序的 Token Embedding、Positional Embedding、各 Block 输出、Final LayerNorm。摘要无法反推出原始大张量，复核此校验和需要重新运行模型；静态文件另有独立的文件 SHA-256。

`manifest.json` 记录每个 JSON 的路径、字节数、SHA-256、标题、输入和 Token 数。前端在安全上下文下校验文件 SHA-256；不具备 Web Crypto 时仍会验证文件长度、结构和数值，不声称完成密码学校验。

## 重生成

```bash
cd services/model-api
uv sync --frozen
PYTHONPATH=. uv run python scripts/export_schema.py
PYTHONPATH=. HF_HUB_DISABLE_XET=1 uv run python scripts/generate_fixtures.py
HF_HUB_DISABLE_XET=1 uv run pytest -q
cd ../..
npm run schema:types
npm test
```

生成器复用一个模型，依次计算三段输入，先运行 Pydantic 和数值验证，再运行共享 JSON Schema 验证，最后写入 JSON 与清单。每次重新生成的时间、运行耗时和文件哈希会变化；同环境下原始张量校验和应保持一致。不同 CPU / BLAS 的小数值差异应按科学方法文档中的容差解释。

模型缓存由 Hugging Face 管理，通常位于用户 cache 目录，不进入 Git。单元测试中的 API test double 只存在于测试文件，正式数据与实际服务均不走该路径。
