# ── Stage 1: Dependencies ──────────────────────────────────────────────────
# WHY separate stage: keeps node_modules out of the final image.
# The production image gets only the output, not the build tooling.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production image ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# WHY non-root user: running as root in a container is a security vulnerability.
# If the process is compromised, root in the container maps to root on the host.
RUN addgroup -S kurai && adduser -S kurai -G kurai

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# WHY EXPOSE is documentation, not a firewall rule:
# The container still needs -p 3000:3000 at runtime. EXPOSE tells humans
# and tooling (Docker Desktop, k8s) what port the service listens on.
EXPOSE 3000

USER kurai
CMD ["node", "server/index.js"]
