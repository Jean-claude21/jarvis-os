# Jarvis OS on a server of its own (Coolify): the API, the web account and the watcher in one
# process (`apps/api/src/host.ts`). Its settings come from the environment (JARVIS_BRANCH,
# JARVIS_PUBLIC_URL, JARVIS_<BRANCH>_*), never from this image.
FROM node:22-slim
ENV NODE_ENV=production PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
# curl: Coolify checks the container's health with it before switching to a new release.
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod=false

COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/api apps/api
# The v3 client (React), built once into apps/web/dist and served by the API at /v3.
COPY apps/web apps/web
RUN pnpm --filter @jarvis-os/web build

ARG JARVIS_RELEASE=local
ENV JARVIS_RELEASE=$JARVIS_RELEASE PORT=3000
EXPOSE 3000
RUN chown -R node:node /app
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "apps/api/src/host.ts"]
