'use client'

import { useState, useMemo } from 'react'
import { LabelBaseData } from '@/lib/types/labelTypes'
import LabelBadge from './LabelBadge'
import { Check, Plus } from 'lucide-react'

interface LabelSelectorProps {
  boardId: string
  todoId: number
  currentLabels: LabelBaseData[]
  allLabels: LabelBaseData[]
  onToggleLabel: (labelId: number, isAdding: boolean) => void
  onCreateLabel: (name: string) => void
}

export default function LabelSelector({
  boardId,
  todoId,
  currentLabels,
  allLabels,
  onToggleLabel,
  onCreateLabel,
}: LabelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter labels based on search
  const filteredLabels = useMemo(() => {
    if (!Array.isArray(allLabels)) return []
    if (!searchQuery.trim()) return allLabels
    const query = searchQuery.toLowerCase()
    return allLabels.filter(label => label.name.toLowerCase().includes(query))
  }, [allLabels, searchQuery])

  // Check if search matches existing label exactly
  const exactMatch = useMemo(() => {
    if (!Array.isArray(allLabels)) return undefined
    return allLabels.find(l => l.name.toLowerCase() === searchQuery.toLowerCase())
  }, [allLabels, searchQuery])

  // Handle Enter key for create
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim() && !exactMatch) {
      e.preventDefault()
      onCreateLabel(searchQuery.trim())
      setSearchQuery('')
    }
  }

  const isLabelSelected = (labelId: number) => {
    return currentLabels.some(l => l.id === labelId)
  }

  return (
    <div className="flex max-h-80 w-72 flex-col">
      {/* Search Input */}
      <div
        className="sticky top-0 border-b p-3"
        style={{
          borderColor: 'var(--app-border)',
          background: 'color-mix(in srgb, var(--app-panel-strong) 92%, transparent)',
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}  // Prevent drag detection
          placeholder="Search labels..."
          className="app-input text-sm"
          autoFocus
        />
      </div>

      {/* Label List */}
      <div className="overflow-auto flex-1">
        {!Array.isArray(allLabels) ? (
          <div className="px-3 py-4 text-center text-sm app-text-muted">
            Loading labels...
          </div>
        ) : (
          <>
            {filteredLabels.map(label => {
              const isSelected = isLabelSelected(label.id)
              return (
                <div
                  key={label.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggleLabel(label.id, !isSelected)
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-white/10"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <LabelBadge label={label} size="sm" />
                </div>
              )
            })}

            {/* No results */}
            {filteredLabels.length === 0 && !searchQuery && (
              <div className="px-3 py-4 text-center text-sm app-text-muted">
                No labels yet
              </div>
            )}
          </>
        )}

        {/* Create New Label Option */}
        {searchQuery.trim() && !exactMatch && (
          <div
            onMouseDown={(e) => e.stopPropagation()}  // Prevent drag detection
            onClick={(e) => {
              e.stopPropagation()  // Prevent event from bubbling to DraggableTodo
              onCreateLabel(searchQuery.trim())
              setSearchQuery('')
            }}
            className="mt-1 flex cursor-pointer items-center gap-2 border-t px-3 py-3 hover:bg-white/10"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-600">
              Create <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
