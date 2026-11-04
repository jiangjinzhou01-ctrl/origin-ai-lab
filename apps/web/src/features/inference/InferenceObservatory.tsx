import { useEffect } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import type { Analysis } from '../../data/analysis.generated'
import { currentMatrix, inferenceSteps, useLab } from '../../store/lab'
import { SceneViewport } from '../architecture/SceneViewport'
import { percent } from '../../components/Primitives'

export function InferenceObservatory({ data }: { data: Analysis }) {
  const steps = inferenceSteps(data.model.layers)
  const step = useLab((s) => s.step),
    seek = useLab((s) => s.seek)
  const playing = useLab((s) => s.playing),
    setPlaying = useLab((s) => s.setPlaying)
  const query = useLab((s) => s.query),
    layer = useLab((s) => s.layer)
  const current = steps[step]!
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (step >= steps.length - 1) setPlaying(false)
      else seek(step + 1)
    }, 1300)
    return () => clearTimeout(timer)
  }, [playing, step, steps.length, seek, setPlaying])
  const stats = data.activation_summaries.filter((s) => s.layer !== null)
  const values = stats.map((s) => s.rms[query]!)
  const max = Math.max(...values) * 1.1
  const points = values
    .map((v, i) => `${44 + (i * 480) / (values.length - 1)},${170 - (v / max) * 132}`)
    .join(' ')
  return (
    <section className="inference-observatory" aria-label="推理回放">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Inference Observatory</span>
          <h2>沿着一次计算，向前。</h2>
        </div>
        <span className="tensor-tag">
          {String(step + 1).padStart(2, '0')} / {steps.length}
        </span>
      </div>
      <p className="recorded-notice">
        这是已完成的真实前向计算的分步回放。动画间隔不是模型执行耗时，未模拟实时逐层推理。
      </p>
      <div className="inference-stage">
        <SceneViewport data={data} compact />
        <div className="step-narrative">
          <span className="eyebrow">Recorded step {step}</span>
          <h3 data-testid="playback-step">{current.label}</h3>
          <p>{current.detail}</p>
          <StepMeasurement data={data} id={current.id} />
          <span className="mono small muted">{current.component}</span>
        </div>
      </div>
      <div className="playback-controls">
        <button
          className="icon-button"
          aria-label="重置回放"
          onClick={() => {
            setPlaying(false)
            seek(0)
          }}
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="上一步"
          disabled={step === 0}
          onClick={() => {
            setPlaying(false)
            seek(step - 1)
          }}
        >
          <SkipBack size={17} />
        </button>
        <button
          className="play-button"
          aria-label={playing ? '暂停回放' : '播放回放'}
          onClick={() => {
            if (step === steps.length - 1) seek(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          className="icon-button"
          aria-label="下一步"
          disabled={step === steps.length - 1}
          onClick={() => {
            setPlaying(false)
            seek(step + 1)
          }}
        >
          <SkipForward size={17} />
        </button>
        <label className="playback-position">
          定位步骤
          <input
            aria-label="回放步骤定位"
            type="range"
            min={0}
            max={steps.length - 1}
            value={step}
            onChange={(e) => {
              setPlaying(false)
              seek(Number(e.target.value))
            }}
          />
        </label>
      </div>
      <div className="step-timeline" aria-label="所有计算步骤">
        {steps.map((s, i) => (
          <button
            key={s.id}
            aria-label={`跳至 ${s.label}`}
            aria-current={step === i ? 'step' : undefined}
            title={s.label}
            onClick={() => {
              setPlaying(false)
              seek(i)
            }}
          >
            <span>{i < 2 || i > steps.length - 3 ? s.label.split(' ')[0] : `L${s.layer}`}</span>
            <i className={i <= step ? 'step-complete' : ''} />
          </button>
        ))}
      </div>
      <div className="activation-chart">
        <div className="chart-heading">
          <h3>Residual Stream · 每层输出 RMS</h3>
          <span className="mono">
            Token {query} · {data.tokens[query]!.display}
          </span>
        </div>
        <svg
          viewBox="0 0 560 215"
          role="img"
          aria-label={`Token ${query} 各层输出 Residual RMS，当前 Layer ${layer} 为 ${values[layer]!.toFixed(5)}`}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={44} x2={524} y1={170 - f * 132} y2={170 - f * 132} stroke="#293239" />
              <text x={34} y={174 - f * 132} textAnchor="end" className="matrix-label">
                {(max * f).toFixed(1)}
              </text>
            </g>
          ))}
          <polyline points={points} fill="none" stroke="#9cbcc5" strokeWidth={2} />
          {values.map((v, i) => (
            <g key={i}>
              <circle
                cx={44 + (i * 480) / (values.length - 1)}
                cy={170 - (v / max) * 132}
                r={i === layer ? 5 : 2.8}
                fill={i === layer ? '#f0f0ec' : '#7898a3'}
              />
              <text
                x={44 + (i * 480) / (values.length - 1)}
                y={196}
                textAnchor="middle"
                className="matrix-label"
              >
                {i}
              </text>
            </g>
          ))}
          <text x={525} y={214} textAnchor="end" className="axis-name">
            Layer（零基索引）
          </text>
        </svg>
        <dl className="activation-readout">
          <div>
            <dt>Layer {layer} · L2 Norm</dt>
            <dd>{stats[layer]!.l2[query]!.toFixed(5)}</dd>
          </div>
          <div>
            <dt>Layer {layer} · RMS</dt>
            <dd>{values[layer]!.toFixed(5)}</dd>
          </div>
          <div>
            <dt>隐藏维度</dt>
            <dd>{data.model.hidden_size}</dd>
          </div>
        </dl>
        <p className="science-note">
          L2 = √Σxᵢ²；RMS = √(Σxᵢ² / d)，沿隐藏维度计算。统计点为各 Block 在 MLP
          残差相加后的输出。数值大小不代表“理解程度”。
        </p>
      </div>
    </section>
  )
}

function StepMeasurement({ data, id }: { data: Analysis; id: string }) {
  const query = useLab((s) => s.query),
    layer = useLab((s) => s.layer),
    head = useLab((s) => s.head),
    key = useLab((s) => s.key)
  const prediction = data.next_token_predictions.by_position[query]!
  const top = prediction.candidates[0]!
  const residual = data.activation_summaries.find((s) => s.id === `block-${layer}`)!
  let label: string, value: string
  if (id === 'tokenize') {
    label = '实际序列长度 · 未插入 BOS'
    value = `${data.input.sequence_length} Tokens`
  } else if (id === 'embedding') {
    label = `Token ${query} · Token / Position Embedding RMS`
    value = `${data.activation_summaries[0]!.rms[query]!.toFixed(5)} / ${data.activation_summaries[1]!.rms[query]!.toFixed(5)}`
  } else if (id.startsWith('attn')) {
    label = `L${layer} / H${head} · Q${query} → K${key}`
    value = currentMatrix(data, layer, head)[query]![key]!.toFixed(8)
  } else if (id.startsWith('resid')) {
    label = `Token ${query} · Block ${layer} 输出 RMS`
    value = residual.rms[query]!.toFixed(5)
  } else if (id === 'logits') {
    label = `位置 ${query} · 候选 ${top.display} 的原始 Logit`
    value = top.logit.toFixed(5)
  } else {
    label = `位置 ${query} · ${top.display} 的完整词表概率`
    value = percent(top.probability)
  }
  return (
    <dl className="step-measurement">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  )
}
