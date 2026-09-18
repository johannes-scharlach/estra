# Build context is the REPO ROOT, not this directory — pnpm needs the
# lockfile and workspace manifests to resolve a filtered install:
#
#   fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
#
# `pnpm api:deploy` from the root does exactly that.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# --- compile ---------------------------------------------------------------
# Uses the workspace lockfile, so the image is built by the same TypeScript
# the repo type-checks with. node-linker: `.npmrc` picks `hoisted` because
# Metro cannot follow symlinks, but hoisting flattens every project into one
# tree and would install Expo here for no reason.
#
# `build` type-checks and then esbuilds src into one file with every runtime
# dependency inlined, so the image below needs no node_modules at all. That
# is not a size trick: pnpm always installs the workspace root's own
# dependencies, and this repo keeps expo and react-native there for Metro's
# benefit, so every workspace-aware route (--prod install, `pnpm deploy`)
# drags a few hundred MB of native modules into the image. The alternative
# was a standalone lockfile-less install, which left every transitive
# dependency of `ai` floating. Bundling from the lockfile pins them instead.
FROM base AS build
ENV npm_config_node_linker=isolated
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
# Never installed — --frozen-lockfile checks the lockfile against every
# workspace project, so the manifest has to be present.
COPY apps/mobile/package.json apps/mobile/
COPY packages/profile/package.json packages/profile/
COPY packages/meals/package.json packages/meals/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
COPY packages/profile/src packages/profile/src
COPY packages/meals/src packages/meals/src
RUN pnpm --filter api build

# --- image -----------------------------------------------------------------
# dist/index.cjs and its source map, nothing else. `.cjs` because bundling to
# ESM breaks: @vercel/oidc, which `ai` pulls in via the gateway provider, is
# CommonJS and calls require() dynamically.
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.cjs"]
