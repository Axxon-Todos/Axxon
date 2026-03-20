import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTodoById } from '@/lib/api/todos/updateTodoById';
import type { TodoWithLabels } from '@/lib/types/todoTypes';

export function useUpdateTodoMutation(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      data,
    }: {
      todoId: number;
      data: Partial<TodoWithLabels>;
    }) => updateTodoById(organizationId, boardId, todoId, data),
    onMutate: async ({ todoId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['todos', organizationId, boardId] });
      const prevTodos = queryClient.getQueryData<TodoWithLabels[]>([
        'todos',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<TodoWithLabels[]>(
        ['todos', organizationId, boardId],
        (old) =>
          old
            ? old.map((todo) => (todo.id === todoId ? { ...todo, ...data } : todo))
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
    onSuccess: (updatedTodo) => {
      queryClient.setQueryData<TodoWithLabels[]>(
        ['todos', organizationId, boardId],
        (old) =>
          old
            ? old.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo))
            : [updatedTodo]
      );
    },
  });
}
