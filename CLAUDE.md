# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Axxon is a modern productivity platform for task planning, project management, and habit building. Built with Next.js (App Router), PostgreSQL, Redis, and Socket.io for real-time collaboration.

**Tech Stack:**
- Frontend: Next.js 15, React 19, TailwindCSS, TanStack Query
- Backend: Next.js API Routes, TypeScript, Knex.js
- Database: PostgreSQL
- Real-time: Socket.io + Redis pub/sub
- Auth: Google OAuth + JWT (httpOnly cookies)

## Development Commands

**Working Directory:** All commands run from `axxon/` subdirectory.

```bash
cd axxon

# Install dependencies (uses pnpm)
pnpm install

# Development
pnpm dev              # Start both Next.js (port 3000) and WebSocket server (port 4000)
pnpm dev-next         # Start only Next.js dev server
pnpm dev-ws           # Start only WebSocket server

# Build & Production
pnpm build            # Build Next.js app
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint

# Database (Knex.js)
npm run migrate:make  # Create new migration (KNEX_MIGRATION_EXTENSION=ts is set)
npm run migrate:latest # Run pending migrations
npm run rollback      # Rollback last migration batch
npm run seed          # Seed development data

# Redis (Docker)
npm run redis:start   # Start Redis container (required for real-time features)
npm run redis:stop    # Stop Redis container
npm run redis:logs    # View Redis logs
npm run redis:cli     # Open Redis CLI
```

## Architecture Overview

### Backend Structure

**API Routes:** `src/app/api/`
- Thin route handlers that extract params and delegate to controllers
- Follow REST conventions: GET, POST, PATCH, DELETE
- Routes use Next.js dynamic segments (e.g., `[boardId]`, `[todoId]`)

**Controllers:** `src/lib/controllers/`
- Handle business logic and authentication
- Verify JWT tokens from cookies
- Call model methods for database operations
- Publish updates to Redis for real-time sync
- Organized by domain: `auth/`, `board/`, `todos/`, `categories/`, `labels/`, `boardMembers/`

**Models:** `src/lib/models/`
- Static classes with CRUD methods (Active Record pattern)
- Direct Knex query builders for database access
- Key models: `Users`, `Board`, `Todos`, `Categories`, `Labels`, `TodoLabels`, `BoardMembers`
- Example: `Board.createBoard()`, `Todos.updateTodo()`, `TodoLabels.getTodosWithLabels()`

**Database:**
- PostgreSQL with Knex.js migrations
- Migrations in `src/lib/db/migrations/`
- All foreign keys use CASCADE DELETE
- Categories use position-based ordering for drag-and-drop

### Real-time Architecture

**Critical:** The app has TWO servers that must run simultaneously:
1. Next.js server (port 3000) - Web app and API
2. WebSocket server (port 4000) - Real-time updates via `src/lib/server.ts`

**Flow:**
```
User action → Controller updates DB → Publishes to Redis channel "board:{boardId}"
→ WebSocket server (wsServer.ts) receives from Redis
→ Emits to Socket.io room matching boardId
→ All clients in room receive update
→ TanStack Query cache updated optimistically
```

**Key Files:**
- `src/lib/server.ts` - WebSocket server entry point
- `src/lib/wsServer.ts` - Socket.io + Redis pub/sub setup
- `src/lib/redis.ts` - Redis client configuration
- `src/hooks/useSocket.ts` - Client Socket.io connection hook
- `src/hooks/useBoardRealtime.ts` - Listen for board updates and sync cache

**Event Types:**
- `board:todo:created`, `board:todo:updated`, `board:todo:deleted`
- `board:category:updated`
- Events published via `publishBoardUpdate()` in controllers

### Frontend Structure

**State Management:**
- TanStack Query for server state (queries, mutations, caching)
- QueryClient setup in `src/app/QueryProvider.tsx`
- API layer in `src/lib/api/` (fetch wrappers)
- Mutations in `src/lib/mutations/` (invalidate queries on success)

**Components:**
- `src/components/common/` - Reusable UI components
- `src/components/features/boardView/` - Board view with drag-and-drop
- `src/components/features/dashboard/` - Dashboard components
- Uses `@dnd-kit` for drag-and-drop functionality

**Routing:**
- File-based routing via Next.js App Router
- Protected routes check for JWT in cookies
- Middleware (`middleware.ts`) redirects to `/dashboard` if authenticated

**Key Patterns:**
- Components use `useQuery` for data fetching with query keys like `['todos', boardId]`
- Mutations invalidate related queries after success
- WebSocket events trigger optimistic cache updates via `queryClient.setQueryData()`

### Authentication Flow

1. User clicks Google login on landing page (`/app/page.tsx`)
2. OAuth callback at `/api/auth/google/callback/route.ts`:
   - Exchange code for Google tokens
   - Decode `id_token` for user info
   - `Users.findOrCreateByGoogle()` creates/finds user in DB
   - Sign JWT with 7-day expiration
   - Set httpOnly cookie
3. All API routes verify JWT via `getUserFromToken()` in `src/lib/utils/auth.ts`
4. JWT secret from `JWT_SECRET` env variable

### Environment Setup

Required environment variables in `axxon/.env.local`:

```bash
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASS=your_password
PG_DB=postgres

# Or use connection string:
# PG_CONNECTION_STRING=postgresql://user:pass@host:5432/db

# Auth
SESSION_SECRET=your_random_string
JWT_SECRET=your_jwt_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_HOSTNAME=http://localhost:3000

# App
NODE_ENV=development

# Redis (optional, defaults to localhost:6379)
REDIS_URL=redis://localhost:6379
```

## Development Workflow

### Initial Setup

```bash
cd axxon
pnpm install
cp .env.example .env.local  # Then fill in your values
npm run redis:start         # Start Redis via Docker
npm run migrate:latest      # Run database migrations
npm run seed                # Seed development data (optional)
pnpm dev                    # Start both servers
```

### Adding New Features

**New API Endpoint:**
1. Create route file in `src/app/api/`
2. Create controller in `src/lib/controllers/`
3. Add/update model methods in `src/lib/models/`
4. If real-time needed, publish to Redis in controller

**New Database Table:**
1. `npm run migrate:make <name>` (creates `.ts` file)
2. Define `up()` and `down()` in migration
3. Add model class in `src/lib/models/`
4. Add TypeScript types in `src/lib/types/`

**New Frontend Feature:**
1. Create API client function in `src/lib/api/`
2. Create mutation hook in `src/lib/mutations/`
3. Add component in `src/components/features/`
4. Use TanStack Query hooks in component
5. If real-time, add event listener in `useBoardRealtime.ts`

### Testing Real-time Features

1. Ensure Redis is running: `npm run redis:start`
2. Start both servers: `pnpm dev`
3. Open multiple browser windows to same board
4. Changes in one window should appear in others immediately

## Important Notes

- **Always run from `axxon/` directory**, not repository root
- **Redis must be running** for real-time features (WebSocket server won't start without it)
- **Run both servers** with `pnpm dev` for full functionality
- All database operations use Knex query builder, not raw SQL
- JWT stored in httpOnly cookies (never in localStorage)
- All foreign keys have CASCADE DELETE
- Categories have position-based ordering (update positions when reordering)
- Use `credentials: 'include'` in all frontend fetch calls for cookie auth

## Key Files Reference

**Backend Entry Points:**
- `src/lib/server.ts` - WebSocket server
- `src/app/api/auth/google/callback/route.ts` - OAuth handler
- `middleware.ts` - Auth redirect middleware

**Database:**
- `knexfile.ts` - Knex configuration
- `src/lib/db/knex.ts` - Database connection instance
- `src/lib/db/migrations/` - Schema migrations

**Frontend Entry Points:**
- `src/app/page.tsx` - Landing page
- `src/app/dashboard/[boardId]/page.tsx` - Board view
- `src/app/QueryProvider.tsx` - TanStack Query setup

**Types:**
- `src/lib/types/*.ts` - Domain-specific TypeScript definitions

# Rules
- ensure that you follow proper seperation of concerns and maintain up-to-date security practices
- Maintain proper organization with the rest of the codebase 
- Ensure functions and components are organized correctly in their respected areas
- frontend components on the ui layer should be used as global components such as my modals which is a global component that gets data placed into it depending on the usecase
- add comments to code to briefly explain it purpose

