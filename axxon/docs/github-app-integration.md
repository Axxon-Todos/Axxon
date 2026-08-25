<!-- Documents the implemented org-scoped GitHub App integration and repository access model. -->
# GitHub App Integration

## Current Intent
- Keep the integration organization-scoped: installations attach to Axxon organizations, repositories sync into organizations, and boards receive repository access through the explicit `board_repository_access` allowlist.
- Keep route handlers thin. GitHub request validation and controller-level authorization live under `src/lib/controllers/integrations/github`, low-level GitHub API/auth helpers live under `src/lib/github`, and install/sync/webhook workflows live under `src/lib/integrations/github`.
- Persist every webhook delivery in `github_webhook_events` before processing so duplicate handling, replay tooling, and debugging stay possible as the integration grows.
- Keep the current integration read-oriented: installation auth, repository listing, repository sync, board repository allowlists, and webhook auditing. Do not add pull request mutation or broad write workflows unless explicitly requested.

## Required Env Vars
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `APP_BASE_URL`

## Install And Setup Flow
1. An org owner calls `POST /api/organizations/[organizationId]/integrations/github/install`.
2. The backend signs a short-lived install state token containing the org id and Axxon user id, resolves the GitHub App slug, and returns a GitHub installation URL.
3. GitHub redirects back to the static setup bridge page at `/dashboard/integrations/github/setup`.
4. The bridge verifies the signed install state and redirects into the canonical org page at `/dashboard/orgs/[organizationId]/integrations/github/setup`.
5. The org-scoped setup page calls `POST /api/organizations/[organizationId]/integrations/github/finalize`.
6. If GitHub user verification is required, finalize returns a GitHub authorization URL that points to `/api/integrations/github/callback`.
7. The callback exchanges the GitHub code, verifies the GitHub user can access the installation, creates a short-lived verification token, and redirects back to the org setup page.
8. Finalize upserts the active installation, marks other org installations removed, syncs repositories, and returns the connected state to the UI.

## Repository Access Flow
- Org members can list the current installation summary and active synced repositories through `GET /api/organizations/[organizationId]/repositories`.
- Board members can list repositories assigned to a board through `GET /api/organizations/[organizationId]/boards/[boardId]/repositories`.
- Org owners can replace a board's repository allowlist through `PUT /api/organizations/[organizationId]/boards/[boardId]/repositories`.
- Org owners can read the board/repository matrix through `GET /api/organizations/[organizationId]/board-repository-access`.
- The allowlist is stored in `board_repository_access` and only accepts active repositories that belong to the same organization as the board.

## Webhook Flow
- GitHub sends webhook deliveries to `POST /api/webhooks/github`.
- The route reads the raw request body, verifies `X-Hub-Signature-256`, extracts `x-github-event` and `x-github-delivery`, and inserts the delivery into `github_webhook_events`.
- Duplicate deliveries are acknowledged without reprocessing.
- `installation` events update installation status for `created`, `suspend`, `unsuspend`, and `deleted`.
- Deleted installations also deactivate repositories for the installation.
- `installation_repositories` events trigger a full repository sync for the matching active org installation.
- Unsupported events are persisted and marked ignored.

## Persistence
- `github_installations` stores GitHub App installations linked to Axxon organizations, including account metadata, repository selection, install status, installer, and last sync time.
- `repositories` stores imported repositories accessible through an org installation and keeps inactive rows when access is later removed.
- `board_repository_access` stores the explicit board-to-repository allowlist.
- `github_webhook_events` stores raw webhook payloads and headers plus processing status, retry count, and failure details.

## Current TODOs
- Add pull request and branch sync.
- Add webhook replay tooling backed by `github_webhook_events`.
- Add a retry worker for failed webhook events and repository sync retries.
