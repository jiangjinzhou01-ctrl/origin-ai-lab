import { useEffect, useRef, useState } from 'react'
import type { Token } from '../data/analysis.generated'
import { percent } from '../components/Primitives'

export function attentionColor(value: number): string {
  const dark = [27, 38, 44],
    light = [183, 213, 219]
  return `rgb(${dark.map((v, i) => Math.round(v + (light[i]! - v) * value)).join(',')})`
}
export function attentionTextColor(value: number): '#ffffff' | '#000000' {
  const rgb = [27 + 156 * value, 38 + 175 * value, 44 + 175 * value]
  const linear = rgb.map((c) => {
    const s = Math.round(c) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  return luminance > 0.179 ? '#000000' : '#ffffff'
}
interface Props {
  matrix: number[][]
  tokens: Token[]
  query: number
  selectedKey: number
  onSelect: (query: number, key: number) => void
  label: string
}
const short = (s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s)

export function AttentionMatrix(props: Props) {
  const { matrix, tokens, query, selectedKey, onSelect, label } = props
  const [hovered, setHovered] = useState<[number, number] | null>(null)
  const n = tokens.length
  const cell = n <= 8 ? 49 : 35,
    left = 99,
    top = 83
  const width = left + cell * n + 20,
    height = top + cell * n + 24
  const shown = hovered ?? [query, selectedKey]
  const val = matrix[shown[0]]![shown[1]]!
  return (
    <div className="matrix-container">
      <div className="matrix-scroll">
        {n > 16 ? (
          <CanvasMatrix {...props} />
        ) : (
          <svg
            className="attention-matrix"
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={label}
            onPointerLeave={() => setHovered(null)}
          >
            <defs>
              <pattern id="causal-hatch" width="7" height="7" patternUnits="userSpaceOnUse">
                <path d="M-1 1L1 -1M0 7L7 0M6 8L8 6" stroke="#283238" strokeWidth="0.8" />
              </pattern>
            </defs>
            <text x={left} y={15} className="axis-name">
              Key → 被关注的位置
            </text>
            <text
              x={14}
              y={top + (cell * n) / 2}
              transform={`rotate(-90 14 ${top + (cell * n) / 2})`}
              textAnchor="middle"
              className="axis-name"
            >
              Query → 当前读取的位置
            </text>
            {tokens.map((t, k) => (
              <text
                key={`k${k}`}
                x={left + k * cell + cell / 2}
                y={top - 15}
                transform={`rotate(-32 ${left + k * cell + cell / 2} ${top - 15})`}
                className={`matrix-label ${k === selectedKey ? 'active-label' : ''}`}
              >
                {k} {short(t.display)}
              </text>
            ))}
            {tokens.map((t, q) => (
              <g key={q}>
                <text
                  x={left - 12}
                  y={top + q * cell + cell / 2 + 4}
                  textAnchor="end"
                  className={`matrix-label ${q === query ? 'active-label' : ''}`}
                >
                  {q} {short(t.display)}
                </text>
                {matrix[q]!.map((p, k) => (
                  <g key={k}>
                    <rect
                      x={left + k * cell + 1}
                      y={top + q * cell + 1}
                      width={cell - 3}
                      height={cell - 3}
                      rx="2"
                      fill={k > q ? 'url(#causal-hatch)' : attentionColor(p)}
                      stroke={
                        q === query && k === selectedKey
                          ? '#f0f0ec'
                          : q === query
                            ? '#6d868e'
                            : 'none'
                      }
                      strokeWidth={q === query && k === selectedKey ? 2 : 0.8}
                      role="button"
                      tabIndex={q === query && k === selectedKey ? 0 : -1}
                      aria-label={`Query ${q}, Key ${k}: ${p.toFixed(8)}${k > q ? '，因果遮罩' : ''}`}
                      data-testid={`cell-${q}-${k}`}
                      data-value={p.toFixed(8)}
                      onPointerEnter={() => setHovered([q, k])}
                      onFocus={() => setHovered([q, k])}
                      onClick={() => onSelect(q, k)}
                      onKeyDown={(e) => {
                        const moves: Record<string, [number, number]> = {
                          ArrowUp: [q - 1, k],
                          ArrowDown: [q + 1, k],
                          ArrowLeft: [q, k - 1],
                          ArrowRight: [q, k + 1],
                        }
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(q, k)
                        } else if (moves[e.key]) {
                          e.preventDefault()
                          const [nq, nk] = moves[e.key]!
                          if (nq >= 0 && nq < n && nk >= 0 && nk < n) {
                            onSelect(nq, nk)
                            e.currentTarget.ownerSVGElement
                              ?.querySelector<SVGRectElement>(`[data-testid="cell-${nq}-${nk}"]`)
                              ?.focus()
                          }
                        }
                      }}
                    >
                      <title>{`Query ${q} (${t.display}) → Key ${k} (${tokens[k]!.display}): ${p.toFixed(8)}${k > q ? ' · Causal Mask' : ''}`}</title>
                    </rect>
                    {n <= 6 && (
                      <text
                        pointerEvents="none"
                        x={left + k * cell + cell / 2}
                        y={top + q * cell + cell / 2 + 3}
                        textAnchor="middle"
                        className="cell-value"
                        fill={k > q ? '#8999a3' : attentionTextColor(p)}
                      >
                        {k > q ? '—' : p.toFixed(2)}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        )}
      </div>
      <div className="matrix-legend">
        <span>注意力概率</span>
        <span className="mono">0</span>
        <span className="legend-scale" />
        <span className="mono">1</span>
        <span className="masked-swatch" />
        <span>未来位置被屏蔽</span>
      </div>
      <div className="matrix-tooltip" role="status" aria-live="polite">
        <span>
          Q<span className="mono">{shown[0]}</span> → K<span className="mono">{shown[1]}</span>
        </span>
        <strong className="mono">{val.toFixed(8)}</strong>
        <span>
          {percent(val)}
          {shown[1] > shown[0] ? ' · Causal Mask，无法读取未来' : ' · 真实 Attention Probability'}
        </span>
      </div>
    </div>
  )
}

function CanvasMatrix({ matrix, tokens, query, selectedKey, onSelect, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const n = tokens.length,
    cell = 18,
    left = 90,
    top = 85
  const width = left + n * cell + 12,
    height = top + n * cell + 12
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    ctx.font = '10px monospace'
    matrix.forEach((row, q) =>
      row.forEach((p, k) => {
        const x = left + k * cell,
          y = top + q * cell
        ctx.fillStyle = k > q ? '#161e23' : attentionColor(p)
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
        if (k > q) {
          ctx.strokeStyle = '#293239'
          ctx.beginPath()
          ctx.moveTo(x + 3, y + cell - 3)
          ctx.lineTo(x + cell - 3, y + 3)
          ctx.stroke()
        }
        if (q === query && k === selectedKey) {
          ctx.strokeStyle = '#f0f0ec'
          ctx.lineWidth = 2
          ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
        }
      }),
    )
    tokens.forEach((t, i) => {
      ctx.fillStyle = '#a0b1b8'
      ctx.textAlign = 'right'
      ctx.fillText(`${i} ${short(t.display)}`, left - 6, top + i * cell + 13)
      ctx.save()
      ctx.translate(left + i * cell + 12, top - 8)
      ctx.rotate(-Math.PI / 3)
      ctx.textAlign = 'left'
      ctx.fillText(`${i} ${short(t.display)}`, 0, 0)
      ctx.restore()
    })
    return () => {
      canvas.width = 0
      canvas.height = 0
    }
  }, [matrix, tokens, query, selectedKey, width, height, left, top, cell])
  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      role="img"
      aria-label={`${label}，Query 为行、Key 为列；使用下方选择器和行数据表读取精确值。`}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const k = Math.floor((((e.clientX - rect.left) * width) / rect.width - left) / cell)
        const q = Math.floor((((e.clientY - rect.top) * height) / rect.height - top) / cell)
        if (q >= 0 && q < n && k >= 0 && k < n) onSelect(q, k)
      }}
    />
  )
}
