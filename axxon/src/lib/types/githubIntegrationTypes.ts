// Defines shared GitHub integration types for API payloads, persistence records, and setup flows.
export type GithubInstallationStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'removed';

export type GithubRepositorySelection = 'all' | 'selected';

export type GithubWebhookEventStatus =
  | 'received'
  | 'processed'
  | 'ignored'
  | 'failed';

export type GithubInstallationRecord = {
  id: number;
  organization_id: number;
  github_installation_id: string;
  github_account_id: string;
  github_account_login: string;
  github_account_type: string;
  repository_selection: GithubRepositorySelection;
  status: GithubInstallationStatus;
  installed_by_user_id: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RepositoryRecord = {
  id: number;
  organization_id: number;
  github_installation_id: string;
  github_repo_id: string;
  name: string;
  full_name: string;
  owner_login: string;
  default_branch: string | null;
  private: boolean;
  archived: boolean;
  html_url: string;
  is_active: boolean;
  raw_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type GithubWebhookEventRecord = {
  id: number;
  github_delivery_id: string;
  event_name: string;
  action: string | null;
  github_installation_id: string | null;
  github_repository_id: string | null;
  signature_256: string | null;
  payload_json: Record<string, unknown>;
  headers_json: Record<string, string>;
  received_at: string;
  processed_at: string | null;
  status: GithubWebhookEventStatus;
  error_message: string | null;
  retry_count: number;
};

export type GithubSetupAction = 'install' | 'update' | null;

export type GithubInstallationSummary = Pick<
  GithubInstallationRecord,
  | 'organization_id'
  | 'github_installation_id'
  | 'github_account_id'
  | 'github_account_login'
  | 'github_account_type'
  | 'repository_selection'
  | 'status'
  | 'installed_by_user_id'
  | 'last_synced_at'
  | 'updated_at'
>;

export type OrganizationRepositoriesResponse = {
  installation: GithubInstallationSummary | null;
  repositories: RepositoryRecord[];
};

export type GithubInstallStartResponse = {
  installUrl: string;
};

export type GithubFinalizeRequest = {
  installationId: string;
  setupAction?: GithubSetupAction;
  state: string;
  verificationToken?: string;
};

export type GithubFinalizeAuthorizationRequired = {
  status: 'authorization_required';
  authorizationUrl: string;
};

export type GithubFinalizeSuccess = {
  status: 'connected';
  installation: GithubInstallationSummary;
  repositoriesSynced: number;
};

export type GithubFinalizeResponse =
  | GithubFinalizeAuthorizationRequired
  | GithubFinalizeSuccess;

export type GithubSyncResponse = {
  installation: GithubInstallationSummary;
  syncedCount: number;
  deactivatedCount: number;
};

export type GithubSetupSearchParams = {
  installation_id?: string;
  setup_action?: string;
  state?: string;
  verification_token?: string;
  error?: string;
};
