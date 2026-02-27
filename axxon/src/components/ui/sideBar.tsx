"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Separator from "@radix-ui/react-separator";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  MoonStar,
  Plus,
  Sparkles,
  SunMedium,
} from "lucide-react";
import BoardList from "@/components/features/dashboard/BoardList";
import CreateBoardForm from "@/components/features/dashboard/CreateBoardForm";
import Modal from "@/components/ui/Modal";
import { useTheme } from "@/context/ThemeProvider";

export const SIDEBAR_EXPANDED_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_TRANSITION = {
  type: "spring",
  stiffness: 240,
  damping: 28,
  mass: 0.9,
} as const;

const CONTENT_TRANSITION = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1] as const,
};

export default function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const sidebarTransition = shouldReduceMotion
    ? { duration: 0 }
    : SIDEBAR_TRANSITION;
  const contentTransition = shouldReduceMotion
    ? { duration: 0 }
    : CONTENT_TRANSITION;
  const isDashboardActive = pathname === "/dashboard";

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
      <Tooltip.Provider delayDuration={120}>
        <motion.aside
          aria-label="Dashboard sidebar"
          initial={false}
          animate={{
            width: collapsed
              ? SIDEBAR_COLLAPSED_WIDTH
              : SIDEBAR_EXPANDED_WIDTH,
          }}
          transition={sidebarTransition}
          className="glass-panel-strong fixed inset-y-0 left-0 z-30 flex h-screen flex-col overflow-hidden border-r border-[var(--app-border)] text-[var(--app-foreground)] shadow-[var(--app-shadow)] backdrop-blur-xl"
        >
          <motion.div
            layout
            className={`${
              collapsed
                ? "flex flex-col items-center gap-2 px-2 pb-3 pt-4"
                : "flex items-start gap-3 px-3 pb-3 pt-4"
            }`}
          >
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  key="sidebar-title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={contentTransition}
                  className="min-w-0 flex-1"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] app-text-muted">
                    Workspace
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--app-accent)] text-[var(--app-accent-foreground)] shadow-lg">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <p className="truncate text-lg font-semibold tracking-tight">
                      Axxon
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              layout
              className={`${
                collapsed
                  ? "flex flex-col items-center gap-2"
                  : "ml-auto flex items-center gap-2"
              }`}
            >
              <SidebarTooltip label="Create board">
                <motion.button
                  type="button"
                  aria-label="Create board"
                  aria-haspopup="dialog"
                  onClick={() => setIsCreateModalOpen(true)}
                  whileHover={
                    shouldReduceMotion ? undefined : { scale: 1.03, y: -1 }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  className="glass-button glass-button-primary !h-10 !w-10 !p-0 focus-visible:outline-none"
                >
                  <Plus className="h-4 w-4" />
                </motion.button>
              </SidebarTooltip>

              <SidebarTooltip
                label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <motion.button
                  type="button"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() => setCollapsed(!collapsed)}
                  whileHover={
                    shouldReduceMotion ? undefined : { scale: 1.02, y: -1 }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  className="glass-button !h-10 !w-10 !p-0 focus-visible:outline-none"
                >
                  <motion.span
                    animate={{ rotate: collapsed ? 180 : 0 }}
                    transition={contentTransition}
                    className="flex items-center justify-center"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </motion.span>
                </motion.button>
              </SidebarTooltip>
            </motion.div>
          </motion.div>

          <div className="px-3">
            <SidebarNavItem
              href="/dashboard"
              label="Dashboard"
              collapsed={collapsed}
              active={isDashboardActive}
            />
          </div>

          <div className="px-3 py-3">
            <Separator.Root
              decorative
              orientation="horizontal"
              className="h-px bg-[var(--app-border)]"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-4">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  key="boards-panel"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={contentTransition}
                  className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px]"
                >
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={contentTransition}
                    className="px-4 pb-3 pt-4"
                  >
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] app-text-muted">
                      Boards
                    </p>
                    <p className="mt-1 text-sm app-text-muted">
                      Move between boards without breaking flow.
                    </p>
                  </motion.div>

                  <Separator.Root
                    decorative
                    orientation="horizontal"
                    className="h-px bg-[var(--app-border)]"
                  />

                  <ScrollArea.Root className="min-h-0 flex-1">
                    <ScrollArea.Viewport className="h-full w-full">
                      <div className="px-3 py-3">
                        <BoardList variant="sidebar" />
                      </div>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar
                      orientation="vertical"
                      className="flex touch-none select-none p-1"
                    >
                      <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--app-border)]" />
                    </ScrollArea.Scrollbar>
                  </ScrollArea.Root>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-3 pb-4">
            <Separator.Root
              decorative
              orientation="horizontal"
              className="mb-3 h-px bg-[var(--app-border)]"
            />

            <div className="grid gap-2">
              <SidebarUtilityButton
                label={theme === "light" ? "Dark mode" : "Light mode"}
                collapsed={collapsed}
                onClick={toggleTheme}
              >
                {theme === "light" ? (
                  <MoonStar className="h-4 w-4" />
                ) : (
                  <SunMedium className="h-4 w-4" />
                )}
              </SidebarUtilityButton>

              <SidebarUtilityButton
                label={isLoggingOut ? "Logging out..." : "Log out"}
                collapsed={collapsed}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
              </SidebarUtilityButton>
            </div>
          </div>
        </motion.aside>
      </Tooltip.Provider>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Board"
      >
        <CreateBoardForm onClose={() => setIsCreateModalOpen(false)} />
      </Modal>
    </>
  );
}

function SidebarNavItem({
  href,
  label,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const contentTransition = shouldReduceMotion
    ? { duration: 0 }
    : CONTENT_TRANSITION;

  const content = (
    <Link href={href} aria-current={active ? "page" : undefined} className="block">
      <motion.div
        layout
        whileHover={shouldReduceMotion ? undefined : { x: collapsed ? 0 : 4 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
        className={`glass-button flex min-h-14 items-center rounded-[20px] transition-colors ${
          collapsed ? "justify-center px-0" : "justify-between px-3.5"
        }`}
        style={
          active
            ? {
                borderColor: "color-mix(in srgb, var(--app-accent) 28%, var(--app-border))",
                background:
                  "color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong))",
                boxShadow:
                  "0 18px 32px -24px color-mix(in srgb, var(--app-accent) 55%, transparent)",
              }
            : undefined
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl border"
            style={
              active
                ? {
                    borderColor: "color-mix(in srgb, var(--app-accent) 30%, var(--app-border))",
                    background:
                      "color-mix(in srgb, var(--app-accent) 16%, var(--app-panel))",
                    color: "var(--app-accent)",
                  }
                : {
                    borderColor: "var(--app-border)",
                    background: "color-mix(in srgb, var(--app-panel) 88%, transparent)",
                    color: "var(--app-foreground)",
                  }
            }
          >
            <LayoutDashboard className="h-5 w-5" />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="dashboard-label"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={contentTransition}
                className="truncate text-sm font-medium"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && active && (
            <motion.span
              key="dashboard-indicator"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={contentTransition}
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: 'var(--app-accent)',
                boxShadow: '0 0 16px var(--app-accent)',
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );

  if (collapsed) {
    return <SidebarTooltip label={label}>{content}</SidebarTooltip>;
  }

  return content;
}

function SidebarUtilityButton({
  label,
  collapsed,
  onClick,
  disabled,
  children,
}: {
  label: string;
  collapsed: boolean;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`glass-button w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-60 ${
        collapsed ? "justify-center px-0" : "justify-start px-3.5"
      }`}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-2xl border"
        style={{
          borderColor: "var(--app-border)",
          background: "color-mix(in srgb, var(--app-panel) 88%, transparent)",
        }}
      >
        {children}
      </span>
      {!collapsed && <span className="truncate text-sm font-medium">{label}</span>}
    </button>
  );

  if (collapsed) {
    return <SidebarTooltip label={label}>{content}</SidebarTooltip>;
  }

  return content;
}

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
          sideOffset={12}
          className="glass-panel rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] shadow-lg"
        >
          {label}
          <Tooltip.Arrow style={{ fill: 'var(--app-panel-strong)' }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
