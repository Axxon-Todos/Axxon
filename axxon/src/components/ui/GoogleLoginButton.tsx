// Renders the platform's Google auth entry button with consistent brand styling across landing and app flows.
'use client';

import { Chrome } from 'lucide-react';
import { buttonClassName } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

type GoogleLoginButtonProps = {
  className?: string;
  label?: string;
  variant?: 'landing' | 'app';
};

const variantClasses = {
  landing: 'landing-google-button',
  app: buttonClassName({ variant: 'primary' }),
};

const iconClasses = {
  landing: 'h-4 w-4',
  app: 'h-4 w-4 opacity-80',
};

const GoogleLoginButton = ({
  className,
  label = 'Sign in with Google',
  variant = 'landing',
}: GoogleLoginButtonProps) => (
  <a href="/api/auth/google" className={cn(variantClasses[variant], className)}>
    <Chrome className={iconClasses[variant]} />
    {label}
  </a>
);

export default GoogleLoginButton;
