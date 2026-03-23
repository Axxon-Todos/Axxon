# GitHub App Integration Foundation

## Implementation Intent
- Keep the integration org-scoped: installations attach to Axxon organizations, repositories are imported into organizations, and boards will link to repos later through a future `board_repositories` junction table.
- Keep route handlers thin and move the GitHub-specific work into `src/lib/github` and `src/lib/integrations/github`.
- Persist every webhook delivery in `github_webhook_events` before processing so duplicate handling, replay tooling, and debugging stay possible as the integration grows.
- Keep v1 read-oriented: installation auth, repo listing, repo sync, and webhook auditing only. Do not add PR mutation or broad write workflows yet.

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
6. If GitHub user verification is still required, finalize returns a GitHub authorization URL that points to `/api/integrations/github/callback`.
7. The callback exchanges the GitHub code, verifies the GitHub user can access the installation, creates a short-lived verification token, and redirects back to the org setup page.
8. Finalize upserts the installation, syncs repositories, and returns a connected state to the UI.

## Webhook Flow
- GitHub sends webhook deliveries to `POST /api/webhooks/github`.
- The route reads the raw request body, verifies `X-Hub-Signature-256`, extracts `x-github-event` and `x-github-delivery`, and inserts the delivery into `github_webhook_events`.
- Duplicate deliveries are acknowledged without reprocessing.
- V1 branches on `installation` and `installation_repositories`.
- `installation` updates installation status for `created`, `suspend`, `unsuspend`, and `deleted`.
- `installation_repositories` triggers a full repo sync for the matching org installation.

## Migration Intent
- `github_installations` stores GitHub App installations linked to Axxon organizations, including account metadata, repository selection, install status, installer, and last sync time.
- `repositories` stores imported repositories accessible through an org installation and keeps inactive rows when access is later removed.
- `github_webhook_events` stores raw webhook payloads and headers plus processing status, retry count, and failure details.

## Current TODOs
- Add `board_repositories` so boards can link to imported repos.
- Add pull request and branch sync.
- Add webhook replay tooling backed by `github_webhook_events`.
- Add a retry worker for failed webhook events and repo sync retries.
