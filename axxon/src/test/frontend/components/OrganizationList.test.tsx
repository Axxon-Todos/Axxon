// Verifies organization selection, search, and owner-only editing in the dashboard directory.
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/dashboard/EditOrganizationModal', () => ({
  default: ({ organization, onClose }: { organization: { name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Edit organization">
      Editing {organization.name}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

import OrganizationList from '@/components/features/dashboard/OrganizationList';
import { renderWithProviders } from '../renderWithProviders';

const organizations = [
  {
    id: 3,
    name: 'Platform',
    description: 'Core delivery org',
    color: '#737373',
    created_by: 7,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    accessible_board_count: 2,
    member_count: 4,
    repo_count: 1,
    current_user_role: 'owner' as const,
  },
  {
    id: 4,
    name: 'Design',
    description: 'Product design org',
    color: '#a3a3a3',
    created_by: 8,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    accessible_board_count: 1,
    member_count: 3,
    repo_count: 0,
    current_user_role: 'member' as const,
  },
];

describe('OrganizationList', () => {
  it('selects organizations and keeps quick edit owner-only', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <OrganizationList organizations={organizations} selectedOrganizationId={3} onSelect={onSelect} />
    );

    expect(screen.getByRole('link', { name: 'Open Platform' })).toHaveAttribute('href', '/dashboard/orgs/3');
    expect(screen.getByRole('button', { name: 'Edit Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Design' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Design 1 board/i }));
    expect(onSelect).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Platform' }));
    expect(screen.getByRole('dialog', { name: 'Edit organization' })).toHaveTextContent('Editing Platform');
  });

  it('filters the directory without changing the selection', () => {
    renderWithProviders(
      <OrganizationList organizations={organizations} selectedOrganizationId={3} onSelect={vi.fn()} />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search organizations' }), { target: { value: 'design' } });
    expect(screen.getByRole('link', { name: 'Open Design' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Platform' })).not.toBeInTheDocument();
  });
});
