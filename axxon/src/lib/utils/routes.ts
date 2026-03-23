export function buildOrganizationApiPath(organizationId: string | number) {
  return `/api/organizations/${organizationId}`;
}

export function buildOrganizationPath(organizationId: string | number) {
  return `/dashboard/orgs/${organizationId}`;
}

export function buildDashboardGitHubSetupBridgePath() {
  return '/dashboard/integrations/github/setup';
}

export function buildOrganizationBoardPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationPath(organizationId)}/boards/${boardId}`;
}

export function buildOrganizationGitHubSetupPath(
  organizationId: string | number
) {
  return `${buildOrganizationPath(organizationId)}/integrations/github/setup`;
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
  return `${buildOrganizationApiPath(organizationId)}/boards`;
}

export function buildOrganizationRepositoriesApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/repositories`;
}

export function buildOrganizationGitHubInstallApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/integrations/github/install`;
}

export function buildOrganizationGitHubFinalizeApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/integrations/github/finalize`;
}

export function buildOrganizationGitHubSyncApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/integrations/github/sync`;
}

export function buildOrganizationBoardApiPath(
  organizationId: string | number,
  boardId: string | number,
  suffix = ''
) {
  return `${buildOrganizationBoardsApiPath(organizationId)}/${boardId}${suffix}`;
}
