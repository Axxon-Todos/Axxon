// Renders the sidebar's org-first navigation tree with expandable organizations, direct board links, and owner-only quick edit actions.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Boxes, ChevronDown, PencilLine } from 'lucide-react';

import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import { fetchProjects } from '@/lib/api/projects/getProjects';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import {
  buildOrganizationPath,
  buildOrganizationProjectPath,
} from '@/lib/utils/routes';

const ITEM_EASE = [0.16, 1, 0.3, 1] as const;

export default function SidebarOrganizationTree({ onNavigate }: { onNavigate?: () => void }) {
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
              (expandedOrganizations[organizationId] ?? organizationId === activeOrganizationId)
          )
      ),
    [activeOrganizationId, expandedOrganizations, organizations]
  );

  const projectQueries = useQueries({
    queries: organizations.map((organization) => {
      const organizationId = String(organization.id);

      return {
        queryKey: ['projects', organizationId],
        queryFn: () => fetchProjects(organizationId),
        enabled: expandedOrganizationIds.has(organizationId),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const itemTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: ITEM_EASE };
  const statusClassName = 'px-3 py-2 text-xs app-text-muted';

  if (isLoading) {
    return <div className={statusClassName}>Loading organizations...</div>;
  }

  if (isError) {
    return <div className={statusClassName}>Unable to load organizations.</div>;
  }

  if (organizations.length === 0) {
    return (
      <div className={statusClassName}>
        No organizations yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0.5">
        {organizations.map((organization, index) => {
          const organizationId = String(organization.id);
          const organizationHref = buildOrganizationPath(organization.id);
          const isOrganizationActive =
            pathname === organizationHref || pathname.startsWith(`${organizationHref}/`);
          const isExpanded = expandedOrganizations[organizationId] ?? isOrganizationActive;
          const projects = projectQueries[index]?.data ?? [];
          const isProjectsLoading = projectQueries[index]?.isLoading ?? false;
          const hasProjectsError = Boolean(projectQueries[index]?.error);
          const organizationAccent = resolveAccentColor(organization.color);

          return (
            <motion.section
              key={organization.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...itemTransition,
                delay: shouldReduceMotion ? 0 : index * 0.035,
              }}
              className="min-w-0"
            >
              <div className="flex min-w-0 items-center gap-0.5 rounded-lg transition-colors hover:bg-[var(--app-panel-soft)]">
                <Link
                  href={organizationHref}
                  aria-current={pathname === organizationHref ? 'page' : undefined}
                  onClick={onNavigate}
                  className={clsx(
                    'flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-3 text-sm transition-colors',
                    isOrganizationActive ? 'font-medium text-[var(--app-foreground)]' : 'app-text-muted hover:text-[var(--app-foreground)]'
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: organizationAccent }}
                  />
                  <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedOrganizations((current) => ({
                      ...current,
                      [organizationId]: !(current[organizationId] ?? isOrganizationActive),
                    }))
                  }
                  className="sidebar-icon-button !h-8 !w-7 shrink-0"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${organization.name}`}
                  aria-expanded={isExpanded}
                >
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={itemTransition}
                    className="flex items-center justify-center"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </button>
                {organization.current_user_role === 'owner' && (
                  <button type="button" aria-label={`Edit ${organization.name}`} onClick={() => setEditingOrganization(organization)} className="sidebar-icon-button !h-8 !w-7 shrink-0 text-[var(--app-muted)]">
                    <PencilLine className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    key={`organization-projects-${organization.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={itemTransition}
                    className="overflow-hidden"
                  >
                    <div className="ml-[18px] border-l border-[var(--app-border)] pl-2">
                      <div className="space-y-0.5 py-0.5">
                        {isProjectsLoading ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            Loading projects...
                          </p>
                        ) : hasProjectsError ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            Unable to load projects.
                          </p>
                        ) : projects.length === 0 ? (
                          <p className="px-3 py-2 text-xs app-text-muted">
                            No projects yet.
                          </p>
                        ) : (
                          projects.map((project) => {
                            const projectHref = buildOrganizationProjectPath(
                              organization.id,
                              project.id
                            );
                            const isProjectActive =
                              pathname === projectHref || pathname.startsWith(`${projectHref}/`);

                            return (
                              <Link
                                key={project.id}
                                href={projectHref}
                                aria-current={isProjectActive ? 'page' : undefined}
                                onClick={onNavigate}
                                className={clsx(
                                  'flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
                                  isProjectActive
                                    ? 'bg-[var(--app-panel-soft)] font-medium text-[var(--app-foreground)]'
                                    : 'app-text-muted hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-foreground)]'
                                )}
                              >
                                <Boxes className="h-3.5 w-3.5 shrink-0" />
                                <span className="min-w-0 flex-1 truncate">
                                  {project.name || 'Untitled Project'}
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
