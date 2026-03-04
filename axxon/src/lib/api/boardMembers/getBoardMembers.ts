import { apiFetch } from '@/lib/api/apiFetch'
import type { User } from '@/lib/types/users'

export async function fetchBoardMembers(boardId: string): Promise<User[]> {
  const response = await apiFetch(`/api/board/${boardId}/member`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch board members')
  }

  return response.json()
}
