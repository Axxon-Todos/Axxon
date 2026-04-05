// Verifies theme persistence and the dark-first default for the application theme provider.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTheme } from '@/context/ThemeProvider';

import { renderWithProviders } from '../renderWithProviders';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button type="button" onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
}

describe('ThemeProvider', () => {
  it('defaults to dark mode when nothing is stored', async () => {
    renderWithProviders(<ThemeProbe />);

    expect(await screen.findByText('Current theme: dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('restores the stored theme and syncs it to the document', async () => {
    window.localStorage.setItem('axxon-theme', 'light');

    renderWithProviders(<ThemeProbe />);

    expect(await screen.findByText('Current theme: light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('toggles the theme and persists the new value', async () => {
    renderWithProviders(<ThemeProbe />);

    fireEvent.click(await screen.findByRole('button', { name: /current theme/i }));

    expect(await screen.findByText('Current theme: light')).toBeInTheDocument();
    expect(window.localStorage.getItem('axxon-theme')).toBe('light');
  });
});
