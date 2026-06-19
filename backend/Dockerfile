# ─── BUILD STAGE ───
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ─── PRODUCTION STAGE ───
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy compiled dist and generated Prisma client from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Create directory for uploads (attachments)
RUN mkdir -p uploads/attachments

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

# Run migrations and start the NestJS server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
