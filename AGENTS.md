<!-- Defines repository-wide guidance for coding agents working in the Axxon codebase. -->
# Repository Guidelines

## Product Architecture
Axxon is an agent-work orchestration platform for software teams. The implemented application is an org-first Next.js App Router product with a separate Socket.IO realtime server.

- Organizations are the top-level workspace boundary and own members, boards, connected repositories, board repository allowlists, and organization-scoped settings.
- Boards always live inside organizations. Do not reintroduce board-first data models, routes, API handlers, or UI flows.
- Board workspace data includes categories, labels, todos, sprint assignment, board members, analytics, and repository access.
- Conversations and messages are persisted in the database and are linked through the existing board/member data model.
- GitHub repository connections are GitHub App installation-based. Persist installations at the organization layer and treat synced repositories as organization-owned records.
- Board-to-repository access is an explicit allowlist stored in `board_repository_access`.
- Realtime board updates are published through Redis and delivered by the Socket.IO server in `axxon/src/lib/server.ts` and `axxon/src/lib/wsServer.ts`.
- The authenticated SPA flow is org-first:
  - `/dashboard`
  - `/dashboard/orgs`
  - `/dashboard/orgs/[organizationId]`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]/sprints`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]/analytics`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]/settings`
- GitHub setup uses a static bridge at `/dashboard/integrations/github/setup` and lands on the canonical org page at `/dashboard/orgs/[organizationId]/integrations/github/setup`.
- The canonical product API surface is org-scoped under `axxon/src/app/api/organizations/**`.
- Public or intentionally non-org product API exceptions are limited to auth, `/api/users/me`, `/api/integrations/github/callback`, and `/api/webhooks/github`.
- `/api/auth/google` is an existing compatibility redirect into the newer PKCE start route. Do not use that as precedent for adding legacy product routes.
- During this development phase, do not add backward-compatibility layers, redirects, dual-write paths, or legacy board-only endpoints unless explicitly requested.
- Keep `axxon/docs/system-architecture.md` aligned with major route, layer, data model, auth, realtime, or integration changes.

## Design System
Axxon uses a dark-first slate/graphite platform theme with indigo primary actions, cyan secondary accents, and light-mode support.

- Treat `axxon/src/app/globals.css` as the canonical source for semantic design tokens, shared surface styles, and landing-shell utilities.
- Prefer shared UI primitives in `axxon/src/components/ui`, including `Button`, `Surface`, `Badge`, `PageHero`, `SegmentedControl`, `Modal`, `SideDrawer`, and `PaginationControls`.
- Keep entity-specific board or organization colors as secondary accents only; they should not override the platform brand palette.
- The landing page is an AI-native agile platform presentation for agent teams; use motion and Three.js intentionally rather than as generic decoration.
- Product screens should follow the established page-hero plus surfaced-section pattern unless a deliberate product-level redesign is requested.
- Feature-specific UI belongs under `axxon/src/components/features/**`; promote primitives to `axxon/src/components/ui` only when reused across multiple features.

## Project Structure
Run project commands from `axxon/`. The git root is the parent `Axxon/` directory; the application lives in `Axxon/axxon`.

- `axxon/src/app`: Next.js App Router pages, layouts, middleware-covered dashboard routes, and `api/**/route.ts` handlers.
- `axxon/src/components/ui`: shared reusable product-shell primitives.
- `axxon/src/components/features/dashboard`: dashboard, organization workspace, organization members, board list, and GitHub connection UI.
- `axxon/src/components/features/boardView`: board workspace shell, Kanban/List/Calendar views, task cards/drawers, labels, and category management.
- `axxon/src/components/features/boardSprints`: sprint workspace and sprint editor UI.
- `axxon/src/components/features/boardAnalytics`: board analytics visualizations and sections.
- `axxon/src/components/features/boardSettings`: board settings and repository access management UI.
- `axxon/src/components/landing`: public landing page sections and Three.js hero scene.
- `axxon/src/components/forms`: form components used by feature surfaces.
- `axxon/src/context`: client providers for auth, theme, modals, board view state, and label popups.
- `axxon/src/hooks`: reusable client hooks, including route params, socket connection, realtime subscriptions, and responsive helpers.
- `axxon/src/lib/api`: browser-side fetch wrappers around API routes. Use `apiFetch` so credentials are included.
- `axxon/src/lib/controllers`: request orchestration, validation, authorization calls, and domain workflows.
- `axxon/src/lib/models`: Knex persistence classes and queries.
- `axxon/src/lib/types`: reusable domain and API response types.
- `axxon/src/lib/utils`: route builders, auth/authorization helpers, API errors, route param parsing, color helpers, and other shared utilities.
- `axxon/src/lib/github`: low-level GitHub App, OAuth, API client, env, and webhook utilities.
- `axxon/src/lib/integrations/github`: organization-level GitHub install, callback, sync, state token, and webhook service orchestration.
- `axxon/src/lib/db`: Knex connection, migrations, seeds, and database utility scripts.
- `axxon/src/test`: backend and frontend Vitest suites, grouped by routes, controllers, models, utils, websocket, components, context, and hooks.
- `axxon/scripts`: local Docker and database helper shell scripts.
- `axxon/docs`: architecture and integration documentation.
- `axxon/public`: static assets.

## Route And Layering Rules
- Keep dashboard pages under `axxon/src/app/dashboard/**`; org-specific product pages belong under `axxon/src/app/dashboard/orgs/**`.
- Keep org-aware API handlers under `axxon/src/app/api/organizations/**`.
- Keep GitHub App setup bridge pages under `axxon/src/app/dashboard/integrations/**`.
- Keep public GitHub entrypoints limited to `/api/integrations/github/callback` and `/api/webhooks/github`.
- Route handlers should stay thin: require the session, parse route params/body, call a controller, and return JSON or redirects.
- Controllers should validate inputs, enforce auth boundaries, coordinate models/services, and normalize API errors.
- Models should focus on persistence and database invariants. Use Knex transactions when multiple writes must succeed or fail together.
- Client components should call `src/lib/api/**` wrappers and React Query mutations instead of hardcoding endpoint strings.
- Route helpers and org/board path builders belong in `axxon/src/lib/utils/routes.ts` or narrowly scoped route utility files.
- Authorization helpers belong in `axxon/src/lib/utils/authorization.ts` and `axxon/src/lib/utils/organizationBoardRoute.ts`; do not bypass them for org-scoped resources.

## Build, Test, And Development Commands
Run commands from `axxon/`.

- `pnpm install`: install dependencies.
- `pnpm dev`: start Next.js and the Socket.IO server concurrently.
- `pnpm dev-next`: start only Next.js.
- `pnpm dev-ws`: start only the Socket.IO server from `src/lib/server.ts`.
- `pnpm db:bootstrap`: wait for Postgres, run migrations, and seed only fresh databases.
- `pnpm build` / `pnpm start`: build and run the production app.
- `pnpm lint`: run ESLint over `src` and project lint configs.
- `pnpm lint:ci`: run ESLint with `--max-warnings=0`.
- `pnpm typecheck`: run TypeScript without emitting files.
- `pnpm test`: run backend and frontend test suites.
- `pnpm test:backend`: run backend preflight checks plus backend Vitest.
- `pnpm test:frontend`: run frontend Vitest.
- `pnpm migrate:make -- <name>`: create a TypeScript Knex migration.
- `pnpm migrate:latest`: apply migrations.
- `pnpm seed`: run the development seed.
- `pnpm rollback`: roll back the latest migration batch.
- `pnpm docker:dev`: start local Docker infrastructure with `.env.local` and optional `.env.docker`.
- `pnpm docker:dev:down`: stop local Docker infrastructure.
- `pnpm docker:dev:reset-db`: recreate the local Docker stack and reset the persisted Postgres volume.
- `pnpm docker:prod` / `pnpm docker:prod:down`: build/start or stop the production compose stack with `.env.local`.
- `pnpm redis:start`, `pnpm redis:stop`, `pnpm redis:logs`, `pnpm redis:cli`: manage Redis directly.

## Coding Style
Use TypeScript throughout and prefer the `@/` import alias for internal modules. Follow the existing 2-space indentation where files use it and avoid reformatting unrelated files.

- Name React components and context providers in PascalCase.
- Name hooks in camelCase with a `use` prefix.
- Name Next route handlers as `route.ts`.
- Keep code concise and minimal.
- Maintain separation of concerns across components, API clients, controllers, models, and utilities.
- Prefer dedicated type files under `src/lib/types`; inline types are fine only when very small and tightly local.
- Add short comments only where intent is not obvious from the code.
- Preserve existing visual and structural conventions unless a deliberate redesign is part of the task.
- Default new UI work to semantic design tokens and shared primitives instead of hardcoded Tailwind color palettes.
- New source files should begin with a brief comment describing their purpose and functionality, matching the current repository convention.

## Backend And Security Rules
- Validate org membership before board membership. Board access is scoped inside organization access.
- Organization member invites are org-owner actions and currently support only emails that already belong to existing Axxon users.
- Board member adds should use org-member `userIds`, not raw email entry, and only allow users who already belong to the org.
- Only org owners should mutate board-to-repository allowlists.
- Restrict GitHub install, finalize, and sync actions to org owners. Repository listing can remain visible to org members.
- Read GitHub webhook request bodies raw before JSON parsing, verify `X-Hub-Signature-256`, and persist deliveries before processing.
- Google OAuth uses a server-started PKCE and state flow. Prefer `GOOGLE_REDIRECT_URI` for callback URL configuration.
- Keep websocket production exposure behind an explicit reverse proxy or loopback-only bind unless public access is intentional.
- Socket.IO handshakes must use session cookies, allowed-origin checks, and board membership checks before joining board rooms.
- Maintain secure defaults for auth, cookies, secrets, repo access boundaries, and member-scoped actions.
- Do not commit `.env*` files; secrets are ignored by `axxon/.gitignore`.
- Treat organization boundaries as a security boundary, not just a UI grouping.

## Testing Guidelines
Vitest is available for backend and frontend suites. Tests are expected for meaningful behavior changes.

- Documentation-only changes should include a diff review and stale-reference search; automated suites are not required unless docs are generated from code.
- Every meaningful code change should include `pnpm lint` plus targeted automated tests.
- Run `pnpm typecheck` when touching route params, shared types, API contracts, or complex component props.
- Any major feature, schema change, route change, auth change, or orchestration-flow change should also run `pnpm test:backend` and `pnpm test:frontend`.
- Keep CI green. Update or remove obsolete tests when architecture changes intentionally invalidate older behavior.
- Place tests under `src/test/backend/**` or `src/test/frontend/**` using `*.test.ts` or `*.test.tsx`.
- Prioritize coverage for organization membership, org-scoped board access, auth/authorization helpers, analytics, board workspace behavior, sprint CRUD and assignment rules, migrations/schema constraints, GitHub integration flows, and websocket/realtime behavior.
- Manual verification is still expected for affected UI flows, especially auth, org creation, board CRUD, analytics, migrations, GitHub setup, and websocket behavior.

## Commit And Pull Request Guidelines
Recent history favors short, single-purpose commit subjects. Use imperative wording and prefer Conventional Commit prefixes when they fit, for example `docs: refresh architecture guidance`.

- Keep each commit focused.
- PRs should summarize user-visible changes, list schema or environment updates, link the relevant issue when available, and include screenshots or recordings for UI work.
- Always note manual test steps and automated checks run.

## Git Workflow
- Before modifying tracked files, ensure you are on a non-protected feature branch. Never commit directly to `main`, `master`, or `staging`.
- If already on a non-protected feature branch, continue using it.
- If on a protected branch, create a branch using one of:
  - `feature/<short-kebab-summary>`
  - `fix/<short-kebab-summary>`
  - `chore/<short-kebab-summary>`
  - `tweak/<short-kebab-summary>`
- Start work with `git status` and understand any existing dirty files before editing.
- Do not revert or overwrite user changes. If unrelated files are dirty, leave them alone.
- After changes, run verification appropriate to the scope.
- Commit with a Conventional Commit prefix when applicable.
- Push with `git push -u origin <branch-name>`.
- If pushing is not possible because remote auth is unavailable, state that and provide the exact push command for the user to run.

## Documentation Maintenance
- When a major feature is completed, update this file and any relevant docs under `axxon/docs`.
- Keep `axxon/docs/system-architecture.md` as the concise source of truth for implemented structure.
- Keep `axxon/docs/github-app-integration.md` aligned with actual GitHub install, sync, webhook, and repository access behavior.
