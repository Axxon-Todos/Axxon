// hooks/useUpdateCategory.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateCategoryById } from "@/lib/api/categories/updateCategoryById"

// Custom hook to update a category with optimistic updates
export function useUpdateCategory(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: number; data: Partial<{ name: string; color: string; position: number }> }) =>
      updateCategoryById(boardId, categoryId, data),

    // Optimistic update
    onMutate: async ({ categoryId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["categories", boardId] })
      const previousCategories = queryClient.getQueryData<any[]>(["categories", boardId])

      queryClient.setQueryData<any[]>(["categories", boardId], (old) =>
        old?.map((cat) =>
          cat.id === categoryId ? { ...cat, ...data } : cat
        )
      )

      return { previousCategories }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories", boardId], context.previousCategories)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", boardId] })
    },
  })
}
