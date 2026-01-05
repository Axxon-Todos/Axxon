'use client'

import { LabelBaseData } from '@/lib/types/labelTypes'
import LabelBadge from './LabelBadge'
import { Tag } from 'lucide-react'

interface LabelIconProps {
  labels: LabelBaseData[]
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export default function LabelIcon({ labels, onClick, className = '' }: LabelIconProps) {
  const labelCount = labels.length

  // No labels: Show base icon
  if (labelCount === 0) {
    return (
      <button
        onClick={(e) => onClick(e)}
        className={`text-gray-400 hover:text-gray-600 ${className}`}
        aria-label="Add labels"
      >
        <Tag className="w-4 h-4" />
      </button>
    )
  }

  // 1-2 labels: Show actual badges
  if (labelCount <= 2) {
    return (
      <div onClick={(e) => onClick(e)} className={`flex gap-1 cursor-pointer ${className}`}>
        {labels.map(label => (
          <LabelBadge key={label.id} label={label} size="sm" />
        ))}
      </div>
    )
  }

  // 3+ labels: Show first 2 + count
  return (
    <div onClick={(e) => onClick(e)} className={`flex gap-1 cursor-pointer ${className}`}>
      <LabelBadge label={labels[0]} size="sm" />
      <LabelBadge label={labels[1]} size="sm" />
      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
        +{labelCount - 2} more
      </span>
    </div>
  )
}
