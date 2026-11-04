import json

import numpy as np
import pytest
import torch
from jsonschema import Draft202012Validator
from transformers import AutoModelForCausalLM

from app.analysis.engine import MODEL_ID, REVISION, AnalysisError, ModelEngine
from app.analysis.validation import validate_analysis

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def engine():
    return ModelEngine()


def test_real_forward_and_hf_crosscheck(engine, schema):
    data = engine.analyze("The cat sat on the")
    validate_analysis(data)
    Draft202012Validator(schema).validate(data.model_dump(mode="json"))
    assert data.model.revision == REVISION
    assert [t.id for t in data.tokens] == [464, 3797, 3332, 319, 262]
    assert not data.input.bos_inserted
    ids = engine.tokenize(data.input.text)
    assert torch.equal(ids, engine.bridge.to_tokens(data.input.text, prepend_bos=False))
    # Bridge instruments the original module and takes ownership of attention
    # capture. Cross-check against a separate, uninstrumented HF model.
    hf_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        revision=REVISION,
        attn_implementation="eager",
        dtype=torch.float32,
    ).eval()
    assert data.model.parameter_count == sum(p.numel() for p in hf_model.parameters())
    with torch.inference_mode():
        hf = hf_model(ids, output_attentions=True, output_hidden_states=True, use_cache=False)
    # Independent eager kernels differ in floating-point operation order.
    # Observed max attention error < 1.7e-6; tolerance remains below 0.01%.
    np.testing.assert_allclose(
        data.attention.values, torch.stack(hf.attentions)[:, 0].cpu(), atol=3e-6, rtol=1e-5
    )
    np.testing.assert_allclose(
        data.activation_summaries[2].rms,
        hf.hidden_states[1].square().mean(-1).sqrt()[0].cpu(),
        atol=3e-6,
        rtol=1e-5,
    )
    np.testing.assert_allclose(
        data.activation_summaries[-1].rms,
        hf.hidden_states[-1].square().mean(-1).sqrt()[0].cpu(),
        atol=3e-6,
        rtol=1e-5,
    )
    probabilities = hf.logits[0, -1].softmax(-1)
    for candidate in data.next_token_predictions.by_position[-1].candidates:
        assert np.isclose(
            candidate.probability, float(probabilities[candidate.id]), atol=3e-6, rtol=3e-5
        )
        assert np.isclose(
            candidate.logit, float(hf.logits[0, -1, candidate.id]), atol=1e-4, rtol=1e-6
        )


def test_repeat_and_byte_level_unicode(engine):
    first = engine.analyze("Hello\n世界 👋")
    second = engine.analyze("Hello\n世界 👋")
    assert first.attention.values == second.attention.values
    assert first.provenance.tensor_sha256 == second.provenance.tensor_sha256
    assert first.activation_summaries == second.activation_summaries
    validate_analysis(first)
    special = engine.analyze("<|endoftext|>Hello")
    assert special.tokens[0].is_special


def test_actual_token_limit(engine):
    with pytest.raises(AnalysisError, match="未被截断"):
        engine.analyze(" word" * 65)
    with pytest.raises(AnalysisError, match="8192"):
        engine.analyze("x" * 9000)


def test_real_fixture_export(tmp_path, schema):
    from scripts.generate_fixtures import generate

    manifest = generate(tmp_path, limit=1)
    assert len(manifest["experiments"]) == 1
    data = json.loads((tmp_path / "language.json").read_text())
    Draft202012Validator(schema).validate(data)
    assert data["source_mode"] == "static"
