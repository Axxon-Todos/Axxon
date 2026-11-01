// Parses and authorizes organization/project route parameters for the architecture workspace APIs.
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';
import { requireProjectMember, requireProjectOwner } from '@/lib/utils/authorization';

type OrganizationProjectRouteParams = {
  organizationId: string;
  projectId: string;
};

export async function parseOrganizationProjectParams(
  context: RouteContext<OrganizationProjectRouteParams>
) {
  const { organizationId, projectId } = await context.params;
  return {
    organizationId: parseNumericRouteParam(organizationId, 'organization id'),
    projectId: parseNumericRouteParam(projectId, 'project id'),
  };
}

export async function requireOrganizationProjectMember(
  context: RouteContext<OrganizationProjectRouteParams>,
  userId: number
) {
  const params = await parseOrganizationProjectParams(context);
  await requireProjectMember(params.organizationId, params.projectId, userId);
  return params;
}

export async function requireOrganizationProjectOwner(
  context: RouteContext<OrganizationProjectRouteParams>,
  userId: number
) {
  const params = await parseOrganizationProjectParams(context);
  await requireProjectOwner(params.organizationId, params.projectId, userId);
  return params;
}
