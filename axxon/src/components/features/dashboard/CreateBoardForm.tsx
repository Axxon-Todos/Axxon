'use client'

import { useState } from 'react'
import { useCreateBoard } from '@/lib/mutations/useCreateBoard'

interface CreateBoardFormProps {
  onClose: () => void
}

export default function CreateBoardForm({ onClose }: CreateBoardFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#000000')

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
      <div>
        <label className="block text-sm font-medium mb-2">Board Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter board name"
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Board Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-full h-10 rounded-lg cursor-pointer"
        />
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Board'}
        </button>
      </div>

      {createMutation.isError && (
        <p className="text-red-500 text-sm">
          {createMutation.error?.message || 'Failed to create board'}
        </p>
      )}
    </form>
  )
}
