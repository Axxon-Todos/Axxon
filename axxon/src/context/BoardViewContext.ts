'use client'

import { createContext, useContext } from 'react'

type BoardViewContextType = {
  hideTodos: boolean
  setHideTodos: (value: boolean) => void
}

const BoardViewContext = createContext<BoardViewContextType | undefined>(undefined)

export const useBoardView = () => {
  const context = useContext(BoardViewContext)
  if (!context) throw new Error('useBoardView must be used within a BoardViewProvider')
  return context
}

export default BoardViewContext
