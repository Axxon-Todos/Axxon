// Defines the authenticated dashboard shell and keeps the content area aligned with the collapsible sidebar.
"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Sidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_TRANSITION,
} from "@/components/ui/sideBar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : SIDEBAR_TRANSITION;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  return (
    <div className="app-shell-bg min-h-screen overflow-x-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <motion.main
        initial={false}
        animate={{
          marginLeft: sidebarWidth,
          width: `calc(100vw - ${sidebarWidth}px)`,
        }}
        transition={transition}
        className="box-border min-h-screen min-w-0 max-w-full overflow-x-hidden overflow-y-auto px-4 pb-12 pt-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] flex-col gap-6">{children}</div>
      </motion.main>
    </div>
  );
}
