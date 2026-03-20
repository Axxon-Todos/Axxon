'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      <div className="space-y-2">
        <label className="block text-sm font-medium">Organization Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Platform Engineering"
          className="app-input"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional context about the engineering group, product area, or operating model."
          className="app-input min-h-28 resize-none"
        />
      </div>

      <div className="glass-panel flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-sm font-medium">Organization Accent</p>
          <p className="mt-1 text-sm app-text-muted">
            Used across the org hub and navigation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-2xl border border-white/40 shadow-inner"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
          />
        </div>
      </div>

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
