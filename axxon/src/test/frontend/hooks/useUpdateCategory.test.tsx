// Verifies category updates refresh both lane and todo caches when done-state changes affect completion flags.
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedUpdateCategoryById } = vi.hoisted(() => ({
  mockedUpdateCategoryById: vi.fn(),
}));

vi.mock('@/lib/api/categories/updateCategoryById', () => ({
  updateCategoryById: mockedUpdateCategoryById,
}));

import { useUpdateCategory } from '@/lib/mutations/UseUpdateCategory';

describe('useUpdateCategory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    mockedUpdateCategoryById.mockResolvedValue({
      id: 4,
      board_id: 9,
      is_done: false,
    });
  });

  function createWrapper() {
    function HookWrapper({ children }: { children: React.ReactNode }) {
      return (
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </React.StrictMode>
      );
    }

    HookWrapper.displayName = 'HookWrapper';

    return HookWrapper;
  }

  it('invalidates categories and todos after category updates settle', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCategory('12', '9'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        categoryId: 4,
        data: { is_done: false },
      });
    });

    await waitFor(() => {
      expect(mockedUpdateCategoryById).toHaveBeenCalledWith('12', '9', 4, {
        is_done: false,
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['categories', '12', '9'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todos', '12', '9'],
    });
  });
});
