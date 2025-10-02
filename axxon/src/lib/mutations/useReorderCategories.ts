import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderCategories } from '@/lib/api/categories/reorderCategories';

export function useReorderCategories(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOrder: string[]) => reorderCategories(boardId, newOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', boardId] });
    },
  });
}
