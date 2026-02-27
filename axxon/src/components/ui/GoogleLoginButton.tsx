'use client';

type GoogleLoginButtonProps = {
  className?: string;
  label?: string;
};

const GoogleLoginButton = ({
  className,
  label = 'Sign in with Google',
}: GoogleLoginButtonProps) => {
  const handleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;
    const scope = 'openid email profile';

    if (!clientId || !redirectUri) {
      console.error('Missing Google OAuth environment variables.');
      return;
    }

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className={className ?? 'bg-blue-500 text-white px-4 py-2 rounded'}
    >
      {label}
    </button>
  );
};

export default GoogleLoginButton;
