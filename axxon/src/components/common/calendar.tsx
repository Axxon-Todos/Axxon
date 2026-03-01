"use client";

import { useState } from "react";
import dayjs from "dayjs";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarTodo = {
  id: number | string;
  title: string;
  color?: string;
  boardName?: string;
  boardId?: string;
  categoryName?: string;
  categoryId?: number;
  description?: string;
  priority?: number;
  dueDate?: string;
  assigneeId?: number;
  isComplete?: boolean;
};

type TodosByDate = Record<string, CalendarTodo[]>;

type CalendarProps = {
  todosByDate: TodosByDate;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  onSelectTodo?: (todo: CalendarTodo) => void;
};

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({
  todosByDate,
  selectedDate,
  onSelectDate,
  onSelectTodo,
}: CalendarProps) {
  const today = dayjs();
  const [currentMonth, setCurrentMonth] = useState(today.startOf("month"));
  const activeDate = selectedDate ?? today.format("YYYY-MM-DD");

  const prevMonth = () => setCurrentMonth((value) => value.subtract(1, "month"));
  const nextMonth = () => setCurrentMonth((value) => value.add(1, "month"));
  const jumpToToday = () => {
    setCurrentMonth(today.startOf("month"));
    onSelectDate?.(today.format("YYYY-MM-DD"));
  };

  const startOfMonth = currentMonth.startOf("month").startOf("week");
  const days = Array.from({ length: 42 }).map((_, i) => startOfMonth.add(i, "day"));
  const selectedTodos = (todosByDate[activeDate] || [])
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <section className="glass-panel-strong rounded-[2rem] p-4 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-kicker">Calendar</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Due-date timeline</h2>
          <p className="mt-2 text-sm leading-6 app-text-muted">
            Track what lands this month, jump to today instantly, and inspect the full agenda for any date.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={prevMonth} className="glass-button !h-11 !w-11 !p-0" type="button">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-3">
            <CalendarDays className="h-4 w-4 text-[var(--app-accent)]" />
            <span className="text-sm font-semibold sm:text-base">{currentMonth.format("MMMM YYYY")}</span>
          </div>
          <button onClick={nextMonth} className="glass-button !h-11 !w-11 !p-0" type="button">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={jumpToToday} className="glass-button" type="button">
            Today
          </button>
        </div>
      </div>

      <div
        className="mt-6 rounded-[1.75rem] border border-[var(--app-border)] p-3 sm:p-4"
        style={{
          background: "color-mix(in srgb, var(--app-panel) 92%, transparent)",
        }}
      >
        <div className="grid grid-cols-7 gap-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.18em] app-text-muted sm:text-[0.72rem]">
          {daysOfWeek.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const key = day.format("YYYY-MM-DD");
            const todos = todosByDate[key] || [];
            const isCurrentMonth = day.month() === currentMonth.month();
            const isToday = day.isSame(today, "day");
            const isSelected = key === activeDate;
            const hasOverdue = day.isBefore(today, "day") && todos.some((todo) => !todo.isComplete);
            const dayClassName = clsx(
              "min-h-[7.75rem] rounded-[1.2rem] border p-3 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
              isToday || isSelected
                ? "border-[var(--app-accent)]"
                : isCurrentMonth
                  ? "border-[var(--app-border)] bg-white/10"
                  : "border-transparent bg-white/5 text-[var(--app-muted)]"
            );

            return (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setCurrentMonth(day.startOf("month"));
                  onSelectDate?.(key);
                }}
                aria-pressed={isSelected}
                className={dayClassName}
                style={
                  isToday || isSelected
                    ? {
                        background:
                          "color-mix(in srgb, var(--app-accent) 16%, var(--app-panel-strong))",
                        boxShadow: isSelected
                          ? "0 22px 40px -32px color-mix(in srgb, var(--app-accent) 62%, transparent)"
                          : undefined,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={clsx("text-sm font-semibold", {
                      "text-[var(--app-accent)]": isToday || isSelected,
                    })}
                  >
                    {day.date()}
                  </span>
                  {todos.length > 0 ? <span className="app-badge">{todos.length}</span> : null}
                </div>

                <div className="mt-3 space-y-2">
                  {todos.slice(0, 2).map((todo) => (
                    <div
                      key={todo.id}
                      className="rounded-xl border border-white/10 px-2.5 py-2 text-xs"
                      style={{
                        background: "color-mix(in srgb, var(--app-panel-strong) 82%, transparent)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: todo.color || "#2563eb" }}
                        />
                        <span className="truncate font-medium">{todo.title}</span>
                      </div>
                      {todo.boardName ? (
                        <span className="mt-1 block truncate app-text-muted">{todo.boardName}</span>
                      ) : null}
                    </div>
                  ))}

                  {todos.length > 2 ? (
                    <div className="text-xs font-medium app-text-muted">+{todos.length - 2} more</div>
                  ) : null}

                  {todos.length === 0 ? (
                    <div className="pt-2 text-xs app-text-muted">
                      {hasOverdue ? "Overdue tasks" : "No due items"}
                    </div>
                  ) : null}
                </div>

                {hasOverdue ? (
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Past due
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="mt-5 rounded-[1.5rem] border border-[var(--app-border)] p-4 sm:p-5"
        style={{
          background: "color-mix(in srgb, var(--app-panel) 88%, transparent)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Selected Agenda</p>
            <h3 className="mt-2 text-xl font-semibold">{dayjs(activeDate).format("dddd, MMMM D")}</h3>
          </div>
          <span className="app-badge">{selectedTodos.length} tasks</span>
        </div>

        <div className="mt-5 space-y-3">
          {selectedTodos.length === 0 ? (
            <p className="text-sm app-text-muted">No due items scheduled for this date.</p>
          ) : (
            selectedTodos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => onSelectTodo?.(todo)}
                className="glass-panel flex w-full items-start gap-3 rounded-[1.15rem] p-4 text-left hover:-translate-y-0.5"
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: todo.color || "#2563eb" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{todo.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {todo.boardName ? <span className="app-badge">{todo.boardName}</span> : null}
                    {todo.categoryName ? <span className="app-badge">{todo.categoryName}</span> : null}
                    {todo.dueDate ? <span className="app-badge">{dayjs(todo.dueDate).format("MMM D")}</span> : null}
                    {todo.isComplete ? <span className="app-badge">Complete</span> : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
