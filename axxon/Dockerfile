FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS app-builder
COPY . .
# Next.js bakes NEXT_PUBLIC_* values into the client bundle during the production build.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG NEXT_PUBLIC_REDIRECT_URI=""
ARG NEXT_PUBLIC_HOSTNAME=""
ARG NEXT_PUBLIC_WS_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_REDIRECT_URI=$NEXT_PUBLIC_REDIRECT_URI
ENV NEXT_PUBLIC_HOSTNAME=$NEXT_PUBLIC_HOSTNAME
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm build

FROM deps AS app-dev
COPY . .
# Dev reads public envs at container runtime through the Next.js dev server.
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "dev-next"]

FROM deps AS ws-dev
COPY . .
# Keep the websocket process isolated from the Next.js process for easier restarts and scaling.
ENV NODE_ENV=development
ENV WS_PORT=4000
EXPOSE 4000
CMD ["pnpm", "dev-ws"]

FROM base AS app-prod
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=app-builder /app/public ./public
COPY --from=app-builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=app-builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS ws-prod
COPY . .
# The websocket image reads its auth, DB, and Redis settings from Compose at runtime.
ENV NODE_ENV=production
ENV WS_PORT=4000
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/lib/server.ts"]
