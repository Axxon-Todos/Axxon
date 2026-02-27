"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PencilLine, Trash2, UserPlus, X } from "lucide-react";
import { UpdateBoard } from "@/lib/types/boardTypes";

type BoardOptionsModalProps = {
  board: UpdateBoard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onInvite: () => void;
};

const PANEL_TRANSITION = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1] as const,
};

export default function BoardOptionsModal({
  board,
  onClose,
  onEdit,
  onDelete,
  onInvite,
}: BoardOptionsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    if (panelRef.current) {
      const firstButton = panelRef.current.querySelector("button");
      if (firstButton instanceof HTMLElement) {
        firstButton.focus();
      }
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const boardName = board.name || "Untitled Board";
  const boardColor = board.color || "#0f172a";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-options-title"
    >
      <motion.button
        type="button"
        aria-label="Close board options"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={PANEL_TRANSITION}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={PANEL_TRANSITION}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.96))] text-slate-950 shadow-[0_32px_90px_-38px_rgba(15,23,42,0.72)]"
      >
        <div
          className="absolute inset-x-0 top-0 h-28 opacity-90"
          style={{
            background: `linear-gradient(135deg, ${boardColor}, rgba(15, 23, 42, 0.12))`,
          }}
        />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="h-12 w-12 shrink-0 rounded-2xl border border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                style={{ backgroundColor: boardColor }}
              />
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Board actions
                </p>
                <h2
                  id="board-options-title"
                  className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950"
                >
                  {boardName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Manage this board, invite collaborators, or update its details.
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close board options"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white/75 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-3">
            <ActionButton
              title="Edit board"
              description="Rename the board, change its color, or update its details."
              icon={<PencilLine className="h-5 w-5" />}
              iconClassName="bg-cyan-400/[0.14] text-cyan-700"
              onClick={() => {
                onEdit();
                onClose();
              }}
            />

            <ActionButton
              title="Invite members"
              description="Add teammates and share access without leaving the dashboard."
              icon={<UserPlus className="h-5 w-5" />}
              iconClassName="bg-emerald-500/[0.14] text-emerald-700"
              onClick={() => {
                onInvite();
                onClose();
              }}
            />

            <ActionButton
              title="Delete board"
              description="Permanently remove this board after confirming the action."
              icon={<Trash2 className="h-5 w-5" />}
              iconClassName="bg-rose-500/[0.14] text-rose-700"
              danger
              onClick={() => {
                if (confirm(`Delete board "${boardName}"?`)) {
                  onDelete();
                }
                onClose();
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function ActionButton({
  title,
  description,
  icon,
  iconClassName,
  danger = false,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClassName: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-4 rounded-[22px] border px-4 py-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
        danger
          ? "border-rose-200/70 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-50"
          : "border-slate-200/85 bg-white/78 hover:border-slate-300 hover:bg-white"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span
          className={`block text-sm font-semibold ${
            danger ? "text-rose-700" : "text-slate-950"
          }`}
        >
          {title}
        </span>
        <span
          className={`mt-1 block text-sm leading-6 ${
            danger ? "text-rose-600/85" : "text-slate-600"
          }`}
        >
          {description}
        </span>
      </span>
    </button>
  );
}
