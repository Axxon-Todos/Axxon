// Provides the shared organization form inputs used by create and edit organization flows.
'use client';

import Surface from '@/components/ui/Surface';

type OrganizationFormFieldsProps = {
  autoFocus?: boolean;
  color: string;
  description: string;
  name: string;
  onColorChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
};

export default function OrganizationFormFields({
  autoFocus = false,
  color,
  description,
  name,
  onColorChange,
  onDescriptionChange,
  onNameChange,
}: OrganizationFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Organization Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Platform Engineering"
          className="app-input"
          autoFocus={autoFocus}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Optional context about the engineering group, product area, or operating model."
          className="app-input min-h-28 resize-none"
        />
      </div>

      <Surface variant="default" className="flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-sm font-medium">Organization Accent</p>
          <p className="mt-1 text-sm app-text-muted">
            Used as the organization&apos;s visual identifier across the workspace.
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
            onChange={(event) => onColorChange(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-xl border-0 bg-transparent"
          />
        </div>
      </Surface>
    </>
  );
}
