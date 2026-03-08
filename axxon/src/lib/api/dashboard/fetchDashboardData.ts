import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardBaseData } from '@/lib/types/boardTypes';

export type DashboardData = {
  id: string | null;
  boards: BoardBaseData[];
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const res = await apiFetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}
