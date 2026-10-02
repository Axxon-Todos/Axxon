// Shows boards for the selected organization as a searchable project directory.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Separator from '@radix-ui/react-separator';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, FolderKanban, GitBranch, Plus, Search, Users2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import type { BoardBaseData } from '@/lib/types/boardTypes';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { buildOrganizationBoardPath, buildOrganizationPath } from '@/lib/utils/routes';
import { resolveAccentColor } from '@/lib/utils/brandColors';

type DashboardProjectsProps = {
  organization: OrganizationSummary | null;
  onCreateBoard: () => void;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// Keeps board timestamps legible when older records have no valid update date.
function formatUpdatedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : `Updated ${dateFormatter.format(date)}`;
}

// Renders the selected workspace summary and its board list.
export default function DashboardProjects({ organization, onCreateBoard }: DashboardProjectsProps) {
  const [search, setSearch] = useState('');
  const reducedMotion = useReducedMotion();
  const organizationId = organization ? String(organization.id) : '';
  const { data: boards = [], isLoading, isError, refetch } = useQuery<BoardBaseData[]>({
    queryKey: ['boards', organizationId],
    queryFn: () => fetchBoards(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  });
  const filteredBoards = boards
    .filter((board) => (board.name || 'Untitled board').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  if (!organization) {
    return (
      <div id="dashboard-projects" className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)]"><FolderKanban className="h-6 w-6 app-text-muted" /></span>
        <h2 className="mt-5 text-xl font-semibold">No organization selected</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 app-text-muted">Create an organization to see its boards and team activity here.</p>
      </div>
    );
  }

  return (
    <motion.div
      id="dashboard-projects"
      key={organization.id}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-5 px-5 pb-5 pt-5 sm:px-7 sm:pt-7">
        <div className="min-w-0">
          <p className="app-kicker">Selected workspace</p>
          <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{organization.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 app-text-muted">
            {organization.description || 'Boards, teammates, repositories, and agent work for this organization.'}
          </p>
        </div>
        <Link href={buildOrganizationPath(organization.id)} className="app-button !min-h-10 shrink-0 text-sm">
          Open workspace <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 pb-5 text-xs app-text-muted sm:px-7">
        <span className="inline-flex items-center gap-2"><FolderKanban className="h-3.5 w-3.5" /> {organization.accessible_board_count} boards</span>
        <span className="inline-flex items-center gap-2"><Users2 className="h-3.5 w-3.5" /> {organization.member_count} members</span>
        <span className="inline-flex items-center gap-2"><GitBranch className="h-3.5 w-3.5" /> {organization.repo_count} repositories</span>
      </div>

      <Separator.Root decorative orientation="horizontal" className="h-px bg-[var(--app-border)]" />

      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-7">
        <div>
          <p className="app-kicker">Inside this organization</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight">Projects <span className="ml-1 text-base font-normal app-text-muted">{boards.length}</span></h3>
        </div>
        <Button variant="primary" size="sm" onClick={onCreateBoard}><Plus className="h-4 w-4" /> Create board</Button>
      </div>

      <div className="px-5 pb-5 sm:px-7">
        <label className="relative block">
          <span className="sr-only">Search boards</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a board" className="app-input !rounded-lg !py-2.5 pl-10 text-sm" />
        </label>
      </div>

      <div className="border-t border-[var(--app-border)]">
        {isLoading ? (
          <div className="space-y-2 p-5 sm:p-7" aria-label="Loading boards">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--app-panel-soft)] motion-reduce:animate-none" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-6">
            <p className="text-sm app-error-text">Unable to load boards for this organization.</p>
            <Button size="sm" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : boards.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <FolderKanban className="mx-auto h-7 w-7 app-text-muted" />
            <h4 className="mt-4 text-lg font-semibold">No boards yet</h4>
            <p className="mt-2 text-sm app-text-muted">Create a board to organize this team&apos;s work.</p>
            <Button variant="primary" size="sm" className="mt-5" onClick={onCreateBoard}><Plus className="h-4 w-4" /> Create board</Button>
          </div>
        ) : filteredBoards.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm app-text-muted">No boards match “{search}”.</p>
        ) : (
          <div className="divide-y divide-[var(--app-border)]">
            {filteredBoards.map((board, index) => (
              <motion.div key={board.id} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : Math.min(index * 0.045, 0.3) }}>
                <Link href={buildOrganizationBoardPath(organization.id, board.id)} aria-label={`Open board ${board.name || 'Untitled board'}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-[var(--app-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)] sm:px-7">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted-strong)]">
                    <FolderKanban className="h-[18px] w-[18px]" />
                    <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: resolveAccentColor(board.color) }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{board.name || 'Untitled board'}</span>
                    <span className="mt-1 block text-xs app-text-muted">{formatUpdatedDate(board.updated_at)}</span>
                  </span>
                  <span className="hidden text-xs app-text-muted sm:block">Board</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--app-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--app-foreground-strong)] motion-reduce:transform-none motion-reduce:transition-none" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
