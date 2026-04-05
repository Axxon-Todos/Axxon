// Wraps shared surface variants so product sections and cards use the same elevation language.
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type SurfaceVariant = 'default' | 'strong' | 'interactive';

const variantClasses: Record<SurfaceVariant, string> = {
  default: 'app-surface',
  strong: 'app-surface-strong',
  interactive: 'app-surface-interactive',
};

export function surfaceClassName({
  variant = 'default',
  className,
}: {
  variant?: SurfaceVariant;
  className?: string;
}) {
  return cn(variantClasses[variant], className);
}

export default function Surface({
  variant = 'default',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  children?: ReactNode;
}) {
  return (
    <div className={surfaceClassName({ variant, className })} {...props}>
      {children}
    </div>
  );
}
