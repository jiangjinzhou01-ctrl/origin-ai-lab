"""Single source of truth. Export this Pydantic model to JSON Schema and TS."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Input(Record):
    text: str
    sequence_length: int = Field(ge=1, le=64)
    add_special_tokens: Literal[False]
    bos_inserted: Literal[False]
    bos_token_id: int
    tokenization: Literal["byte-level BPE"]


class ModelInfo(Record):
    id: Literal["openai-community/gpt2"]
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    tokenizer_revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    model_type: Literal["gpt2"]
    layers: int = Field(gt=0)
    heads: int = Field(gt=0)
    hidden_size: int = Field(gt=0)
    intermediate_size: int = Field(gt=0)
    vocab_size: int = Field(gt=0)
    context_length: int = Field(gt=0)
    parameter_count: int = Field(gt=0)
    activation_function: str
    layer_norm_epsilon: float = Field(gt=0)
    tied_embeddings: bool


class Runtime(Record):
    backend: Literal["transformer_lens.TransformerBridge"]
    device: str
    dtype: Literal["float32"]
    eval_mode: Literal[True]
    inference_mode: Literal[True]
    attention_implementation: Literal["eager"]
    max_tokens: int = Field(ge=1, le=64)
    cpu_threads: int = Field(gt=0)
    model_load_ms: float = Field(ge=0)
    inference_ms: float = Field(ge=0)
    serialization_ms: float = Field(ge=0)
    process_rss_mb: float = Field(gt=0)
    cache_hit: bool


class Token(Record):
    position: int = Field(ge=0)
    id: int = Field(ge=0)
    text: str
    display: str
    raw_piece: str
    byte_hex: str
    is_special: bool


class Component(Record):
    id: str
    name: str
    kind: Literal[
        "embedding", "position", "block", "norm", "attention", "mlp", "projection", "residual"
    ]
    layer: int | None
    input_shape: list[int]
    output_shape: list[int]
    description: str


class Connection(Record):
    source: str
    target: str
    kind: Literal["flow", "residual", "add", "tied_weights"]


class Architecture(Record):
    family: Literal["GPT-2 decoder-only, pre-LayerNorm"]
    representation: Literal["semantic component schematic"]
    components: list[Component]
    connections: list[Connection]


class Attention(Record):
    axes: tuple[Literal["layer"], Literal["head"], Literal["query"], Literal["key"]]
    shape: tuple[int, int, int, int]
    values: list[list[list[list[float]]]]
    hooks: list[str]
    precision: Literal["float32, rounded to 8 decimal places"]
    causal: Literal[True]


class Activation(Record):
    id: str
    layer: int | None
    hook: str
    location: str
    tensor_shape: tuple[int, int, int]
    l2: list[float]
    rms: list[float]


class Candidate(Record):
    id: int = Field(ge=0)
    text: str
    display: str
    logit: float
    probability: float = Field(ge=0, le=1)


class Prediction(Record):
    position: int = Field(ge=0)
    candidates: list[Candidate]
    remaining_probability: float = Field(ge=0, le=1)


class Predictions(Record):
    distribution: Literal["softmax over full vocabulary, temperature=1, no sampling"]
    top_k: int = Field(ge=1, le=20)
    by_position: list[Prediction]


class Provenance(Record):
    generated_at: str
    analysis_code_version: str
    analysis_code_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    dependencies: dict[str, str]
    model_config_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    tensor_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    checksum_definition: Literal[
        "SHA256 of little-endian float32 attention, raw logits, and cached residuals in hook order"
    ]
    index_base: Literal[0]
    rounding_decimals: Literal[8]
    validation: Literal[
        "schema + finite + shape + normalization + causal mask + byte reconstruction"
    ]
    model_license: Literal["MIT"]


class Analysis(Record):
    schema_version: Literal["origin.analysis.v1"]
    analysis_id: str
    source_mode: Literal["static", "live"]
    input: Input
    model: ModelInfo
    runtime: Runtime
    tokens: list[Token]
    architecture: Architecture
    attention: Attention
    activation_summaries: list[Activation]
    next_token_predictions: Predictions
    provenance: Provenance
