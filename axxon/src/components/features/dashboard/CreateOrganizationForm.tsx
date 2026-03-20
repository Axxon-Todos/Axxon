'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrganization } from '@/lib/api/organizations/createOrganization';
import OrganizationFormFields from '@/components/features/dashboard/OrganizationFormFields';

interface CreateOrganizationFormProps {
  onClose: () => void;
}

export default function CreateOrganizationForm({
  onClose,
}: CreateOrganizationFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0f766e');

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
        <button type="button" onClick={onClose} className="glass-button">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Organization'}
        </button>
      </div>

      {createMutation.isError ? (
        <p className="text-sm text-rose-400">
          {createMutation.error?.message || 'Failed to create organization'}
        </p>
      ) : null}
    </form>
  );
}
