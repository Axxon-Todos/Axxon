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

export function buildOrganizationBoardSettingsPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationBoardPath(organizationId, boardId)}/settings`;
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

export function buildOrganizationMembersApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/members`;
}

export function buildOrganizationMemberCandidatesApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/member-candidates`;
}

export function buildOrganizationBoardRepositoriesApiPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationBoardApiPath(organizationId, boardId)}/repositories`;
}

export function buildOrganizationBoardMemberCandidatesApiPath(
  organizationId: string | number,
  boardId: string | number
) {
  return `${buildOrganizationBoardApiPath(organizationId, boardId)}/member-candidates`;
}

export function buildOrganizationBoardRepositoryAccessApiPath(
  organizationId: string | number
) {
  return `${buildOrganizationApiPath(organizationId)}/board-repository-access`;
}
