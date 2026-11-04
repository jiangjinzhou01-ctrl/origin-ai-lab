import { useEffect, useState } from 'react'
import { ArrowRight, FlaskConical, PlugZap, X } from 'lucide-react'
import { API_URL, health } from '../../data/client'
import { useLab } from '../../store/lab'

export function ExperimentControls() {
  const mode = useLab((s) => s.mode),
    setMode = useLab((s) => s.setMode)
  const manifest = useLab((s) => s.manifest),
    choose = useLab((s) => s.chooseExperiment)
  const selected = useLab((s) => s.experimentId),
    status = useLab((s) => s.status)
  const data = useLab((s) => s.analysis),
    submit = useLab((s) => s.submit),
    cancel = useLab((s) => s.cancel)
  const [text, setText] = useState('The cat sat on the')
  const [service, setService] = useState('尚未连接')
  useEffect(() => {
    if (mode !== 'live') return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    setService('检查服务中…')
    health(controller.signal)
      .then((result) =>
        setService(result.model_ready ? '模型已就绪' : `模型未就绪 · ${result.status}`),
      )
      .catch(() => {
        if (!controller.signal.aborted) setService('服务不可用')
        else setService('连接超时或已取消')
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [mode])
  return (
    <section className="experiment-controls" aria-label="实验设置">
      <div className="experiment-topline">
        <div className="segmented" aria-label="数据模式">
          <button
            aria-pressed={mode === 'static'}
            onClick={() => {
              setMode('static')
              if (data?.source_mode !== 'static') void choose(manifest?.experiments[0]?.id ?? '')
            }}
          >
            <FlaskConical size={14} />
            预计算实验
          </button>
          <button aria-pressed={mode === 'live'} onClick={() => setMode('live')}>
            <PlugZap size={14} />
            实时分析
          </button>
        </div>
        <span className="small muted">
          {mode === 'static' ? '无需后端 · 真实模型记录' : service}
        </span>
      </div>
      {mode === 'static' ? (
        <div className="preset-row">
          <label htmlFor="experiment">实验</label>
          <select
            id="experiment"
            value={selected}
            onChange={(e) => void choose(e.target.value)}
            aria-label="选择预计算实验"
          >
            {!selected && (
              <option value="" disabled>
                选择实验
              </option>
            )}
            {manifest?.experiments.map((e) => (
              <option value={e.id} key={e.id}>
                {e.title} — {e.text}
              </option>
            ))}
          </select>
          <span className="mono small muted desktop-only">
            {data?.input.sequence_length ?? '—'} TOKENS
          </span>
        </div>
      ) : (
        <form
          className="live-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(text)
          }}
        >
          <label htmlFor="live-text">
            输入文本<span>最多 {data?.runtime.max_tokens ?? 64} 个实际 Token，不自动截断</span>
          </label>
          <div className="live-input-row">
            <textarea
              id="live-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={8192}
              rows={2}
              placeholder="输入要分析的短文本…"
            />
            {status === 'loading' ? (
              <button type="button" className="button" onClick={cancel}>
                <X size={16} />
                取消
              </button>
            ) : (
              <button className="button primary" type="submit">
                运行分析
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <p className="small muted">
            连接 {API_URL}；文本仅发送至此分析服务。GPT-2 主要面向英文。中文可能占用更多 Token。
          </p>
        </form>
      )}
    </section>
  )
}
