// Verifies the dashboard org directory keeps quick edit owner-only while preserving the primary org navigation target.
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedFetchOrganizations } = vi.hoisted(() => ({
  mockedFetchOrganizations: vi.fn(),
}));

vi.mock('@/lib/api/organizations/getOrganizations', () => ({
  fetchOrganizations: mockedFetchOrganizations,
}));

vi.mock('@/components/features/dashboard/EditOrganizationModal', () => ({
  default: ({
    organization,
    onClose,
  }: {
    organization: { name: string };
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Edit Organization">
      Editing {organization.name}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import OrganizationList from '@/components/features/dashboard/OrganizationList';

import { renderWithProviders } from '../renderWithProviders';

describe('OrganizationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchOrganizations.mockResolvedValue([
      {
        id: 3,
        name: 'Platform',
        description: 'Core delivery org',
        color: '#6366f1',
        created_by: 7,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        accessible_board_count: 2,
        member_count: 4,
        repo_count: 1,
        current_user_role: 'owner',
      },
      {
        id: 4,
        name: 'Design',
        description: 'Product design org',
        color: '#0891b2',
        created_by: 8,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        accessible_board_count: 1,
        member_count: 3,
        repo_count: 0,
        current_user_role: 'member',
      },
    ]);
  });

  it('opens the quick edit flow for organization owners only', async () => {
    renderWithProviders(<OrganizationList />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Platform' })).toHaveAttribute(
      'href',
      '/dashboard/orgs/3'
    );
    expect(screen.getByRole('button', { name: 'Edit Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Design' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Platform' }));

    expect(await screen.findByRole('dialog', { name: 'Edit Organization' })).toBeInTheDocument();
    expect(screen.getByText('Editing Platform')).toBeInTheDocument();
  });
});
