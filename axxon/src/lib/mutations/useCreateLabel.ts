import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLabel } from '@/lib/api/labels/createLabel';
import type { LabelBaseData } from '@/lib/types/labelTypes';

export function useCreateLabel(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) =>
      createLabel(organizationId, boardId, data),
    onMutate: async (newLabel) => {
      await queryClient.cancelQueries({ queryKey: ['labels', organizationId, boardId] });
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>([
        'labels',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<LabelBaseData[]>(
        ['labels', organizationId, boardId],
        (old) => [
          ...(old || []),
          { ...newLabel, id: Date.now(), board_id: Number(boardId) } as LabelBaseData,
        ]
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
    onSuccess: (createdLabel) => {
      queryClient.setQueryData<LabelBaseData[]>(
        ['labels', organizationId, boardId],
        (old) => (old ? old.map((label) => (label.id > 1000000000000 ? createdLabel : label)) : [createdLabel])
      );
    },
  });
}
