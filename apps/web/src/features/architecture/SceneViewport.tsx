import { lazy, Suspense, useEffect, useState } from 'react'
import { Box, Maximize2, RotateCcw, ArrowLeft } from 'lucide-react'
import type { Analysis } from '../../data/analysis.generated'
import { ErrorBoundary } from '../../components/Primitives'
import { useLab } from '../../store/lab'
import { ArchitectureDiagram } from './ArchitectureDiagram'

const SpatialScene = lazy(() => import('../../scenes/SpatialScene'))

function webGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function SceneViewport({
  data,
  home = false,
  compact = false,
}: {
  data: Analysis
  home?: boolean
  compact?: boolean
}) {
  const [supported] = useState(webGLAvailable)
  const [lost, setLost] = useState(false)
  const use3d = useLab((s) => s.use3d),
    setUse3d = useLab((s) => s.setUse3d)
  const reduced = useLab((s) => s.reducedMotion),
    component = useLab((s) => s.component)
  const focus = useLab((s) => s.focus),
    reset = useLab((s) => s.resetCamera)
  const spatial = supported && use3d && !lost && !reduced
  useEffect(() => {
    setLost(false)
  }, [use3d])
  const fallback = <ArchitectureDiagram data={data} compact={compact || home} />
  return (
    <div className={`scene-viewport ${home ? 'home-scene' : ''} ${compact ? 'compact-scene' : ''}`}>
      <div className="scene-meta">
        <span className="mono">{home ? 'FIG. 01' : 'GPT-2 / STRUCTURE'}</span>
        <span>{spatial ? '空间架构示意' : '二维架构示意'}</span>
      </div>
      <div className="scene-render">
        {spatial ? (
          <ErrorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <SpatialScene data={data} home={home} onContextLost={() => setLost(true)} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          fallback
        )}
      </div>
      {!home && (
        <div className="scene-caption">
          {component
            ? data.architecture.components.find((c) => c.id === component)?.name
            : 'Model overview'}
          <span>组件节点 ≠ 神经元</span>
        </div>
      )}
      <div className="scene-tools">
        {component && !home && (
          <button
            className="icon-button"
            aria-label="返回上一级架构"
            title="返回上一级架构"
            onClick={() => focus(component.includes('.') ? component.split('.')[0]! : null)}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <button className="icon-button" aria-label="重置相机" title="重置相机" onClick={reset}>
          <RotateCcw size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="模型总览"
          title="模型总览"
          onClick={() => focus(null)}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="view-toggle"
          aria-label="启用三维视图"
          aria-pressed={spatial}
          onClick={() => setUse3d(!use3d)}
          disabled={!supported || reduced}
        >
          <Box size={15} />
          {spatial ? '3D' : '2D'}
        </button>
      </div>
      <div className="scene-hint">
        {lost
          ? 'WebGL Context 已丢失，已切换二维视图。'
          : !supported
            ? 'WebGL 不可用，二维视图支持全部分析操作。'
            : reduced
              ? '降低动态效果：使用二维架构。'
              : spatial
                ? '拖动旋转 · 滚轮缩放 · 点击进入 Block'
                : '点击组件查看详情 · 可切换空间视图'}
      </div>
    </div>
  )
}
