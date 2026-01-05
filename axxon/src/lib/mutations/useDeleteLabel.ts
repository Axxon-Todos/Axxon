import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteLabel } from '@/lib/api/labels/deleteLabel'
import { LabelBaseData } from '@/lib/types/labelTypes'

export function useDeleteLabel(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (labelId: number) => {
      return await deleteLabel(boardId, labelId)
    },
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ['labels', boardId] })
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>(['labels', boardId])

      queryClient.setQueryData<LabelBaseData[]>(['labels', boardId], (old) =>
        old ? old.filter(l => l.id !== labelId) : []
      )

      return { prevLabels }
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLabels) {
        queryClient.setQueryData(['labels', boardId], context.prevLabels)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardId] })
    },
  })
}
