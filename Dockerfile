# ---- base: Node 24 on Debian slim (matches Prisma's openssl-3 engine) ----
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: reproducible install from lockfile ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate Prisma client + production Next.js build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# ---- runner: minimal files needed to serve the app ----
FROM base AS runner
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/db ./db
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/docker-entrypoint.sh ./
COPY --from=builder /app/.env ./
RUN chmod +x ./docker-entrypoint.sh
# Informational only — the app binds to $PORT at runtime
# (Hugging Face sets PORT=7860, Render/Railway set their own).
EXPOSE 7860
ENTRYPOINT ["./docker-entrypoint.sh"]
