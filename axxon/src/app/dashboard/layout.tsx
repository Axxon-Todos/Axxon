"use client";

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
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : SIDEBAR_TRANSITION;

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  return (
    <div className="app-shell-bg min-h-screen">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <motion.main
        initial={false}
        animate={{
          marginLeft: collapsed
            ? SIDEBAR_COLLAPSED_WIDTH
            : SIDEBAR_EXPANDED_WIDTH,
        }}
        transition={transition}
        className="min-h-screen min-w-0 w-full overflow-auto px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
