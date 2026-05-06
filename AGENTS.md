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
- `/dashboard/orgs/[organizationId]/ai`
- `/dashboard/orgs/[organizationId]/boards/[boardId]`
- `/dashboard/orgs/[organizationId]/boards/[boardId]/sprints`
- `/dashboard/orgs/[organizationId]/boards/[boardId]/analytics`
- `/dashboard/orgs/[organizationId]/boards/[boardId]/settings`
- GitHub setup uses a static bridge at `/dashboard/integrations/github/setup` and lands on the canonical org page at `/dashboard/orgs/[organizationId]/integrations/github/setup`.
- The canonical API surface is org-scoped under `src/app/api/organizations/**`.
- The organization AI workspace at `/dashboard/orgs/[organizationId]/ai` now supports two modes:
  - Assistant mode: org-scoped, general-purpose chat with persisted creator-owned threads.
  - Planning mode: board-bound, creator-owned planning sessions with a clarification loop, guided multi-option clarification cards, structured plan artifacts, and persisted async planning runs executed through pluggable executors.
- Active planning clarification cards render inline in the planning transcript, while the standard planning composer stays visible but disabled until the active clarification batch or planner processing finishes.
- Planning runs are the execution source of truth. Sessions and transcript messages are user-facing records, but planner execution state, retries, and executor selection persist in `planning_runs`.
- The org AI assistant chat endpoint lives at `src/app/api/organizations/[organizationId]/ai/chat/route.ts`.
- Persisted org AI assistant thread reads live at `src/app/api/organizations/[organizationId]/ai/threads/route.ts` and `src/app/api/organizations/[organizationId]/ai/threads/[threadId]/route.ts`.
- Planning session APIs live under `src/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/**`.
- Planning session create and reply routes persist the turn immediately, create a queued planning run, publish the refreshed session snapshot, and return without waiting for planner completion.
- The retryable processing step lives at `src/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/sessions/[sessionId]/process/route.ts`, and it now re-enqueues retryable or stale runs instead of executing the planner inline.
- Assistant threads persist in `chat_threads` and `chat_messages`; planning sessions persist in `planning_sessions`, `planning_session_messages`, `planning_session_questions`, and `planning_runs`.
- Planning session realtime updates are creator-scoped socket events and are the primary UI update path; use polling only as reconnect or stale-run recovery fallback. Do not broadcast creator-owned planning session payloads to shared board rooms.
- The public GitHub entrypoints are limited to `/api/integrations/github/callback` and `/api/webhooks/github`.
- During this development phase, do not add backward-compatibility layers, redirects, dual-write paths, or legacy board-only endpoints unless explicitly requested.

## Design System
Axxon now uses a dark-first slate/graphite platform theme with indigo primary actions, cyan secondary accents, and light-mode support.

- Treat `axxon/src/app/globals.css` as the canonical source for semantic design tokens, shared surface styles, and landing-shell utilities.
- Prefer the shared UI primitives in `axxon/src/components/ui` such as `Button`, `Surface`, `Badge`, `PageHero`, and `SegmentedControl` before introducing new one-off styling patterns.
- Keep entity-specific board or organization colors as secondary accents only; they should not override the platform brand palette.
- The landing page should stay positioned as an AI-native agile platform for agent teams, with motion and Three.js used intentionally rather than decoratively.
- New product screens should follow the established page-hero + surfaced-section pattern instead of inventing a separate header layout.

## Project Structure & Module Organization
`axxon/` contains the application code. Use `axxon/src/app` for Next.js App Router pages, layouts, and `api/**/route.ts` handlers. Shared UI lives in `axxon/src/components`, client state in `axxon/src/context`, and reusable hooks in `axxon/src/hooks`. Core business logic is grouped under `axxon/src/lib` (`api`, `controllers`, `models`, `mutations`, `types`, `utils`), with database migrations and seeds in `axxon/src/lib/db/`. Put static assets in `axxon/public/`. The repository root is mostly documentation and metadata.

- Keep organization pages under `axxon/src/app/dashboard/orgs/**`.
- Keep org-aware API handlers under `axxon/src/app/api/organizations/**`.
- Keep GitHub App setup bridge pages under `axxon/src/app/dashboard/integrations/**`.
- Shared product-shell UI belongs in `axxon/src/components/ui`.
- Feature-specific UI belongs in `axxon/src/components/features/**`.
- Organization AI assistant and planning UI belongs in `axxon/src/components/features/organizationAi`, including the shared mode switcher, assistant thread sidebar, and planning session workspace.
- Analytics-specific visualizations and section components should stay under `axxon/src/components/features/boardAnalytics`; only promote primitives to `axxon/src/components/ui` when reused across multiple features.
- Board settings components and access-management UI should stay under `axxon/src/components/features/boardSettings`.
- Sprint-specific board UI should stay under `axxon/src/components/features/boardSprints`, and sprint pages must live under `axxon/src/app/dashboard/orgs/[organizationId]/boards/[boardId]/sprints`.
- Route helpers, org/board path builders, and authorization helpers should stay in `axxon/src/lib/utils`.
- Reusable domain types should live under `axxon/src/lib/types`.
- GitHub API/auth helpers belong in `axxon/src/lib/github`, while org-level install/sync orchestration belongs in `axxon/src/lib/integrations/github`.
- Repository persistence belongs in `axxon/src/lib/models/repositories.ts`, GitHub installation persistence in `axxon/src/lib/models/githubInstallations.ts`, and webhook audit persistence in `axxon/src/lib/models/githubWebhookEvents.ts`.
- Persisted organization AI assistant thread persistence belongs in `axxon/src/lib/models/chatThreads.ts`, and append-only assistant message persistence belongs in `axxon/src/lib/models/chatMessages.ts`.
- Planning session persistence belongs in `axxon/src/lib/models/planningSessions.ts`, `axxon/src/lib/models/planningSessionMessages.ts`, `axxon/src/lib/models/planningSessionQuestions.ts`, and `axxon/src/lib/models/planningRuns.ts`.
- Planning executor contracts, queue dispatch, and worker orchestration belong in `axxon/src/lib/ai/planningExecutors.ts`, `axxon/src/lib/ai/planningRunQueue.ts`, and `axxon/src/lib/ai/planningRunWorker.ts`.
- Board-to-repository allowlist persistence belongs in `axxon/src/lib/models/boardRepositoryAccess.ts`.
- Sprint persistence belongs in the existing `src/lib` layers and should extend shared todo payloads through shared types instead of adding separate view-only task models.

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
- `pnpm migrate:latest`, `pnpm migrate:latest:prod`, `pnpm seed`, `pnpm rollback`: apply, seed, or revert Knex migrations.
- `pnpm docker:dev`: start local dev infrastructure, including the database, Redis, and Dockerized app services. Ollama is expected to run on the host.
- `pnpm docker:dev:down`: stop the local dev infrastructure.
- `pnpm docker:prod`: start the production-style Docker stack with Postgres, Redis, migrations, the app server, and the websocket server using `.env.production`.
- `pnpm docker:prod:migrate`: run the production migration container against the production-style Docker stack.
- `pnpm docker:prod:down`: stop the production-style Docker stack.
- `pnpm redis:start` / `pnpm redis:stop`: manage Redis directly when needed for realtime development.

## Coding Style & Naming Conventions
Use TypeScript throughout and prefer the `@/` import alias for internal modules. Follow the existing 2-space indentation and avoid reformatting unrelated files. Name React components and context providers in PascalCase, hooks in camelCase with a `use` prefix, and Next route handlers as `route.ts`.

- Keep code concise and minimal.
- Maintain separation of concerns across components, models, controllers, and API clients.
- Place shared UI primitives in the UI layer only when they are truly global and reusable.
- Prefer dedicated type files under `src/lib/types`; inline types are fine only when they are very small and tightly local.
- Add short comments only where the intent is not obvious from the code.
- Preserve the existing visual and structural conventions unless a deliberate product-level redesign is part of the task.
- Default new UI work to the slate/graphite, indigo, and cyan design foundation and shared semantic tokens instead of hardcoded Tailwind color classes.

## Backend Coding
Knex is used at the model and migrations layer.

- Use transactions where multiple writes must succeed or fail together.
- Maintain ACID-safe behavior for org, board, member, and task mutations.
- Keep models focused on persistence concerns and controllers focused on request orchestration.
- Validate org membership and board membership at the correct boundary. Org membership comes first; board access is scoped within the org.
- Organization member invites are org-owner actions and currently support only emails that already belong to existing Axxon users.
- Board member adds should use org-member `userIds`, not raw email entry, and only allow users who already belong to the org.
- Board-to-repository access is an explicit allowlist stored in `board_repository_access`; only org owners should mutate it.
- Restrict GitHub install/finalize/sync actions to org owners. Repository listing can remain visible to org members.
- Restrict persisted organization AI assistant thread reads and continuations to the thread creator after org membership is validated.
- Restrict planning session reads and continuations to the session creator after board membership is validated.
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
  - organization AI assistant thread creation, creator-only access, and append-only message ordering
  - planning session creation, planning run creation, structured clarification card persistence, batch answer submission, async run retries, readiness evaluation, and structured plan generation
  - auth and authorization helpers
  - analytics and board workspace behavior
  - sprint CRUD, sprint assignment rules, and sprint-filtered board views
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
Google OAuth now uses a server-started PKCE + state flow. Prefer `GOOGLE_REDIRECT_URI` for the callback URL, and keep websocket production exposure behind an explicit reverse proxy or a loopback-only bind unless public access is intentionally required.

- AI runtime selection is controlled by `AXXON_DEPLOY_STAGE`, not by overloading `NODE_ENV`.
- `development` and `staging` should use the local Ollama runtime through `AI_LOCAL_BASE_URL` and `AI_LOCAL_MODEL`.
- `production` should use the external OpenAI-compatible runtime through `AI_CLOUD_BASE_URL`, `AI_CLOUD_MODEL`, and `AI_CLOUD_API_KEY` when AI is enabled.
- When the app runs in Docker and Ollama runs on the host, use `http://host.docker.internal:11434` and ensure the Ollama server is reachable beyond host loopback.
- Planning mode in local Ollama environments should verify GPU-backed execution before processing persisted planning turns; do not silently accept CPU-bound planning runs.
- The production Docker stack should keep Postgres, Redis, the Next.js app, and the websocket server inside Compose, and run migrations through the dedicated one-shot `migrate` service before app startup.
- GitHub Actions should run a throwaway-database migration check on pull requests to `main`, and main-branch deployments should execute the real production migration on the deploy host before restarting app services.

- Maintain current security practices for auth, repo access boundaries, and member-scoped actions.
- Validate inputs at the API boundary and enforce permissions server-side.
- Treat organization boundaries as a security boundary, not just a UI grouping.

## Rules
- Follow proper separation of concerns and maintain up-to-date security practices.
- ALWAYS Write commens at the top of files to briefly describe its purpose and functionality and on new functions
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
