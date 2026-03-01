'use client'

import SideDrawer from '@/components/ui/SideDrawer'
import TodoDrawer from '@/components/features/boardView/TodoDrawer'
import { useModal } from '@/context/ModalManager'

export default function GlobalOverlayHost() {
  const { modalState, closeModal } = useModal()

  if (modalState.type === null) return null

  if (modalState.variant !== 'drawer') return null

  if (modalState.type === 'ADD_TODO') {
    return (
      <SideDrawer
        isOpen
        onClose={closeModal}
        title="Create Todo"
        description="Capture the next step with priority, category, due date, and labels without leaving the board."
      >
        <TodoDrawer mode="create" boardId={modalState.payload.boardId} onClose={closeModal} />
      </SideDrawer>
    )
  }

  return (
    <SideDrawer
      isOpen
      onClose={closeModal}
      title="Todo Details"
      description="Update delivery details, move work across lanes, and keep labels in sync from one shared panel."
    >
      <TodoDrawer
        mode="edit"
        boardId={modalState.payload.boardId}
        todo={modalState.payload.todo}
        onClose={closeModal}
      />
    </SideDrawer>
  )
}
