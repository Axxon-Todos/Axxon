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
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${className}`}
      style={{
        backgroundColor: label.color,
        color: '#fff',
      }}
    >
      <span>{label.name}</span>
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
