// Verifies the top sidebar nav rows render at full width and keep AI as the sole active top-level destination on AI routes.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockedUsePathname, mockedUseRouter } = vi.hoisted(() => ({
  mockedUsePathname: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: mockedUsePathname,
  useRouter: mockedUseRouter,
}));

vi.mock('@/components/features/dashboard/CreateBoardForm', () => ({
  default: () => <div>Create board form</div>,
}));

vi.mock('@/components/features/dashboard/CreateOrganizationForm', () => ({
  default: () => <div>Create organization form</div>,
}));

vi.mock('@/components/features/dashboard/SidebarOrganizationTree', () => ({
  default: () => <div>Sidebar org tree</div>,
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/context/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({
    organizationId: '3',
    boardId: '',
  }),
}));

import Sidebar from '@/components/ui/sideBar';

describe('Sidebar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders full-width top nav rows and keeps AI as the active destination on AI routes', () => {
    mockedUsePathname.mockReturnValue('/dashboard/orgs/3/ai');
    mockedUseRouter.mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
    });

    render(<Sidebar collapsed={false} setCollapsed={vi.fn()} />);

    const organizationsLink = screen.getByRole('link', { name: 'Organizations' });
    const organizationAiLink = screen.getByRole('link', { name: 'Organization AI' });

    expect(organizationsLink).toHaveClass('w-full');
    expect(organizationAiLink).toHaveClass('w-full');
    expect(organizationsLink).not.toHaveAttribute('aria-current');
    expect(organizationAiLink).toHaveAttribute('aria-current', 'page');
  });
});
