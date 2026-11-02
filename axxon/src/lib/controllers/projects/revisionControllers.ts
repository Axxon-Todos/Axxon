// Authorizes project-scoped revision comparison and rollback operations.
import { compareArchitectureRevisions, getArchitectureRevision, revertArchitectureRevision } from '@/lib/models/architectureRevisions';
import { NotFoundError } from '@/lib/utils/apiErrors';
import { requireProjectMember } from '@/lib/utils/authorization';

// Returns one revision and optionally its semantic diff against another revision.
export async function inspectProjectRevision(input: { organizationId: number; projectId: number; revisionId: number; compareTo?: number; userId: number }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  if (input.compareTo) {
    const comparison = await compareArchitectureRevisions(input.projectId, input.compareTo, input.revisionId);
    if (!comparison) throw new NotFoundError('Architecture revision not found');
    return comparison;
  }
  const revision = await getArchitectureRevision(input.projectId, input.revisionId);
  if (!revision) throw new NotFoundError('Architecture revision not found');
  return revision;
}

// Restores a prior snapshot as a new immutable revision for the project.
export async function revertProjectRevision(input: { organizationId: number; projectId: number; revisionId: number; userId: number }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const revision = await revertArchitectureRevision(input.projectId, input.userId, input.revisionId);
  if (!revision) throw new NotFoundError('Architecture revision not found');
  return revision;
}
