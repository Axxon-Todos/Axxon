// Verifies the landing page exposes the refreshed AI-native positioning and hero operating-model framing.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="hero-scene" />,
}));

import LandingPage from '@/components/landing/LandingPage';

describe('LandingPage', () => {
  it('renders the new AI-native messaging and primary CTA', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Run AI agents through a real delivery system, not a pile of prompts.',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with Google/i })).toHaveAttribute(
      'href',
      '/api/auth/google'
    );
    expect(screen.getByText('AI-native agile platform for agent teams')).toBeInTheDocument();
    expect(screen.getByText('Operating Model')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Organizations frame the work. Boards dispatch it. Reviews close the loop.',
      })
    ).toBeInTheDocument();
  });
});
