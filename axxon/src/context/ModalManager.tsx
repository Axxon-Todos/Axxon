// src/context/ModalContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type ModalType = 'ADD_TODO' | 'UPDATE_TODO' | 'CATEGORY' | null

interface ModalState {
  type: ModalType
  payload?: any
}

interface ModalContextType {
  modalState: ModalState
  openModal: (type: ModalType, payload?: any) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within a ModalProvider')
  return context
}

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<ModalState>({ type: null })

  const openModal = (type: ModalType, payload?: any) => {
    setModalState({ type, payload })
  }

  const closeModal = () => setModalState({ type: null, payload: undefined })

  return (
    <ModalContext.Provider value={{ modalState, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}
