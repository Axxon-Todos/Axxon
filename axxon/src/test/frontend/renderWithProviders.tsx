import React, { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LabelPopupProvider } from '@/context/LabelPopupManager';
import { ModalProvider } from '@/context/ModalManager';
import { ThemeProvider } from '@/context/ThemeProvider';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

type RenderWithProvidersOptions = {
  queryClient?: QueryClient;
  withLabelPopup?: boolean;
};

export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const queryClient = options.queryClient ?? createTestQueryClient();

  function Providers({ children }: { children: React.ReactNode }) {
    const content = options.withLabelPopup ? (
      <LabelPopupProvider>{children}</LabelPopupProvider>
    ) : (
      children
    );

    return (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ModalProvider>{content}</ModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Providers }),
  };
}
