import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTodo } from '@/lib/api/todos/createTodo';

export function useCreateTodo(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      categoryId?: string;
    }) => createTodo(organizationId, boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', organizationId, boardId] });
    },
  });
}
