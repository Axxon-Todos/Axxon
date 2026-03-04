"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
  label?: string;
};

export default function PaginationControls({
  page,
  pageCount,
  onPrevious,
  onNext,
  label = "Pagination",
}: PaginationControlsProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        className="glass-button !h-9 !w-9 !p-0 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-medium app-text-muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="glass-button !h-9 !w-9 !p-0 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
