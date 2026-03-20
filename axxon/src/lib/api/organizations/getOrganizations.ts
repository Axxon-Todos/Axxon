import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';

export async function fetchOrganizations(): Promise<OrganizationSummary[]> {
  const res = await apiFetch('/api/organizations', {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch organizations');
  }

  return res.json();
}
