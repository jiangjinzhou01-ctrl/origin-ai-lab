import hashlib
import json
from copy import deepcopy

import pytest
from conftest import ROOT
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from app.analysis.engine import AnalysisError, ModelEngine, byte_decoder
from app.analysis.validation import validate_analysis
from app.serializers.schema import Analysis


def test_all_real_fixtures_and_manifest(schema):
    base = ROOT / "apps/web/public/data"
    manifest = json.loads((base / "manifest.json").read_text())
    assert len(manifest["experiments"]) >= 3
    for item in manifest["experiments"]:
        raw = (base / item["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == item["sha256"]
        assert len(raw) == item["bytes"]
        data = Analysis.model_validate_json(raw)
        validate_analysis(data)
        Draft202012Validator(schema).validate(json.loads(raw))
        assert data.source_mode == "static"


def test_schema_is_generated_from_single_source(schema):
    schema = deepcopy(schema)
    schema.pop("$schema")
    schema.pop("$id")
    assert schema == Analysis.model_json_schema()


def test_provenance_and_serialization(analysis, schema):
    raw = analysis.model_dump_json()
    assert Analysis.model_validate_json(raw) == analysis
    assert analysis.provenance.dependencies["transformer-lens"] == "4.3.0"
    assert analysis.model.revision == analysis.model.tokenizer_revision
    assert len(analysis.provenance.tensor_sha256) == 64
    Draft202012Validator(schema).validate(json.loads(raw))


@pytest.mark.parametrize(
    "kind", ["shape", "nan", "infinity", "causal", "normalization", "token", "rms", "mass", "hook"]
)
def test_corrupt_scientific_data_rejected(analysis, kind):
    if kind == "shape":
        analysis.attention.values.pop()
    elif kind in {"nan", "infinity"}:
        analysis.attention.values[0][0][0][0] = float(kind if kind == "nan" else "inf")
    elif kind == "causal":
        analysis.attention.values[0][0][0][1] = 0.2
        analysis.attention.values[0][0][0][0] = 0.8
    elif kind == "normalization":
        analysis.attention.values[0][0][0][0] = 0.5
    elif kind == "token":
        analysis.tokens.pop()
    elif kind == "rms":
        analysis.activation_summaries[0].rms[0] = -1
    elif kind == "mass":
        analysis.next_token_predictions.by_position[0].remaining_probability = 0
    elif kind == "hook":
        analysis.activation_summaries[2].layer = 9
    with pytest.raises((AssertionError, ValueError)):
        validate_analysis(analysis)


def test_invalid_structure(analysis):
    data = analysis.model_dump()
    data["model"]["layers"] = 0
    with pytest.raises(ValidationError):
        Analysis.model_validate(data)
    data["schema_version"] = "fake.v1"
    with pytest.raises(ValidationError):
        Analysis.model_validate(data)


@pytest.mark.parametrize("text", ["", "  ", "\n\t"])
def test_empty_without_loading_weights(text):
    engine = ModelEngine.__new__(ModelEngine)
    with pytest.raises(AnalysisError, match="非空"):
        engine.tokenize(text)


def test_gpt2_byte_alphabet_is_bijection():
    decoder = byte_decoder()
    assert set(decoder.values()) == set(range(256))
    assert decoder["Ġ"] == 32 and decoder["Ċ"] == 10
