import Ajv2020 from 'ajv/dist/2020'
import schema from '../../../../schemas/origin.analysis.v1.json'
import type { Analysis } from './analysis.generated'

const validate = new Ajv2020({ strict: true, allErrors: true }).compile<Analysis>(schema)
export interface Experiment {
  id: string
  title: string
  description: string
  text: string
  path: string
  bytes: number
  sha256: string
  tokens: number
}
export interface Manifest {
  schema_version: 'origin.manifest.v1'
  experiments: Experiment[]
}
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

export function validateAnalysis(raw: unknown): Analysis {
  if (!validate(raw)) throw new Error('实验数据格式无效，无法按 origin.analysis.v1 读取。')
  const n = raw.input.sequence_length
  const { layers, heads, hidden_size } = raw.model
  if (
    raw.tokens.length !== n ||
    raw.tokens.some((t, i) => t.position !== i) ||
    raw.attention.shape.join() !== [layers, heads, n, n].join() ||
    raw.attention.values.length !== layers ||
    raw.activation_summaries.length !== layers + 3 ||
    raw.next_token_predictions.by_position.length !== n
  ) {
    throw new Error('数据轴与模型配置不一致。')
  }
  raw.attention.values.forEach((layer) => {
    if (layer.length !== heads) throw new Error('Head 维度不一致。')
    layer.forEach((matrix) => {
      if (matrix.length !== n) throw new Error('Query 维度不一致。')
      matrix.forEach((row, q) => {
        if (
          row.length !== n ||
          row.some((p, k) => !Number.isFinite(p) || p < 0 || p > 1 || (k > q && p > 1e-7)) ||
          Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 2e-5
        )
          throw new Error('Attention 概率或因果遮罩无效。')
      })
    })
  })
  raw.activation_summaries.forEach((s) => {
    if (
      s.l2.length !== n ||
      s.rms.length !== n ||
      s.tensor_shape.join() !== [1, n, hidden_size].join() ||
      s.rms.some(
        (r, i) =>
          !Number.isFinite(r) || r < 0 || Math.abs(r * Math.sqrt(hidden_size) - s.l2[i]!) > 0.01,
      )
    ) {
      throw new Error('激活统计与张量维度不一致。')
    }
  })
  raw.next_token_predictions.by_position.forEach((p, i) => {
    if (
      p.position !== i ||
      p.candidates.length !== raw.next_token_predictions.top_k ||
      Math.abs(
        p.candidates.reduce((sum, c) => sum + c.probability, 0) + p.remaining_probability - 1,
      ) > 2e-6
    ) {
      throw new Error('预测概率质量不一致。')
    }
  })
  return raw
}

async function getJSON(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`数据读取失败（HTTP ${response.status}）。`)
  return response.json()
}

export async function loadManifest(signal?: AbortSignal): Promise<Manifest> {
  const raw = (await getJSON(
    `${import.meta.env.BASE_URL}data/manifest.json`,
    signal,
  )) as Partial<Manifest>
  if (
    raw.schema_version !== 'origin.manifest.v1' ||
    !Array.isArray(raw.experiments) ||
    !raw.experiments.length ||
    raw.experiments.some(
      (e) => !/^[\w-]+\.json$/.test(e.path) || !/^[a-f0-9]{64}$/.test(e.sha256) || !e.title,
    )
  ) {
    throw new Error('实验目录格式无效。')
  }
  return raw as Manifest
}

export async function loadExperiment(
  experiment: Experiment,
  signal?: AbortSignal,
): Promise<Analysis> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${experiment.path}`, { signal })
  if (!response.ok) throw new Error(`实验读取失败（HTTP ${response.status}）。`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== experiment.bytes) throw new Error('实验文件长度校验失败。')
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    if (hex !== experiment.sha256) throw new Error('实验文件 SHA-256 校验失败。')
  }
  const data = validateAnalysis(JSON.parse(new TextDecoder().decode(bytes)))
  if (data.source_mode !== 'static') throw new Error('预计算实验来源标识无效。')
  return data
}

export async function analyzeText(text: string, signal: AbortSignal): Promise<Analysis> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'openai-community/gpt2', top_k: 8 }),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new Error('无法连接分析服务。当前输入未进行推理；可返回预计算实验。', { cause: e })
  }
  const body: unknown = await response.json()
  if (!response.ok) {
    const detail = body as { error?: { message?: string } }
    throw new Error(detail.error?.message || `分析服务返回 HTTP ${response.status}。`)
  }
  const data = validateAnalysis(body)
  if (data.source_mode !== 'live' || data.input.text !== text)
    throw new Error('服务返回的数据与提交的实时实验不一致。')
  return data
}

export async function health(
  signal: AbortSignal,
): Promise<{ status: string; model_ready: boolean }> {
  return (await getJSON(`${API_URL}/api/health`, signal)) as {
    status: string
    model_ready: boolean
  }
}
