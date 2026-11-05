# Local development

This file describes the local Docker development setup for Axxon.

## Environment files

The committed templates are `.env.local.example` and `.env.docker.example`.
The working `.env.local` and `.env.docker` files are ignored and contain the
machine-specific values used by Docker Compose.

## Start Axxon

From `axxon/`:

```sh
pnpm install
ollama pull qwen2.5-coder:14b
pnpm docker:dev
```

The application is available at http://localhost:3000 and the websocket server
at http://localhost:4000. The first Docker start creates the Postgres schema and
seed data automatically.

Google OAuth and the GitHub App are optional. Add their credentials to
`.env.local` and restart the stack if those integrations are needed.

To stop the stack:

```sh
pnpm docker:dev:down
```
