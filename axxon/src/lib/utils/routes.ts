export function buildOrganizationPath(organizationId: string | number) {
  return `/dashboard/orgs/${organizationId}`;
}

export function buildOrganizationBoardPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationPath(organizationId)}/boards/${boardId}`;
}

export function buildOrganizationBoardAnalyticsPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationBoardPath(organizationId, boardId)}/analytics`;
}

export function buildOrganizationBoardsApiPath(
  organizationId: string | number
) {
  return `/api/organizations/${organizationId}/boards`;
}

export function buildOrganizationBoardApiPath(
  organizationId: string | number,
  boardId: string | number,
  suffix = ''
) {
  return `${buildOrganizationBoardsApiPath(organizationId)}/${boardId}${suffix}`;
}
