import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Modal from '@/components/ui/Modal';

import { renderWithProviders } from '../renderWithProviders';

describe('Modal', () => {
  it('renders in a portal and closes on Escape', () => {
    const onClose = vi.fn();

    renderWithProviders(
      <Modal isOpen onClose={onClose} title="Modal Title">
        <p>Modal body</p>
      </Modal>
    );

    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(document.body).toHaveTextContent('Modal body');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
