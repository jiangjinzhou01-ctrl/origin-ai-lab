# 科学方法

## 模型与计算路径

模型为 `openai-community/gpt2`，权重与 Tokenizer 固定到 `607a30d783dfa663caf39e06633721c8d4cfcd7e`。GPT-2 Small 是公开研究样本，不是现代最先进模型。加载配置给出 12 Blocks、12 Heads、768 隐藏维、3072 MLP 中间维、50257 词表项、1024 学习到的绝对位置。

使用 TransformerLens 4.3.0 的 `TransformerBridge.boot_transformers`，Transformers 5.22.1 和 PyTorch 2.10.0+cpu。未使用旧 HookedTransformer；未启用会折叠 LayerNorm / 居中权重的 compatibility mode，也未采用回退后端。

Bridge 插桩会给原始模块添加组件视图。参数数目通过公开 `n_params_total` 读取，避免插桩后的重复计数；集成测试与独立未插桩 Hugging Face 模型比较，得到 124,439,808 个参数。

GPT-2 使用 Pre-LayerNorm：

```text
x₀ = token_embedding + positional_embedding
x′ = x + Attention(LN₁(x))
y  = x′ + MLP(LN₂(x′))
logits = FinalLayerNorm(x_last) @ W_embedding.T
```

每个 Block 中 Attention 与 MLP 都有残差相加。空间几何仅是组件布局，不能解释成真实神经元、所有参数、物理网络或人类思考路径。

## Token

显式调用真实 Tokenizer 的 `add_special_tokens=False`，并将得到的 ID Tensor 传入 Bridge。Phase 0 实测发现 Bridge 字符串入口默认加 BOS；ORIGIN 不使用该默认行为。输入模型的 ID 已与 `bridge.to_tokens(text, prepend_bos=False)` 对比。

GPT-2 的 Byte-level BPE 不等于空格分词。记录每个 Token 的 ID、独立 decode、原始 BPE 片段、实际字节及特殊标记。`␠ / ↵ / ⇥` 分别表示空格、换行和 Tab；也保留 JSON 转义字符串。单个 Token 的字节可能不足以构成 UTF-8 字符，独立 decode 可含替代字符。导出器验证拼接所有 Token 字节等于输入的 UTF-8 字节。用户主动输入特殊 Token 字面量时，它依然会标记为特殊 Token；不自动插入 BOS。

## 经过实际验证的 Hook

| 记录内容 | Hook | 原始形状 |
| --- | --- | --- |
| Token Embedding | `embed.hook_out` | `[1, sequence, hidden]` |
| Positional Embedding | `pos_embed.hook_out` | `[1, sequence, hidden]` |
| 第 i 层 Attention Pattern | `blocks.{i}.attn.hook_pattern` | `[1, heads, query, key]` |
| 第 i 层 Block 输出 Residual | `blocks.{i}.hook_out` | `[1, sequence, hidden]` |
| 最终归一化输出 | `ln_final.hook_out` | `[1, sequence, hidden]` |

使用 names_filter 只捕获这些位置。启动时确认 Hook 存在；运行后再次验证形状。Residual 指 MLP 残差相加后的 Block 输出。所有位置索引零基。

## Attention

`softmax((QKᵀ / √d_head) + causal_mask)`。矩阵行是 Query，列是 Key；位置 q 只能访问 0 到 q。未来位置概率应接近 0，不能显示为可访问关系；每行有效概率和约为 1。

导出的权重为真实计算值，float32 转换到 JSON 时保留 8 位小数，不重新归一化。颜色线性映射 0–1，不随 Head 做局部最大值拉伸。关联图直接读取同一 Query 行；阈值仅筛选展示，最多画 12 条，不修改数值。

注意力只是可观测计算量，不能单独证明某个 Token 是输出的因果原因。V1 未进行消融、激活干预或因果解释。

## 激活统计

对每个 Hook 的每个 Token 沿 hidden 维度计算：

- L2 Norm：`sqrt(sum(x_i ** 2))`。
- RMS：`sqrt(mean(x_i ** 2))`，因此 `L2 = RMS × sqrt(hidden_size)`。

前端只显示这些明确摘要，不导出巨大的完整激活。幅度增大不意味着理解加深。层间连线仅为采样统计之间的视觉连接，不能解释成连续时间测量。

## 预测

对每个位置的完整词表 Logits 做 float32 Softmax，温度为 1。提取真实 Top-K，默认 8；不采样、不做 Top-K 重归一化，也不继续生成。候选包含 ID、decode、原始 Logit 和概率；其余候选质量为 `1 - sum(top_k_probabilities)`。

位置 q 的预测对应 q 之后的下一个 Token，仅依赖输入的 0..q。Logit 不是概率，百分比为概率乘 100。条形图以当前 Top-1 为长度基准，文字数值始终为完整词表概率。

## 验证与数值界限

导出前执行 Pydantic、JSON Schema 以及始终启用（不依赖 Python assert）的数值验证：形状、Token 字节重建、NaN / Infinity、概率范围、Attention 行和、因果遮罩、逐层 Hook 对应、L2/RMS 关系、Top-K 顺序和剩余概率。

Attention 行和采用绝对容差 2e-5；未来权重 <1e-7。独立 HF eager 模型交叉检查时，浮点运算顺序会带来差异：实测最大 Attention 差约 1.7e-6，测试容差为 atol=3e-6、rtol=1e-5；概率与 Logit 分别使用同量级及 1e-4 的合理容差。同一环境下两次 eval 结果和原始张量 SHA-256 完全一致。不同硬件或库版本不保证逐位一致，不应把浮点差异解释成模型改变。

## 回放

前向计算先完成，再回放 Tokenization、Embedding、各层 Attention / Residual、Final Logits 和 Prediction，共 28 步。动画间隔为产品交互节奏，不是实测逐层执行时间。步骤定位只改变可视状态，不重复或伪造模型计算。
