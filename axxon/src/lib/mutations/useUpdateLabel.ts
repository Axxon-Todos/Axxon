import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLabel } from '@/lib/api/labels/updateLabel'
import { LabelBaseData } from '@/lib/types/labelTypes'

export function useUpdateLabel(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ labelId, data }: { labelId: number; data: Partial<LabelBaseData> }) => {
      return await updateLabel(boardId, labelId, data)
    },
    onMutate: async ({ labelId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['labels', boardId] })
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>(['labels', boardId])

      queryClient.setQueryData<LabelBaseData[]>(['labels', boardId], (old) =>
        old ? old.map(l => l.id === labelId ? { ...l, ...data } : l) : []
      )

      // Also update in todos
      queryClient.setQueryData(['todos', boardId], (old: any) =>
        old ? old.map((todo: any) => ({
          ...todo,
          labels: todo.labels?.map((l: any) => l.id === labelId ? { ...l, ...data } : l)
        })) : []
      )

      return { prevLabels }
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLabels) {
        queryClient.setQueryData(['labels', boardId], context.prevLabels)
      }
    },
  })
}
