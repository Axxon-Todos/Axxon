// Provides the shared organization form inputs used by create and edit organization flows.
'use client';

import Surface from '@/components/ui/Surface';
import { ORGANIZATION_ACCENT_SWATCHES } from '@/lib/utils/brandColors';

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
        <div className="w-full space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">Organization Accent</p>
              <p className="mt-1 text-sm app-text-muted">
                Used as the organization&apos;s visual identifier across the workspace.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] px-3 py-3">
              <span
                className="h-11 w-11 rounded-2xl border border-[var(--app-border)] shadow-inner"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.18em] app-text-muted">
                  Live Preview
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-[var(--app-foreground-strong)]">
                  {color.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ORGANIZATION_ACCENT_SWATCHES.map((swatchColor) => {
              const isSelected = swatchColor.toLowerCase() === color.toLowerCase();

              return (
                <button
                  key={swatchColor}
                  type="button"
                  aria-label={`Use accent ${swatchColor}`}
                  aria-pressed={isSelected}
                  onClick={() => onColorChange(swatchColor)}
                  className="group relative flex h-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)]"
                  style={
                    isSelected
                      ? {
                          borderColor:
                            'color-mix(in srgb, var(--app-accent) 42%, var(--app-border))',
                          boxShadow:
                            '0 0 0 1px color-mix(in srgb, var(--app-accent) 34%, transparent)',
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-6 w-6 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    style={{ backgroundColor: swatchColor }}
                  />
                  {isSelected ? (
                    <span className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-[var(--app-accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Custom Color</p>
              <p className="mt-1 text-sm app-text-muted">
                Use the native picker when the preset accents are too limiting.
              </p>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                className="h-11 w-11 cursor-pointer rounded-2xl border border-[var(--app-border)] bg-transparent p-1"
              />
              <span className="rounded-xl border border-[var(--app-border)] px-3 py-2 font-mono text-sm font-medium text-[var(--app-foreground-strong)]">
                {color.toUpperCase()}
              </span>
            </label>
          </div>
        </div>
      </Surface>
    </>
  );
}
