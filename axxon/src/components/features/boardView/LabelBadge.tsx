'use client'
//base label layer to show additional labels past 2
import { LabelBaseData } from '@/lib/types/labelTypes'

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
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2.5 py-0.5 leading-4' : 'text-xs px-3 py-1'

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-white/15 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${sizeClasses} ${className}`}
      style={{
        backgroundColor: label.color,
        color: '#fff',
      }}
    >
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-75"
          aria-label="Remove label"
        >
          ×
        </button>
      )}
    </span>
  )
}
