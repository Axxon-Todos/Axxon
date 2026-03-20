import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardsApiPath } from '@/lib/utils/routes';

export function useCreateBoard(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await apiFetch(buildOrganizationBoardsApiPath(organizationId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to create board');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
