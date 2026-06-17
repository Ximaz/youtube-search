# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd

# ---- base: pnpm via corepack ----
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps: install all deps (cached on lockfile) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---- build: prepare types, gate on lint/typecheck/no-js, then build ----
FROM deps AS build
COPY . .
RUN pnpm exec nuxt prepare \
    && pnpm verify \
    && pnpm build

# ---- runtime: only the Nitro output, non-root ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
WORKDIR /app
COPY --from=build /app/.output ./.output
# Migration SQL is read at boot by the migrate plugin (relative to cwd).
COPY --from=build /app/server/database/migrations ./server/database/migrations
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
