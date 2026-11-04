import { create } from 'zustand'
import type { Analysis } from '../data/analysis.generated'
import { analyzeText, loadExperiment, loadManifest } from '../data/client'
import type { Manifest } from '../data/client'

export type Page = 'home' | 'explore' | 'architecture' | 'about'
export type View = 'attention' | 'inference' | 'tokens'
export interface Step {
  id: string
  label: string
  detail: string
  layer: number | null
  component: string
}

export function inferenceSteps(layers: number): Step[] {
  return [
    {
      id: 'tokenize',
      label: 'Tokenization',
      detail: '真实 Byte-level BPE；未自动插入 BOS。',
      layer: null,
      component: 'embedding',
    },
    {
      id: 'embedding',
      label: 'Embedding',
      detail: 'Token Embedding + 学习到的绝对 Positional Embedding。',
      layer: null,
      component: 'position',
    },
    ...Array.from({ length: layers }, (_, layer) => [
      {
        id: `attn-${layer}`,
        label: `L${layer} · Attention`,
        detail: 'LayerNorm → 多头因果 Self-Attention → 残差相加。',
        layer,
        component: `block-${layer}.attention`,
      },
      {
        id: `resid-${layer}`,
        label: `L${layer} · Residual`,
        detail: 'LayerNorm → MLP → 残差相加。此处记录 Block 输出的 L2 / RMS。',
        layer,
        component: `block-${layer}.sum-mlp`,
      },
    ]).flat(),
    {
      id: 'logits',
      label: 'Final Logits',
      detail: 'Final LayerNorm → 共享词嵌入权重的线性投影。Logit 是未归一化分数。',
      layer: null,
      component: 'projection',
    },
    {
      id: 'prediction',
      label: 'Next-token Prediction',
      detail: '对完整词表做 Softmax，得到真实概率；未采样，也未继续生成。',
      layer: null,
      component: 'projection',
    },
  ]
}

interface Lab {
  manifest: Manifest | null
  analysis: Analysis | null
  experimentId: string
  status: 'loading' | 'ready' | 'error'
  error: string | null
  mode: 'static' | 'live'
  page: Page
  view: View
  layer: number
  head: number
  query: number
  key: number
  component: string | null
  cameraRevision: number
  step: number
  playing: boolean
  reducedMotion: boolean
  use3d: boolean
  initialize: () => Promise<void>
  chooseExperiment: (id: string) => Promise<void>
  submit: (text: string) => Promise<void>
  cancel: () => void
  setMode: (mode: 'static' | 'live') => void
  setPage: (page: Page) => void
  setView: (view: View) => void
  setLayer: (layer: number) => void
  setHead: (head: number) => void
  setQuery: (token: number) => void
  setKey: (token: number) => void
  focus: (id: string | null) => void
  resetCamera: () => void
  seek: (step: number) => void
  setPlaying: (playing: boolean) => void
  setReducedMotion: (value: boolean) => void
  setUse3d: (value: boolean) => void
}
let request: AbortController | null = null
let generation = 0
const validIndex = (value: number, count: number) =>
  Number.isInteger(value) && value >= 0 && value < count
const message = (error: unknown) =>
  error instanceof Error ? error.message : '实验读取失败，请重试。'

export const useLab = create<Lab>((set, get) => {
  const accept = (data: Analysis, experimentId: string) =>
    set((s) => ({
      analysis: data,
      experimentId,
      status: 'ready',
      error: null,
      layer: Math.min(s.layer, data.model.layers - 1),
      head: Math.min(s.head, data.model.heads - 1),
      query: data.tokens.length - 1,
      key: 0,
      component: null,
      step: 0,
      playing: false,
      cameraRevision: s.cameraRevision + 1,
    }))
  return {
    manifest: null,
    analysis: null,
    experimentId: '',
    status: 'loading',
    error: null,
    mode: 'static',
    page: 'home',
    view: 'attention',
    layer: 0,
    head: 0,
    query: 0,
    key: 0,
    component: null,
    cameraRevision: 0,
    step: 0,
    playing: false,
    reducedMotion:
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    use3d: typeof matchMedia === 'undefined' || !matchMedia('(max-width: 760px)').matches,
    initialize: async () => {
      request?.abort()
      request = new AbortController()
      const version = ++generation
      set({ status: 'loading', error: null })
      try {
        const manifest = await loadManifest(request.signal)
        if (version !== generation) return
        set({ manifest })
        await get().chooseExperiment(manifest.experiments[0]!.id)
      } catch (error) {
        if (version === generation) set({ status: 'error', error: message(error) })
      }
    },
    chooseExperiment: async (id) => {
      const experiment = get().manifest?.experiments.find((e) => e.id === id)
      if (!experiment) {
        set({ error: '实验不存在。' })
        return
      }
      request?.abort()
      request = new AbortController()
      const version = ++generation
      set({ mode: 'static', status: 'loading', error: null, playing: false })
      try {
        const data = await loadExperiment(experiment, request.signal)
        if (version === generation) accept(data, id)
      } catch (error) {
        if (version === generation) set({ status: 'error', error: message(error) })
      }
    },
    submit: async (text) => {
      if (!text.trim()) {
        set({ error: '请输入非空文本。' })
        return
      }
      request?.abort()
      request = new AbortController()
      const version = ++generation
      const controller = request
      const timeout = setTimeout(() => controller.abort(), 50000)
      set({ mode: 'live', status: 'loading', error: null, playing: false })
      try {
        const data = await analyzeText(text, request.signal)
        if (version === generation) accept(data, '')
      } catch (error) {
        if (version === generation)
          set({
            status: 'error',
            error:
              error instanceof DOMException && error.name === 'AbortError'
                ? '分析已取消或超时，未生成新结果。'
                : message(error),
          })
      } finally {
        clearTimeout(timeout)
      }
    },
    cancel: () => {
      request?.abort()
      ++generation
      set({
        status: get().analysis ? 'ready' : 'error',
        error: '请求已取消；未生成新结果。',
        playing: false,
      })
    },
    setMode: (mode) => {
      request?.abort()
      ++generation
      set({ mode, status: get().analysis ? 'ready' : 'error', error: null, playing: false })
    },
    setPage: (page) => {
      set({ page, playing: false })
      if (typeof location !== 'undefined' && location.hash !== `#${page}`) location.hash = page
    },
    setView: (view) => set({ view, playing: false }),
    setLayer: (layer) => {
      if (validIndex(layer, get().analysis?.model.layers ?? 0))
        set({
          layer,
          component: `block-${layer}`,
          playing: false,
          cameraRevision: get().cameraRevision + 1,
        })
    },
    setHead: (head) => {
      if (validIndex(head, get().analysis?.model.heads ?? 0)) set({ head, playing: false })
    },
    setQuery: (query) => {
      if (validIndex(query, get().analysis?.tokens.length ?? 0)) set({ query })
    },
    setKey: (key) => {
      if (validIndex(key, get().analysis?.tokens.length ?? 0)) set({ key })
    },
    focus: (component) => {
      const node = get().analysis?.architecture.components.find((c) => c.id === component)
      if (component && !node) return
      set({
        component,
        layer: node?.layer ?? get().layer,
        playing: false,
        cameraRevision: get().cameraRevision + 1,
      })
    },
    resetCamera: () => set((s) => ({ cameraRevision: s.cameraRevision + 1 })),
    seek: (step) => {
      const steps = inferenceSteps(get().analysis?.model.layers ?? 0)
      const target = steps[step]
      if (!target) return
      set({
        step,
        layer: target.layer ?? get().layer,
        component: target.component,
        cameraRevision: get().cameraRevision + 1,
      })
    },
    setPlaying: (playing) => set({ playing }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion, playing: false }),
    setUse3d: (use3d) => set({ use3d }),
  }
})

export function currentMatrix(data: Analysis, layer: number, head: number): number[][] {
  const matrix = data.attention.values[layer]?.[head]
  if (!matrix) throw new Error('选中的 Layer / Head 超出数据范围。')
  return matrix
}
