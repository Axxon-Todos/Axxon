// Orchestrates project creation, organization-scoped listing, and canonical architecture draft operations.
import { Architecture } from '@/lib/models/architecture';
import { Projects } from '@/lib/models/projects';
import type { ArchitectureDraftInput } from '@/lib/types/architectureTypes';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireOrganizationMember, requireProjectMember } from '@/lib/utils/authorization';

function requiredName(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new BadRequestError(`${label} is required`);
  return normalized;
}

export async function listProjectsForOrganization(organizationId: number, userId: number) {
  await requireOrganizationMember(organizationId, userId);
  return Projects.listForOrganization(organizationId);
}

export async function createProject(input: { organizationId: number; userId: number; name?: string; description?: string | null }) {
  await requireOrganizationMember(input.organizationId, input.userId);
  return Projects.create({
    organization_id: input.organizationId,
    created_by: input.userId,
    name: requiredName(input.name, 'Project name'),
    description: input.description?.trim() || null,
  });
}

export async function getProjectArchitecture(input: { organizationId: number; projectId: number; userId: number }) {
  const project = await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const [graph, revisions] = await Promise.all([
    Architecture.getGraph(input.projectId),
    Architecture.listRevisions(input.projectId),
  ]);
  return { project, graph, revisions };
}

export async function updateProjectArchitecture(input: { organizationId: number; projectId: number; userId: number; data: ArchitectureDraftInput }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  try {
    return await Architecture.replaceDraft(input.projectId, input.userId, input.data);
  } catch (error) {
    if (error instanceof Error && error.message.includes('outdated revision')) throw new BadRequestError(error.message);
    throw error;
  }
}

export async function commitProjectArchitecture(input: { organizationId: number; projectId: number; userId: number; summary?: string | null }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  try {
    return await Architecture.commitRevision(input.projectId, input.userId, input.summary?.trim() || null);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) throw new NotFoundError(error.message);
    throw error;
  }
}
