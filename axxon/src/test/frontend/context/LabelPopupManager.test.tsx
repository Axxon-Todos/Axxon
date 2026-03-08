import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLabelPopup } from '@/context/LabelPopupManager';
import { useModal } from '@/context/ModalManager';

import { renderWithProviders } from '../renderWithProviders';

function LabelPopupProbe() {
  const { popupState, openPopup, closePopup, isPopupOpen } = useLabelPopup();
  const { openModal } = useModal();

  return (
    <div>
      <button
        type="button"
        onClick={(event) => openPopup(1, event.currentTarget)}
      >
        Open popup 1
      </button>
      <button
        type="button"
        onClick={(event) => openPopup(2, event.currentTarget)}
      >
        Open popup 2
      </button>
      <button type="button" onClick={() => openModal('CATEGORY', {
        id: 3,
        board_id: 1,
        name: 'Backlog',
        color: '#94a3b8',
        position: 0,
        is_done: false,
        created_at: '',
        updated_at: '',
      })}>
        Open modal
      </button>
      <button type="button" onClick={closePopup}>
        Close popup
      </button>
      <p>Current popup: {popupState.todoId ?? 'none'}</p>
      <p>Popup one open: {String(isPopupOpen(1))}</p>
      <p>Popup two open: {String(isPopupOpen(2))}</p>
    </div>
  );
}

describe('LabelPopupManager', () => {
  it('ensures only one popup is open at a time and closes it when a modal opens', () => {
    renderWithProviders(<LabelPopupProbe />, { withLabelPopup: true });

    fireEvent.click(screen.getByRole('button', { name: 'Open popup 1' }));
    expect(screen.getByText('Current popup: 1')).toBeInTheDocument();
    expect(screen.getByText('Popup one open: true')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open popup 2' }));
    expect(screen.getByText('Current popup: 2')).toBeInTheDocument();
    expect(screen.getByText('Popup one open: false')).toBeInTheDocument();
    expect(screen.getByText('Popup two open: true')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(screen.getByText('Current popup: none')).toBeInTheDocument();
  });
});
