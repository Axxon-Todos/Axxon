// Manages global state for label popups - ensures only one popup open at a time and auto-closes when modals open
'use client'

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'
import { useModal } from './ModalManager'

interface LabelPopupState {
  todoId: number | null
  anchorElement: HTMLElement | null
}

interface LabelPopupContextType {
  popupState: LabelPopupState
  openPopup: (todoId: number, anchorElement: HTMLElement) => void
  closePopup: () => void
  isPopupOpen: (todoId: number) => boolean
}

const LabelPopupContext = createContext<LabelPopupContextType | undefined>(undefined)

export const useLabelPopup = () => {
  const context = useContext(LabelPopupContext)
  if (!context) throw new Error('useLabelPopup must be used within a LabelPopupProvider')
  return context
}

export const LabelPopupProvider = ({ children }: { children: ReactNode }) => {
  const [popupState, setPopupState] = useState<LabelPopupState>({
    todoId: null,
    anchorElement: null
  })

  // Auto-close popup when any modal opens
  const { modalState } = useModal()

  const closePopup = useCallback(() => {
    setPopupState({ todoId: null, anchorElement: null })
  }, [])

  useEffect(() => {
    // When modal opens (type changes from null to any value), close any open popup
    if (modalState.type !== null && popupState.todoId !== null) {
      closePopup()
    }
  }, [closePopup, modalState.type, popupState.todoId])

  const openPopup = (todoId: number, anchorElement: HTMLElement) => {
    setPopupState({ todoId, anchorElement })
  }

  const isPopupOpen = (todoId: number) => {
    return popupState.todoId === todoId
  }

  return (
    <LabelPopupContext.Provider value={{ popupState, openPopup, closePopup, isPopupOpen }}>
      {children}
    </LabelPopupContext.Provider>
  )
}
