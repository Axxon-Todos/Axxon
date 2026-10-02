// Edits organization details while keeping the org accent aligned with the shared brand defaults.
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
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
  const [description, setDescription] = useState(
    organization.description ?? '',
  );
  const [color, setColor] = useState(
    organization.color || DEFAULT_BRAND_PRIMARY_HEX,
  );

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
    <Modal
      isOpen
      onClose={onClose}
      title="Edit organization"
      description="Update how this organization appears across your workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <OrganizationFormFields
          autoFocus
          color={color}
          description={description}
          name={name}
          onColorChange={setColor}
          onDescriptionChange={setDescription}
          onNameChange={setName}
        />

        {updateMutation.isError ? (
          <p role="alert" className="text-sm app-error-text">
            {updateMutation.error?.message || 'Failed to update organization'}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || updateMutation.isPending}
            className="w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
