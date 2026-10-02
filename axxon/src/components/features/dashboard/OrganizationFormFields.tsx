// Provides compact, accessible organization fields shared by create and edit flows.
'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

// Updates the organization preview directly from controlled form values.
export default function OrganizationFormFields({
  autoFocus = false,
  color,
  description,
  name,
  onColorChange,
  onDescriptionChange,
  onNameChange,
}: OrganizationFormFieldsProps) {
  const nameId = useId();
  const descriptionId = useId();
  const colorId = useId();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="block text-sm font-medium">
          Name
        </label>
        <input
          id={nameId}
          type="text"
          required
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Platform Engineering"
          className="app-input"
          autoFocus={autoFocus}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={descriptionId} className="block text-sm font-medium">
          Description{' '}
          <span className="font-normal app-text-muted">(optional)</span>
        </label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="What does this organization work on?"
          rows={3}
          className="app-input min-h-24 resize-y"
        />
      </div>

      <fieldset className="space-y-3 border-t border-[var(--app-border)] pt-5">
        <legend className="text-sm font-medium">Accent color</legend>
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs app-text-muted">
            A small identifier beside the organization and its projects.
          </p>
          <span className="shrink-0 font-mono text-xs app-text-muted">
            {color.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ORGANIZATION_ACCENT_SWATCHES.map((swatchColor) => {
            const isSelected =
              swatchColor.toLowerCase() === color.toLowerCase();

            return (
              <motion.button
                key={swatchColor}
                type="button"
                aria-label={`Use accent ${swatchColor}`}
                aria-pressed={isSelected}
                onClick={() => onColorChange(swatchColor)}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                className={`flex h-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] ${isSelected ? 'border-[var(--app-foreground)] bg-[var(--app-panel-soft)]' : 'border-[var(--app-border)] hover:bg-[var(--app-panel-soft)]'}`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/15"
                  style={{ backgroundColor: swatchColor }}
                />
              </motion.button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-[var(--app-panel-soft)] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <motion.span
              animate={{ backgroundColor: color }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
              className="h-3 w-3 shrink-0 rounded-[4px]"
            />
            <span className="min-w-0 truncate text-sm font-medium">
              {name.trim() || 'Organization name'}
            </span>
            <span className="hidden text-xs app-text-muted sm:inline">
              Preview
            </span>
          </div>
          <label
            htmlFor={colorId}
            className="flex shrink-0 items-center gap-2 text-xs app-text-muted"
          >
            Custom
            <input
              id={colorId}
              type="color"
              value={color}
              onChange={(event) => onColorChange(event.target.value)}
              className="h-8 w-8 cursor-pointer rounded-md border border-[var(--app-border)] bg-transparent p-0.5"
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}
