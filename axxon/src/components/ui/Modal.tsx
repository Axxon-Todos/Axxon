'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-6 z-50 transform transition-transform duration-300 text-black">
        {/* Header */}
        {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}

        {/* Children */}
        {children}
      </div>
    </div>,
    document.body
  )
}
