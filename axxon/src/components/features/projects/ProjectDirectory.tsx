// Lists architecture projects and provides the primary organization entry point into the new product.
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Boxes, Plus } from 'lucide-react';
import Surface from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { fetchProjects } from '@/lib/api/projects/getProjects';
import { buildOrganizationProjectPath } from '@/lib/utils/routes';

export default function ProjectDirectory({ organizationId, onCreate }: { organizationId: string; onCreate: () => void }) {
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects', organizationId],
    queryFn: () => fetchProjects(organizationId),
  });

  return (
    <Surface variant="strong" className="rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="app-kicker">Architecture projects</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Shared system blueprints</h2>
          <p className="mt-2 max-w-2xl text-sm app-text-muted">Create a living architecture model that connects requirements, decisions, collaboration, and implementation planning.</p>
        </div>
        <Button variant="primary" onClick={onCreate}><Plus className="h-4 w-4" /> New project</Button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <Surface className="rounded-2xl p-4 text-sm app-text-muted">Loading projects...</Surface> : null}
        {isError ? <Surface className="rounded-2xl p-4 text-sm app-error-text">Failed to load projects.</Surface> : null}
        {!isLoading && !isError && projects.length === 0 ? <Surface className="rounded-2xl p-5 text-sm app-text-muted md:col-span-2 xl:col-span-3">No architecture projects yet. Create the first shared blueprint.</Surface> : null}
        {projects.map((project) => (
          <Link key={project.id} href={buildOrganizationProjectPath(organizationId, project.id)} className="group">
            <Surface variant="interactive" className="h-full rounded-2xl p-5 transition-transform duration-200 group-hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-panel-soft)]"><Boxes className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 app-text-muted" /></div>
              <h3 className="mt-5 truncate text-lg font-semibold">{project.name}</h3>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm app-text-muted">{project.description || 'Canonical architecture workspace'}</p>
              <p className="mt-5 text-xs uppercase tracking-[0.14em] app-text-muted">Open architecture</p>
            </Surface>
          </Link>
        ))}
      </div>
    </Surface>
  );
}
