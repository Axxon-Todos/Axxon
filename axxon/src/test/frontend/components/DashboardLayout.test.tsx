// Verifies desktop rail sizing and a full-width mobile content surface.
import { fireEvent, render, screen } from '@testing-library/react';
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

  vi.doMock('@/components/features/dashboard/SidebarOrganizationTree', () => ({
    default: () => <div>Sidebar org tree</div>,
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
  it('exports the compact rail dimensions', async () => {
    mockSidebarDependencies();

    const sidebarModule = await import('@/components/ui/sideBar');

    expect(sidebarModule.SIDEBAR_EXPANDED_WIDTH).toBe(272);
    expect(sidebarModule.SIDEBAR_COLLAPSED_WIDTH).toBe(64);
  });

  it('reserves rail space only at desktop width and updates it when collapsed', async () => {
    vi.doMock('@/components/ui/sideBar', () => ({
      __esModule: true,
      default: ({ setCollapsed }: { setCollapsed: (value: boolean) => void }) => (
        <button type="button" onClick={() => setCollapsed(true)}>Collapse</button>
      ),
      SIDEBAR_COLLAPSED_WIDTH: 64,
      SIDEBAR_EXPANDED_WIDTH: 272,
    }));

    const { default: DashboardLayout } = await import('@/app/dashboard/layout');

    render(
      <DashboardLayout>
        <div>Board content</div>
      </DashboardLayout>
    );

    const main = screen.getByRole('main');

    expect(main.style.getPropertyValue('--sidebar-width')).toBe('272px');
    expect(main).toHaveClass('w-full', 'lg:pl-[calc(var(--sidebar-width)+2rem)]');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(main.style.getPropertyValue('--sidebar-width')).toBe('64px');
  });
});
