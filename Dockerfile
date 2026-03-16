# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g bun
RUN apk add --no-cache python3 make g++
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 2 — runtime
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json bun.lock* ./
RUN npm install -g bun && bun install --frozen-lockfile --production
COPY --from=builder /app/build ./build
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "build/index.js"]
