# ─── BUILD STAGE ───
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── RUNNING STAGE ───
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
