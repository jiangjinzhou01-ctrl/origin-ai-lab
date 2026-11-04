from app.serializers.schema import Architecture, Component, Connection, ModelInfo


def build_architecture(model: ModelInfo, n: int) -> Architecture:
    h = model.hidden_size
    shape = [1, n, h]
    nodes: list[Component] = []
    edges: list[Connection] = []

    def add(id, name, kind, layer, ins, outs, description):
        nodes.append(
            Component(
                id=id,
                name=name,
                kind=kind,
                layer=layer,
                input_shape=ins,
                output_shape=outs,
                description=description,
            )
        )

    def edge(source, target, kind="flow"):
        edges.append(Connection(source=source, target=target, kind=kind))

    add(
        "embedding",
        "Token Embedding",
        "embedding",
        None,
        [1, n],
        shape,
        "按真实 Token ID 查找学习到的词嵌入。每个 Token 对应一个向量。",
    )
    add(
        "position",
        "Positional Embedding",
        "position",
        None,
        [1, n],
        shape,
        "GPT-2 使用学习到的绝对位置嵌入，与 Token Embedding 相加。",
    )
    for i in range(model.layers):
        b = f"block-{i}"
        add(
            b,
            f"Transformer Block {i}",
            "block",
            i,
            shape,
            shape,
            "Pre-LayerNorm：x → x + Attention(LN₁(x)) → x + MLP(LN₂(x))。残差是向量相加。",
        )
        for suffix, name, kind, description in [
            (
                "ln1",
                "LayerNorm 1",
                "norm",
                f"在隐藏维度上做 LayerNorm；ε = {model.layer_norm_epsilon}。",
            ),
            (
                "attention",
                "Causal Self-Attention",
                "attention",
                f"{model.heads} 个 Head；QKᵀ/√d 经因果遮罩和 Softmax 后得到权重，再乘 V。",
            ),
            ("ln2", "LayerNorm 2", "norm", "对 Attention 残差相加后的向量归一化，再送入 MLP。"),
            (
                "mlp",
                "MLP",
                "mlp",
                f"{h} → {model.intermediate_size} → {h}；激活函数 {model.activation_function}。",
            ),
        ]:
            add(f"{b}.{suffix}", name, kind, i, shape, shape, description)
        edge(f"{b}.ln1", f"{b}.attention")
        for suffix in ["sum-attn", "sum-mlp"]:
            add(
                f"{b}.{suffix}",
                "Residual Addition",
                "residual",
                i,
                shape,
                shape,
                "将子层输出与旁路 Residual Stream 逐元素相加；不是拼接。",
            )
        edge(f"{b}.attention", f"{b}.sum-attn")
        edge(b, f"{b}.ln1")
        edge(b, f"{b}.sum-attn", "residual")
        edge(f"{b}.sum-attn", f"{b}.ln2")
        edge(f"{b}.ln2", f"{b}.mlp")
        edge(f"{b}.mlp", f"{b}.sum-mlp")
        edge(f"{b}.sum-attn", f"{b}.sum-mlp", "residual")
        if i:
            edge(f"block-{i - 1}", b)
    edge("embedding", "block-0", "add")
    edge("position", "block-0", "add")
    add(
        "final-norm",
        "Final LayerNorm",
        "norm",
        None,
        shape,
        shape,
        "最后一个 Block 后的 LayerNorm。此处的向量将投影到词表空间。",
    )
    add(
        "projection",
        "Output Projection",
        "projection",
        None,
        shape,
        [1, n, model.vocab_size],
        "线性投影得到每个词表项的 Logit。权重与 Token Embedding 共享；Logit 本身不是概率。",
    )
    edge(f"block-{model.layers - 1}", "final-norm")
    edge("final-norm", "projection")
    edge("embedding", "projection", "tied_weights")
    return Architecture(
        family="GPT-2 decoder-only, pre-LayerNorm",
        representation="semantic component schematic",
        components=nodes,
        connections=edges,
    )
