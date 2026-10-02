// Defines a responsive dashboard shell with space reserved for the desktop navigation rail.
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import Sidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "@/components/ui/sideBar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="app-shell-bg min-h-dvh overflow-x-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
        className="box-border min-h-dvh min-w-0 w-full overflow-x-hidden px-4 pb-12 pt-20 transition-[padding-left] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:px-6 lg:pl-[calc(var(--sidebar-width)+2rem)] lg:pr-8 lg:pt-6"
      >
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
