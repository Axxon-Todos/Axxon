'use client'
//base label layer to show additional labels past 2
import type { LabelBaseData } from '@/lib/types/labelTypes'

interface LabelBadgeProps {
  label: LabelBaseData
  onRemove?: () => void
  size?: 'sm' | 'md'
  className?: string
}

export default function LabelBadge({
  label,
  onRemove,
  size = 'md',
  className = ''
}: LabelBadgeProps) {
  const sizeClasses = size === 'sm' ? 'min-h-7 px-2.5 py-1 text-[11px] leading-none' : 'min-h-8 px-3 py-1.5 text-xs leading-none'

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${sizeClasses} ${className}`}
      style={{
        backgroundColor: label.color,
        color: '#fff',
      }}
    >
      <span className="truncate leading-none">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex h-4 w-4 items-center justify-center rounded-full hover:opacity-75"
          aria-label="Remove label"
        >
          ×
        </button>
      )}
    </span>
  )
}
