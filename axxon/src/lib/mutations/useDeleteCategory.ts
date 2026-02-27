// lib/mutations/useDeleteCategory.ts
'use client'

import { useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { deleteCategoryById } from '@/lib/api/categories/deleteCategoryById'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'

export function useDeleteCategory(boardId: string | number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryId: string | number) => deleteCategoryById(boardId, categoryId),

    // Optimistic update
    onMutate: async (categoryId: string | number) => {
      await queryClient.cancelQueries({ queryKey: ['categories', boardId] })

      const previousCategories = queryClient.getQueryData<CategoryBaseData[]>(['categories', boardId])

      queryClient.setQueryData(['categories', boardId], (old: CategoryBaseData[] | undefined) =>
        old ? old.filter((c) => c.id !== categoryId) : []
      )

      return { previousCategories }
    },

    // Rollback on error
    onError: (_err, _categoryId, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories', boardId], context.previousCategories)
      }
    },

    // Refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', boardId] })
    },
  })
}
