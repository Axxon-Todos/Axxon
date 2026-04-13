// Renders the dashboard organization directory with owner quick-edit affordances and org-first navigation cards.
'use client';

import { useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { FolderGit2, PencilLine, Users2 } from 'lucide-react';

import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

const PAGE_ITEM_EASE = [0.16, 1, 0.3, 1] as const;

export default function OrganizationList() {
  const shouldReduceMotion = useReducedMotion();
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationSummary | null>(null);

  const { data: organizations = [], isLoading, isError } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: 5 * 60 * 1000,
  });

  const statusClassName = 'glass-panel rounded-2xl px-4 py-3 text-center app-text-muted';

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
      <div className="grid gap-4 lg:grid-cols-2">
        {organizations.map((organization, index) => {
          const href = buildOrganizationPath(organization.id);
          const organizationAccent = resolveAccentColor(organization.color);

          return (
            <motion.article
              key={organization.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={shouldReduceMotion ? undefined : { y: -10, scale: 1.018 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.28,
                delay: shouldReduceMotion ? 0 : index * 0.04,
                ease: PAGE_ITEM_EASE,
              }}
              className={clsx(
                'group glass-panel-strong relative overflow-hidden rounded-[1.8rem] border border-transparent p-6',
                'transition-[box-shadow,border-color,background-color] hover:border-white/20',
                'hover:shadow-[0_28px_80px_-34px_rgba(15,23,42,0.62)]',
                'focus-within:border-white/20 focus-within:ring-2 focus-within:ring-[var(--app-accent)]',
                shouldReduceMotion ? 'duration-0' : 'duration-300'
              )}
            >
              <Link
                href={href}
                aria-label={`Open ${organization.name}`}
                className="absolute inset-0 rounded-[1.8rem]"
              />

              <div
                className={clsx(
                  'absolute inset-x-0 top-0 h-24 origin-top opacity-80',
                  'transition-[opacity,transform] group-hover:opacity-100 group-hover:scale-[1.03]',
                  shouldReduceMotion ? 'duration-0' : 'duration-300'
                )}
                style={{
                  background: `linear-gradient(135deg, ${organizationAccent}, transparent)`,
                }}
              />

              {organization.current_user_role === 'owner' ? (
                <div className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center">
                  <button
                    type="button"
                    aria-label={`Edit ${organization.name}`}
                    onClick={() => setEditingOrganization(organization)}
                    className="app-hover-reveal glass-button !h-10 !w-10 !rounded-[1rem] !p-0"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="pointer-events-none relative">
                <p className="app-kicker">Organization</p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      {organization.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 app-text-muted">
                      {organization.description ||
                        'Top-level workspace for repos, boards, members, and agent execution history.'}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'h-4 w-4 shrink-0 rounded-full transition-transform',
                      shouldReduceMotion ? 'duration-0' : 'duration-300 group-hover:scale-110'
                    )}
                    style={{ backgroundColor: organizationAccent }}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="app-badge">
                    <FolderGit2 className="h-3.5 w-3.5" />
                    {organization.accessible_board_count} boards
                  </span>
                  <span className="app-badge">
                    <Users2 className="h-3.5 w-3.5" />
                    {organization.member_count} members
                  </span>
                </div>
              </div>
            </motion.article>
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
