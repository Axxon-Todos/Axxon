import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

describe('GoogleLoginButton', () => {
  it('links to the server-side OAuth start route', () => {
    render(<GoogleLoginButton label="Continue with Google" />);

    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google'
    );
  });
});
