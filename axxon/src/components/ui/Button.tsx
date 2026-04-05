// Defines reusable semantic button variants and a shared class generator for buttons and links.
'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'default' | 'sm' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'app-button app-button-primary',
  secondary: 'app-button',
  ghost: 'app-button app-button-ghost',
  danger: 'app-button app-button-danger',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: '',
  sm: 'min-h-10 rounded-[0.9rem] px-3.5 py-2 text-sm',
  icon: '!h-10 !w-10 !p-0',
};

export function buttonClassName({
  variant = 'secondary',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(variantClasses[variant], sizeClasses[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export default function Button({
  variant = 'secondary',
  size = 'default',
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}
