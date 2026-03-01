'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

export type ModalType = 'ADD_TODO' | 'UPDATE_TODO' | 'CATEGORY'
export type ModalVariant = 'modal' | 'drawer'

type ModalPayloadMap = {
  ADD_TODO: { boardId: number }
  UPDATE_TODO: { boardId: number; todo: TodoWithLabels }
  CATEGORY: CategoryBaseData
}

export type ModalState =
  | { type: null; variant: null; payload?: undefined }
  | { type: 'ADD_TODO'; variant: 'drawer'; payload: ModalPayloadMap['ADD_TODO'] }
  | { type: 'UPDATE_TODO'; variant: 'drawer'; payload: ModalPayloadMap['UPDATE_TODO'] }
  | { type: 'CATEGORY'; variant: 'modal'; payload: ModalPayloadMap['CATEGORY'] }

interface ModalContextType {
  modalState: ModalState
  openModal: <T extends ModalType>(type: T, payload: ModalPayloadMap[T]) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within a ModalProvider')
  return context
}

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<ModalState>({ type: null, variant: null })

  const openModal = <T extends ModalType>(type: T, payload: ModalPayloadMap[T]) => {
    const variantMap: Record<ModalType, ModalVariant> = {
      ADD_TODO: 'drawer',
      UPDATE_TODO: 'drawer',
      CATEGORY: 'modal',
    }

    setModalState({ type, variant: variantMap[type], payload } as ModalState)
  }

  const closeModal = () => setModalState({ type: null, variant: null, payload: undefined })

  return (
    <ModalContext.Provider value={{ modalState, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}
