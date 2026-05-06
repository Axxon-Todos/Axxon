# Axxon

Axxon is a modern productivity platform designed to help individuals and teams plan tasks, manage projects, and build consistent habits — all in one place. With powerful features like collaborative boards, real-time messaging, and actionable analytics, Axxon brings structure and insight to your daily workflow.

## 🚀 Features

### ✅ Core Functionality
- **Boards & Todos**
  - Organize todos by board and category (e.g., "To Do", "In Progress", "Done")
  - Assign tasks to users, set due dates, priorities, and tags (labels)
  - Fully typed RESTful API backend with dynamic routing and relational modeling

- **Categories & Labels**
  - Customizable categories per board
  - Many-to-many tagging system with color-coded labels

- **User Management**
  - Google OAuth login & signup
  - Invite collaborators to boards by email
  - Role-based membership model (coming soon)

### 📊 Productivity Insights (Coming Soon)
- Board analytics dashboard for visualizing:
  - Task completion trends
  - Label/category distribution
  - Weekly performance summaries
- AI-generated feedback based on recent activity (planned)

### 💬 Messaging (Planned)
- Board-level group chat
- Direct messages and group chats for team communication

### 🧠 Design Philosophy
- Clean, responsive SPA built with Next.js App Router
- Optimized for fast load and fetch times with TanStack Query
- Modular architecture with small API route files and scalable controller and model logic
- Fully typed PostgreSQL schema using Knex and TypeScript

---

## 🧱 Tech Stack

| Layer        | Technology                      |
|-------------|----------------------------------|
| Frontend     | Next.js (App Router), Tailwind CSS, TanStack Query |
| Backend      | Next.js API Routes, TypeScript, Knex.js |
| Database     | PostgreSQL                      |
| Auth         | Google OAuth, JWT (via Cookies) |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 18
- Docker Desktop
- Google Cloud OAuth credentials
- pnpm

### Setup

```bash
cd axxon

# Install dependencies
pnpm install

# Create .env.local with your PG_*, auth, and public URL values.
# For host-based development, keep PG_HOST=localhost and PG_PORT=5432.
```

### Containerized Dev Database

```bash
# Start the full local stack: app, websocket server, redis, postgres, and DB bootstrap
pnpm docker:dev

# Stop the stack but keep the database data
pnpm docker:dev:down

# Reset only the Postgres volume and recreate a fresh migrated + seeded database
pnpm docker:dev:reset-db
```

On the first boot, Docker starts Postgres, waits for it to become healthy, runs your Knex migrations, and then runs the seed script. Later boots keep your data and only rerun migrations. The app and websocket containers wait for that bootstrap step to finish before they start.

### Host Development Against the Containerized DB

```bash
# Start only postgres, redis, and the DB bootstrap step in Docker
docker compose --env-file .env.local up -d db db-init redis

# Then run the app and websocket server on the host
pnpm dev
```

The containerized Postgres instance is exposed on `localhost:5432`, so the host workflow continues to work with `.env.local` unchanged.

### Production Compose

```bash
# Create .env.production with PG_*, auth, public URL, and AI_CLOUD_* values.

# Start the production-style stack locally: postgres, redis, migrations, app, and websocket server
pnpm docker:prod

# Run just the production migration step
pnpm docker:prod:migrate

# Stop the production-style stack
pnpm docker:prod:down
```

The production compose stack now keeps Postgres, Redis, the Next.js app, and the websocket server inside Docker. Ollama is not part of the production stack; non-local AI runs through the external OpenAI-compatible endpoint configured with `AI_CLOUD_BASE_URL`, `AI_CLOUD_MODEL`, and `AI_CLOUD_API_KEY` when needed.

📈 Status

The backend and API are fully implemented with seeded data and type-safe queries.
Frontend development is actively in progress, with SPA routing, modals, and TanStack Query setup underway.

## 📅 Roadmap

- [x] Backend API with RESTful routes
- [x] Board, Category, Todo, Label, and User models
- [x] Google OAuth + DB user creation
- [x] Seeded relational PostgreSQL schema
- [ ] Complete full UI for todos and boards
- [ ] Calendar dashboard view
- [ ] Board-level messaging
- [ ] Board analytics dashboard
- [ ] AI-based productivity insights
