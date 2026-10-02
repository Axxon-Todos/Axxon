// Verifies the redesigned edit dialog submits the controlled organization fields.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockedUpdateOrganization } = vi.hoisted(() => ({
  mockedUpdateOrganization: vi.fn(),
}));

vi.mock('@/lib/api/organizations/updateOrganization', () => ({
  updateOrganizationById: mockedUpdateOrganization,
}));

import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import { renderWithProviders } from '../renderWithProviders';

describe('EditOrganizationModal', () => {
  it('edits the name, description, and accent before saving', async () => {
    const onClose = vi.fn();
    mockedUpdateOrganization.mockResolvedValue({ id: 3, name: 'Product' });

    renderWithProviders(
      <EditOrganizationModal
        organization={{
          id: 3,
          name: 'Platform',
          description: 'Core work',
          color: '#737373',
          created_by: 7,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          accessible_board_count: 2,
          member_count: 4,
          repo_count: 1,
          current_user_role: 'owner',
        }}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit organization' });
    expect(dialog).toHaveClass('max-h-[calc(100dvh-2rem)]');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Product' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Description/ }), {
      target: { value: 'New work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use accent #a3a3a3' }));
    expect(screen.getByText('Product')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockedUpdateOrganization).toHaveBeenCalledWith(3, {
        name: 'Product',
        description: 'New work',
        color: '#a3a3a3',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
