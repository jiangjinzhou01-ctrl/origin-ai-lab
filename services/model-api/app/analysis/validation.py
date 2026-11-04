"""Numerical invariants supplement the generated structural JSON Schema."""

import numpy as np

from app.serializers.schema import Analysis


def validate_analysis(data: Analysis) -> None:
    n = data.input.sequence_length
    m = data.model
    if not len(data.tokens) == n:
        raise ValueError("token count")
    if not [t.position for t in data.tokens] == list(range(n)):
        raise ValueError("token positions")
    if not all(0 <= t.id < m.vocab_size for t in data.tokens):
        raise ValueError("vocabulary bounds")
    if not b"".join(bytes.fromhex(t.byte_hex) for t in data.tokens) == data.input.text.encode():
        raise ValueError("byte reconstruction")
    a = np.asarray(data.attention.values)
    if not a.shape == (m.layers, m.heads, n, n) == tuple(data.attention.shape):
        raise ValueError("attention shape")
    if not np.isfinite(a).all():
        raise ValueError("finite attention")
    if not ((a >= 0).all() and (a <= 1).all()):
        raise ValueError("attention range")
    if not np.allclose(a.sum(-1), 1, atol=2e-05, rtol=0):
        raise ValueError("attention rows")
    if not np.max(np.abs(np.triu(a, k=1))) < 1e-07:
        raise ValueError("causal mask")
    if not data.attention.hooks == [f"blocks.{i}.attn.hook_pattern" for i in range(m.layers)]:
        raise ValueError("layer hooks")
    summaries = {s.id: s for s in data.activation_summaries}
    if not len(summaries) == m.layers + 3:
        raise ValueError("activation count")
    for i in range(m.layers):
        if not summaries[f"block-{i}"].hook == f"blocks.{i}.hook_out":
            raise ValueError("residual layer")
        if not summaries[f"block-{i}"].layer == i:
            raise ValueError("activation layer")
    for s in summaries.values():
        if not s.tensor_shape == (1, n, m.hidden_size):
            raise ValueError("activation shape")
        if not len(s.l2) == len(s.rms) == n:
            raise ValueError("activation token axis")
        if not (np.isfinite(s.l2).all() and np.isfinite(s.rms).all()):
            raise ValueError("finite activations")
        if not (np.asarray(s.rms) >= 0).all():
            raise ValueError("nonnegative RMS")
        if not np.allclose(np.asarray(s.rms) * np.sqrt(m.hidden_size), s.l2, atol=0.0002):
            raise ValueError("L2/RMS definition")
    p = data.next_token_predictions
    if not len(p.by_position) == n:
        raise ValueError("prediction count")
    for i, pred in enumerate(p.by_position):
        if not pred.position == i:
            raise ValueError("prediction position")
        if not len(pred.candidates) == p.top_k:
            raise ValueError("prediction top k")
        if not len({c.id for c in pred.candidates}) == p.top_k:
            raise ValueError("unique candidates")
        probabilities = [c.probability for c in pred.candidates]
        if not probabilities == sorted(probabilities, reverse=True):
            raise ValueError("prediction ordering")
        if not sum(probabilities) <= 1 + 1e-06:
            raise ValueError("probability mass")
        if not np.isclose(sum(probabilities) + pred.remaining_probability, 1, atol=2e-06):
            raise ValueError("remaining mass")
        for c in pred.candidates:
            if not 0 <= c.id < m.vocab_size:
                raise ValueError("prediction vocabulary")
    if not m.revision == m.tokenizer_revision:
        raise ValueError("revision mismatch")
    if not (data.runtime.eval_mode and data.runtime.inference_mode):
        raise ValueError("inference mode")
