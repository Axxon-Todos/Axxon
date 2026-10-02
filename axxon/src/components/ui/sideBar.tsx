// Renders compact desktop navigation and an accessible org-first mobile drawer.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Separator from "@radix-ui/react-separator";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Building2,
  ChevronLeft,
  LogOut,
  Menu,
  MoonStar,
  PanelLeftOpen,
  Plus,
  Sparkles,
  SunMedium,
  X,
} from "lucide-react";
import CreateBoardForm from "@/components/features/dashboard/CreateBoardForm";
import CreateOrganizationForm from "@/components/features/dashboard/CreateOrganizationForm";
import SidebarOrganizationTree from "@/components/features/dashboard/SidebarOrganizationTree";
import Modal from "@/components/ui/Modal";
import { useTheme } from "@/context/ThemeProvider";
import { useOrganizationRouteParams } from "@/hooks/useOrganizationRouteParams";
import { buildOrganizationAiPath } from "@/lib/utils/routes";

export const SIDEBAR_EXPANDED_WIDTH = 272;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_TRANSITION = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1],
} as const;

type SidebarPanelProps = {
  collapsed: boolean;
  mobile?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  onCreate: () => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
};

// Owns sidebar dialogs and keeps desktop and mobile navigation in sync.
export default function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { organizationId } = useOrganizationRouteParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const createLabel = organizationId ? "Create board" : "Create organization";

  // Closes the drawer before opening the shared creation dialog.
  function openCreateModal() {
    setIsMobileOpen(false);
    setIsCreateModalOpen(true);
  }

  // Ends the session and returns to the public entry page.
  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <Tooltip.Provider delayDuration={200}>
        <motion.aside
          aria-label="Dashboard sidebar"
          initial={false}
          animate={{
            width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
          }}
          transition={shouldReduceMotion ? { duration: 0 } : SIDEBAR_TRANSITION}
          className="fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col overflow-hidden border-r border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-foreground)] lg:flex"
        >
          <SidebarPanel
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            onCreate={openCreateModal}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
          />
        </motion.aside>
      </Tooltip.Provider>

      <Dialog.Root open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-panel)] px-4 text-[var(--app-foreground)] lg:hidden">
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="sidebar-icon-button"
            >
              <Menu className="h-4 w-4" />
            </button>
          </Dialog.Trigger>
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-foreground)] text-[var(--app-panel)]">
              A
            </span>
            Axxon
          </Link>
          <button
            type="button"
            aria-label={createLabel}
            onClick={openCreateModal}
            className="sidebar-icon-button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Dialog.Portal>
          <Tooltip.Provider delayDuration={200}>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                className="fixed inset-0 z-40 bg-black/65 lg:hidden"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                initial={{
                  x: shouldReduceMotion ? 0 : -24,
                  opacity: shouldReduceMotion ? 1 : 0,
                }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.2,
                  ease: "easeOut",
                }}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-col overflow-hidden border-r border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-foreground)] shadow-2xl lg:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <SidebarPanel
                  collapsed={false}
                  mobile
                  onNavigate={() => setIsMobileOpen(false)}
                  onCreate={openCreateModal}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                />
              </motion.aside>
            </Dialog.Content>
          </Tooltip.Provider>
        </Dialog.Portal>
      </Dialog.Root>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={organizationId ? "Create New Board" : "Create Organization"}
      >
        {organizationId ? (
          <CreateBoardForm
            organizationId={organizationId}
            onClose={() => setIsCreateModalOpen(false)}
          />
        ) : (
          <CreateOrganizationForm onClose={() => setIsCreateModalOpen(false)} />
        )}
      </Modal>
    </>
  );
}

// Provides the same navigation hierarchy in the desktop rail and mobile drawer.
function SidebarPanel({
  collapsed,
  mobile = false,
  onToggle,
  onNavigate,
  onCreate,
  onLogout,
  isLoggingOut,
}: SidebarPanelProps) {
  const pathname = usePathname();
  const { organizationId } = useOrganizationRouteParams();
  const { theme, toggleTheme } = useTheme();
  const organizationAiPath = organizationId
    ? buildOrganizationAiPath(organizationId)
    : null;
  const isAiActive = Boolean(
    organizationAiPath && pathname.startsWith(organizationAiPath),
  );
  const isOrganizationsActive =
    pathname.startsWith("/dashboard/orgs") || pathname === "/dashboard";
  const createLabel = organizationId ? "Create board" : "Create organization";

  return (
    <>
      <div
        className={`flex h-14 shrink-0 items-center ${collapsed ? "justify-center px-2" : "gap-2 px-3"}`}
      >
        <Link
          href="/dashboard"
          aria-label="Axxon dashboard"
          onClick={onNavigate}
          className="flex h-9 min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--app-foreground)] text-xs text-[var(--app-panel)]">
            A
          </span>
          {!collapsed && <span className="truncate">Axxon</span>}
        </Link>
        {!collapsed && <span className="min-w-0 flex-1" />}
        {mobile ? (
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close navigation"
              className="sidebar-icon-button"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        ) : (
          <SidebarTooltip
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggle}
              className={`sidebar-icon-button ${collapsed ? "absolute left-[14px] top-14" : ""}`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </SidebarTooltip>
        )}
      </div>

      <div className={`shrink-0 ${collapsed ? "mt-12 px-2" : "px-3 pt-3"}`}>
        <SidebarNavItem
          href="/dashboard"
          label="Organizations"
          icon={<Building2 className="h-4 w-4" />}
          collapsed={collapsed}
          active={isOrganizationsActive && !isAiActive}
          onNavigate={onNavigate}
        />
        {organizationAiPath && (
          <SidebarNavItem
            href={organizationAiPath}
            label="Organization AI"
            icon={<Sparkles className="h-4 w-4" />}
            collapsed={collapsed}
            active={isAiActive}
            onNavigate={onNavigate}
          />
        )}
      </div>

      <Separator.Root
        decorative
        className={`my-4 h-px shrink-0 bg-[var(--app-border)] ${collapsed ? "mx-3" : "mx-4"}`}
      />

      {collapsed ? (
        <div className="flex flex-1 flex-col items-center px-2">
          <SidebarTooltip label={createLabel}>
            <button
              type="button"
              aria-label={createLabel}
              onClick={onCreate}
              className="sidebar-icon-button"
            >
              <Plus className="h-4 w-4" />
            </button>
          </SidebarTooltip>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between px-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] app-text-muted">
              Workspaces
            </span>
            <SidebarTooltip label={createLabel}>
              <button
                type="button"
                aria-label={createLabel}
                onClick={onCreate}
                className="sidebar-icon-button !h-7 !w-7"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </SidebarTooltip>
          </div>
          <ScrollArea.Root className="min-h-0 flex-1">
            <ScrollArea.Viewport className="h-full w-full">
              <div className="px-2 pb-5 pt-1">
                <SidebarOrganizationTree onNavigate={onNavigate} />
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="flex w-1.5 touch-none p-0.5"
            >
              <ScrollArea.Thumb className="flex-1 rounded-full bg-[var(--app-border)]" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      )}

      <div
        className={`shrink-0 border-t border-[var(--app-border)] py-2 ${collapsed ? "px-2" : "px-3"}`}
      >
        <SidebarAction
          label={theme === "light" ? "Dark mode" : "Light mode"}
          collapsed={collapsed}
          onClick={toggleTheme}
          icon={
            theme === "light" ? (
              <MoonStar className="h-4 w-4" />
            ) : (
              <SunMedium className="h-4 w-4" />
            )
          }
        />
        <SidebarAction
          label={isLoggingOut ? "Logging out..." : "Log out"}
          collapsed={collapsed}
          onClick={onLogout}
          disabled={isLoggingOut}
          icon={<LogOut className="h-4 w-4" />}
        />
      </div>
    </>
  );
}

// Marks the active destination without adding a second boxed surface.
function SidebarNavItem({
  href,
  label,
  icon,
  collapsed,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`sidebar-nav-row flex h-9 w-full min-w-0 items-center rounded-lg text-sm transition-colors ${collapsed ? "justify-center" : "gap-2.5 px-3"} ${active ? "bg-[var(--app-panel-soft)] font-medium text-[var(--app-foreground)]" : "app-text-muted hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-foreground)]"}`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-foreground)]" />
      )}
    </Link>
  );
  return collapsed ? (
    <SidebarTooltip label={label}>{content}</SidebarTooltip>
  ) : (
    content
  );
}

// Shares row dimensions and focus behavior across utility controls.
function SidebarAction({
  label,
  icon,
  collapsed,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const content = (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`sidebar-nav-row flex h-9 w-full items-center rounded-lg text-sm app-text-muted transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-foreground)] disabled:opacity-50 ${collapsed ? "justify-center" : "gap-2.5 px-3"}`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
  return collapsed ? (
    <SidebarTooltip label={label}>{content}</SidebarTooltip>
  ) : (
    content
  );
}

// Names controls that become icon-only in the collapsed rail.
function SidebarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-[60] rounded-md border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-2 py-1 text-xs text-[var(--app-foreground)] shadow-lg"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
