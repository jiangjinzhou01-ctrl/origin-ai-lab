import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/language.json'
import smaller from '../../public/data/intelligence.json'
import manifest from '../../public/data/manifest.json'
import type { Analysis } from '../data/analysis.generated'
import type { Manifest } from '../data/client'
import { useLab, currentMatrix, inferenceSteps } from './lab'
import { loadExperiment, analyzeText, validateAnalysis } from '../data/client'

vi.mock('../data/client', async (original) => ({
  ...(await original<typeof import('../data/client')>()),
  loadManifest: vi.fn(),
  loadExperiment: vi.fn(),
  analyzeText: vi.fn(),
}))
const data = validateAnalysis(fixture)
beforeEach(() => {
  vi.clearAllMocks()
  useLab.getState().cancel()
  useLab.setState({
    manifest: manifest as Manifest,
    analysis: structuredClone(data),
    mode: 'static',
    status: 'ready',
    error: null,
    layer: 0,
    head: 0,
    query: 4,
    key: 0,
    step: 0,
    playing: false,
    component: null,
  })
})

describe('one coherent experiment state', () => {
  it('synchronizes layer, head, token and component', () => {
    const s = useLab.getState()
    s.setLayer(8)
    s.setHead(5)
    s.setQuery(2)
    s.setKey(1)
    expect(useLab.getState()).toMatchObject({
      layer: 8,
      head: 5,
      query: 2,
      key: 1,
      component: 'block-8',
    })
    expect(currentMatrix(data, 8, 5)[2]![1]).toBe(data.attention.values[8]![5]![2]![1])
    s.focus('block-3.attention')
    expect(useLab.getState().layer).toBe(3)
  })
  it('rejects all invalid indices', () => {
    const s = useLab.getState()
    for (const n of [-1, 999, NaN, 1.5]) {
      s.setLayer(n)
      s.setHead(n)
      s.setQuery(n)
      s.setKey(n)
    }
    expect(useLab.getState()).toMatchObject({ layer: 0, head: 0, query: 4, key: 0 })
    expect(() => currentMatrix(data, 99, 1)).toThrow('超出')
  })
  it('normalizes token selection when experiments change', async () => {
    vi.mocked(loadExperiment).mockResolvedValue(validateAnalysis(smaller))
    await useLab.getState().chooseExperiment('intelligence')
    expect(useLab.getState()).toMatchObject({
      query: smaller.tokens.length - 1,
      key: 0,
      component: null,
      playing: false,
    })
  })
  it('discards stale asynchronous responses', async () => {
    let resolveFirst: (value: Analysis) => void = () => undefined
    vi.mocked(loadExperiment)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValueOnce(validateAnalysis(smaller))
    const first = useLab.getState().chooseExperiment('language')
    await useLab.getState().chooseExperiment('intelligence')
    resolveFirst(data)
    await first
    expect(useLab.getState().experimentId).toBe('intelligence')
    expect(useLab.getState().analysis!.input.text).toBe(smaller.input.text)
  })
  it('preserves previous result and explicit live error', async () => {
    vi.mocked(analyzeText).mockRejectedValue(new Error('服务不可用'))
    await useLab.getState().submit('new private input')
    expect(useLab.getState()).toMatchObject({ mode: 'live', status: 'error', error: '服务不可用' })
    expect(useLab.getState().analysis!.source_mode).toBe('static')
    vi.mocked(loadExperiment).mockResolvedValue(data)
    await useLab.getState().chooseExperiment('language')
    expect(useLab.getState()).toMatchObject({ mode: 'static', status: 'ready', error: null })
  })
  it('does not submit empty text', async () => {
    await useLab.getState().submit('  ')
    expect(analyzeText).not.toHaveBeenCalled()
    expect(useLab.getState().error).toContain('非空')
  })
})

describe('recorded playback', () => {
  it('maps every step to valid architecture and layer', () => {
    const steps = inferenceSteps(data.model.layers)
    expect(steps).toHaveLength(28)
    for (let i = 0; i < steps.length; i++) {
      useLab.getState().seek(i)
      expect(data.architecture.components.some((c) => c.id === useLab.getState().component)).toBe(
        true,
      )
    }
    useLab.getState().seek(2)
    expect(useLab.getState()).toMatchObject({ layer: 0, component: 'block-0.attention' })
    useLab.getState().seek(24)
    expect(useLab.getState().layer).toBe(11)
  })
  it('pauses for view, layer and motion changes', () => {
    const s = useLab.getState()
    s.setPlaying(true)
    s.setView('tokens')
    expect(useLab.getState().playing).toBe(false)
    s.setPlaying(true)
    s.setLayer(1)
    expect(useLab.getState().playing).toBe(false)
    s.setPlaying(true)
    s.setReducedMotion(true)
    expect(useLab.getState().playing).toBe(false)
  })
})
