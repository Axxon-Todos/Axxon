'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateBoardById } from '@/lib/api/boards/updateBoardById'
import type { UpdateBoard } from '@/lib/types/boardTypes'
import Modal from '@/components/ui/Modal'

type EditBoardModalProps = {
  board: UpdateBoard
  onClose: () => void
  onSuccess: () => void
}

export default function EditBoardModal({ board, onClose, onSuccess }: EditBoardModalProps) {
  // Default to empty string or black if undefined
  const [name, setName] = useState(board.name || '')
  const [color, setColor] = useState(board.color || '#000000')

  const updateMutation = useMutation({
    mutationFn: () => updateBoardById(String(board.id), { name, color }),
    onSuccess,
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter') {
        e.preventDefault()
        updateMutation.mutate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [name, color, onClose, updateMutation])

  return (
    <Modal isOpen onClose={onClose} title="Edit Board">
      <div className="space-y-4">
        <input
          type="text"
          className="app-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board name"
          autoFocus
        />
        <div className="glass-panel flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-sm font-medium">Board Accent</p>
            <p className="mt-1 text-sm app-text-muted">Keep it distinct in the sidebar and dashboard.</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-2xl border border-white/40"
              style={{ backgroundColor: color }}
            />
            <input
              type="color"
              className="h-10 w-14 rounded-xl bg-transparent"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-button text-sm">Cancel</button>
          <button
            onClick={() => updateMutation.mutate()}
            className="glass-button glass-button-primary text-sm"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
