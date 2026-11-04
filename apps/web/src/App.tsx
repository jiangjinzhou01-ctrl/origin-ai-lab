import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useLab, type Page } from './store/lab'
import { Header } from './components/Header'
import { Home } from './components/Home'
import { About } from './components/About'
import { ErrorBoundary, Loading, OriginMark } from './components/Primitives'
import { Workspace } from './features/explorer/Workspace'
import { ArchitectureExplorer } from './features/architecture/ArchitectureExplorer'

export default function App() {
  const initialize = useLab((s) => s.initialize),
    data = useLab((s) => s.analysis)
  const page = useLab((s) => s.page),
    setPage = useLab((s) => s.setPage)
  const error = useLab((s) => s.error),
    status = useLab((s) => s.status)
  const reduced = useLab((s) => s.reducedMotion),
    setReduced = useLab((s) => s.setReducedMotion)
  useEffect(() => {
    void initialize()
  }, [initialize])
  useEffect(() => {
    const sync = () => {
      const value = location.hash.slice(1)
      if (['home', 'explore', 'architecture', 'about'].includes(value)) setPage(value as Page)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [setPage])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [setReduced])
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced)
  }, [reduced])
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      <Header />
      <div id="main-content" tabIndex={-1}>
        <ErrorBoundary>
          {!data ? (
            status === 'error' ? (
              <main className="error-state page-shell" role="alert">
                <h1>实验尚未载入</h1>
                <p>{error}</p>
                <button className="button primary" onClick={() => void initialize()}>
                  重新读取实验
                  <ArrowUpRight size={16} />
                </button>
              </main>
            ) : (
              <Loading />
            )
          ) : page === 'home' ? (
            <Home data={data} />
          ) : page === 'architecture' ? (
            <ArchitectureExplorer data={data} />
          ) : page === 'about' ? (
            <About data={data} />
          ) : (
            <Workspace data={data} />
          )}
        </ErrorBoundary>
      </div>
      <footer className="site-footer page-shell">
        <a href="#home" className="footer-brand" onClick={() => setPage('home')}>
          <OriginMark size={25} />
          <span>ORIGIN</span>
        </a>
        <p>Explore intelligence, not illusions.</p>
        <span>
          V1.0 <span className="tiny-divider" />
          Interactive Intelligence Laboratory
        </span>
      </footer>
    </>
  )
}
