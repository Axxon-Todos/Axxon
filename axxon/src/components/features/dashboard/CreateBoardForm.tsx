'use client'

import { useState } from 'react'
import { useCreateBoard } from '@/lib/mutations/useCreateBoard'

interface CreateBoardFormProps {
  onClose: () => void
}

export default function CreateBoardForm({ onClose }: CreateBoardFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2563eb')

  const createMutation = useCreateBoard()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    createMutation.mutate(
      { name, color },
      {
        onSuccess: () => {
          onClose()
        }
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Board Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter board name"
          className="app-input"
          autoFocus
        />
      </div>

      <div className="glass-panel flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-sm font-medium">Board Accent</p>
          <p className="mt-1 text-sm app-text-muted">Used as the board’s visual identifier.</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-2xl border border-white/40 shadow-inner"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="glass-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Board'}
        </button>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-rose-400">
          {createMutation.error?.message || 'Failed to create board'}
        </p>
      )}
    </form>
  )
}
