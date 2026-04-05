// Renders small semantic badges that match the platform token system.
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'default' | 'success' | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'app-badge',
  success: 'app-badge app-badge-success',
  danger: 'app-badge app-badge-danger',
};

export default function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </span>
  );
}
