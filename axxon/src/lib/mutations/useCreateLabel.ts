import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createLabel } from '@/lib/api/labels/createLabel'
import { LabelBaseData } from '@/lib/types/labelTypes'

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      return await createLabel(boardId, data)
    },
    onMutate: async (newLabel) => {
      await queryClient.cancelQueries({ queryKey: ['labels', boardId] })
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>(['labels', boardId])

      // Optimistic update with temporary ID
      queryClient.setQueryData<LabelBaseData[]>(['labels', boardId], (old) => [
        ...(old || []),
        { ...newLabel, id: Date.now(), board_id: Number(boardId) } as LabelBaseData,
      ])

      return { prevLabels }
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLabels) {
        queryClient.setQueryData(['labels', boardId], context.prevLabels)
      }
    },
    onSuccess: (createdLabel) => {
      queryClient.setQueryData<LabelBaseData[]>(['labels', boardId], (old) =>
        old ? old.map(l => l.id > 1000000000000 ? createdLabel : l) : [createdLabel]
      )
    },
  })
}
