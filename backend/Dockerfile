# ─── BUILD STAGE ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ─── PRODUCTION STAGE ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Não rodar como root em produção
RUN addgroup --system --gid 1001 nestjs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Instalar apenas dependências de produção
RUN npm ci --omit=dev && npm cache clean --force

# Copiar dist e Prisma client gerado
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Criar diretórios de upload (fallback local — em produção use Supabase Storage)
RUN mkdir -p uploads/attachments uploads/avatars \
 && chown -R nestjs:nestjs uploads

ENV PORT=3001
ENV NODE_ENV=production

USER nestjs

EXPOSE 3001

# Executa migrations e inicia o servidor NestJS
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
