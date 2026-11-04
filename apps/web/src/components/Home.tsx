import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Fingerprint,
  GitBranch,
  Layers3,
  Play,
} from 'lucide-react'
import type { Analysis } from '../data/analysis.generated'
import { useLab } from '../store/lab'
import { SceneViewport } from '../features/architecture/SceneViewport'
import { Eyebrow, OriginMark, percent, SectionTitle } from './Primitives'

export function Home({ data }: { data: Analysis }) {
  const setPage = useLab((s) => s.setPage),
    setView = useLab((s) => s.setView),
    choose = useLab((s) => s.chooseExperiment)
  const experiments = useLab((s) => s.manifest?.experiments)
  const final = data.next_token_predictions.by_position.at(-1)!.candidates[0]!
  function open(view: 'attention' | 'inference') {
    setView(view)
    setPage('explore')
  }
  return (
    <main className="home-page">
      <section className="hero page-shell">
        <div className="hero-copy">
          <Eyebrow>Interactive Intelligence Laboratory</Eyebrow>
          <h1>
            观察智能，
            <br />
            从一次<span>计算</span>开始<span className="hero-period">。</span>
          </h1>
          <p className="hero-description">
            走进真实 Transformer 的内部。
            <br />
            从一个 Token，到注意力的分配，再到下一个可能。
          </p>
          <div className="hero-actions">
            <button className="button primary hero-button" onClick={() => open('attention')}>
              探索模型
              <ArrowUpRight size={18} />
            </button>
            <button className="text-link" onClick={() => open('inference')}>
              <Play size={13} />
              回放一次推理
            </button>
          </div>
          <div className="hero-assurance">
            <Check size={13} />
            <span>真实 GPT-2 计算</span>
            <span className="tiny-divider" />
            <span>开源 · 可复现</span>
          </div>
        </div>
        <div className="hero-visual">
          <SceneViewport data={data} home />
          <div className="hero-data-stamp">
            <span className="stamp-dot" />
            <div>
              <span>GPT-2 SMALL</span>
              <strong>一次计算，{data.model.layers} 层路径。</strong>
            </div>
            <span className="mono">01—{String(data.model.layers).padStart(2, '0')}</span>
          </div>
        </div>
      </section>
      <section className="model-strip page-shell" aria-label="实际模型配置">
        <div className="model-identity">
          <OriginMark size={29} />
          <div>
            <strong>GPT-2 Small</strong>
            <span>公开权重 · Decoder-only Transformer</span>
          </div>
        </div>
        <div>
          <strong>{data.model.layers}</strong>
          <span>Transformer Blocks</span>
        </div>
        <div>
          <strong>{data.model.heads}</strong>
          <span>Heads / Block</span>
        </div>
        <div>
          <strong>{data.model.hidden_size}</strong>
          <span>Hidden Dimensions</span>
        </div>
        <div className="strip-end">
          <span className="verified-dot" />
          源自加载配置
          <span className="mono">{(data.model.parameter_count / 1e6).toFixed(1)}M parameters</span>
        </div>
      </section>
      <section className="home-experiments page-shell">
        <SectionTitle number="01" title="从一个真实实验开始">
          <span className="small muted">预计算数据 · 无需等待模型加载</span>
        </SectionTitle>
        <div className="experiment-grid">
          {experiments?.map((e, i) => (
            <button
              key={e.id}
              className="experiment-card"
              onClick={() => {
                void choose(e.id)
                setPage('explore')
              }}
            >
              <div className="experiment-card-top">
                <span className="mono">EXPERIMENT {String(i + 1).padStart(2, '0')}</span>
                <ArrowUpRight size={19} />
              </div>
              <h3>{e.title}</h3>
              <p className="experiment-prompt">
                {e.text}
                <span className="prompt-cursor" />
              </p>
              <p className="experiment-description">{e.description}</p>
              <div className="experiment-card-bottom">
                <span>{e.tokens} 个实际 Token</span>
                <span>
                  <i />
                  真实模型记录
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="inside-section page-shell">
        <div className="inside-copy">
          <Eyebrow number="02">Explore intelligence, not illusions.</Eyebrow>
          <h2>
            每一个数值，
            <br />
            都有来处。
          </h2>
          <p>看得见的结构，查得到的权重，复现得了的结果。ORIGIN 让探索始于观察，让解释保有边界。</p>
          <button className="text-link" onClick={() => setPage('about')}>
            了解我们的科学方法
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="inside-list">
          <article>
            <span className="feature-index">01</span>
            <GitBranch size={21} strokeWidth={1.3} />
            <div>
              <h3>把注意力，放在细节上。</h3>
              <p>精确到 Layer、Head 与 Token 的实际概率矩阵。每个位置都可以选择、读取、核验。</p>
            </div>
          </article>
          <article>
            <span className="feature-index">02</span>
            <Layers3 size={21} strokeWidth={1.3} />
            <div>
              <h3>从整体，走进计算路径。</h3>
              <p>连贯的空间架构与二维分析。结构示意和真实测量始终清楚区分。</p>
            </div>
          </article>
          <article>
            <span className="feature-index">03</span>
            <Fingerprint size={21} strokeWidth={1.3} />
            <div>
              <h3>真实，不止是一种承诺。</h3>
              <p>固定权重 Revision、计算配置与校验和随每次实验提供，也可以导出数据自行检查。</p>
            </div>
          </article>
        </div>
      </section>
      <section className="home-live-record page-shell">
        <span className="eyebrow">An actual observation</span>
        <p>
          “{data.input.text}”<ArrowRight size={22} />
          <code>{final.display}</code>
          <span>{percent(final.probability)} 的下一 Token 概率</span>
        </p>
        <button className="text-link" onClick={() => open('attention')}>
          检查这次记录
          <ArrowUpRight size={16} />
        </button>
      </section>
    </main>
  )
}
