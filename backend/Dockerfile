
# Stage 1: Build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY prisma ./prisma

# Generate Prisma Client for Debian
RUN npx prisma generate

COPY . .

RUN npm run build


# Stage 2: Production
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

COPY prisma ./prisma

# Copy generated Prisma Client and engine
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled backend
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "dist/server.js"]
