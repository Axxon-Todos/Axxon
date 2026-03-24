import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedInviteOrganizationMembers,
  mockedSearchOrganizationInviteCandidates,
} = vi.hoisted(() => ({
  mockedInviteOrganizationMembers: vi.fn(),
  mockedSearchOrganizationInviteCandidates: vi.fn(),
}));

vi.mock('@/lib/api/organizations/inviteOrganizationMembers', () => ({
  inviteOrganizationMembers: mockedInviteOrganizationMembers,
}));

vi.mock('@/lib/api/organizations/searchOrganizationInviteCandidates', () => ({
  searchOrganizationInviteCandidates: mockedSearchOrganizationInviteCandidates,
}));

import InviteOrganizationMembersModal from '@/components/features/dashboard/InviteOrganizationMembersModal';
import { renderWithProviders } from '../renderWithProviders';

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

describe('InviteOrganizationMembersModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInviteOrganizationMembers.mockResolvedValue({
      addedCount: 1,
      alreadyMemberEmails: [],
    });
    mockedSearchOrganizationInviteCandidates.mockImplementation(
      async (_organizationId: string, query: string) => {
        if (query === 'alex') {
          return [
            {
              id: 31,
              email: 'alex@example.com',
              first_name: 'Alex',
              last_name: 'Morgan',
              avatar_url: null,
            },
          ];
        }

        return [];
      }
    );
  });

  it('starts empty and waits for a debounced search before loading users', async () => {
    renderWithProviders(
      <InviteOrganizationMembersModal organizationId="3" onClose={vi.fn()} />
    );

    expect(
      screen.getByText('Start typing to search existing Axxon users.')
    ).toBeInTheDocument();
    expect(mockedSearchOrganizationInviteCandidates).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Find existing users'), {
      target: { value: 'a' },
    });

    await act(async () => {
      await sleep(350);
    });

    expect(mockedSearchOrganizationInviteCandidates).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Find existing users'), {
      target: { value: 'alex' },
    });

    await act(async () => {
      await sleep(350);
    });

    await waitFor(() => {
      expect(mockedSearchOrganizationInviteCandidates).toHaveBeenCalledWith('3', 'alex');
    });
    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument();
  });

  it('invites selected users by id', async () => {
    renderWithProviders(
      <InviteOrganizationMembersModal organizationId="3" onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Find existing users'), {
      target: { value: 'alex' },
    });

    await act(async () => {
      await sleep(350);
    });

    fireEvent.click(await screen.findByText('Alex Morgan'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Invites' }));

    await waitFor(() => {
      expect(mockedInviteOrganizationMembers).toHaveBeenCalledWith({
        organizationId: '3',
        userIds: [31],
      });
    });
  });
});
