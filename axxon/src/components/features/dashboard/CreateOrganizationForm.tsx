// Handles organization creation with the shared form actions and updated default accent color.
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import OrganizationFormFields from '@/components/features/dashboard/OrganizationFormFields';
import Button from '@/components/ui/Button';
import { createOrganization } from '@/lib/api/organizations/createOrganization';
import { DEFAULT_BRAND_PRIMARY_HEX } from '@/lib/utils/brandColors';

interface CreateOrganizationFormProps {
  onClose: () => void;
}

export default function CreateOrganizationForm({
  onClose,
}: CreateOrganizationFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEFAULT_BRAND_PRIMARY_HEX);

  const createMutation = useMutation({
    mutationFn: () =>
      createOrganization({
        name,
        description,
        color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      onClose();
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    createMutation.mutate();
  }

  return (
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

      {createMutation.isError ? (
        <p role="alert" className="text-sm app-error-text">
          {createMutation.error?.message || 'Failed to create organization'}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <Button onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || createMutation.isPending}
          className="w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Organization'}
        </Button>
      </div>
    </form>
  );
}
