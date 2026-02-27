'use client'

import { useState } from 'react'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'

interface CategoryFormProps {
  category: CategoryBaseData
  onSave: (updates: Partial<CategoryBaseData>) => void
  onDelete: (id: number) => void
  onClose: () => void
}

export default function UpdateCategoryForm({ category, onSave, onDelete, onClose }: CategoryFormProps) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color || '#cccccc')
  const [isDone, setIsDone] = useState(!!category.is_done)
  const [loading, setLoading] = useState(false)

  const handleSave = () => {
    setLoading(true)
    onSave({ name, color, is_done: isDone })
    setLoading(false)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this category?')) {
      onDelete(category.id)
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="app-input"
        />
      </div>

      <div className="glass-panel flex items-center justify-between rounded-[1.4rem] p-4">
        <div>
          <p className="text-sm font-medium">Lane Color</p>
          <p className="mt-1 text-sm app-text-muted">Used for quick visual recognition on the board.</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-2xl border border-white/40"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 rounded-xl bg-transparent"
          />
        </div>
      </div>

      <label className="glass-panel flex items-center gap-3 rounded-[1.3rem] p-4">
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => setIsDone((prev) => !prev)}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium">Mark this as the done lane</span>
      </label>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={handleDelete} className="glass-button glass-button-danger justify-center sm:justify-start">
          Delete
        </button>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-button">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
