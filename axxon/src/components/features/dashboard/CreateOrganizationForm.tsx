// Handles organization creation with the shared form actions and updated default accent color.
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import OrganizationFormFields from '@/components/features/dashboard/OrganizationFormFields';
import Button from '@/components/ui/Button';
import { createOrganization } from '@/lib/api/organizations/createOrganization';

interface CreateOrganizationFormProps {
  onClose: () => void;
}

export default function CreateOrganizationForm({
  onClose,
}: CreateOrganizationFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#15784e');

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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Organization'}
        </Button>
      </div>

      {createMutation.isError ? (
        <p className="text-sm app-error-text">
          {createMutation.error?.message || 'Failed to create organization'}
        </p>
      ) : null}
    </form>
  );
}
