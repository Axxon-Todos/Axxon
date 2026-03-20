import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addLabelToTodo } from '@/lib/api/todoLabels/addLabelToTodo';
import { removeLabelFromTodo } from '@/lib/api/todoLabels/removeLabelFromTodo';
import type { LabelBaseData } from '@/lib/types/labelTypes';
import type { TodoWithLabels } from '@/lib/types/todoTypes';

export function useToggleTodoLabel(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      labelId,
      isAdding,
    }: {
      todoId: number;
      labelId: number;
      isAdding: boolean;
    }) => {
      if (isAdding) {
        return addLabelToTodo(organizationId, boardId, todoId, labelId);
      }

      return removeLabelFromTodo(organizationId, boardId, todoId, labelId);
    },
    onMutate: async ({ todoId, labelId, isAdding }) => {
      await queryClient.cancelQueries({ queryKey: ['todos', organizationId, boardId] });
      const prevTodos = queryClient.getQueryData<TodoWithLabels[]>([
        'todos',
        organizationId,
        boardId,
      ]);
      const allLabels = queryClient.getQueryData<LabelBaseData[]>([
        'labels',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<TodoWithLabels[]>(
        ['todos', organizationId, boardId],
        (old) =>
          old
            ? old.map((todo) => {
                if (todo.id !== todoId) return todo;

                const label = allLabels?.find((entry) => entry.id === labelId);
                if (!label) return todo;

                return {
                  ...todo,
                  labels: isAdding
                    ? [...(todo.labels || []), label]
                    : (todo.labels || []).filter((entry) => entry.id !== labelId),
                };
              })
            : []
      );

      return { prevTodos };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTodos) {
        queryClient.setQueryData(
          ['todos', organizationId, boardId],
          context.prevTodos
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', organizationId, boardId] });
    },
  });
}
