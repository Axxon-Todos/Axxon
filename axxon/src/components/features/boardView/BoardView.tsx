'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, closestCenter, DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import { useSocket } from '@/hooks/useSocket'
import { useBoardRealtime } from '@/hooks/useBoardRealtime'
import { useUpdateTodoMutation } from '@/lib/mutations/useUpdateTodo'
import { useDeleteTodoMutation } from '@/lib/mutations/useDeleteTodo'

import { fetchBoard } from '@/lib/api/getSingleBoard'
import { fetchCategories } from '@/lib/api/getCategories'
import { fetchLabels } from '@/lib/api/getLabels'
import { fetchTodosWithLabels } from '@/lib/api/getTodosWithLabels'

import DroppableColumn from './DroppableColumn'
import Modal from '@/components/ui/Modal'
import AddTodoForm from '@/components/forms/AddTodoForms'
import UpdateTodoForm from '@/components/forms/UpdateTodoForm'

import BoardViewContext from '@/context/BoardViewContext'
import { useModal } from '@/context/ModalManager'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

export default function BoardView({ boardId }: { boardId: string }) {

  const modalTitleMap = { ADD_TODO: 'Add Todo', UPDATE_TODO: 'Update Todo', CATEGORY: 'Category' }
  
  // --- Socket & Realtime ---
  const socketRef = useSocket(boardId)
  useBoardRealtime(boardId, socketRef)

  // --- Local State ---
  const [activeTodo, setActiveTodo] = useState<TodoWithLabels | null>(null)
  const [hideTodos, setHideTodos] = useState(false)

  // --- Modal Context ---
  const { modalState, openModal, closeModal } = useModal()

  // --- Mutations ---
  const updateTodo = useUpdateTodoMutation(boardId)
  const deleteTodo = useDeleteTodoMutation(boardId)

  // --- Queries ---
  const { data: board } = useQuery({ queryKey: ['board', boardId], queryFn: () => fetchBoard(boardId) })
  const { data: categories } = useQuery<CategoryBaseData[]>({ queryKey: ['categories', boardId], queryFn: () => fetchCategories(boardId) })
  const { data: labels } = useQuery({ queryKey: ['labels', boardId], queryFn: () => fetchLabels(boardId) })
  const { data: todos } = useQuery<TodoWithLabels[]>({
    queryKey: ['todos', boardId],
    queryFn: () => fetchTodosWithLabels(boardId),
    select: (data) => [...data],
  })

  // --- Categorize Todos ---
  const categorizedTodos = useMemo(() => {
    if (!todos || !categories) return {}
    return categories.reduce((acc, category) => {
      acc[category.id] = todos.filter(todo => todo.category_id === category.id)
      return acc
    }, {} as Record<number, TodoWithLabels[]>)
  }, [todos, categories])

  // --- Drag & Drop ---
  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as TodoWithLabels
    setActiveTodo(todo)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)
    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      updateTodo.mutate({ todoId: todo.id, data: { category_id: overCategoryId } })
    }
    setActiveTodo(null)
  }

  // --- Loading State ---
  if (!board || !categories || !todos || !labels) return <div>Loading board...</div>

  // --- Modal Content Renderer ---
  const renderModalContent = () => {
    if (!modalState.type) return null
    switch (modalState.type) {
      case 'ADD_TODO':
        return <AddTodoForm boardId={Number(boardId)} onClose={closeModal} />
      case 'UPDATE_TODO':
        return modalState.payload ? (
          <UpdateTodoForm
            todo={modalState.payload}
            boardId={boardId}
            onClose={closeModal}
            onDelete={() => {
              deleteTodo.mutate(modalState.payload.id)
              closeModal()
            }}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">{board.name}</h1>

        {/* Add Todo Button */}
        <button
          onClick={() => openModal('ADD_TODO')}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Add Todo
        </button>

        {/* Generic Modal */}
        {modalState.type && (
          <Modal
            isOpen={!!modalState.type}
            onClose={closeModal}
            title={modalTitleMap[modalState.type]}
          >
            {renderModalContent()}
          </Modal>
        )}

        {/* Categorized Todos */}
        <BoardViewContext.Provider value={{ hideTodos, setHideTodos }}>
          <div className="flex flex-col gap-6">
            {categories.map(category => (
              <DroppableColumn
                key={category.id}
                categoryId={category.id}
                categoryName={category.name}
                todos={categorizedTodos[category.id] || []}
                onTodoClick={(todo) => openModal('UPDATE_TODO', todo)}
              />
            ))}
          </div>
        </BoardViewContext.Provider>

        {/* Toggle Hide/Show Todos Button */}
        <button
          onClick={() => setHideTodos(prev => !prev)}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
        >
          {hideTodos ? 'Show Todos' : 'Hide Todos'}
        </button>
      </div>
    </DndContext>
  )
}
