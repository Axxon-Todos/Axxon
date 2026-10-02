// Verifies the monochrome landing page retains its core product message and sign-in action.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '@/components/landing/LandingPage';

describe('LandingPage', () => {
  it('renders the agent workspace story and primary CTA', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Give agent work a clear place to happen.',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with Google/i })).toHaveAttribute(
      'href',
      '/api/auth/google'
    );
    expect(screen.getByText('THE WORKSPACE FOR AGENT TEAMS')).toBeInTheDocument();
    expect(screen.getByText('01 / ORGANIZATION')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clarity at every level.' })).toBeInTheDocument();
  });
});
