'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Modal from '@/components/ui/Modal';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { inviteOrganizationMembers } from '@/lib/api/organizations/inviteOrganizationMembers';
import { searchOrganizationInviteCandidates } from '@/lib/api/organizations/searchOrganizationInviteCandidates';
import type { User } from '@/lib/types/users';

type InviteOrganizationMembersModalProps = {
  organizationId: string;
  onClose: () => void;
};

function formatMemberName(member: Pick<User, 'first_name' | 'last_name' | 'email'>) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || member.email;
}

export default function InviteOrganizationMembersModal({
  organizationId,
  onClose,
}: InviteOrganizationMembersModalProps) {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearchValue = useDebouncedValue(searchValue, 300);
  const [selectedCandidates, setSelectedCandidates] = useState<User[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const shouldSearch = debouncedSearchValue.trim().length >= 2;

  const { data: candidates = [], isLoading, isFetching } = useQuery<User[]>({
    queryKey: ['organization-member-candidates', organizationId, debouncedSearchValue],
    queryFn: () =>
      searchOrganizationInviteCandidates(organizationId, debouncedSearchValue.trim()),
    enabled: shouldSearch,
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

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteOrganizationMembers({
        organizationId,
        userIds: selectedUserIds,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organization-members', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['organization-member-candidates', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['organization', organizationId],
      });
      onClose();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to invite organization members.'
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
    if (selectedCandidates.length === 0 || inviteMutation.isPending) {
      return;
    }

    setErrorMessage('');
    await inviteMutation.mutateAsync();
  }

  return (
    <Modal isOpen onClose={onClose} title="Invite Members to Organization">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="invite-organization-members-input" className="text-sm font-medium">
            Find existing users
          </label>
          <input
            id="invite-organization-members-input"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name or email"
            className="app-input"
          />
          <p className="text-xs app-text-muted">
            Type at least 2 characters to find existing Axxon users who are not already in this organization.
          </p>
        </div>

        {selectedCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => toggleUser(candidate)}
                className="app-badge"
                aria-label={`Remove ${candidate.email}`}
              >
                {formatMemberName(candidate)} ×
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[var(--app-border)] p-2">
          {!shouldSearch ? (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
              Start typing to search existing Axxon users.
            </div>
          ) : isLoading && candidates.length === 0 ? (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
              Searching users...
            </div>
          ) : candidates.length === 0 ? (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
              No existing Axxon users match this search.
            </div>
          ) : (
            candidates.map((candidate) => {
              const isSelected = selectedUserIdSet.has(candidate.id);

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => toggleUser(candidate)}
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
                    <p className="font-medium">{formatMemberName(candidate)}</p>
                    <p className="text-sm app-text-muted">{candidate.email}</p>
                  </div>
                  <span className="app-badge">{isSelected ? 'Selected' : 'Invite'}</span>
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
            disabled={inviteMutation.isPending || selectedCandidates.length === 0}
            className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inviteMutation.isPending ? 'Inviting...' : 'Send Invites'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
