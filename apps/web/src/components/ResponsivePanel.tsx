import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function ResponsivePanel({
  label,
  children,
  initialMobileOpen = false,
}: {
  label: string
  children: ReactNode
  initialMobileOpen?: boolean
}) {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches)
  const [open, setOpen] = useState(initialMobileOpen)
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return (
    <>
      <button
        className="mobile-panel-toggle"
        aria-expanded={!mobile || open}
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown size={17} />
      </button>
      <div className="responsive-panel-content" hidden={mobile && !open}>
        {children}
      </div>
    </>
  )
}
