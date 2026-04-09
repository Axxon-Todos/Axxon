// Lists organizations across the page and sidebar shells with organization colors treated as secondary identifiers.
'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { FolderGit2, Users2 } from 'lucide-react';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

type OrganizationListProps = {
  variant?: 'page' | 'sidebar';
};

const PAGE_ITEM_EASE = [0.16, 1, 0.3, 1] as const;

export default function OrganizationList({
  variant = 'page',
}: OrganizationListProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const isSidebar = variant === 'sidebar';

  const { data: organizations = [], isLoading, isError } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: 5 * 60 * 1000,
  });

  const statusClassName = clsx(
    'glass-panel rounded-2xl px-4 py-3 app-text-muted',
    isSidebar ? 'text-sm' : 'text-center'
  );

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

  if (isSidebar) {
    return (
      <div className="space-y-2">
        {organizations.map((organization, index) => {
          const href = buildOrganizationPath(organization.id);
          const isActive = pathname.startsWith(`${href}`);
          const organizationAccent = resolveAccentColor(organization.color);

          return (
            <Link
              key={organization.id}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className="group block rounded-2xl focus-visible:outline-none"
            >
              <motion.div
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, y: 10, scale: 0.985 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, delay: shouldReduceMotion ? 0 : index * 0.03 }}
                className="glass-panel rounded-2xl transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-[var(--app-accent)]"
                style={
                  isActive
                    ? {
                        borderColor:
                          'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                        background:
                          'color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong))',
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: organizationAccent }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {organization.name}
                  </span>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {organizations.map((organization, index) => {
        const href = buildOrganizationPath(organization.id);
        const organizationAccent = resolveAccentColor(organization.color);

        return (
          <Link
            key={organization.id}
            href={href}
            className="group block rounded-[1.8rem] focus-visible:outline-none"
          >
            <motion.article
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: 18, scale: 0.985 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { y: -10, scale: 1.018 }
              }
              transition={{
                duration: shouldReduceMotion ? 0 : 0.28,
                delay: shouldReduceMotion ? 0 : index * 0.04,
                ease: PAGE_ITEM_EASE,
              }}
              className={clsx(
                'glass-panel-strong relative overflow-hidden rounded-[1.8rem] border border-transparent p-6',
                'transition-[box-shadow,border-color,background-color] group-hover:border-white/20',
                'group-hover:shadow-[0_28px_80px_-34px_rgba(15,23,42,0.62)]',
                'group-focus-visible:border-white/20 group-focus-visible:ring-2 group-focus-visible:ring-[var(--app-accent)]',
                shouldReduceMotion ? 'duration-0' : 'duration-300'
              )}
            >
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
              <div className="relative">
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
          </Link>
        );
      })}
    </div>
  );
}
