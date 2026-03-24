import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedAddBoardMembers,
  mockedSearchBoardInviteCandidates,
} = vi.hoisted(() => ({
  mockedAddBoardMembers: vi.fn(),
  mockedSearchBoardInviteCandidates: vi.fn(),
}));

vi.mock('@/lib/api/boardMembers/addBoardMembers', () => ({
  addBoardMembers: mockedAddBoardMembers,
}));

vi.mock('@/lib/api/boardMembers/searchBoardInviteCandidates', () => ({
  searchBoardInviteCandidates: mockedSearchBoardInviteCandidates,
}));

import InviteMembersModal from '@/components/features/dashboard/InviteMembersModal';
import { renderWithProviders } from '../renderWithProviders';

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

describe('InviteMembersModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAddBoardMembers.mockResolvedValue({ addedCount: 1 });
    mockedSearchBoardInviteCandidates.mockImplementation(
      async (_organizationId: string, _boardId: string, query: string) => {
        if (query === 'alex') {
          return [
            {
              id: 22,
              email: 'alex@example.com',
              first_name: 'Alex',
              last_name: 'Builder',
              avatar_url: null,
            },
          ];
        }

        return [
          {
            id: 11,
            email: 'jordan@example.com',
            first_name: 'Jordan',
            last_name: 'Addable',
            avatar_url: null,
          },
        ];
      }
    );
  });

  it('loads addable members on open and debounces search before updating results', async () => {
    renderWithProviders(
      <InviteMembersModal
        organizationId={3}
        boardId={9}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Jordan Addable')).toBeInTheDocument();
    expect(mockedSearchBoardInviteCandidates).toHaveBeenCalledWith('3', '9', '');

    fireEvent.change(screen.getByLabelText('Search organization members'), {
      target: { value: 'alex' },
    });

    expect(mockedSearchBoardInviteCandidates).not.toHaveBeenCalledWith('3', '9', 'alex');

    await act(async () => {
      await sleep(250);
    });

    expect(mockedSearchBoardInviteCandidates).not.toHaveBeenCalledWith('3', '9', 'alex');

    await act(async () => {
      await sleep(100);
    });

    await waitFor(() => {
      expect(mockedSearchBoardInviteCandidates).toHaveBeenCalledWith('3', '9', 'alex');
    });
    expect(await screen.findByText('Alex Builder')).toBeInTheDocument();
  });

  it('submits selected user ids when adding board members', async () => {
    renderWithProviders(
      <InviteMembersModal
        organizationId={3}
        boardId={9}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Jordan Addable')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Jordan Addable'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Members' }));

    await waitFor(() => {
      expect(mockedAddBoardMembers).toHaveBeenCalledWith({
        organizationId: 3,
        boardId: 9,
        userIds: [11],
      });
    });
  });
});
