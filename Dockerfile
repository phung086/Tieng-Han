# Local development image: preserves the existing development MCP contract.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "node scripts/db-migrate.mjs && pnpm dev --hostname 0.0.0.0"]
