import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addLabelToTodo } from '@/lib/api/todoLabels/addLabelToTodo'
import { removeLabelFromTodo } from '@/lib/api/todoLabels/removeLabelFromTodo'
import { TodoWithLabels } from '@/lib/types/todoTypes'
import { LabelBaseData } from '@/lib/types/labelTypes'

// mutation hook to add and remove labels from a todo (toggle)
export function useToggleTodoLabel(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      todoId,
      labelId,
      isAdding
    }: {
      todoId: number
      labelId: number
      isAdding: boolean
    }) => {
      if (isAdding) {
        return await addLabelToTodo(boardId, todoId, labelId)
      } else {
        return await removeLabelFromTodo(boardId, todoId, labelId)
      }
    },

    onMutate: async ({ todoId, labelId, isAdding }) => {
      await queryClient.cancelQueries({ queryKey: ['todos', boardId] })
      const prevTodos = queryClient.getQueryData<TodoWithLabels[]>(['todos', boardId])
      const allLabels = queryClient.getQueryData<LabelBaseData[]>(['labels', boardId])

      queryClient.setQueryData<TodoWithLabels[]>(['todos', boardId], (old) =>
        old ? old.map(todo => {
          if (todo.id !== todoId) return todo
          const label = allLabels?.find(l => l.id === labelId)
          if (!label) return todo

          return {
            ...todo,
            labels: isAdding
              ? [...(todo.labels || []), label]
              : (todo.labels || []).filter(l => l.id !== labelId)
          }
        }) : []
      )

      return { prevTodos }
    },

    onError: (_err, _vars, context) => {
      if (context?.prevTodos) {
        queryClient.setQueryData(['todos', boardId], context.prevTodos)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardId] })
    },
  })
}
