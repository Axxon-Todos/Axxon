'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, PaintBucket, Shapes, Text, Archive, RotateCcw } from 'lucide-react';

import Modal from '@/components/ui/Modal';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import { createSprint } from '@/lib/api/sprints/createSprint';
import { updateSprint } from '@/lib/api/sprints/updateSprint';
import type { SprintBaseData } from '@/lib/types/sprintTypes';

import { SprintIconGlyph, sprintIconOptions } from './sprintIcons';

type SprintEditorModalProps = {
  boardId: number;
  sprint?: SprintBaseData | null;
  onClose: () => void;
  onSuccess: (sprint: SprintBaseData) => void;
};

export default function SprintEditorModal({
  boardId,
  sprint,
  onClose,
  onSuccess,
}: SprintEditorModalProps) {
  const { organizationId } = useOrganizationRouteParams();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(sprint);
  const [name, setName] = useState(sprint?.name ?? '');
  const [description, setDescription] = useState(sprint?.description ?? '');
  const [startDate, setStartDate] = useState(sprint?.start_date?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(sprint?.end_date?.slice(0, 10) ?? '');
  const [color, setColor] = useState(sprint?.color ?? '#2563eb');
  const [useCustomColor, setUseCustomColor] = useState(Boolean(sprint?.color));
  const [icon, setIcon] = useState(sprint?.icon ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(sprint?.name ?? '');
    setDescription(sprint?.description ?? '');
    setStartDate(sprint?.start_date?.slice(0, 10) ?? '');
    setEndDate(sprint?.end_date?.slice(0, 10) ?? '');
    setColor(sprint?.color ?? '#2563eb');
    setUseCustomColor(Boolean(sprint?.color));
    setIcon(sprint?.icon ?? null);
    setErrorMessage(null);
  }, [sprint]);

  const invalidateBoardQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sprints', organizationId, String(boardId)] }),
      queryClient.invalidateQueries({ queryKey: ['todos', organizationId, String(boardId)] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        color: useCustomColor ? color : null,
        icon,
      };

      if (sprint?.id) {
        return updateSprint(organizationId, boardId, sprint.id, payload);
      }

      return createSprint(organizationId, boardId, payload);
    },
    onSuccess: async (savedSprint) => {
      await invalidateBoardQueries();
      onSuccess(savedSprint);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!sprint?.id) {
        throw new Error('Sprint not found');
      }

      return updateSprint(organizationId, boardId, sprint.id, {
        archived_at: sprint.archived_at ? null : new Date().toISOString(),
      });
    },
    onSuccess: async (savedSprint) => {
      await invalidateBoardQueries();
      onSuccess(savedSprint);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const selectedIconLabel = useMemo(
    () => sprintIconOptions.find((option) => option.value === icon)?.label ?? 'No icon',
    [icon]
  );

  const isPending = saveMutation.isPending || archiveMutation.isPending;

  return (
    <Modal isOpen onClose={onClose} title={isEditMode ? 'Edit Sprint' : 'Create Sprint'}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setErrorMessage(null);

          if (!name.trim()) {
            setErrorMessage('Sprint name is required.');
            return;
          }

          if (!startDate || !endDate) {
            setErrorMessage('Sprint start and end dates are required.');
            return;
          }

          saveMutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Sprint name</label>
          <div className="relative">
            <Text className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-accent)]" />
            <input
              type="text"
              className="app-input pl-10"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Q2 Platform Sprint"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="app-input min-h-28 resize-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Capture the focus and expected outcome for this sprint."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start date</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-accent)]" />
              <input
                type="date"
                className="app-input pl-10"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End date</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-accent)]" />
              <input
                type="date"
                className="app-input pl-10"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[1.4rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Accent color</p>
              <p className="mt-1 text-sm app-text-muted">Optional, but helpful when the sprint appears on todo cards.</p>
            </div>
            <button
              type="button"
              onClick={() => setUseCustomColor((previous) => !previous)}
              className={`glass-button text-sm ${useCustomColor ? 'glass-button-primary' : ''}`}
            >
              <PaintBucket className="h-4 w-4" />
              {useCustomColor ? 'Custom Color' : 'Use Default'}
            </button>
          </div>

          {useCustomColor ? (
            <div className="mt-4 flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-2xl border border-white/40"
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                className="h-10 w-14 rounded-xl bg-transparent"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="glass-panel rounded-[1.4rem] p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shapes className="h-4 w-4 text-[var(--app-accent)]" />
            Icon
          </div>
          <p className="mt-2 text-sm app-text-muted">Optional. Keep the set controlled so sprint badges stay consistent.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setIcon(null)}
              className={`glass-button justify-start rounded-[1rem] ${icon === null ? 'glass-button-primary' : ''}`}
            >
              No icon
            </button>
            {sprintIconOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIcon(option.value)}
                className={`glass-button justify-start rounded-[1rem] ${
                  icon === option.value ? 'glass-button-primary' : ''
                }`}
              >
                <option.Icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel flex items-center justify-between gap-3 rounded-[1.4rem] p-4">
          <div>
            <p className="text-sm font-medium">Preview</p>
            <p className="mt-1 text-sm app-text-muted">This is how the sprint badge will appear across the board.</p>
          </div>
          <span
            className="app-badge"
            style={useCustomColor && color ? { color } : undefined}
          >
            <SprintIconGlyph icon={icon} />
            {name.trim() || 'Sprint name'}
            <span className="app-text-muted">· {selectedIconLabel}</span>
          </span>
        </div>

        {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                className="glass-button text-sm"
                disabled={isPending}
              >
                {sprint?.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {sprint?.archived_at ? 'Restore Sprint' : 'Archive Sprint'}
              </button>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="glass-button text-sm" disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className="glass-button glass-button-primary text-sm" disabled={isPending}>
              {saveMutation.isPending ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Sprint'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
