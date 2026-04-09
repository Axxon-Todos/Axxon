// Edits board details while preserving a brand-aligned fallback accent for boards without a saved color.
'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateBoardById } from '@/lib/api/boards/updateBoardById';
import type { UpdateBoard } from '@/lib/types/boardTypes';
import Modal from '@/components/ui/Modal';
import { DEFAULT_BRAND_PRIMARY_HEX } from '@/lib/utils/brandColors';

type EditBoardModalProps = {
  board: UpdateBoard & { organization_id: number };
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditBoardModal({
  board,
  onClose,
  onSuccess,
}: EditBoardModalProps) {
  const [name, setName] = useState(board.name || '');
  const [color, setColor] = useState(board.color || DEFAULT_BRAND_PRIMARY_HEX);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateBoardById(board.organization_id, String(board.id), { name, color }),
    onSuccess,
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter') {
        event.preventDefault();
        updateMutation.mutate();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, updateMutation]);

  return (
    <Modal isOpen onClose={onClose} title="Edit Board">
      <div className="space-y-4">
        <input
          type="text"
          className="app-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Board name"
          autoFocus
        />
        <div className="glass-panel flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-sm font-medium">Board Accent</p>
            <p className="mt-1 text-sm app-text-muted">
              Keep it distinct in the org hub and sidebar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-2xl border border-[var(--app-border)]"
              style={{ backgroundColor: color }}
            />
            <input
              type="color"
              className="h-10 w-14 rounded-xl bg-transparent"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-button text-sm">
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            className="glass-button glass-button-primary text-sm"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
