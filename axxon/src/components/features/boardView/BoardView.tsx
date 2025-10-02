'use client'
// --- React & Libraries ---
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, closestCenter, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

// --- Hooks & Mutations ---
import { useSocket } from '@/hooks/useSocket'
import { useBoardRealtime } from '@/hooks/useBoardRealtime'
import { useUpdateTodoMutation } from '@/lib/mutations/useUpdateTodo'
import { useDeleteTodoMutation } from '@/lib/mutations/useDeleteTodo'
import { useUpdateCategory } from '@/lib/mutations/UseUpdateCategory'
import { useDeleteCategory } from '@/lib/mutations/useDeleteCategory'
import { useReorderCategories } from '@/lib/mutations/useReorderCategories'

// --- Fetchers ---
import { fetchBoard } from '@/lib/api/boards/getSingleBoard'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { fetchTodosWithLabels } from '@/lib/api/todos/getTodosWithLabels'

// --- Components ---
import DroppableColumn from './DroppableColumn'
import DraggableCategory from './DraggableCategory'
import Modal from '@/components/ui/Modal'
import AddTodoForm from '@/components/forms/AddTodoForms'
import UpdateTodoForm from '@/components/forms/UpdateTodoForm'
import UpdateCategoryForm from '@/components/forms/CategoryForm'

// --- Contexts ---
import BoardViewContext from '@/context/BoardViewContext'
import { useModal } from '@/context/ModalManager'

// --- Types ---
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
  const [categoryOrder, setCategoryOrder] = useState<number[]>([])
  const [unsavedOrder, setUnsavedOrder] = useState<number[] | null>(null)
  const [unsavedCategories, setUnsavedCategories] = useState<Record<number, Partial<CategoryBaseData>>>({})

  // --- Modal Context ---
  const { modalState, openModal, closeModal } = useModal()

  // --- Mutations ---
  const updateTodo = useUpdateTodoMutation(boardId)
  const deleteTodo = useDeleteTodoMutation(boardId)
  const reorderCategories = useReorderCategories(boardId)
  const updateCategory = useUpdateCategory(boardId)
  const deleteCategory = useDeleteCategory(boardId)

  // --- Queries ---
  const { data: board } = useQuery({ queryKey: ['board', boardId], queryFn: () => fetchBoard(boardId) })
  const { data: categories } = useQuery<CategoryBaseData[]>({ queryKey: ['categories', boardId], queryFn: () => fetchCategories(boardId) })
  const { data: labels } = useQuery({ queryKey: ['labels', boardId], queryFn: () => fetchLabels(boardId) })
  const { data: todos } = useQuery<TodoWithLabels[]>({ queryKey: ['todos', boardId], queryFn: () => fetchTodosWithLabels(boardId) })

  // --- Category Map with Optimistic Updates ---
  const categoryMap = useMemo(() => {
    if (!categories) return {}
    return categories.reduce((acc, c) => {
      const overrides = unsavedCategories[c.id] || {}
      acc[c.id] = { ...c, ...overrides } // merge optimistic edits
      return acc
    }, {} as Record<number, CategoryBaseData>)
  }, [categories, unsavedCategories])

  // --- Initialize category order ---
  useEffect(() => {
    if (categories && categories.length && categoryOrder.length === 0) {
      setCategoryOrder(categories.map(c => c.id))
    }
  }, [categories])

  // --- Categorize Todos ---
  const categorizedTodos = useMemo(() => {
    if (!todos || !categories) return {}
    return categories.reduce((acc, category) => {
      acc[category.id] = todos.filter(todo => todo.category_id === category.id)
      return acc
    }, {} as Record<number, TodoWithLabels[]>)
  }, [todos, categories])

  // --- Drag & Drop Handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as TodoWithLabels
    setActiveTodo(todo)
  }

  const handleTodoDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)
    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      updateTodo.mutate({ todoId: todo.id, data: { category_id: overCategoryId } })
    }
    setActiveTodo(null)
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setCategoryOrder((prevOrder) => {
      const activeIndex = prevOrder.indexOf(Number(active.id))
      const overIndex = prevOrder.indexOf(Number(over.id))
      if (activeIndex === -1 || overIndex === -1) return prevOrder

      const newOrder = arrayMove(prevOrder, activeIndex, overIndex)
      setUnsavedOrder(newOrder)
      return newOrder
    })
  }

  // --- Save Changes Handler ---
  const handleSaveCategoryChanges = async () => {
    try {
      // 1. Commit pending category updates
      const updatePromises = Object.entries(unsavedCategories).map(([id, data]) =>
        updateCategory.mutateAsync({ categoryId: Number(id), data })
      )

      // 2. Commit category reorder if needed
      if (unsavedOrder) {
        await reorderCategories.mutateAsync(unsavedOrder.map(String))
      }

      // 3. Reset local state after successful save
      await Promise.all(updatePromises)
      setUnsavedCategories({})
      setUnsavedOrder(null)
    } catch (err) {
      console.error('Failed to save category changes', err)
    }
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
      case 'CATEGORY':
        return modalState.payload ? (
          <UpdateCategoryForm
            category={modalState.payload}
            onSave={(updatedProps) => {
              setUnsavedCategories(prev => ({
                ...prev,
                [modalState.payload.id]: { ...prev[modalState.payload.id], ...updatedProps }
              }))
              closeModal()
            }}
            onDelete={(id) => {
              // Optimistically remove locally
              setCategoryOrder(prev => prev.filter(cid => cid !== id))
              setUnsavedCategories(prev => {
                const copy = { ...prev }
                delete copy[id]
                return copy
              })
              // Trigger mutation
              deleteCategory.mutate(id)
              closeModal()
            }}
            onClose={closeModal}
          />
        ) : null
      default:
        return null
    }
  }

  // --- Render ---
  return (
    <BoardViewContext.Provider value={{ hideTodos, setHideTodos }}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">{board.name}</h1>

        {/* Add Todo Button */}
        <button
          onClick={() => openModal('ADD_TODO')}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Add Todo
        </button>

        {/* Manage Board Button */}
        <button
          onClick={() => {
            setHideTodos((prev) => {
              const newHide = !prev
              if (prev) {
                // Leaving management mode, discard unsaved changes
                setUnsavedOrder(null)
                setUnsavedCategories({})
                if (categories) {
                  setCategoryOrder(categories.map(c => c.id))
                }
              }
              return newHide
            })
          }}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
        >
          {hideTodos ? 'Show Todos' : 'Hide Todos'}
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

        {/* Board Content */}
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={hideTodos ? () => {} : handleDragStart}
          onDragEnd={hideTodos ? handleCategoryDragEnd : handleTodoDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          {hideTodos ? (
            <SortableContext
              items={categoryOrder}
              strategy={verticalListSortingStrategy}
            >
              {categoryOrder.map((id) => {
                const category = categoryMap[id]
                if (!category) return null
                return (
                  <DraggableCategory
                    key={category.id}
                    category={category}
                    onTodoClick={(todo: any) => openModal('UPDATE_TODO', todo)}
                  />
                )
              })}
            </SortableContext>
          ) : (
            categoryOrder.map((id) => {
              const category = categoryMap[id]
              if (!category) return null
              return (
                <DroppableColumn
                  key={category.id}
                  categoryId={category.id}
                  categoryName={category.name}
                  todos={categorizedTodos[category.id] || []}
                  onTodoClick={(todo) => openModal('UPDATE_TODO', todo)}
                />
              )
            })
          )}
        </DndContext>

        {/* Save button for category updates + reordering */}
        {hideTodos && (unsavedOrder || Object.keys(unsavedCategories).length > 0) && (
          <button
            onClick={handleSaveCategoryChanges}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
          >
            Save Changes
          </button>
        )}
      </div>
    </BoardViewContext.Provider>
  )
}
