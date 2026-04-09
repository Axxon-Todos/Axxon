// Renders centered product modals with consistent overlay, surface, and keyboard-dismiss behavior.
'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { buttonClassName } from '@/components/ui/Button'
import { surfaceClassName } from '@/components/ui/Surface'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[rgba(2,6,23,0.68)] backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div
        className={surfaceClassName({
          variant: 'strong',
          className:
            'relative z-50 w-full max-w-xl rounded-[1.75rem] p-6 text-[var(--app-foreground)] shadow-2xl',
        })}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          {title ? (
            <div>
              <p className="app-kicker">Dialog</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className={buttonClassName({ size: 'icon' })}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}
