import { useState } from 'react'
import { GitBranch, Grid2X2, Info } from 'lucide-react'
import { currentMatrix, useLab } from '../../store/lab'
import type { Analysis } from '../../data/analysis.generated'
import { AttentionMatrix } from '../../visualization/AttentionMatrix'
import { percent } from '../../components/Primitives'

export function LayerHeadControls({ data }: { data: Analysis }) {
  const layer = useLab((s) => s.layer),
    head = useLab((s) => s.head)
  const setLayer = useLab((s) => s.setLayer),
    setHead = useLab((s) => s.setHead)
  return (
    <div className="layer-head-controls">
      <label>
        Layer{' '}
        <select
          aria-label="选择 Layer"
          value={layer}
          onChange={(e) => setLayer(Number(e.target.value))}
        >
          {Array.from({ length: data.model.layers }, (_, i) => (
            <option key={i} value={i}>
              Layer {i}
            </option>
          ))}
        </select>
      </label>
      <label>
        Head{' '}
        <select
          aria-label="选择 Head"
          value={head}
          onChange={(e) => setHead(Number(e.target.value))}
        >
          {Array.from({ length: data.model.heads }, (_, i) => (
            <option key={i} value={i}>
              Head {i}
            </option>
          ))}
        </select>
      </label>
      <span className="small muted">零基索引</span>
    </div>
  )
}

export function AttentionInspector({ data }: { data: Analysis }) {
  const layer = useLab((s) => s.layer),
    head = useLab((s) => s.head),
    query = useLab((s) => s.query),
    key = useLab((s) => s.key)
  const setQuery = useLab((s) => s.setQuery),
    setKey = useLab((s) => s.setKey)
  const [links, setLinks] = useState(false),
    [threshold, setThreshold] = useState(0.08)
  const matrix = currentMatrix(data, layer, head),
    row = matrix[query]!
  const summary = data.activation_summaries.find((s) => s.id === `block-${layer}`)!
  return (
    <section className="attention-inspector" aria-label="Attention Inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Attention Inspector</span>
          <h2>注意力的分配</h2>
        </div>
        <span className="tensor-tag" data-testid="matrix-label">
          L{layer} / H{head}{' '}
          <span>
            {data.tokens.length} × {data.tokens.length}
          </span>
        </span>
      </div>
      <LayerHeadControls data={data} />
      <div className="matrix-toolbar">
        <span className="small muted">行 = Query · 列 = Key</span>
        <div className="segmented small-segment">
          <button aria-pressed={!links} onClick={() => setLinks(false)} aria-label="矩阵视图">
            <Grid2X2 size={14} />
            矩阵
          </button>
          <button aria-pressed={links} onClick={() => setLinks(true)} aria-label="关联连线视图">
            <GitBranch size={14} />
            关联
          </button>
        </div>
      </div>
      {links ? (
        <div className="association-container">
          <label className="range-label">
            显示阈值 <span>{percent(threshold)}</span>
            <input
              aria-label="连线显示阈值"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <Associations
            data={data}
            row={row}
            query={query}
            threshold={threshold}
            select={setKey}
            selectedKey={key}
          />
          <p className="small muted">只绘制权重 ≥ 阈值的前 12 条关系；阈值不改变矩阵或原始数值。</p>
        </div>
      ) : (
        <AttentionMatrix
          matrix={matrix}
          tokens={data.tokens}
          query={query}
          selectedKey={key}
          label={`Attention Matrix Layer ${layer} Head ${head}`}
          onSelect={(q, k) => {
            setQuery(q)
            setKey(k)
          }}
        />
      )}
      <div className="query-key-controls">
        <label>
          Query
          <select
            aria-label="选择 Query Token"
            value={query}
            onChange={(e) => setQuery(Number(e.target.value))}
          >
            {data.tokens.map((t) => (
              <option value={t.position} key={t.position}>
                {t.position} · {t.display}
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden="true">→</span>
        <label>
          Key
          <select
            aria-label="选择 Key Token"
            value={key}
            onChange={(e) => setKey(Number(e.target.value))}
          >
            {data.tokens.map((t) => (
              <option value={t.position} key={t.position}>
                {t.position} · {t.display}
                {t.position > query ? ' [Mask]' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="selected-measurement">
        <div>
          <span>
            Q{query} → K{key}
          </span>
          <strong data-testid="attention-value">{row[key]!.toFixed(8)}</strong>
          <small>
            {key > query ? 'Causal Mask · 未来位置不可访问' : `概率 ${percent(row[key]!)}`}
          </small>
        </div>
        <div>
          <span>
            Block {layer} · Token {query}
          </span>
          <strong>{summary.rms[query]!.toFixed(4)}</strong>
          <small>输出 Residual Stream · RMS</small>
        </div>
      </div>
      <details className="compact-details">
        <summary>读取当前 Query 行的完整数值</summary>
        <div className="table-scroll">
          <table>
            <caption>
              Layer {layer} / Head {head} / Query {query}
            </caption>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Token</th>
                <th scope="col">概率</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {row.map((p, k) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>
                    <code>{data.tokens[k]!.display}</code>
                  </td>
                  <td className="mono">{p.toFixed(8)}</td>
                  <td>{k > query ? '因果遮罩' : '可访问'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="science-note">
        <Info size={14} />
        每行在可访问位置上的概率和约为 1。注意力是可观测计算量，不能单独证明因果关系。
      </p>
      <code className="hook-caption">{data.attention.hooks[layer]} · float32</code>
    </section>
  )
}

function Associations({
  data,
  row,
  query,
  threshold,
  select,
  selectedKey,
}: {
  data: Analysis
  row: number[]
  query: number
  threshold: number
  select: (k: number) => void
  selectedKey: number
}) {
  const entries = row
    .map((p, k) => ({ p, k }))
    .filter((e) => e.k <= query && e.p >= threshold)
    .sort((a, b) => b.p - a.p)
    .slice(0, 12)
    .sort((a, b) => a.k - b.k)
  if (!entries.length)
    return <div className="empty-state">此阈值下没有可显示的关系。降低阈值可查看。</div>
  const width = Math.max(440, entries.length * 70)
  return (
    <div className="association-scroll">
      <svg
        viewBox={`0 0 ${width} 240`}
        style={{ minWidth: entries.length > 6 ? width : undefined }}
        role="group"
        aria-label="同一 Attention 行的关联连线"
      >
        <text x={width / 2} y={25} textAnchor="middle" className="matrix-label">
          Query {query} · {data.tokens[query]!.display}
        </text>
        <rect x={width / 2 - 36} y={40} width={72} height={32} rx={3} fill="#9cbcc5" />
        <text x={width / 2} y={60} textAnchor="middle" fill="#0b0f12" fontSize={12}>
          {query}
        </text>
        {entries.map(({ k, p }, i) => {
          const x = ((i + 0.5) * width) / entries.length
          return (
            <g
              key={k}
              role="button"
              tabIndex={0}
              aria-label={`Key ${k}: ${p.toFixed(8)}`}
              onClick={() => select(k)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  select(k)
                }
              }}
            >
              <path
                d={`M${width / 2},72 C${width / 2},135 ${x},115 ${x},174`}
                fill="none"
                stroke={selectedKey === k ? '#f0f0ec' : '#9cbcc5'}
                strokeWidth={1 + p * 7}
                opacity={0.3 + 0.7 * p}
              />
              <rect
                x={x - 28}
                y={174}
                width={56}
                height={28}
                fill="#1a262e"
                stroke={selectedKey === k ? '#f0f0ec' : '#455962'}
                rx={3}
              />
              <text x={x} y={193} textAnchor="middle" className="matrix-label">
                K{k}
              </text>
              <text x={x} y={222} textAnchor="middle" className="matrix-label">
                {percent(p)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
