// Edits organization details while keeping the org accent aligned with the shared brand defaults.
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Modal from '@/components/ui/Modal';
import OrganizationFormFields from '@/components/features/dashboard/OrganizationFormFields';
import { updateOrganizationById } from '@/lib/api/organizations/updateOrganization';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { DEFAULT_BRAND_PRIMARY_HEX } from '@/lib/utils/brandColors';

type EditOrganizationModalProps = {
  onClose: () => void;
  organization: OrganizationSummary;
};

export default function EditOrganizationModal({
  onClose,
  organization,
}: EditOrganizationModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description ?? '');
  const [color, setColor] = useState(organization.color || DEFAULT_BRAND_PRIMARY_HEX);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateOrganizationById(organization.id, {
        name,
        description,
        color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({
        queryKey: ['organization', String(organization.id)],
      });
      onClose();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    updateMutation.mutate();
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit Organization">
      <form onSubmit={handleSubmit} className="space-y-4">
        <OrganizationFormFields
          autoFocus
          color={color}
          description={description}
          name={name}
          onColorChange={setColor}
          onDescriptionChange={setDescription}
          onNameChange={setName}
        />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || updateMutation.isPending}
            className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {updateMutation.isError ? (
          <p className="text-sm text-rose-400">
            {updateMutation.error?.message || 'Failed to update organization'}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
