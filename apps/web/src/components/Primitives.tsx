import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ArrowUpRight, RotateCcw } from 'lucide-react'

export function OriginMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1.5" />
      <ellipse
        cx="32"
        cy="32"
        rx="9"
        ry="23"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(42 32 32)"
      />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  )
}

export function Eyebrow({ children, number }: { children: ReactNode; number?: string }) {
  return (
    <div className="eyebrow">
      {number && <span className="index">{number}</span>}
      {children}
    </div>
  )
}

export function SectionTitle({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="section-title">
      <h2>
        <span className="index">{number}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

export function LinkArrow() {
  return <ArrowUpRight size={16} aria-hidden="true" />
}

export function Loading({ label = '正在读取经过验证的实验数据…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loader" />
      <p>{label}</p>
    </div>
  )
}

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ORIGIN view error', error, info.componentStack)
  }
  render() {
    if (this.state.failed)
      return (
        this.props.fallback ?? (
          <div className="error-state" role="alert">
            <h2>此视图未能加载</h2>
            <p>刷新可重新读取实验；科学数据不会由模拟值代替。</p>
            <button className="button" onClick={() => location.reload()}>
              <RotateCcw size={16} />
              重新载入
            </button>
          </div>
        )
      )
    return this.props.children
  }
}

export const percent = (p: number) => `${(p * 100).toFixed(2)}%`
export const tensor = (shape: readonly number[]) => `[${shape.join(' × ')}]`
