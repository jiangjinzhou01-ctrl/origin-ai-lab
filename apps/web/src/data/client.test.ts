import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import fixture from '../../public/data/language.json'
import manifest from '../../public/data/manifest.json'
import { analyzeText, loadExperiment, loadManifest, validateAnalysis } from './client'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('verified experiment data', () => {
  it('validates actual fixture and rejects malformed schema', () => {
    expect(validateAnalysis(fixture).tokens.map((t) => t.id)).toEqual([464, 3797, 3332, 319, 262])
    expect(() => validateAnalysis({ schema_version: 'fake' })).toThrow('格式无效')
  })
  it('rejects scientifically inconsistent values', () => {
    const bad = structuredClone(fixture)
    bad.attention.values[0]![0]![0]![1] = 0.2
    expect(() => validateAnalysis(bad)).toThrow('概率或因果遮罩')
    bad.attention.values[0]![0]![0]![1] = 0
    bad.tokens.pop()
    expect(() => validateAnalysis(bad)).toThrow('数据轴')
  })
  it('loads manifest using Vite base', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => manifest })
    expect((await loadManifest()).experiments).toHaveLength(3)
    expect(fetchMock.mock.calls[0]![0]).toBe('/data/manifest.json')
  })
  it('rejects invalid manifest and failed HTTP', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await expect(loadManifest()).rejects.toThrow('目录格式')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(loadManifest()).rejects.toThrow('404')
  })
  it('loads JSON bytes and rejects length mismatch', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(fixture))
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer })
    const experiment = {
      ...manifest.experiments[0]!,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    expect((await loadExperiment(experiment)).input.text).toBe(fixture.input.text)
    await expect(loadExperiment({ ...experiment, bytes: 1 })).rejects.toThrow('长度校验')
    await expect(loadExperiment({ ...experiment, sha256: '0'.repeat(64) })).rejects.toThrow(
      'SHA-256',
    )
  })
})

describe('live transport', () => {
  it('reports backend unavailable without a fabricated result', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'))
    await expect(analyzeText('hello', new AbortController().signal)).rejects.toThrow(
      '当前输入未进行推理',
    )
  })
  it('preserves structured server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { message: '实际 Token 超过上限' } }),
    })
    await expect(analyzeText('long', new AbortController().signal)).rejects.toThrow('超过上限')
  })
  it('rejects static results masquerading as live', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => fixture })
    await expect(analyzeText(fixture.input.text, new AbortController().signal)).rejects.toThrow(
      '不一致',
    )
  })
  it('accepts matching real-mode protocol', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...fixture, source_mode: 'live' }),
    })
    expect((await analyzeText(fixture.input.text, new AbortController().signal)).source_mode).toBe(
      'live',
    )
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
  })
})
