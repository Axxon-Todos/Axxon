// src/lib/api/getCategories.ts
import { apiFetch } from '@/lib/api/apiFetch';

export async function fetchCategories(boardId: string) {
  const res = await apiFetch(`/api/board/${boardId}/categories`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch categories')
  }

  return res.json()
}
