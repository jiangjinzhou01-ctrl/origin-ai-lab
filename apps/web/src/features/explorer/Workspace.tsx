import { ArrowUpRight, Braces, GitBranch, ListVideo } from 'lucide-react'
import type { Analysis } from '../../data/analysis.generated'
import { Eyebrow, Loading } from '../../components/Primitives'
import { Provenance } from '../../components/Provenance'
import { ResponsivePanel } from '../../components/ResponsivePanel'
import { useLab, type View } from '../../store/lab'
import { AttentionInspector } from '../attention/AttentionInspector'
import { SceneViewport } from '../architecture/SceneViewport'
import { InferenceObservatory } from '../inference/InferenceObservatory'
import { ExperimentControls } from './ExperimentControls'
import { Predictions } from './Predictions'
import { TokenDetails, TokenRail } from './TokenRail'

const tabs = [
  { id: 'attention' as View, label: 'Attention', icon: GitBranch },
  { id: 'tokens' as View, label: 'Token 详情', icon: Braces },
  { id: 'inference' as View, label: '推理回放', icon: ListVideo },
]

export function Workspace({ data }: { data: Analysis }) {
  const view = useLab((s) => s.view),
    setView = useLab((s) => s.setView),
    page = useLab((s) => s.setPage)
  const status = useLab((s) => s.status),
    error = useLab((s) => s.error),
    mode = useLab((s) => s.mode)
  const choose = useLab((s) => s.chooseExperiment),
    manifest = useLab((s) => s.manifest)
  const layer = useLab((s) => s.layer),
    head = useLab((s) => s.head)
  return (
    <main className="workspace page-shell">
      <div className="workspace-title">
        <div>
          <Eyebrow number="01">Experiment workspace</Eyebrow>
          <h1>让计算，可以被观察。</h1>
        </div>
        <span className="experiment-code mono">
          {data.source_mode === 'static' ? 'RECORDED EXPERIMENT' : 'LIVE ANALYSIS'}
          <span>{data.analysis_id}</span>
        </span>
      </div>
      <ExperimentControls />
      {error && (
        <div className="inline-error" role="alert">
          <div>
            <strong>新实验未完成</strong>
            <p>{error}</p>
          </div>
          <button
            className="button small-button"
            onClick={() => void choose(manifest!.experiments[0]!.id)}
          >
            使用预计算实验
          </button>
        </div>
      )}
      {(data.source_mode !== mode || status === 'error') && (
        <p className="last-result-note" role="status">
          下方保留的是上一次{data.source_mode === 'static' ? '预计算实验' : '实时分析'}
          结果，尚无当前输入的新结果。
        </p>
      )}
      {status === 'loading' ? (
        <Loading label={mode === 'live' ? '正在等待真实模型计算…' : '正在校验并载入实验…'} />
      ) : (
        <>
          <div className="workspace-tabs" role="tablist" aria-label="实验视图">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                onClick={() => setView(t.id)}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
            <span className="small muted">实际模型数据 · {data.tokens.length} Tokens</span>
          </div>
          <TokenRail data={data} />
          <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
            {view === 'tokens' ? (
              <>
                <TokenDetails data={data} />
                <div className="token-analysis-next">
                  <p>选择 Token 后，Attention 与下一 Token 预测使用同一个位置。</p>
                  <button className="button" onClick={() => setView('attention')}>
                    查看此 Token 的 Attention
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className={`analysis-layout ${view === 'inference' ? 'inference-layout' : ''}`}>
                <div className="primary-analysis">
                  {view === 'attention' ? (
                    <AttentionInspector data={data} />
                  ) : (
                    <InferenceObservatory data={data} />
                  )}
                </div>
                <aside className="context-sidebar">
                  <ResponsivePanel label="预测与模型信息">
                    <Predictions data={data} />
                    {view === 'attention' && (
                      <section className="context-architecture">
                        <div className="panel-heading">
                          <span className="eyebrow">Model context</span>
                          <button className="text-link" onClick={() => page('architecture')}>
                            完整架构
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                        <SceneViewport data={data} compact />
                        <div className="context-readout">
                          <span>当前检查</span>
                          <strong>
                            Block {layer} / Head {head}
                          </strong>
                        </div>
                      </section>
                    )}
                  </ResponsivePanel>
                </aside>
              </div>
            )}
          </div>
          {view === 'tokens' && <Predictions data={data} />}
          <Provenance data={data} />
        </>
      )}
    </main>
  )
}
