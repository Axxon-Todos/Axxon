import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SideDrawer from '@/components/ui/SideDrawer';

import { renderWithProviders } from '../renderWithProviders';

describe('SideDrawer', () => {
  it('locks body scroll while open and closes on Escape', () => {
    const onClose = vi.fn();

    const { rerender } = renderWithProviders(
      <SideDrawer isOpen onClose={onClose} title="Drawer">
        <p>Drawer body</p>
      </SideDrawer>
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByText('Drawer body')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    rerender(
      <SideDrawer isOpen={false} onClose={onClose} title="Drawer">
        <p>Drawer body</p>
      </SideDrawer>
    );

    expect(document.body.style.overflow).toBe('');
  });
});
