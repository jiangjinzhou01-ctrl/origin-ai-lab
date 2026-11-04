"""Regenerate schemas/origin.analysis.v1.json from the single Python model."""

import json
from pathlib import Path

from app.serializers.schema import Analysis

root = Path(__file__).resolve().parents[3]
schema = Analysis.model_json_schema()
schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
schema["$id"] = "https://origin.local/schemas/origin.analysis.v1.json"
(root / "schemas").mkdir(exist_ok=True)
(root / "schemas/origin.analysis.v1.json").write_text(json.dumps(schema, indent=2) + "\n")
