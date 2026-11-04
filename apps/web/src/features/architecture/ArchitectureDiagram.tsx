import type { Analysis } from '../../data/analysis.generated'
import { useLab } from '../../store/lab'

export function ArchitectureDiagram({
  data,
  compact = false,
}: {
  data: Analysis
  compact?: boolean
}) {
  const layer = useLab((s) => s.layer),
    component = useLab((s) => s.component),
    focus = useLab((s) => s.focus)
  const blocks = data.architecture.components.filter((c) => c.kind === 'block')
  const focused = !!component?.startsWith('block-')
  if (focused && !compact) return <BlockDiagram layer={layer} />
  const height = 185 + blocks.length * 32
  return (
    <svg
      className={`architecture-diagram ${compact ? 'compact-diagram' : ''}`}
      viewBox={`0 0 430 ${height}`}
      role="group"
      aria-label="GPT-2 完整架构二维示意图"
    >
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10" fill="#69828a" />
        </marker>
      </defs>
      <path
        d={`M215 72V${height - 34}`}
        stroke="#69828a"
        strokeWidth="1"
        markerEnd="url(#flow-arrow)"
      />
      <DiagramButton
        x={68}
        y={12}
        w={146}
        h={42}
        id="embedding"
        label="Token Embedding"
        onClick={focus}
        selected={component === 'embedding'}
      />
      <DiagramButton
        x={228}
        y={12}
        w={146}
        h={42}
        id="position"
        label="Position Embedding"
        onClick={focus}
        selected={component === 'position'}
      />
      <path d="M141 54V68H301V54M215 68V83" stroke="#69828a" fill="none" />
      <text x={215} y={76} textAnchor="middle" fill="#c4a98c" fontSize={15}>
        ⊕
      </text>
      {blocks.map((b, i) => (
        <g key={b.id}>
          <DiagramButton
            x={103}
            y={87 + i * 32}
            w={224}
            h={25}
            id={b.id}
            label={`Transformer Block ${i}`}
            onClick={focus}
            selected={i === layer}
          />
          <text x={82} y={104 + i * 32} textAnchor="end" className="diagram-number">
            {String(i).padStart(2, '0')}
          </text>
          <path d={`M327 ${96 + i * 32}h26v9h-26`} stroke="#59727b" fill="none" opacity={0.7} />
        </g>
      ))}
      <DiagramButton
        x={103}
        y={92 + blocks.length * 32}
        w={224}
        h={27}
        id="final-norm"
        label="Final LayerNorm"
        onClick={focus}
        selected={component === 'final-norm'}
      />
      <DiagramButton
        x={103}
        y={126 + blocks.length * 32}
        w={224}
        h={27}
        id="projection"
        label="Output Projection → Logits"
        onClick={focus}
        selected={component === 'projection'}
      />
      <text x={215} y={height - 6} textAnchor="middle" className="diagram-number">
        组件示意 · 位置与几何不代表物理结构
      </text>
    </svg>
  )
}

function DiagramButton({
  x,
  y,
  w,
  h,
  id,
  label,
  onClick,
  selected,
}: {
  x: number
  y: number
  w: number
  h: number
  id: string
  label: string
  onClick: (id: string) => void
  selected: boolean
}) {
  return (
    <g
      className="diagram-button"
      role="button"
      tabIndex={0}
      aria-label={`查看 ${label}`}
      aria-pressed={selected}
      onClick={() => onClick(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(id)
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={selected ? '#b3cbd0' : '#1a252c'}
        stroke={selected ? '#d9e7ea' : '#3a4c56'}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        textAnchor="middle"
        fill={selected ? '#152229' : '#c4d1d5'}
        fontSize={11}
      >
        {label}
      </text>
    </g>
  )
}

export function BlockDiagram({ layer }: { layer: number }) {
  const focus = useLab((s) => s.focus),
    component = useLab((s) => s.component)
  const b = `block-${layer}`
  const nodes = [
    ['ln1', 'LayerNorm 1'],
    ['attention', 'Causal Self-Attention'],
    ['sum-attn', '⊕ Residual Addition'],
    ['ln2', 'LayerNorm 2'],
    ['mlp', 'MLP'],
    ['sum-mlp', '⊕ Residual Addition'],
  ]
  return (
    <svg
      className="block-diagram"
      viewBox="0 0 430 470"
      role="group"
      aria-label={`Transformer Block ${layer} 内部计算示意图`}
    >
      <text x={215} y={24} textAnchor="middle" className="axis-name">
        Block {layer} · Pre-LayerNorm
      </text>
      <path d="M215 46V430" stroke="#69828a" />
      <path
        d="M215 46H65V207H121M215 225H365V387H310"
        fill="none"
        stroke="#c4a98c"
        strokeDasharray="4 4"
      />
      <text x={57} y={140} transform="rotate(-90 57 140)" className="diagram-number" fill="#c4a98c">
        Residual
      </text>
      <text
        x={382}
        y={311}
        transform="rotate(90 382 311)"
        className="diagram-number"
        fill="#c4a98c"
      >
        Residual
      </text>
      {nodes.map(([suffix, name], i) => (
        <DiagramButton
          key={suffix}
          x={121}
          y={66 + i * 60}
          w={188}
          h={40}
          id={`${b}.${suffix}`}
          label={name!}
          onClick={focus}
          selected={component === `${b}.${suffix}`}
        />
      ))}
      <text x={215} y={450} textAnchor="middle" className="diagram-number">
        [batch, sequence, hidden] → 同形状
      </text>
    </svg>
  )
}
