FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 HANEUL_STANDALONE=1
RUN npm install --global pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
ARG HANEUL_BUILD_FINGERPRINT=unknown
ENV HANEUL_BUILD_FINGERPRINT=$HANEUL_BUILD_FINGERPRINT
LABEL vn.haneul.build-fingerprint=$HANEUL_BUILD_FINGERPRINT
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/db-migrate.mjs /app/scripts/docker-health.mjs ./scripts/
EXPOSE 3000
CMD ["sh", "-c", "node scripts/db-migrate.mjs && node server.js"]
