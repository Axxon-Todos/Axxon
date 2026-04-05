import { apiFetch } from '@/lib/api/apiFetch';

type CreateOrganizationInput = {
  name: string;
  description?: string;
  color?: string;
};

export async function createOrganization(data: CreateOrganizationInput) {
  const res = await apiFetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to create organization');
  }

  return res.json();
}
