"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import Sidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_TRANSITION,
} from "@/components/ui/sideBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : SIDEBAR_TRANSITION;
  const isAnalyticsPage = pathname.includes('/analytics');
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
        className={`box-border min-w-0 max-w-full overflow-x-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-8 ${
          isAnalyticsPage ? 'h-screen overflow-hidden' : 'min-h-screen overflow-auto'
        }`}
      >
        {children}
      </motion.main>
    </div>
  );
}
