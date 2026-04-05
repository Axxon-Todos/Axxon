// Renders a right-side drawer shell used for deeper task and board interactions across the app.
'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { buttonClassName } from '@/components/ui/Button'
import { surfaceClassName } from '@/components/ui/Surface'

interface SideDrawerProps {
  isOpen: boolean
  title?: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
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
        className="absolute inset-0 bg-[rgba(2,8,6,0.66)] backdrop-blur-md"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={surfaceClassName({
          variant: 'strong',
          className:
            'absolute right-0 top-0 flex h-full w-full flex-col border-l border-[var(--app-border-strong)] lg:w-[42vw] lg:min-w-[440px] lg:max-w-[760px]',
        })}
      >
        <header className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_95%,transparent)] px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title ? (
                <>
                  <p className="app-kicker">Detail</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
                </>
              ) : null}
              {description ? <p className="mt-3 text-sm leading-6 app-text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={buttonClassName({ size: 'icon' })}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <footer className="sticky bottom-0 z-10 border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_95%,transparent)] px-5 py-4 backdrop-blur-xl sm:px-6">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body
  )
}
