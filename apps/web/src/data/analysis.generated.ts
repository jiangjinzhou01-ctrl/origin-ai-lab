/* Generated from the Pydantic JSON Schema. Do not edit. */

export type SchemaVersion = "origin.analysis.v1";
export type AnalysisId = string;
export type SourceMode = "static" | "live";
export type Text = string;
export type SequenceLength = number;
export type AddSpecialTokens = false;
export type BosInserted = false;
export type BosTokenId = number;
export type Tokenization = "byte-level BPE";
export type Id = "openai-community/gpt2";
export type Revision = string;
export type TokenizerRevision = string;
export type ModelType = "gpt2";
export type Layers = number;
export type Heads = number;
export type HiddenSize = number;
export type IntermediateSize = number;
export type VocabSize = number;
export type ContextLength = number;
export type ParameterCount = number;
export type ActivationFunction = string;
export type LayerNormEpsilon = number;
export type TiedEmbeddings = boolean;
export type Backend = "transformer_lens.TransformerBridge";
export type Device = string;
export type Dtype = "float32";
export type EvalMode = true;
export type InferenceMode = true;
export type AttentionImplementation = "eager";
export type MaxTokens = number;
export type CpuThreads = number;
export type ModelLoadMs = number;
export type InferenceMs = number;
export type SerializationMs = number;
export type ProcessRssMb = number;
export type CacheHit = boolean;
export type Position = number;
export type Id1 = number;
export type Text1 = string;
export type Display = string;
export type RawPiece = string;
export type ByteHex = string;
export type IsSpecial = boolean;
export type Tokens = Token[];
export type Family = "GPT-2 decoder-only, pre-LayerNorm";
export type Representation = "semantic component schematic";
export type Id2 = string;
export type Name = string;
export type Kind = "embedding" | "position" | "block" | "norm" | "attention" | "mlp" | "projection" | "residual";
export type Layer = number | null;
export type InputShape = number[];
export type OutputShape = number[];
export type Description = string;
export type Components = Component[];
export type Source = string;
export type Target = string;
export type Kind1 = "flow" | "residual" | "add" | "tied_weights";
export type Connections = Connection[];
/**
 * @minItems 4
 * @maxItems 4
 */
export type Axes = ["layer", "head", "query", "key"];
/**
 * @minItems 4
 * @maxItems 4
 */
export type Shape = [number, number, number, number];
export type Values = number[][][][];
export type Hooks = string[];
export type Precision = "float32, rounded to 8 decimal places";
export type Causal = true;
export type Id3 = string;
export type Layer1 = number | null;
export type Hook = string;
export type Location = string;
/**
 * @minItems 3
 * @maxItems 3
 */
export type TensorShape = [number, number, number];
export type L2 = number[];
export type Rms = number[];
export type ActivationSummaries = Activation[];
export type Distribution = "softmax over full vocabulary, temperature=1, no sampling";
export type TopK = number;
export type Position1 = number;
export type Id4 = number;
export type Text2 = string;
export type Display1 = string;
export type Logit = number;
export type Probability = number;
export type Candidates = Candidate[];
export type RemainingProbability = number;
export type ByPosition = Prediction[];
export type GeneratedAt = string;
export type AnalysisCodeVersion = string;
export type AnalysisCodeSha256 = string;
export type ModelConfigSha256 = string;
export type TensorSha256 = string;
export type ChecksumDefinition =
  "SHA256 of little-endian float32 attention, raw logits, and cached residuals in hook order";
export type IndexBase = 0;
export type RoundingDecimals = 8;
export type Validation = "schema + finite + shape + normalization + causal mask + byte reconstruction";
export type ModelLicense = "MIT";

export interface Analysis {
  schema_version: SchemaVersion;
  analysis_id: AnalysisId;
  source_mode: SourceMode;
  input: Input;
  model: ModelInfo;
  runtime: Runtime;
  tokens: Tokens;
  architecture: Architecture;
  attention: Attention;
  activation_summaries: ActivationSummaries;
  next_token_predictions: Predictions;
  provenance: Provenance;
}
export interface Input {
  text: Text;
  sequence_length: SequenceLength;
  add_special_tokens: AddSpecialTokens;
  bos_inserted: BosInserted;
  bos_token_id: BosTokenId;
  tokenization: Tokenization;
}
export interface ModelInfo {
  id: Id;
  revision: Revision;
  tokenizer_revision: TokenizerRevision;
  model_type: ModelType;
  layers: Layers;
  heads: Heads;
  hidden_size: HiddenSize;
  intermediate_size: IntermediateSize;
  vocab_size: VocabSize;
  context_length: ContextLength;
  parameter_count: ParameterCount;
  activation_function: ActivationFunction;
  layer_norm_epsilon: LayerNormEpsilon;
  tied_embeddings: TiedEmbeddings;
}
export interface Runtime {
  backend: Backend;
  device: Device;
  dtype: Dtype;
  eval_mode: EvalMode;
  inference_mode: InferenceMode;
  attention_implementation: AttentionImplementation;
  max_tokens: MaxTokens;
  cpu_threads: CpuThreads;
  model_load_ms: ModelLoadMs;
  inference_ms: InferenceMs;
  serialization_ms: SerializationMs;
  process_rss_mb: ProcessRssMb;
  cache_hit: CacheHit;
}
export interface Token {
  position: Position;
  id: Id1;
  text: Text1;
  display: Display;
  raw_piece: RawPiece;
  byte_hex: ByteHex;
  is_special: IsSpecial;
}
export interface Architecture {
  family: Family;
  representation: Representation;
  components: Components;
  connections: Connections;
}
export interface Component {
  id: Id2;
  name: Name;
  kind: Kind;
  layer: Layer;
  input_shape: InputShape;
  output_shape: OutputShape;
  description: Description;
}
export interface Connection {
  source: Source;
  target: Target;
  kind: Kind1;
}
export interface Attention {
  axes: Axes;
  shape: Shape;
  values: Values;
  hooks: Hooks;
  precision: Precision;
  causal: Causal;
}
export interface Activation {
  id: Id3;
  layer: Layer1;
  hook: Hook;
  location: Location;
  tensor_shape: TensorShape;
  l2: L2;
  rms: Rms;
}
export interface Predictions {
  distribution: Distribution;
  top_k: TopK;
  by_position: ByPosition;
}
export interface Prediction {
  position: Position1;
  candidates: Candidates;
  remaining_probability: RemainingProbability;
}
export interface Candidate {
  id: Id4;
  text: Text2;
  display: Display1;
  logit: Logit;
  probability: Probability;
}
export interface Provenance {
  generated_at: GeneratedAt;
  analysis_code_version: AnalysisCodeVersion;
  analysis_code_sha256: AnalysisCodeSha256;
  dependencies: Dependencies;
  model_config_sha256: ModelConfigSha256;
  tensor_sha256: TensorSha256;
  checksum_definition: ChecksumDefinition;
  index_base: IndexBase;
  rounding_decimals: RoundingDecimals;
  validation: Validation;
  model_license: ModelLicense;
}
export interface Dependencies {
  [k: string]: string;
}
