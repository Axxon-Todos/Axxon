# Repository Guidelines

## Project Structure & Module Organization
`axxon/` contains the application code. Use `axxon/src/app` for Next.js App Router pages, layouts, and `api/**/route.ts` handlers. Shared UI lives in `axxon/src/components`, client state in `axxon/src/context`, and reusable hooks in `axxon/src/hooks`. Core business logic is grouped under `axxon/src/lib` (`api`, `controllers`, `models`, `mutations`, `types`, `utils`), with database migrations and seeds in `axxon/src/lib/db/`. Put static assets in `axxon/public/`. The repository root is mostly documentation and metadata.
Analytics-specific visualizations and section components should stay under `axxon/src/components/features/boardAnalytics`; only promote primitives to `axxon/src/components/ui` when reused by multiple features.

## Build, Test, and Development Commands
Run commands from `axxon/`.

- `pnpm install`: install dependencies.
- `pnpm dev`: start Next.js on port 3000 and the Socket.IO server from `src/lib/server.ts` on port 4000.
- `pnpm build` / `pnpm start`: build and run the production app.
- `pnpm lint`: run ESLint with the Next.js and TypeScript ruleset.
- `pnpm migrate:latest`, `pnpm seed`, `pnpm rollback`: apply, seed, or revert Knex migrations.
- `pnpm redis:start` / `pnpm redis:stop`: manage the local Redis container used by realtime features.

## Coding Style & Naming Conventions
Use TypeScript throughout and prefer the `@/` import alias for internal modules. Follow the existing 2-space indentation and avoid reformatting unrelated files. Name React components and context providers in PascalCase (`CreateBoardForm.tsx`), hooks in camelCase with a `use` prefix (`useSocket.ts`), and Next route handlers as `route.ts`. Run `pnpm lint` before opening a PR. ESLint extends `next/core-web-vitals` and `next/typescript`.

## Backend Coding
Knex is used at the model and migrations layer. Ensure proper use of transactions and commpents to explain methods. Models are typically static methods. Ensure you maintain ACID complaince and use proper security measures.

## Testing Guidelines
Vitest is available for backend and frontend suites (`pnpm test`, `pnpm test:backend`, `pnpm test:frontend`). Every change should include `pnpm lint` plus targeted test execution and manual verification of the affected flow, especially auth, board CRUD, analytics, migrations, and websocket behavior. Place tests near the feature in `src/` and use `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
Recent history favors short, single-purpose commit subjects; use imperative wording and prefer Conventional Commit prefixes when they fit, for example `feat: add board accent color`. Keep each commit focused. PRs should summarize user-visible changes, list schema or environment updates, link the relevant issue when available, and include screenshots or recordings for UI work. Always note the manual test steps you ran.

## Security & Configuration Tips
Do not commit `.env*` files; secrets are ignored by `axxon/.gitignore`. Validate database, Google OAuth, Redis, and websocket settings locally before merging configuration changes.

## Rules 
- ensure that you follow proper seperation of concerns and maintain up-to-date security practices
- Maintain proper organization with the rest of the codebase 
- Ensure functions and components are organized correctly in their respected areas
- frontend components on the ui layer should be used as global components such as my modals which is a global component that gets data placed into it depending on the usecase
- add comments on the code that summarize their purpose when neede
- aim For concise and minimal code
- types implemented should be aimed to be under the type directory and imported but if smaller it can go directly in the file
- whenever a new major feature is complete revise this agents.md file and improve its documentation

### Git workflow (mandatory)
- Before modifying any tracked file, ensure you are on a NEW feature branch (never commit directly to main/master/staging).
- If already on a non-protected feature branch, continue using it; otherwise create one.

Branch naming:
- feature/<short-kebab-summary>
- fix/<short-kebab-summary>
- chore/<short-kebab-summary>
- tweak/<short-kebab-summary>

Required sequence:
1) `git status` (must be clean or stash)
2) `git fetch --all --prune`
3) Identify base branch (default: `staging` if it exists, else `main`, else current HEAD)
4) `git checkout <base>` and `git pull --ff-only`
5) `git checkout -b <new-branch>`
6) After changes: `pnpm lint`
7) Commit with Conventional Commit prefix when applicable
8) Push: `git push -u origin <new-branch>`

If pushing is not possible (no remote auth), explicitly say so and provide the exact commands the user should run to push.
