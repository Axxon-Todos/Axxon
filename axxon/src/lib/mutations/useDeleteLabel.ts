import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteLabel } from '@/lib/api/labels/deleteLabel';
import type { LabelBaseData } from '@/lib/types/labelTypes';

export function useDeleteLabel(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelId: number) =>
      deleteLabel(organizationId, boardId, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ['labels', organizationId, boardId] });
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>([
        'labels',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<LabelBaseData[]>(
        ['labels', organizationId, boardId],
        (old) => (old ? old.filter((label) => label.id !== labelId) : [])
      );

      return { prevLabels };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLabels) {
        queryClient.setQueryData(
          ['labels', organizationId, boardId],
          context.prevLabels
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', organizationId, boardId] });
    },
  });
}
