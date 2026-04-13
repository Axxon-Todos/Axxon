// Renders the sidebar's org-first navigation tree with expandable organizations, direct board links, and owner-only quick edit actions.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDown, FolderKanban, PencilLine } from 'lucide-react';

import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import type { BoardBaseData } from '@/lib/types/boardTypes';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import {
  buildOrganizationBoardPath,
  buildOrganizationPath,
} from '@/lib/utils/routes';

const ITEM_EASE = [0.16, 1, 0.3, 1] as const;

export default function SidebarOrganizationTree() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const { organizationId: activeOrganizationId } = useOrganizationRouteParams();
  const [expandedOrganizations, setExpandedOrganizations] = useState<Record<string, boolean>>(
    {}
  );
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationSummary | null>(null);

  const { data: organizations = [], isLoading, isError } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!activeOrganizationId) {
      return;
    }

    setExpandedOrganizations((current) => {
      if (Object.prototype.hasOwnProperty.call(current, activeOrganizationId)) {
        return current;
      }

      return {
        ...current,
        [activeOrganizationId]: true,
      };
    });
  }, [activeOrganizationId]);

  const expandedOrganizationIds = useMemo(
    () =>
      new Set(
        organizations
          .map((organization) => String(organization.id))
          .filter(
            (organizationId) =>
              organizationId === activeOrganizationId ||
              expandedOrganizations[organizationId]
          )
      ),
    [activeOrganizationId, expandedOrganizations, organizations]
  );

  const boardQueries = useQueries({
    queries: organizations.map((organization) => {
      const organizationId = String(organization.id);

      return {
        queryKey: ['boards', organizationId],
        queryFn: () => fetchBoards(organizationId),
        enabled: expandedOrganizationIds.has(organizationId),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const itemTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: ITEM_EASE };
  const statusClassName = 'glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted';

  if (isLoading) {
    return <div className={statusClassName}>Loading organizations...</div>;
  }

  if (isError) {
    return <div className={statusClassName}>Unable to load organizations.</div>;
  }

  if (organizations.length === 0) {
    return (
      <div className={statusClassName}>
        No organizations yet. Create one to start organizing boards around a team boundary.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {organizations.map((organization, index) => {
          const organizationId = String(organization.id);
          const organizationHref = buildOrganizationPath(organization.id);
          const isOrganizationActive =
            pathname === organizationHref || pathname.startsWith(`${organizationHref}/`);
          const isExpanded = expandedOrganizations[organizationId] ?? isOrganizationActive;
          const boards = (boardQueries[index]?.data ?? []) as BoardBaseData[];
          const isBoardsLoading = boardQueries[index]?.isLoading ?? false;
          const hasBoardsError = Boolean(boardQueries[index]?.error);
          const organizationAccent = resolveAccentColor(organization.color);

          return (
            <motion.section
              key={organization.id}
              initial={
                shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.985 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                ...itemTransition,
                delay: shouldReduceMotion ? 0 : index * 0.035,
              }}
              className="group glass-panel overflow-hidden rounded-[1.5rem]"
              style={
                isOrganizationActive
                  ? {
                      borderColor:
                        'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                      background:
                        'color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong))',
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2 p-2">
                <Link
                  href={organizationHref}
                  aria-current={isOrganizationActive ? 'page' : undefined}
                  className={clsx(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-[1.15rem] px-3 py-3 transition-[background-color,color]',
                    isOrganizationActive &&
                      'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: organizationAccent,
                      boxShadow: `0 0 0 6px color-mix(in srgb, ${organizationAccent} 18%, transparent)`,
                    }}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {organization.name}
                    </span>
                    <span className="mt-1 block text-xs app-text-muted">
                      {organization.accessible_board_count} boards in scope
                    </span>
                  </span>
                </Link>

                <div className="flex h-10 w-10 items-center justify-center">
                  {organization.current_user_role === 'owner' ? (
                    <button
                      type="button"
                      aria-label={`Edit ${organization.name}`}
                      onClick={() => setEditingOrganization(organization)}
                      className="app-hover-reveal glass-button !h-10 !w-10 !rounded-[1rem] !p-0"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedOrganizations((current) => ({
                      ...current,
                      [organizationId]: !(current[organizationId] ?? false),
                    }))
                  }
                  className="glass-button !h-10 !w-10 !rounded-[1rem] !p-0"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${organization.name}`}
                >
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={itemTransition}
                    className="flex items-center justify-center"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    key={`organization-boards-${organization.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={itemTransition}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3">
                      <div className="ml-4 space-y-1 border-l border-[var(--app-border)] pl-4">
                        {isBoardsLoading ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            Loading boards...
                          </p>
                        ) : hasBoardsError ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            Unable to load boards.
                          </p>
                        ) : boards.length === 0 ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            No boards yet.
                          </p>
                        ) : (
                          boards.map((board) => {
                            const boardHref = buildOrganizationBoardPath(
                              organization.id,
                              board.id
                            );
                            const isBoardActive =
                              pathname === boardHref || pathname.startsWith(`${boardHref}/`);
                            const boardAccent = resolveAccentColor(board.color);

                            return (
                              <Link
                                key={board.id}
                                href={boardHref}
                                aria-current={isBoardActive ? 'page' : undefined}
                                className={clsx(
                                  'flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm transition-[background-color,color]',
                                  isBoardActive
                                    ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-foreground)]'
                                    : 'app-text-muted hover:bg-[color-mix(in_srgb,var(--app-panel-strong)_84%,transparent)] hover:text-[var(--app-foreground)]'
                                )}
                              >
                                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                                  <FolderKanban className="h-3.5 w-3.5" />
                                  <span
                                    className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: boardAccent }}
                                  />
                                </span>
                                <span className="truncate">
                                  {board.name || 'Untitled Board'}
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.section>
          );
        })}
      </div>

      {editingOrganization ? (
        <EditOrganizationModal
          organization={editingOrganization}
          onClose={() => setEditingOrganization(null)}
        />
      ) : null}
    </>
  );
}
