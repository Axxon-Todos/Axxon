'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SideDrawerProps {
  isOpen: boolean
  title?: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function SideDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
  footer,
}: SideDrawerProps) {
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-panel-strong absolute right-0 top-0 flex h-full w-full flex-col border-l border-[var(--app-border)] shadow-2xl lg:w-[40vw] lg:min-w-[420px] lg:max-w-[720px]"
      >
        <header className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_92%,transparent)] px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
              {description ? <p className="mt-2 text-sm leading-6 app-text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="glass-button !h-11 !w-11 !p-0"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <footer className="sticky bottom-0 z-10 border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_92%,transparent)] px-5 py-4 backdrop-blur-xl sm:px-6">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body
  )
}
