// Verifies dashboard shell sizing stays aligned with the widened sidebar constants and layout contract.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function mockSidebarDependencies() {
  vi.doMock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
    }),
  }));

  vi.doMock('@/components/features/dashboard/BoardList', () => ({
    default: () => <div>Boards</div>,
  }));

  vi.doMock('@/components/features/dashboard/CreateBoardForm', () => ({
    default: () => <div>Create board form</div>,
  }));

  vi.doMock('@/components/features/dashboard/CreateOrganizationForm', () => ({
    default: () => <div>Create organization form</div>,
  }));

  vi.doMock('@/components/features/dashboard/OrganizationList', () => ({
    default: () => <div>Organizations</div>,
  }));

  vi.doMock('@/components/ui/Modal', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }));

  vi.doMock('@/context/ThemeProvider', () => ({
    useTheme: () => ({
      theme: 'dark',
      toggleTheme: vi.fn(),
    }),
  }));

  vi.doMock('@/hooks/useOrganizationRouteParams', () => ({
    useOrganizationRouteParams: () => ({
      organizationId: null,
    }),
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('dashboard shell sizing', () => {
  it('exports the widened sidebar constants', async () => {
    mockSidebarDependencies();

    const sidebarModule = await import('@/components/ui/sideBar');

    expect(sidebarModule.SIDEBAR_EXPANDED_WIDTH).toBe(320);
    expect(sidebarModule.SIDEBAR_COLLAPSED_WIDTH).toBe(84);
  });

  it('derives the main content sizing from the sidebar constants', async () => {
    vi.doMock('framer-motion', () => {
      const MotionMain = React.forwardRef<
        HTMLElement,
        React.HTMLAttributes<HTMLElement> & {
          animate?: { marginLeft?: number; width?: string };
        }
      >(({ children, animate, ...props }, ref) => (
        <main
          ref={ref}
          data-margin-left={String(animate?.marginLeft ?? '')}
          data-width={String(animate?.width ?? '')}
          {...props}
        >
          {children}
        </main>
      ));

      MotionMain.displayName = 'MotionMain';

      return {
        motion: {
          main: MotionMain,
        },
        useReducedMotion: () => true,
      };
    });

    vi.doMock('@/components/ui/sideBar', () => ({
      __esModule: true,
      default: () => <aside data-testid="sidebar" />,
      SIDEBAR_COLLAPSED_WIDTH: 77,
      SIDEBAR_EXPANDED_WIDTH: 410,
      SIDEBAR_TRANSITION: { duration: 0 },
    }));

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });

    const { default: DashboardLayout } = await import('@/app/dashboard/layout');

    render(
      <DashboardLayout>
        <div>Board content</div>
      </DashboardLayout>
    );

    const main = screen.getByRole('main');

    expect(main).toHaveAttribute('data-margin-left', '410');
    expect(main).toHaveAttribute('data-width', 'calc(100vw - 410px)');
  });
});
