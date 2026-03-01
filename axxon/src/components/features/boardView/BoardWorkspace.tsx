'use client'

import dayjs from 'dayjs'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import Modal from '@/components/ui/Modal'
import UpdateCategoryForm from '@/components/forms/CategoryForm'
import { useModal } from '@/context/ModalManager'
import { useBoardRealtime } from '@/hooks/useBoardRealtime'
import { useSocket } from '@/hooks/useSocket'
import { fetchBoard } from '@/lib/api/boards/getSingleBoard'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { fetchTodosWithLabels } from '@/lib/api/todos/getTodosWithLabels'
import { useDeleteCategory } from '@/lib/mutations/useDeleteCategory'
import { useReorderCategories } from '@/lib/mutations/useReorderCategories'
import { useUpdateCategory } from '@/lib/mutations/UseUpdateCategory'
import { useUpdateTodoMutation } from '@/lib/mutations/useUpdateTodo'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import { BOARD_VIEW_ORDER, type BoardDisplayView } from '@/lib/types/boardViewTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'
import { isTodoEffectivelyComplete } from '@/lib/utils/todoCompletion'

import BoardHeader from './BoardHeader'
import BoardCalendarView from './views/BoardCalendarView'
import BoardKanbanView from './views/BoardKanbanView'
import BoardListView from './views/BoardListView'

export default function BoardWorkspace({ boardId }: { boardId: string }) {
  const socketRef = useSocket(boardId)
  useBoardRealtime(boardId, socketRef)

  const [activeView, setActiveView] = useState<BoardDisplayView>('list')
  const [transitionDirection, setTransitionDirection] = useState(1)
  const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [categoryOrder, setCategoryOrder] = useState<number[]>([])
  const [unsavedOrder, setUnsavedOrder] = useState<number[] | null>(null)
  const [unsavedCategories, setUnsavedCategories] = useState<Record<number, Partial<CategoryBaseData>>>({})

  const { modalState, openModal, closeModal } = useModal()
  const shouldReduceMotion = useReducedMotion()

  const updateTodo = useUpdateTodoMutation(boardId)
  const reorderCategories = useReorderCategories(boardId)
  const updateCategory = useUpdateCategory(boardId)
  const deleteCategory = useDeleteCategory(boardId)

  const { data: board } = useQuery({ queryKey: ['board', boardId], queryFn: () => fetchBoard(boardId) })
  const { data: categories } = useQuery<CategoryBaseData[]>({
    queryKey: ['categories', boardId],
    queryFn: () => fetchCategories(boardId),
  })
  const { data: labels } = useQuery({
    queryKey: ['labels', boardId],
    queryFn: () => fetchLabels(boardId),
  })
  const { data: todos } = useQuery<TodoWithLabels[]>({
    queryKey: ['todos', boardId],
    queryFn: () => fetchTodosWithLabels(boardId),
  })

  useEffect(() => {
    if (categories && categories.length && categoryOrder.length === 0) {
      setCategoryOrder(categories.map((category) => category.id))
    }
  }, [categories, categoryOrder.length])

  const categoryMap = useMemo(() => {
    if (!categories) return {}

    return categories.reduce(
      (acc, category) => {
        const overrides = unsavedCategories[category.id] || {}
        acc[category.id] = { ...category, ...overrides }
        return acc
      },
      {} as Record<number, CategoryBaseData>
    )
  }, [categories, unsavedCategories])

  const categorizedTodos = useMemo(() => {
    if (!todos || !categories) return {}

    return categories.reduce(
      (acc, category) => {
        acc[category.id] = todos.filter((todo) => todo.category_id === category.id)
        return acc
      },
      {} as Record<number, TodoWithLabels[]>
    )
  }, [categories, todos])

  const dueSoonCount = (todos || []).filter((todo) => {
    const category = todo.category_id ? categoryMap[todo.category_id] : undefined
    if (!todo.due_date || isTodoEffectivelyComplete(todo.is_complete, category?.is_done)) return false
    const dueDate = dayjs(todo.due_date)
    return dueDate.isAfter(dayjs().subtract(1, 'day'), 'day') && dueDate.diff(dayjs(), 'day') <= 7
  }).length

  const completedCount = (todos || []).filter((todo) => {
    const category = todo.category_id ? categoryMap[todo.category_id] : undefined
    return isTodoEffectivelyComplete(todo.is_complete, category?.is_done)
  }).length

  const hasUnsavedCategoryChanges = Boolean(unsavedOrder || Object.keys(unsavedCategories).length > 0)

  const resetCategoryManagement = () => {
    setIsManagingCategories(false)
    setUnsavedCategories({})
    setUnsavedOrder(null)

    if (categories) {
      setCategoryOrder(categories.map((category) => category.id))
    }
  }

  const handleChangeView = (nextView: BoardDisplayView) => {
    if (nextView === activeView) return

    const currentIndex = BOARD_VIEW_ORDER.indexOf(activeView)
    const nextIndex = BOARD_VIEW_ORDER.indexOf(nextView)
    setTransitionDirection(nextIndex > currentIndex ? 1 : -1)
    setActiveView(nextView)

    if (nextView === 'calendar') {
      resetCategoryManagement()
    }
  }

  const handleToggleManageCategories = () => {
    if (isManagingCategories) {
      resetCategoryManagement()
      return
    }

    setIsManagingCategories(true)
  }

  const handleMoveTodo = (todo: TodoWithLabels, categoryId: number) => {
    updateTodo.mutate({ todoId: todo.id, data: { category_id: categoryId } })
  }

  const handleSaveCategoryChanges = async () => {
    try {
      const updatePromises = Object.entries(unsavedCategories).map(([id, data]) =>
        updateCategory.mutateAsync({ categoryId: Number(id), data })
      )

      if (unsavedOrder) {
        await reorderCategories.mutateAsync(unsavedOrder.map(String))
      }

      await Promise.all(updatePromises)
      setUnsavedCategories({})
      setUnsavedOrder(null)
    } catch (error) {
      console.error('Failed to save category changes', error)
    }
  }

  const handleOpenTodo = (todo: TodoWithLabels) => {
    openModal('UPDATE_TODO', { boardId: Number(boardId), todo })
  }

  if (!board || !categories || !todos || !labels) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Board Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading board...</h1>
        </section>
      </div>
    )
  }

  const motionVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (direction: number) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
        animate: { opacity: 1, x: 0 },
        exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
      }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <BoardHeader
        boardId={boardId}
        board={board}
        categoryCount={categories.length}
        todoCount={todos.length}
        labelCount={labels.length}
        dueSoonCount={dueSoonCount}
        completedCount={completedCount}
        activeView={activeView}
        onChangeView={handleChangeView}
        onAddTodo={() => openModal('ADD_TODO', { boardId: Number(boardId) })}
        isManagingCategories={isManagingCategories}
        onToggleManageCategories={handleToggleManageCategories}
      />

      {modalState.type === 'CATEGORY' ? (
        <Modal isOpen onClose={closeModal} title="Edit Category">
          <UpdateCategoryForm
            category={modalState.payload}
            onSave={(updatedProps: Partial<CategoryBaseData>) => {
              setUnsavedCategories((prev) => ({
                ...prev,
                [modalState.payload.id]: { ...prev[modalState.payload.id], ...updatedProps },
              }))
              closeModal()
            }}
            onDelete={(id: number) => {
              setCategoryOrder((prev) => {
                const next = prev.filter((categoryId) => categoryId !== id)
                setUnsavedOrder(next)
                return next
              })
              setUnsavedCategories((prev) => {
                const copy = { ...prev }
                delete copy[id]
                return copy
              })
              deleteCategory.mutate(id)
              closeModal()
            }}
            onClose={closeModal}
          />
        </Modal>
      ) : null}

      <div className="glass-panel relative rounded-[2rem] p-4 sm:p-5">
        <AnimatePresence initial={false} mode="wait" custom={transitionDirection}>
          <motion.div
            key={activeView}
            custom={transitionDirection}
            variants={motionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView === 'list' ? (
              <BoardListView
                categoryOrder={categoryOrder}
                categoryMap={categoryMap}
                categorizedTodos={categorizedTodos}
                isManagingCategories={isManagingCategories}
                onToggleManageCategories={handleToggleManageCategories}
                onTodoClick={handleOpenTodo}
                onTodoMove={handleMoveTodo}
                onStageCategoryOrder={(nextOrder) => {
                  setCategoryOrder(nextOrder)
                  setUnsavedOrder(nextOrder)
                }}
                onSaveCategoryChanges={handleSaveCategoryChanges}
                hasUnsavedCategoryChanges={hasUnsavedCategoryChanges}
              />
            ) : null}

            {activeView === 'kanban' ? (
              <BoardKanbanView
                boardColor={board.color || '#2563eb'}
                categoryOrder={categoryOrder}
                categoryMap={categoryMap}
                categorizedTodos={categorizedTodos}
                isManagingCategories={isManagingCategories}
                onTodoClick={handleOpenTodo}
                onTodoMove={handleMoveTodo}
                onStageCategoryOrder={(nextOrder) => {
                  setCategoryOrder(nextOrder)
                  setUnsavedOrder(nextOrder)
                }}
                onSaveCategoryChanges={handleSaveCategoryChanges}
                hasUnsavedCategoryChanges={hasUnsavedCategoryChanges}
              />
            ) : null}

            {activeView === 'calendar' ? (
              <BoardCalendarView
                board={board}
                categoriesById={categoryMap}
                todos={todos}
                onTodoClick={handleOpenTodo}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
