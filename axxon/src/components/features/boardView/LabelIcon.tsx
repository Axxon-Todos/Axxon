'use client'

import type { LabelBaseData } from '@/lib/types/labelTypes'
import LabelBadge from './LabelBadge'
import { Tag } from 'lucide-react'

interface LabelIconProps {
  labels: LabelBaseData[]
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export default function LabelIcon({ labels, onClick, className = '' }: LabelIconProps) {
  const labelCount = labels.length

  if (labelCount === 0) {
    return (
      <button
        type="button"
        onClick={(e) => onClick(e)}
        className={`inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_88%,white_12%)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] ${className}`}
        aria-label="Add labels"
      >
        <Tag className="h-3.5 w-3.5" />
        Add label
      </button>
    )
  }

  if (labelCount <= 2) {
    return (
      <button
        type="button"
        onClick={(e) => onClick(e)}
        className={`flex max-w-full flex-wrap items-center gap-1.5 text-left ${className}`}
      >
        {labels.map((label) => (
          <LabelBadge key={label.id} label={label} size="sm" />
        ))}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => onClick(e)}
      className={`flex max-w-full flex-wrap items-center gap-1.5 text-left ${className}`}
    >
      <LabelBadge label={labels[0]} size="sm" />
      <LabelBadge label={labels[1]} size="sm" />
      <span className="app-badge rounded-full px-2.5 py-1 text-[11px] leading-none">
        +{labelCount - 2} more
      </span>
    </button>
  )
}
