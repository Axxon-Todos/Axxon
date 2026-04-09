// Handles board creation with the refreshed form actions and modernized default accent color.
'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Surface from '@/components/ui/Surface';
import { useCreateBoard } from '@/lib/mutations/useCreateBoard';
import { DEFAULT_BRAND_PRIMARY_HEX } from '@/lib/utils/brandColors';

interface CreateBoardFormProps {
  organizationId: string;
  onClose: () => void;
}

export default function CreateBoardForm({
  organizationId,
  onClose,
}: CreateBoardFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_BRAND_PRIMARY_HEX);

  const createMutation = useCreateBoard(organizationId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    createMutation.mutate(
      { name, color },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Board Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Agent Work Queue"
          className="app-input"
          autoFocus
        />
      </div>

      <Surface variant="default" className="flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-sm font-medium">Board Accent</p>
          <p className="mt-1 text-sm app-text-muted">
            Used as the board&apos;s visual identifier inside the org.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-2xl border border-[var(--app-border)] shadow-inner"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
          />
        </div>
      </Surface>

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Board'}
        </Button>
      </div>

      {createMutation.isError ? (
        <p className="text-sm app-error-text">
          {createMutation.error?.message || 'Failed to create board'}
        </p>
      ) : null}
    </form>
  );
}
