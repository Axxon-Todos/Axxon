# Repository Guidelines

## Product Architecture
Axxon is an agent-work orchestration platform for software teams.

- Organizations are the top-level workspace boundary.
- Organizations own members, connected repositories, boards, tasks, agent configurations, shared context, execution history, and org-level settings.
- Boards must live inside organizations. Do not reintroduce board-first data models, routes, or UI flows.
- GitHub repository connections are installation-based. Persist the GitHub App installation at the org layer and treat imported repositories as org-owned records.
- The authenticated SPA flow is org-first:
  - `/dashboard`
  - `/dashboard/orgs`
  - `/dashboard/orgs/[organizationId]`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]`
  - `/dashboard/orgs/[organizationId]/boards/[boardId]/analytics`
- GitHub setup uses a static bridge at `/dashboard/integrations/github/setup` and lands on the canonical org page at `/dashboard/orgs/[organizationId]/integrations/github/setup`.
- The canonical API surface is org-scoped under `src/app/api/organizations/**`.
- The public GitHub entrypoints are limited to `/api/integrations/github/callback` and `/api/webhooks/github`.
- During this development phase, do not add backward-compatibility layers, redirects, dual-write paths, or legacy board-only endpoints unless explicitly requested.

## Project Structure & Module Organization
`axxon/` contains the application code. Use `axxon/src/app` for Next.js App Router pages, layouts, and `api/**/route.ts` handlers. Shared UI lives in `axxon/src/components`, client state in `axxon/src/context`, and reusable hooks in `axxon/src/hooks`. Core business logic is grouped under `axxon/src/lib` (`api`, `controllers`, `models`, `mutations`, `types`, `utils`), with database migrations and seeds in `axxon/src/lib/db/`. Put static assets in `axxon/public/`. The repository root is mostly documentation and metadata.

- Keep organization pages under `axxon/src/app/dashboard/orgs/**`.
- Keep org-aware API handlers under `axxon/src/app/api/organizations/**`.
- Keep GitHub App setup bridge pages under `axxon/src/app/dashboard/integrations/**`.
- Shared product-shell UI belongs in `axxon/src/components/ui`.
- Feature-specific UI belongs in `axxon/src/components/features/**`.
- Analytics-specific visualizations and section components should stay under `axxon/src/components/features/boardAnalytics`; only promote primitives to `axxon/src/components/ui` when reused across multiple features.
- Route helpers, org/board path builders, and authorization helpers should stay in `axxon/src/lib/utils`.
- Reusable domain types should live under `axxon/src/lib/types`.
- GitHub API/auth helpers belong in `axxon/src/lib/github`, while org-level install/sync orchestration belongs in `axxon/src/lib/integrations/github`.
- Repository persistence belongs in `axxon/src/lib/models/repositories.ts`, GitHub installation persistence in `axxon/src/lib/models/githubInstallations.ts`, and webhook audit persistence in `axxon/src/lib/models/githubWebhookEvents.ts`.

## Build, Test, and Development Commands
Run commands from `axxon/`.

- `pnpm install`: install dependencies.
- `pnpm dev`: start Next.js on port 3000 and the Socket.IO server from `src/lib/server.ts` on port 4000.
- `pnpm build` / `pnpm start`: build and run the production app.
- `pnpm lint`: run Next.js lint checks.
- `pnpm lint:ci`: run the stricter CI lint entrypoint.
- `pnpm typecheck`: run TypeScript without emitting files.
- `pnpm test`: run backend and frontend test suites.
- `pnpm test:backend`: run backend preflight checks plus backend Vitest coverage.
- `pnpm test:frontend`: run frontend Vitest coverage.
- `pnpm migrate:latest`, `pnpm seed`, `pnpm rollback`: apply, seed, or revert Knex migrations.
- `pnpm docker:dev`: start local dev infrastructure, including the database and Redis.
- `pnpm docker:dev:down`: stop the local dev infrastructure.
- `pnpm redis:start` / `pnpm redis:stop`: manage Redis directly when needed for realtime development.

## Coding Style & Naming Conventions
Use TypeScript throughout and prefer the `@/` import alias for internal modules. Follow the existing 2-space indentation and avoid reformatting unrelated files. Name React components and context providers in PascalCase, hooks in camelCase with a `use` prefix, and Next route handlers as `route.ts`.

- Keep code concise and minimal.
- Maintain separation of concerns across components, models, controllers, and API clients.
- Place shared UI primitives in the UI layer only when they are truly global and reusable.
- Prefer dedicated type files under `src/lib/types`; inline types are fine only when they are very small and tightly local.
- Add short comments only where the intent is not obvious from the code.
- Preserve the existing visual and structural conventions unless a deliberate product-level redesign is part of the task.

## Backend Coding
Knex is used at the model and migrations layer.

- Use transactions where multiple writes must succeed or fail together.
- Maintain ACID-safe behavior for org, board, member, and task mutations.
- Keep models focused on persistence concerns and controllers focused on request orchestration.
- Validate org membership and board membership at the correct boundary. Org membership comes first; board access is scoped within the org.
- Restrict GitHub install/finalize/sync actions to org owners. Repository listing can remain visible to org members.
- Do not bypass authorization helpers for org-scoped resources.
- Maintain secure defaults for auth, cookies, secrets, and socket access.
- Read GitHub webhook request bodies raw before JSON parsing, verify `X-Hub-Signature-256`, and persist deliveries before processing.

## Testing Guidelines
Vitest is available for backend and frontend suites. Tests are part of the expected delivery for every feature, not optional cleanup.

- Every meaningful change should include `pnpm lint` plus targeted automated tests.
- Any major feature, schema change, route change, auth change, or orchestration-flow change must also run:
  - `pnpm test:backend`
  - `pnpm test:frontend`
- Run `pnpm typecheck` when touching route params, shared types, API contracts, or complex component props.
- Keep CI green. New work should expand or update tests instead of weakening them.
- When architecture changes invalidate older behavior, rewrite or remove outdated tests rather than preserving obsolete compatibility paths.
- Place tests near the feature in `src/` and use `*.test.ts` or `*.test.tsx`.
- Prioritize coverage for:
  - organization creation and membership rules
  - org-scoped board creation and access
  - auth and authorization helpers
  - analytics and board workspace behavior
  - migrations and schema constraints
  - websocket and realtime flows when affected
- Manual verification is still expected for the affected user flow, especially auth, org creation, board CRUD, analytics, migrations, and websocket behavior.

## Commit & Pull Request Guidelines
Recent history favors short, single-purpose commit subjects. Use imperative wording and prefer Conventional Commit prefixes when they fit, for example `feat: add organization workspace shell`.

- Keep each commit focused.
- PRs should summarize user-visible changes, list schema or environment updates, link the relevant issue when available, and include screenshots or recordings for UI work.
- Always note the manual test steps and automated checks you ran.

## Security & Configuration Tips
Do not commit `.env*` files; secrets are ignored by `axxon/.gitignore`. Validate database, Google OAuth, Redis, and websocket settings locally before merging configuration changes.

- Maintain current security practices for auth, repo access boundaries, and member-scoped actions.
- Validate inputs at the API boundary and enforce permissions server-side.
- Treat organization boundaries as a security boundary, not just a UI grouping.

## Rules
- Follow proper separation of concerns and maintain up-to-date security practices.
- ALWAYS Write commens at the top of files to briefly describe its purpose and functionality
- When developing features aim for reusable functions to enforce clean code
- Maintain consistency with the surrounding codebase.
- Keep functions and components organized in their appropriate layers.
- UI-layer components should remain general-purpose and reusable.
- Do not add backward-compatibility code during active in-development architecture pivots unless explicitly requested.
- Keep the org-first architecture intact across schema, APIs, routing, and UI.
- When a new major feature is complete, revise this `AGENTS.md` file so the documentation stays aligned with the real system.

### Git workflow (mandatory)
- Before modifying any tracked file, ensure you are on a new feature branch. Never commit directly to `main`, `master`, or `staging`.
- If you are already on a non-protected feature branch, continue using it; otherwise create one.

Branch naming:
- `feature/<short-kebab-summary>`
- `fix/<short-kebab-summary>`
- `chore/<short-kebab-summary>`
- `tweak/<short-kebab-summary>`

Required sequence:
1. `git status` (must be clean or intentionally understood)
2. `git fetch --all --prune`
3. Identify the base branch (`staging` if it exists, else `main`, else current HEAD)
4. `git checkout <base>` and `git pull --ff-only`
5. `git checkout -b <new-branch>`
6. After changes: run the required verification commands for the scope of work
7. Commit with a Conventional Commit prefix when applicable
8. Push with `git push -u origin <new-branch>`

If pushing is not possible because remote auth is unavailable, explicitly say so and provide the exact push command for the user to run.
