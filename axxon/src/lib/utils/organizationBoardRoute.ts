import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import {
  requireBoardCreatorInOrganization,
  requireBoardInOrganization,
} from '@/lib/utils/authorization';

type OrganizationBoardRouteParams = {
  organizationId: string;
  boardId: string;
};

export async function parseOrganizationBoardParams(
  context: RouteContext<OrganizationBoardRouteParams>
) {
  const { organizationId, boardId } = await context.params;

  return {
    organizationId: parseNumericRouteParam(organizationId, 'organization id'),
    boardId: parseNumericRouteParam(boardId, 'board id'),
  };
}

export async function requireOrganizationBoardMember(
  context: RouteContext<OrganizationBoardRouteParams>,
  userId: number
) {
  const params = await parseOrganizationBoardParams(context);
  await requireBoardInOrganization(params.organizationId, params.boardId, userId);
  return params;
}

export async function requireOrganizationBoardCreator(
  context: RouteContext<OrganizationBoardRouteParams>,
  userId: number
) {
  const params = await parseOrganizationBoardParams(context);
  await requireBoardCreatorInOrganization(params.organizationId, params.boardId, userId);
  return params;
}
