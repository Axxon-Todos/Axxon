"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { AlertCircle, ArrowRight, CalendarDays, FolderKanban, UserRound } from "lucide-react";

import SideDrawer from "@/components/ui/SideDrawer";
import type { CalendarTodo } from "@/components/common/calendar";

const priorityMap: Record<number, string> = {
  1: "None",
  2: "Low",
  3: "Medium",
  4: "High",
};

type TaskDetailsDrawerProps = {
  todo: CalendarTodo | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function TaskDetailsDrawer({
  todo,
  isOpen,
  onClose,
}: TaskDetailsDrawerProps) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={todo?.title ?? "Task details"}
    >
      {!todo ? null : (
        <div className="space-y-6">
          <section className="glass-panel rounded-[1.5rem] p-5">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: todo.color || "#2563eb" }}
              />
              <div className="min-w-0 flex-1">
                <p className="app-kicker">Source Board</p>
                <h3 className="mt-2 break-words text-xl font-semibold">
                  {todo.boardName || "Untitled Board"}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {todo.isComplete ? <span className="app-badge">Complete</span> : <span className="app-badge">Open</span>}
                  {todo.categoryName ? <span className="app-badge">{todo.categoryName}</span> : null}
                </div>
              </div>
            </div>

            {todo.boardId ? (
              <Link
                href={`/dashboard/${todo.boardId}`}
                className="glass-button glass-button-primary mt-5 inline-flex"
                onClick={onClose}
              >
                Open Board
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <DetailCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Due Date"
              value={todo.dueDate ? dayjs(todo.dueDate).format("dddd, MMMM D") : "No due date"}
            />
            <DetailCard
              icon={<AlertCircle className="h-4 w-4" />}
              label="Priority"
              value={priorityMap[todo.priority || 1] || "None"}
            />
            <DetailCard
              icon={<FolderKanban className="h-4 w-4" />}
              label="Board"
              value={todo.boardName || "Untitled Board"}
            />
            <DetailCard
              icon={<UserRound className="h-4 w-4" />}
              label="Assignee"
              value={todo.assigneeId ? `Assignee #${todo.assigneeId}` : "Unassigned"}
            />
          </section>

          {todo.description ? (
            <section className="glass-panel rounded-[1.5rem] p-5">
              <p className="app-kicker">Description</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 app-text-muted">
                {todo.description}
              </p>
            </section>
          ) : null}
        </div>
      )}
    </SideDrawer>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="glass-panel rounded-[1.25rem] p-4">
      <div className="flex items-center gap-2 app-text-muted">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-3 break-words text-sm font-medium">{value}</p>
    </article>
  );
}
