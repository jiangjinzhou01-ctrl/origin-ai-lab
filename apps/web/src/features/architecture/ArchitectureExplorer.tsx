import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Analysis } from '../../data/analysis.generated'
import { useLab } from '../../store/lab'
import { SceneViewport } from './SceneViewport'
import { BlockDiagram } from './ArchitectureDiagram'
import { LayerHeadControls } from '../attention/AttentionInspector'
import { Eyebrow, tensor } from '../../components/Primitives'
import { ResponsivePanel } from '../../components/ResponsivePanel'

export function ArchitectureExplorer({ data }: { data: Analysis }) {
  const layer = useLab((s) => s.layer),
    component = useLab((s) => s.component),
    focus = useLab((s) => s.focus)
  const setPage = useLab((s) => s.setPage),
    setView = useLab((s) => s.setView)
  const node = data.architecture.components.find((c) => c.id === component)
  const relevant = data.architecture.components.filter((c) => c.layer === layer)
  return (
    <main className="architecture-page page-shell">
      <div className="page-intro">
        <Eyebrow number="02">Architecture Explorer</Eyebrow>
        <h1>结构，为计算提供路径。</h1>
        <p>从整个模型到一个 Block，再到 Attention Head。每个节点都映射到真实模型配置。</p>
      </div>
      <div className="architecture-layout">
        <div className="architecture-main">
          <SceneViewport data={data} />
          <div className="architecture-legend">
            <span>
              <i />
              Attention Heads
            </span>
            <span>
              <i className="warm-dot" />
              MLP
            </span>
            <span>语义层级示意 · 非神经元级可视化</span>
          </div>
        </div>
        <aside className="architecture-info">
          <ResponsivePanel label="组件信息与张量形状" initialMobileOpen>
            <div className="breadcrumb">
              <button onClick={() => focus(null)}>GPT-2</button>
              {node && (
                <>
                  <span>/</span>
                  <span>{node.layer !== null ? `Block ${node.layer}` : node.name}</span>
                </>
              )}
            </div>
            <Eyebrow>{node ? node.kind : 'Model overview'}</Eyebrow>
            <h2>{node?.name ?? 'GPT-2 Small'}</h2>
            <p>
              {node?.description ??
                '一个可复现的 Decoder-only Transformer 研究样本。学习到的 Token 与位置嵌入经过 Pre-LayerNorm Blocks，再投影到词表。'}
            </p>
            <dl className="data-list">
              {node ? (
                <>
                  <div>
                    <dt>输入张量</dt>
                    <dd className="mono">{tensor(node.input_shape)}</dd>
                  </div>
                  <div>
                    <dt>输出张量</dt>
                    <dd className="mono">{tensor(node.output_shape)}</dd>
                  </div>
                  <div>
                    <dt>稳定组件 ID</dt>
                    <dd className="mono">{node.id}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>参数数量</dt>
                    <dd>{data.model.parameter_count.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Layers × Heads</dt>
                    <dd>
                      {data.model.layers} × {data.model.heads}
                    </dd>
                  </div>
                  <div>
                    <dt>Hidden / MLP</dt>
                    <dd>
                      {data.model.hidden_size} / {data.model.intermediate_size}
                    </dd>
                  </div>
                  <div>
                    <dt>位置编码</dt>
                    <dd>Learned absolute · {data.model.context_length} 位置</dd>
                  </div>
                  <div>
                    <dt>Output 权重</dt>
                    <dd>与 Token Embedding 共享</dd>
                  </div>
                </>
              )}
            </dl>
            <LayerHeadControls data={data} />
            <div className="component-list" aria-label={`Block ${layer} 的组件`}>
              {relevant.map((c) => (
                <button key={c.id} aria-pressed={component === c.id} onClick={() => focus(c.id)}>
                  <span>{c.name}</span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
            <button
              className="button primary"
              onClick={() => {
                focus(`block-${layer}.attention`)
                setView('attention')
                setPage('explore')
              }}
            >
              检查此层的 Attention
              <ArrowRight size={16} />
            </button>
          </ResponsivePanel>
        </aside>
      </div>
      <section className="block-explanation">
        <div>
          <Eyebrow number="02.1">Inside the block</Eyebrow>
          <h2>归一化、变换、再相加。</h2>
          <p>
            GPT-2 使用 Pre-LayerNorm。Attention 和 MLP 各自之前都有
            LayerNorm，各自之后都有残差相加。
          </p>
          <code>
            x′ = x + Attention(LN₁(x))
            <br />y = x′ + MLP(LN₂(x′))
          </code>
          <p className="small muted">
            图中的连线表示计算依赖；空间布局不表示模型的物理形态，也不等同于人类思考过程。
          </p>
          <button className="text-link" onClick={() => focus(`block-${layer}`)}>
            <ArrowLeft size={15} />
            聚焦当前 Block
          </button>
        </div>
        <BlockDiagram layer={layer} />
      </section>
    </main>
  )
}
