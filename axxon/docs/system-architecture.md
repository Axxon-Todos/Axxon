<!-- Summarizes the implemented Axxon system structure for maintainers and coding agents. -->
# Axxon System Architecture

## Overview
Axxon is an org-first software team orchestration app built with Next.js App Router, TypeScript, Knex, React Query, and a separate Socket.IO realtime server. The app code lives in `axxon/`; the git root is the parent `Axxon/` directory.

Organizations are the primary security and product boundary. Boards, members, repositories, repository allowlists, categories, labels, todos, sprints, analytics, and GitHub installations are all accessed through organization-scoped flows.

## Application Surfaces
- Public landing page: `src/app/page.tsx` with sections under `src/components/landing`.
- Authenticated dashboard: `src/app/dashboard/**`.
- Organization workspace: `src/app/dashboard/orgs/[organizationId]/page.tsx` rendered by `OrganizationWorkspace`.
- Board workspace: `src/app/dashboard/orgs/[organizationId]/boards/[boardId]/page.tsx` rendered by `BoardWorkspace`.
- Board subpages: `sprints`, `analytics`, and `settings` live under the board route.
- GitHub setup bridge: `/dashboard/integrations/github/setup`.
- Canonical GitHub setup page: `/dashboard/orgs/[organizationId]/integrations/github/setup`.

## API And Code Layers
- Product APIs are org-scoped under `src/app/api/organizations/**`.
- Public API exceptions are auth routes, `/api/users/me`, `/api/integrations/github/callback`, and `/api/webhooks/github`.
- Route handlers require sessions, parse params/bodies, call controllers, and return responses.
- Controllers in `src/lib/controllers/**` validate input, enforce authorization, and orchestrate models/services.
- Models in `src/lib/models/**` own Knex persistence and database-level invariants.
- Browser API wrappers in `src/lib/api/**` centralize endpoint calls and use `apiFetch` for credentialed requests.
- React Query mutations in `src/lib/mutations/**` wrap client-side writes.
- Shared types live in `src/lib/types/**`; route builders and auth helpers live in `src/lib/utils/**`.

## Data And Integrations
- Core tables include users, organizations, organization_members, boards, board_members, categories, labels, todos, todo_labels, sprints, conversations, conversation_members, conversation_messages, and message attachments.
- GitHub integration tables include `github_installations`, `repositories`, `board_repository_access`, and `github_webhook_events`.
- GitHub low-level API/auth/webhook helpers live in `src/lib/github`.
- GitHub organization-level install, callback, sync, state token, and webhook workflows live in `src/lib/integrations/github`.
- Database migrations, seeds, and bootstrap utilities live under `src/lib/db`.

## Auth, Authorization, And Realtime
- Middleware protects `/dashboard/**` and non-public `/api/**` routes using session cookies.
- Google OAuth uses a server-started PKCE and state flow. `/api/auth/google` redirects to `/api/auth/google/start` for compatibility.
- Organization membership is checked before board membership for org-scoped board resources.
- Org owners control organization member invites, GitHub installation mutations, repository sync, and board repository allowlist mutations.
- `pnpm dev` runs Next.js and the Socket.IO server. `src/lib/server.ts` starts the websocket process; `src/lib/wsServer.ts` handles Socket.IO, Redis pub/sub, allowed origins, session-cookie handshakes, rate-limited auth failures, and board room membership checks.
- Board mutations publish Redis `board:*` messages that Socket.IO forwards to subscribed board rooms.

## Testing And Operations
- Backend tests live under `src/test/backend` and cover routes, controllers, models, utils, database seed behavior, and websocket behavior.
- Frontend tests live under `src/test/frontend` and cover components, context providers, and hooks.
- `pnpm test:backend` runs a Postgres/Redis preflight before backend Vitest.
- Local infrastructure is managed with `pnpm docker:dev`, `pnpm docker:dev:down`, `pnpm docker:dev:reset-db`, and Redis-specific helper scripts.
- `pnpm db:bootstrap` waits for Postgres, applies migrations, and seeds only fresh databases.
