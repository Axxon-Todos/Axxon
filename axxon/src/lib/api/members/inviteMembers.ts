import { apiFetch } from '@/lib/api/apiFetch';

export const inviteMembersByEmail = async ({boardId, emails }: {boardId: number; emails: string[]}): Promise<{ message: string }> => {
  const res = await apiFetch(`/api/board/${boardId}/member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
