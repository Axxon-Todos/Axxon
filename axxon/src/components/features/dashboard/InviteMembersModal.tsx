'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Modal from '@/components/ui/Modal';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { addBoardMembers } from '@/lib/api/boardMembers/addBoardMembers';
import { searchBoardInviteCandidates } from '@/lib/api/boardMembers/searchBoardInviteCandidates';
import type { User } from '@/lib/types/users';

type InviteMembersModalProps = {
  organizationId: number;
  boardId: number;
  onClose: () => void;
};

function formatMemberName(member: Pick<User, 'first_name' | 'last_name' | 'email'>) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || member.email;
}

export default function InviteMembersModal({
  organizationId,
  boardId,
  onClose,
}: InviteMembersModalProps) {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearchValue = useDebouncedValue(searchValue, 300);
  const [selectedCandidates, setSelectedCandidates] = useState<User[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: candidates = [], isLoading, isFetching } = useQuery<User[]>({
    queryKey: ['board-member-candidates', String(organizationId), String(boardId), debouncedSearchValue],
    queryFn: () =>
      searchBoardInviteCandidates(
        String(organizationId),
        String(boardId),
        debouncedSearchValue.trim()
      ),
    placeholderData: (previousData) => previousData,
  });

  const selectedUserIds = useMemo(
    () => selectedCandidates.map((candidate) => candidate.id),
    [selectedCandidates]
  );
  const selectedUserIdSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds]
  );
  const isDebouncing = searchValue !== debouncedSearchValue;

  const addMembersMutation = useMutation({
    mutationFn: () =>
      addBoardMembers({
        organizationId,
        boardId,
        userIds: selectedUserIds,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['board-members', String(organizationId), String(boardId)],
      });
      await queryClient.invalidateQueries({
        queryKey: ['board-member-candidates', String(organizationId), String(boardId)],
      });
      onClose();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to add board members.'
      );
    },
  });

  function toggleUser(candidate: User) {
    setSelectedCandidates((current) =>
      current.some((member) => member.id === candidate.id)
        ? current.filter((member) => member.id !== candidate.id)
        : [...current, candidate]
    );
    setErrorMessage('');
  }

  async function handleSubmit() {
    if (selectedCandidates.length === 0 || addMembersMutation.isPending) {
      return;
    }

    setErrorMessage('');
    await addMembersMutation.mutateAsync();
  }
  const searchTerm = debouncedSearchValue.trim();

  return (
    <Modal isOpen onClose={onClose} title="Invite Org Members to Board">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="invite-board-members-search" className="text-sm font-medium">
            Search organization members
          </label>
          <input
            id="invite-board-members-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name or email"
            className="app-input"
          />
          <p className="text-xs app-text-muted">
            Showing organization members who can still be added to this board.
          </p>
        </div>

        {selectedCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedCandidates.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleUser(member)}
                className="app-badge"
                aria-label={`Remove ${member.email}`}
              >
                {formatMemberName(member)} ×
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[var(--app-border)] p-2">
          {isLoading && candidates.length === 0 ? (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
              Loading addable organization members...
            </div>
          ) : candidates.length === 0 ? (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
              {searchTerm
                ? 'No addable organization members match this search.'
                : 'Everyone in this organization already has board access.'}
            </div>
          ) : (
            candidates.map((member) => {
              const isSelected = selectedUserIdSet.has(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleUser(member)}
                  className="glass-panel flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                  style={
                    isSelected
                      ? {
                          borderColor:
                            'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                          background:
                            'color-mix(in srgb, var(--app-accent) 10%, var(--app-panel-strong))',
                        }
                      : undefined
                  }
                >
                  <div>
                    <p className="font-medium">{formatMemberName(member)}</p>
                    <p className="text-sm app-text-muted">{member.email}</p>
                  </div>
                  <span className="app-badge">{isSelected ? 'Selected' : 'Addable'}</span>
                </button>
              );
            })
          )}
        </div>

        {isDebouncing || (isFetching && candidates.length > 0) ? (
          <p className="text-xs app-text-muted">Updating results...</p>
        ) : null}

        {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedCandidates.length === 0 || addMembersMutation.isPending}
            className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addMembersMutation.isPending ? 'Adding...' : 'Add Members'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
