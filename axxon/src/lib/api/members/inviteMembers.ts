import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export const inviteMembersByEmail = async ({
  organizationId,
  boardId,
  emails,
}: {
  organizationId: string | number;
  boardId: string | number;
  emails: string[];
}): Promise<{ message: string }> => {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/member'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
};
