'use client'

import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

import { updateTodoById } from '@/lib/api/todos/updateTodoById'
import { deleteTodoById } from '@/lib/api/todos/deleteTodoById'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { useToggleTodoLabel } from '@/lib/mutations/useToggleTodoLabel'
import { useCreateLabel } from '@/lib/mutations/useCreateLabel'

import LabelSelector from '@/components/features/boardView/LabelSelector'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

interface UpdateTodoFormProps {
  todo: TodoWithLabels
  boardId: string | number
  onClose?: () => void
  onDelete?: () => void
}

export default function UpdateTodoForm({ todo, boardId, onClose, onDelete }: UpdateTodoFormProps) {
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [priority, setPriority] = useState(todo.priority ? String(todo.priority) : '3')
  const [assigneeId, setAssigneeId] = useState(todo.assignee_id ? String(todo.assignee_id) : '')

  const queryClient = useQueryClient()
  const numericBoardId = Number(boardId)
  const numericTodoId = Number(todo.id)

  const updateMutation = useMutation({
    mutationFn: (updatedData: any) => updateTodoById(numericBoardId, numericTodoId, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', numericBoardId] })
      onClose?.()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTodoById(numericBoardId, numericTodoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', numericBoardId] })
      onClose?.()
      onDelete?.()
    },
  })

  const { data: allLabels } = useQuery({
    queryKey: ['labels', String(numericBoardId)],
    queryFn: () => fetchLabels(String(numericBoardId)),
  })

  const toggleLabel = useToggleTodoLabel(String(numericBoardId))
  const createLabel = useCreateLabel(String(numericBoardId))

  const handleToggleLabel = (labelId: number, isAdding: boolean) => {
    toggleLabel.mutate({ todoId: numericTodoId, labelId, isAdding })
  }

  const handleCreateLabel = (name: string) => {
    createLabel.mutate(
      { name },
      {
        onSuccess: (newLabel) => {
          toggleLabel.mutate({ todoId: numericTodoId, labelId: newLabel.id, isAdding: true })
        },
      }
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const assigneeIdValue = assigneeId.trim() === '' ? null : Number(assigneeId)
    if (assigneeIdValue !== null && Number.isNaN(assigneeIdValue)) {
      alert('Assignee ID must be a number or empty')
      return
    }

    updateMutation.mutate({
      title,
      description,
      priority: Number(priority),
      assignee_id: assigneeIdValue,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Todo title"
          className="app-input"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="app-input min-h-28 resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="app-input"
            required
          >
            <option value="1">None</option>
            <option value="2">Low</option>
            <option value="3">Medium</option>
            <option value="4">High</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Assignee ID</label>
          <input
            type="text"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            placeholder="Assignee ID (optional)"
            className="app-input"
          />
        </div>
      </div>

      <div className="glass-panel rounded-[1.4rem] p-4">
        <h3 className="text-sm font-semibold">Labels</h3>
        <div className="mt-3">
          <LabelSelector
            boardId={String(numericBoardId)}
            todoId={numericTodoId}
            currentLabels={todo.labels || []}
            allLabels={Array.isArray(allLabels) ? allLabels : []}
            onToggleLabel={handleToggleLabel}
            onCreateLabel={handleCreateLabel}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          className="glass-button glass-button-danger justify-center sm:justify-start"
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button">
            Cancel
          </button>
          <button
            type="submit"
            className="glass-button glass-button-primary"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}
