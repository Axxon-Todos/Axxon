// src/lib/api/getTodos.ts
import { apiFetch } from '@/lib/api/apiFetch';

export async function fetchTodos(boardId: string) {
  const res = await apiFetch(`/api/board/${boardId}/todos`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch todos')
  }

  return res.json()
}
