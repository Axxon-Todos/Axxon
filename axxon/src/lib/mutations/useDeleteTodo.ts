import { useMutation } from '@tanstack/react-query';
import { deleteTodoById } from '@/lib/api/todos/deleteTodoById';

export function useDeleteTodoMutation(organizationId: string, boardId: string) {
  return useMutation({
    mutationFn: async (todoId: number) =>
      deleteTodoById(organizationId, boardId, todoId),
    onError: (err) => {
      console.error('Failed to delete todo:', err);
    },
  });
}
