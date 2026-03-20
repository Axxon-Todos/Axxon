'use client';

type GoogleLoginButtonProps = {
  className?: string;
  label?: string;
};

const GoogleLoginButton = ({
  className,
  label = 'Sign in with Google',
}: GoogleLoginButtonProps) => (
  <a
    href="/api/auth/google"
    className={className ?? 'bg-blue-500 text-white px-4 py-2 rounded'}
  >
    {label}
  </a>
);

export default GoogleLoginButton;
