// Renders reusable segmented controls for view switching and compact filter toggles.
'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SegmentedOption<T>>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('app-segmented', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            data-active={isActive}
            onClick={() => onChange(option.value)}
            className="app-segmented-button"
          >
            {isActive ? (
              <motion.span
                layoutId={`${ariaLabel}-active`}
                className="absolute inset-0 rounded-[0.88rem]"
                style={{ background: 'var(--app-accent)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            ) : null}
            <span className={cn('relative z-10 inline-flex items-center gap-2', isActive ? 'text-[var(--app-accent-foreground)]' : '')}>
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
