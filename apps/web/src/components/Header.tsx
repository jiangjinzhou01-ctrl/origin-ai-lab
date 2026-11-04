import { ArrowUpRight, Move, Waves } from 'lucide-react'
import { useLab, type Page } from '../store/lab'
import { OriginMark } from './Primitives'

const links: { page: Page; label: string }[] = [
  { page: 'explore', label: '探索实验' },
  { page: 'architecture', label: '模型架构' },
  { page: 'about', label: '关于 ORIGIN' },
]

export function Header() {
  const page = useLab((s) => s.page)
  const setPage = useLab((s) => s.setPage)
  const analysis = useLab((s) => s.analysis)
  const reduced = useLab((s) => s.reducedMotion)
  const setReduced = useLab((s) => s.setReducedMotion)
  return (
    <header className="site-header">
      <a href="#home" className="brand" aria-label="ORIGIN 首页" onClick={() => setPage('home')}>
        <OriginMark />
        <span>ORIGIN</span>
      </a>
      <nav aria-label="主导航">
        {links.map((link) => (
          <a
            key={link.page}
            href={`#${link.page}`}
            onClick={() => setPage(link.page)}
            aria-current={page === link.page ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="header-tools">
        <span className="mode-badge">
          <i />
          {analysis?.source_mode === 'live' ? '实时计算结果' : '预计算实验'}
          <span className="desktop-only"> / GPT-2</span>
        </span>
        <button
          className="icon-button motion-button"
          aria-label="降低动态效果"
          aria-pressed={reduced}
          onClick={() => setReduced(!reduced)}
          title="降低动态效果"
        >
          {reduced ? <Move size={17} /> : <Waves size={17} />}
        </button>
        <a
          href="#explore"
          className="header-enter"
          onClick={() => setPage('explore')}
          aria-label="进入实验室"
        >
          <ArrowUpRight size={19} />
        </a>
      </div>
    </header>
  )
}
