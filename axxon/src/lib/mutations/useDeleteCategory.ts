'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategoryById } from '@/lib/api/categories/deleteCategoryById';
import type { CategoryBaseData } from '@/lib/types/categoryTypes';

export function useDeleteCategory(organizationId: string, boardId: string | number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string | number) =>
      deleteCategoryById(organizationId, boardId, categoryId),
    onMutate: async (categoryId: string | number) => {
      await queryClient.cancelQueries({
        queryKey: ['categories', organizationId, String(boardId)],
      });

      const previousCategories = queryClient.getQueryData<CategoryBaseData[]>([
        'categories',
        organizationId,
        String(boardId),
      ]);

      queryClient.setQueryData(
        ['categories', organizationId, String(boardId)],
        (old: CategoryBaseData[] | undefined) =>
          old ? old.filter((category) => category.id !== categoryId) : []
      );

      return { previousCategories };
    },
    onError: (_err, _categoryId, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          ['categories', organizationId, String(boardId)],
          context.previousCategories
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', organizationId, String(boardId)],
      });
    },
  });
}
