'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, FolderKanban, Sparkles, Tags, Trash2 } from 'lucide-react'

import LabelSelector from '@/components/features/boardView/LabelSelector'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { createTodo } from '@/lib/api/todos/createTodo'
import { deleteTodoById } from '@/lib/api/todos/deleteTodoById'
import { updateTodoById } from '@/lib/api/todos/updateTodoById'
import { useCreateLabel } from '@/lib/mutations/useCreateLabel'
import { useToggleTodoLabel } from '@/lib/mutations/useToggleTodoLabel'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { LabelBaseData } from '@/lib/types/labelTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

interface TodoDrawerProps {
  mode: 'create' | 'edit'
  boardId: number
  todo?: TodoWithLabels
  onClose: () => void
}

const priorityOptions = [
  { value: '1', label: 'None' },
  { value: '2', label: 'Low' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'High' },
]

export default function TodoDrawer({ mode, boardId, todo, onClose }: TodoDrawerProps) {
  const queryClient = useQueryClient()
  const boardIdKey = String(boardId)
  const isEditMode = mode === 'edit' && !!todo

  const { data: categories = [] } = useQuery<CategoryBaseData[]>({
    queryKey: ['categories', boardIdKey],
    queryFn: () => fetchCategories(boardIdKey),
  })
  const { data: allLabels = [] } = useQuery<LabelBaseData[]>({
    queryKey: ['labels', boardIdKey],
    queryFn: () => fetchLabels(boardIdKey),
  })

  const [title, setTitle] = useState(todo?.title || '')
  const [description, setDescription] = useState(todo?.description || '')
  const [priority, setPriority] = useState(todo?.priority ? String(todo.priority) : '3')
  const [dueDate, setDueDate] = useState(todo?.due_date ? todo.due_date.slice(0, 10) : '')
  const [categoryId, setCategoryId] = useState(todo?.category_id ? String(todo.category_id) : '')
  const [isComplete, setIsComplete] = useState(Boolean(todo?.is_complete))
  const [currentLabels, setCurrentLabels] = useState<LabelBaseData[]>(todo?.labels || [])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setTitle(todo?.title || '')
    setDescription(todo?.description || '')
    setPriority(todo?.priority ? String(todo.priority) : '3')
    setDueDate(todo?.due_date ? todo.due_date.slice(0, 10) : '')
    setCategoryId(todo?.category_id ? String(todo.category_id) : '')
    setIsComplete(Boolean(todo?.is_complete))
    setCurrentLabels(todo?.labels || [])
    setErrorMessage(null)
  }, [todo, mode])

  const createMutation = useMutation({
    mutationFn: () =>
      createTodo(boardId, {
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        priority: Number(priority),
        category_id: categoryId ? Number(categoryId) : undefined,
        is_complete: isComplete,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardIdKey] })
      onClose()
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTodoById(boardId, todo?.id || 0, {
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        priority: Number(priority),
        category_id: categoryId ? Number(categoryId) : null,
        is_complete: isComplete,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardIdKey] })
      onClose()
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTodoById(boardId, todo?.id || 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardIdKey] })
      onClose()
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
    },
  })

  const toggleLabel = useToggleTodoLabel(boardIdKey)
  const createLabel = useCreateLabel(boardIdKey)

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === categoryId),
    [categories, categoryId]
  )

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    toggleLabel.isPending ||
    createLabel.isPending

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage('Title is required.')
      return
    }

    if (isEditMode) {
      updateMutation.mutate()
      return
    }

    createMutation.mutate()
  }

  const handleToggleLabel = (labelId: number, isAdding: boolean) => {
    if (!todo?.id) return

    const label = allLabels.find((item) => item.id === labelId)
    if (!label) return

    setCurrentLabels((prev) =>
      isAdding ? [...prev.filter((item) => item.id !== labelId), label] : prev.filter((item) => item.id !== labelId)
    )
    toggleLabel.mutate({ todoId: todo.id, labelId, isAdding })
  }

  const handleCreateLabel = (name: string) => {
    createLabel.mutate(
      { name },
      {
        onSuccess: (createdLabel) => {
          queryClient.invalidateQueries({ queryKey: ['labels', boardIdKey] })
          if (!todo?.id) return
          setCurrentLabels((prev) => [...prev, createdLabel])
          toggleLabel.mutate({ todoId: todo.id, labelId: createdLabel.id, isAdding: true })
        },
      }
    )
  }

  const drawerTitle = isEditMode ? 'Refine Todo' : 'Add Todo'

  return (
    <div className="flex min-h-full flex-col">
      <section
        className="glass-panel rounded-[1.7rem] p-5"
        style={{
          background:
            'linear-gradient(145deg, color-mix(in srgb, var(--app-accent) 14%, var(--app-panel-strong)), var(--app-panel))',
        }}
      >
        <p className="app-kicker">{drawerTitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] text-[var(--app-accent)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">
              {isEditMode ? 'Keep this work moving' : 'Capture the next piece of work'}
            </h3>
            <p className="mt-1 text-sm leading-6 app-text-muted">
              Update core details, labels, and lane placement from one focused panel.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col gap-5">
        <section className="glass-panel rounded-[1.7rem] p-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ship dashboard polish"
              className="app-input"
              required
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the outcome, blocker, or next action."
              className="app-input min-h-32 resize-none"
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="glass-panel rounded-[1.7rem] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FolderKanban className="h-4 w-4 text-[var(--app-accent)]" />
              Workflow
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="app-input"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="glass-panel flex items-center justify-between rounded-[1.3rem] p-4">
                <div>
                  <p className="text-sm font-medium">Completion</p>
                  <p className="mt-1 text-sm app-text-muted">Mark work complete without leaving the board.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComplete((prev) => !prev)}
                  className={`glass-button ${isComplete ? 'glass-button-primary' : ''}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isComplete ? 'Complete' : 'Open'}
                </button>
              </label>
            </div>
          </div>

          <div className="glass-panel rounded-[1.7rem] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-[var(--app-accent)]" />
              Timing & Priority
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="app-input"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value)}
                      className={`glass-button justify-start rounded-[1rem] ${
                        priority === option.value ? 'glass-button-primary' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[1.7rem] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Tags className="h-4 w-4 text-[var(--app-accent)]" />
            Labels
          </div>
          <div className="mt-4 rounded-[1.3rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_84%,transparent)]">
            {isEditMode ? (
              <LabelSelector
                boardId={boardIdKey}
                todoId={todo.id}
                currentLabels={currentLabels}
                allLabels={allLabels}
                onToggleLabel={handleToggleLabel}
                onCreateLabel={handleCreateLabel}
              />
            ) : (
              <div className="p-4 text-sm leading-6 app-text-muted">
                Create the todo first, then add labels from the same drawer when it reopens in edit mode.
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[1.7rem] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Current lane</p>
              <p className="mt-1 text-sm app-text-muted">
                {selectedCategory ? selectedCategory.name : 'Not assigned to a category'}
              </p>
            </div>
            {selectedCategory ? (
              <span className="app-badge" style={{ color: selectedCategory.color }}>
                {selectedCategory.name}
              </span>
            ) : null}
          </div>
        </section>

        {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

        <div className="sticky bottom-0 mt-auto border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg)_82%,transparent)] py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {isEditMode ? (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  className="glass-button glass-button-danger justify-center sm:justify-start"
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Todo'}
                </button>
              ) : (
                <p className="text-sm app-text-muted">Changes save to the board immediately after submit.</p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className="glass-button" disabled={isPending}>
                Cancel
              </button>
              <button type="submit" className="glass-button glass-button-primary" disabled={isPending}>
                {createMutation.isPending
                  ? 'Creating...'
                  : updateMutation.isPending
                    ? 'Saving...'
                    : isEditMode
                      ? 'Save Changes'
                      : 'Create Todo'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
