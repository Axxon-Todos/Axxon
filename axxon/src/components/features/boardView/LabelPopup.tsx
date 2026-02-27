'use client'
//Label popup when clicked directly
import { useEffect, useRef, RefObject, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface LabelPopupProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
}

export default function LabelPopup({ isOpen, onClose, anchorRef, children }: LabelPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const clickedPopup = popupRef.current && popupRef.current.contains(target)
      const clickedAnchor = anchorRef.current && anchorRef.current.contains(target)

      if (!clickedPopup && !clickedAnchor) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Calculate position
  useEffect(() => {
    if (!isOpen || !anchorRef.current || !popupRef.current) return

    const anchor = anchorRef.current.getBoundingClientRect()
    const popup = popupRef.current

    // Position below anchor with 8px gap
    popup.style.position = 'fixed'
    popup.style.top = `${anchor.bottom + 8}px`
    popup.style.left = `${anchor.left}px`
    popup.style.zIndex = '900'
  }, [isOpen, anchorRef])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={popupRef}
      className="glass-panel-strong rounded-[1.25rem] border border-[var(--app-border)] shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
