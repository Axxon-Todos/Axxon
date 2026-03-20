import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderCategories } from '@/lib/api/categories/reorderCategories';

export function useReorderCategories(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOrder: string[]) =>
      reorderCategories(organizationId, boardId, newOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', organizationId, boardId],
      });
    },
  });
}
