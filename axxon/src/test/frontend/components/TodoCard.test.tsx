import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TodoCard from '@/components/features/boardView/TodoCard';

import { renderWithProviders } from '../renderWithProviders';

describe('TodoCard', () => {
  it('renders hydrated assignee names instead of raw ids', () => {
    renderWithProviders(
      <TodoCard
        todo={{
          id: 8,
          board_id: 1,
          title: 'Assigned todo',
          assignee_id: 14,
          assignee: {
            id: 14,
            name: 'Ada Lovelace',
            avatar_url: null,
          },
          labels: [],
        }}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Assignee #14')).not.toBeInTheDocument();
  });
});
