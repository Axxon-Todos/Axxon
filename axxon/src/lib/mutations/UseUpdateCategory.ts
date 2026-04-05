import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCategoryById } from '@/lib/api/categories/updateCategoryById';

export function useUpdateCategory(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: number;
      data: Partial<{ name: string; color: string; position: number }>;
    }) => updateCategoryById(organizationId, boardId, categoryId, data),

    onMutate: async ({ categoryId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['categories', organizationId, boardId] });
      const previousCategories = queryClient.getQueryData<any[]>([
        'categories',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<any[]>(
        ['categories', organizationId, boardId],
        (old) => old?.map((category) => (category.id === categoryId ? { ...category, ...data } : category))
      );

      return { previousCategories };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          ['categories', organizationId, boardId],
          context.previousCategories
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', organizationId, boardId],
      });
    },
  });
}
