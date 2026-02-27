'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!isOpen) return null

  // Render modal in portal to avoid stacking issues
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="glass-panel-strong relative z-50 w-full max-w-lg rounded-[1.75rem] p-6 text-[var(--app-foreground)] shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          {title ? <h2 className="text-xl font-semibold">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="glass-button !h-10 !w-10 !p-0"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Children */}
        {children}
      </div>
    </div>,
    document.body
  )
}
