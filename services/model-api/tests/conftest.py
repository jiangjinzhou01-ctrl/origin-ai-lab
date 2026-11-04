import json
from pathlib import Path

import pytest

from app.serializers.schema import Analysis

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def analysis():
    return Analysis.model_validate_json((ROOT / "apps/web/public/data/language.json").read_text())


@pytest.fixture
def schema():
    return json.loads((ROOT / "schemas/origin.analysis.v1.json").read_text())
