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
    <div className="w-64 max-h-80 flex flex-col">
      {/* Search Input */}
      <div className="p-2 border-b sticky top-0 bg-white">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}  // Prevent drag detection
          placeholder="Search labels..."
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Label List */}
      <div className="overflow-auto flex-1">
        {!Array.isArray(allLabels) ? (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">
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
                    console.log('Label mouseDown:', label.name, label.id)
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Label mouseUp:', label.name, label.id, !isSelected)
                    onToggleLabel(label.id, !isSelected)
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
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
            className="flex items-center gap-2 px-3 py-2 border-t hover:bg-gray-100 cursor-pointer mt-1"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-600">
              Create <strong>"{searchQuery.trim()}"</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
