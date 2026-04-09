// Presents board-level quick actions inside a branded modal surface for settings, edits, invites, and deletion.
"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PencilLine, Settings2, Trash2, UserPlus, X } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { surfaceClassName } from "@/components/ui/Surface";
import type { UpdateBoard } from "@/lib/types/boardTypes";
import { resolveAccentColor } from "@/lib/utils/brandColors";

type BoardOptionsModalProps = {
  board: UpdateBoard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettings: () => void;
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
  onSettings,
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
  const boardColor = resolveAccentColor(board.color);

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
        className="absolute inset-0 bg-[rgba(2,6,23,0.72)] backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={PANEL_TRANSITION}
        className={surfaceClassName({
          variant: "strong",
          className: "relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] p-6 sm:p-7",
        })}
      >
        <div
          className="absolute inset-x-0 top-0 h-32 opacity-90"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${boardColor} 34%, transparent), transparent)`,
          }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="h-12 w-12 shrink-0 rounded-2xl border border-[var(--app-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: boardColor }}
              />
              <div className="min-w-0">
                <p className="app-kicker">Board actions</p>
                <h2
                  id="board-options-title"
                  className="mt-2 break-words text-2xl font-semibold tracking-tight"
                >
                  {boardName}
                </h2>
                <p className="mt-2 text-sm app-text-muted">
                  Manage this board, invite collaborators, or update its details.
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close board options"
              onClick={onClose}
              className={buttonClassName({ size: "icon" })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <ActionButton
              title="Board settings"
              description="Review access, board members, and repository links."
              icon={<Settings2 className="h-5 w-5" />}
              iconClassName="bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] text-[var(--app-accent)]"
              onClick={() => {
                onSettings();
                onClose();
              }}
            />

            <ActionButton
              title="Edit board"
              description="Rename the board, change its color, or update its details."
              icon={<PencilLine className="h-5 w-5" />}
              iconClassName="bg-[color-mix(in_srgb,var(--app-highlight)_18%,transparent)] text-[var(--app-highlight)]"
              onClick={() => {
                onEdit();
                onClose();
              }}
            />

            <ActionButton
              title="Invite members"
              description="Add teammates and share access without leaving the dashboard."
              icon={<UserPlus className="h-5 w-5" />}
              iconClassName="bg-[color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]"
              onClick={() => {
                onInvite();
                onClose();
              }}
            />

            <ActionButton
              title="Delete board"
              description="Permanently remove this board after confirming the action."
              icon={<Trash2 className="h-5 w-5" />}
              iconClassName="bg-[color-mix(in_srgb,var(--app-danger)_14%,transparent)] text-[var(--app-danger)]"
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
  icon: ReactNode;
  iconClassName: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-4 rounded-[22px] border px-4 py-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] ${
        danger
          ? "border-[color-mix(in_srgb,var(--app-danger)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_8%,var(--app-panel))]"
          : "border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_90%,transparent)]"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            danger ? "text-[var(--app-danger)]" : "text-[var(--app-foreground-strong)]"
          }`}
        >
          {title}
        </span>
        <span className="mt-1 block break-words text-sm leading-6 app-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
