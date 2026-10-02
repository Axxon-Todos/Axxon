// Presents a searchable organization directory with accessible selection and owner actions.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Pencil, Search } from 'lucide-react';

import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

type OrganizationListProps = {
  organizations: OrganizationSummary[];
  selectedOrganizationId: number | null;
  onSelect: (organizationId: number) => void;
  isLoading?: boolean;
  isError?: boolean;
};

// Renders organization selection as a compact, keyboard-friendly directory.
export default function OrganizationList({
  organizations,
  selectedOrganizationId,
  onSelect,
  isLoading = false,
  isError = false,
}: OrganizationListProps) {
  const [search, setSearch] = useState('');
  const [editingOrganization, setEditingOrganization] = useState<OrganizationSummary | null>(null);
  const reducedMotion = useReducedMotion();
  const filteredOrganizations = organizations.filter((organization) =>
    organization.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div>
          <p className="app-kicker">Directory</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Organizations</h2>
        </div>
        <span className="text-sm tabular-nums app-text-muted">{organizations.length.toString().padStart(2, '0')}</span>
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <label className="relative block">
          <span className="sr-only">Search organizations</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an organization"
            className="app-input !rounded-lg !py-2.5 pl-10 text-sm"
          />
        </label>
      </div>

      <ScrollArea.Root className="h-[min(540px,60vh)] min-h-[260px]">
        <ScrollArea.Viewport className="h-full w-full">
          <Tooltip.Provider delayDuration={180}>
            <div className="space-y-1 px-3 pb-4 sm:px-4">
              {isLoading ? (
                <div className="space-y-2" aria-label="Loading organizations">
                  {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--app-panel-soft)] motion-reduce:animate-none" />)}
                </div>
              ) : isError ? (
                <p className="px-3 py-8 text-sm app-error-text">Unable to load organizations.</p>
              ) : organizations.length === 0 ? (
                <p className="px-3 py-8 text-sm leading-6 app-text-muted">Create an organization to start organizing boards and teammates.</p>
              ) : filteredOrganizations.length === 0 ? (
                <p className="px-3 py-8 text-sm app-text-muted">No organizations match “{search}”.</p>
              ) : filteredOrganizations.map((organization, index) => {
                const selected = organization.id === selectedOrganizationId;
                return (
                  <motion.div
                    key={organization.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : Math.min(index * 0.04, 0.24) }}
                    className="group relative flex items-center gap-1 rounded-lg border border-transparent pr-2 hover:bg-[var(--app-panel-soft)]"
                    data-selected={selected}
                    style={selected ? { background: 'var(--app-panel-soft)', borderColor: 'var(--app-border)' } : undefined}
                  >
                    {selected ? <motion.span layoutId="active-organization" className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-[var(--app-accent)]" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 38 }} /> : null}
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-controls="dashboard-projects"
                      onClick={() => onSelect(organization.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]"
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-xs font-semibold tracking-wide">
                        {organization.name.slice(0, 2).toUpperCase()}
                        <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: resolveAccentColor(organization.color) }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{organization.name}</span>
                        <span className="mt-1 block truncate text-xs app-text-muted">
                          {organization.accessible_board_count} {organization.accessible_board_count === 1 ? 'board' : 'boards'} · {organization.current_user_role}
                        </span>
                      </span>
                    </button>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <Link
                          href={buildOrganizationPath(organization.id)}
                          aria-label={`Open ${organization.name}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-foreground-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Tooltip.Trigger>
                      <Tooltip.Portal><Tooltip.Content side="top" sideOffset={6} className="z-50 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-2 py-1 text-xs shadow-[var(--app-shadow)]">Open workspace</Tooltip.Content></Tooltip.Portal>
                    </Tooltip.Root>
                    {organization.current_user_role === 'owner' ? (
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            aria-label={`Edit ${organization.name}`}
                            onClick={() => setEditingOrganization(organization)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-muted)] hover:bg-[var(--app-panel)] hover:text-[var(--app-foreground-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal><Tooltip.Content side="top" sideOffset={6} className="z-50 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-2 py-1 text-xs shadow-[var(--app-shadow)]">Edit organization</Tooltip.Content></Tooltip.Portal>
                      </Tooltip.Root>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
          </Tooltip.Provider>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="flex w-1.5 p-0.5"><ScrollArea.Thumb className="flex-1 rounded-full bg-[var(--app-border-strong)]" /></ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {editingOrganization ? (
        <EditOrganizationModal organization={editingOrganization} onClose={() => setEditingOrganization(null)} />
      ) : null}
    </>
  );
}
