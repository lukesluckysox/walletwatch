# ── Build stage ───────────────────────────────────────────
FROM node:20-slim AS builder

# bcrypt needs build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL dependencies (including devDependencies for tsx, esbuild, vite)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build client (Vite) + server (esbuild → dist/index.cjs)
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Railway injects PORT; default to 5000
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
