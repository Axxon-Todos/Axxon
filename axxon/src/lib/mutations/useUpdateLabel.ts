import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLabel } from '@/lib/api/labels/updateLabel';
import type { LabelBaseData } from '@/lib/types/labelTypes';

export function useUpdateLabel(organizationId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      labelId,
      data,
    }: {
      labelId: number;
      data: Partial<LabelBaseData>;
    }) => updateLabel(organizationId, boardId, labelId, data),
    onMutate: async ({ labelId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['labels', organizationId, boardId] });
      const prevLabels = queryClient.getQueryData<LabelBaseData[]>([
        'labels',
        organizationId,
        boardId,
      ]);

      queryClient.setQueryData<LabelBaseData[]>(
        ['labels', organizationId, boardId],
        (old) => (old ? old.map((label) => (label.id === labelId ? { ...label, ...data } : label)) : [])
      );

      queryClient.setQueryData(
        ['todos', organizationId, boardId],
        (old: any) =>
          old
            ? old.map((todo: any) => ({
                ...todo,
                labels: todo.labels?.map((label: any) =>
                  label.id === labelId ? { ...label, ...data } : label
                ),
              }))
            : []
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
  });
}
