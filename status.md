# MY-FINANCE — Status do Projeto

> Atualizado em: 2026-06-24
> Stack atual: Next.js 14 App Router + PostgreSQL (Supabase) + Prisma + JWT manual
> Stack alvo: Next.js 14 App Router + Supabase client + Supabase Auth (sem Prisma runtime, sem JWT manual)

---

## Visão Geral

SaaS de gestão financeira residencial/familiar. Suporta múltiplos usuários por household (casa/família), com contas bancárias, cartões de crédito, lançamentos, orçamentos, metas, investimentos e relatórios.

**Acesso local:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger Docs: http://localhost:3001/api/docs
- PostgreSQL: Supabase — `db.qovqkvcvlrzmtvufursn.supabase.co`
- Redis: não utilizado (removido)

---

## Próxima Etapa
- [x] Desenvolvimento e melhorias de UX/UI na tela: **Relatórios**
- [x] Revisar comportamento de Categorias & Subcategorias na tela de **Transações**
- [x] Refatorar e aprimorar a tela de **Configurações** (Perfil, Família e Categorias)
- [x] **Auditoria e hardening de segurança** (2026-06-22)
- [x] **Correções pós-auditoria:** logout inesperado, orçamentos, OFX, LGPD (2026-06-23)
- [x] **PWA, Google OAuth, middleware JWT, correção "Alex Rivera"** (2026-06-23)
- [x] **Tentativa de deploy Cloudflare Pages** — fracassou por incompatibilidade Prisma + Edge Runtime (2026-06-24, ver log)
- [x] **Hard reset** para commit `251e1b9` — codebase voltou ao estado de 2026-06-23 noite
- [x] **FASE 5 — Migração Supabase Auth + Supabase client** — CONCLUÍDA (2026-06-24)
- [x] **Build Cloudflare Pages passando** — commit `803fd11` (2026-06-24)
- [ ] **PRÓXIMO PASSO IMEDIATO:** Adicionar variáveis de ambiente no Cloudflare Pages ← FAZER PRIMEIRO
- [ ] **Pós-deploy — Revisão geral de integrações** (Supabase, GitHub, Google Cloud)

---

## ⚠️ PRÓXIMO PASSO — Cloudflare Pages sem variáveis de ambiente

O build está passando mas o app retorna 500 porque o projeto `my-finance-my` não tem variáveis configuradas.

**Cloudflare Pages → my-finance-my → Settings → Variables and secrets → + Add**

| Variável | De onde pegar | Tipo |
|----------|---------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Text |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key | Text |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key | Secret |
| `NEXT_PUBLIC_APP_URL` | `https://my-finance-my.pages.dev` | Text |

Após salvar → clicar em **Redeploy** para o build rodar com as variáveis.

**Observação importante:** `NEXT_PUBLIC_*` precisam estar disponíveis no momento do build (não só no runtime) para serem embutidas no Next.js.

---

## Como Rodar Localmente

```bash
# 1. Backend (banco no Supabase — não precisa docker-compose)
cd backend
copy .env.example .env        # Windows — preencha as senhas
npm install
npx prisma migrate deploy      # aplica todas as migrations no Supabase
npx prisma db seed             # popula com dados de demonstração
npm run start:dev

# 2. Frontend (outro terminal)
cd frontend
copy .env.example .env.local  # Windows
npm install
npm run dev
```

**Login de demonstração:** demo@myfinance.com / demo123

> **Configurar `.env` do backend:**
> - `DATABASE_URL` → transaction pooler do Supabase (porta 6543)
> - `DIRECT_URL` → conexão direta do Supabase (porta 5432) — usada nas migrations
> - Ambas as URLs estão no formato correto no `.env.example` — só substituir `[YOUR-PASSWORD]`
> - Senha: Supabase Dashboard → Project Settings → Database → Database password
>
> **Pasta de anexos** (criar manualmente — ignorada pelo git):
> ```bash
> mkdir -p backend/uploads/attachments   # Linux/Mac
> md backend\uploads\attachments         # Windows
> ```

---

## Estrutura do Projeto

```
MY-FINANCE/
├── status.md                  ← Este arquivo
├── docker-compose.yml         ← PostgreSQL 16 + Redis 7
├── .gitignore
│
├── backend/                   ← NestJS API (porta 3001)
│   ├── src/
│   │   ├── main.ts            ← Bootstrap, Swagger, CORS
│   │   ├── app.module.ts      ← Módulo raiz
│   │   ├── prisma/            ← PrismaService (global)
│   │   ├── auth/              ← Register, Login, Refresh, Logout (JWT)
│   │   ├── users/             ← Perfil do usuário
│   │   ├── households/        ← Casa/família, resumo financeiro
│   │   ├── accounts/          ← Contas bancárias (CRUD)
│   │   ├── cards/             ← Cartões de crédito (CRUD + freeze + fatura)
│   │   ├── categories/        ← Categorias hierárquicas (CRUD)
│   │   ├── transactions/      ← Lançamentos com paginação, filtros, CSV/OFX import, anexos
│   │   ├── budgets/           ← Orçamentos com progresso real
│   │   ├── goals/             ← Metas financeiras com aporte
│   │   ├── investments/       ← Carteira de investimentos com P&L
│   │   ├── reports/           ← Fluxo de caixa, categorias, patrimônio, export PDF
│   │   ├── mail/              ← MailService global (nodemailer, graceful no-op sem SMTP)
│   │   └── notifications/     ← Jobs agendados (cron) para alertas de e-mail
│   └── prisma/
│       ├── schema.prisma      ← 10 entidades definidas
│       └── seed.ts            ← Dados de demonstração
│
├── frontend/                  ← Next.js 14 App Router (porta 3000)
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/     ← Página de login
│       │   │   └── register/  ← Página de cadastro
│       │   └── (dashboard)/
│       │       ├── layout.tsx ← Layout com sidebar
│       │       ├── dashboard/ ← Dashboard principal
│       │       ├── accounts/  ← Contas & Cartões
│       │       ├── transactions/ ← Lista + CSV/OFX import + filtros + anexos
│       │       ├── budgets/   ← Orçamento com barras de progresso
│       │       ├── goals/     ← Metas com aporte direto
│       │       ├── investments/ ← Carteira com P&L
│       │       ├── reports/   ← Relatórios com gráficos + export PDF
│       │       └── settings/  ← Perfil, Família, Categorias, Convites
│       ├── components/
│       │   └── layout/
│       │       └── Sidebar.tsx ← Sidebar de navegação
│       ├── lib/
│       │   ├── api.ts         ← Axios client com refresh automático
│       │   └── utils.ts       ← formatCurrency, formatDate, etc.
│       └── (auth)/
│           ├── login/         ← Página de login
│           ├── register/      ← Página de cadastro
│           └── accept-invite/ ← Aceitar convite de household (token URL)
│
└── stitch_smart_home_finance_pro/  ← Protótipo visual original (referência)
```

---

## Fases de Implementação

### ✅ FASE 0 — Protótipo Visual (Stitch AI) — CONCLUÍDO
- 20 telas HTML (desktop + mobile) com Tailwind
- Design system em `precision_finance/DESIGN.md`
- Router hash-based com emulador mobile
- Todos os dados são mockados

### ✅ FASE 1 — Fundação — CONCLUÍDO (2026-05-27)

#### Infraestrutura
- [x] docker-compose.yml (PostgreSQL 16 + Redis 7)
- [x] .gitignore
- [x] status.md

#### Backend — NestJS
- [x] Estrutura do projeto (package.json, tsconfig.json, nest-cli.json)
- [x] .env.example com todas as variáveis
- [x] PrismaService (módulo global)
- [x] Schema Prisma completo (10 entidades + enums)
- [x] Módulo Auth — Register, Login, Refresh Token, Logout
- [x] JWT Strategy + JwtAuthGuard
- [x] Módulo Users — perfil próprio
- [x] Módulo Households — dados da família + resumo financeiro
- [x] Módulo Accounts — CRUD completo de contas bancárias
- [x] Módulo Cards — CRUD + congelar/descongelar + resumo de fatura
- [x] Módulo Categories — CRUD + categories.defaults.ts (19 categorias padrão)
- [x] Módulo Transactions — CRUD + paginação + filtros + resumo mensal
- [x] Módulo Budgets — CRUD + progresso real com gastos do período
- [x] Módulo Goals — CRUD + aportes
- [x] Módulo Investments — CRUD + cálculo P&L (ganho/perda)
- [x] Módulo Reports — Fluxo de caixa, despesas/categoria, patrimônio líquido, contas a pagar
- [x] Seed com dados de demonstração realistas
- [x] Swagger/OpenAPI em /api/docs

#### Frontend — Next.js 14
- [x] package.json (next, react-query, recharts, react-hook-form, zod, axios...)
- [x] Tailwind CSS + PostCSS configurados
- [x] globals.css com fontes Google (Inter + Material Symbols)
- [x] Providers (React Query + Toaster)
- [x] Axios client com interceptor de refresh automático
- [x] Utilitários (formatCurrency, formatDate, formatPercent)
- [x] Sidebar de navegação (7 itens + logout)
- [x] Página Login (form validado com zod + react-hook-form)
- [x] Página Register (form validado com zod + react-hook-form)
- [x] Dashboard — saldo total, receitas/despesas do mês, gráfico de fluxo de caixa, contas a pagar, categorias
- [x] Accounts — Contas bancárias + Cartões (tabs) com congelar/descongelar
- [x] Transactions — Lista paginada + formulário de novo lançamento
- [x] Budgets — Orçamentos com barras de progresso em tempo real
- [x] Goals — Metas com aportes diretos
- [x] Investments — Carteira completa com P&L e formulário de ativo
- [x] Reports — Fluxo de caixa 12m, gráfico de pizza por categoria, patrimônio

### ✅ FASE 2 — Funcionalidades Avançadas — CONCLUÍDO (2026-05-28)
- [x] Página Contas: modais de criar conta bancária e cartão com seleção de cor
- [x] Página Configurações (`/settings`): abas Perfil / Família / Categorias
- [x] Backend: `GET /reports/export/transactions.csv` — export com filtros, BOM UTF-8
- [x] Backend: `POST /transactions/import/csv` — import inteligente, suporta vários formatos de bancos
- [x] Frontend: botões Export CSV + Import CSV com modal completo na página de Transações
- [x] Frontend: filtros de tipo e período na listagem de transações
- [x] Sidebar: item Configurações + exibe nome/household do usuário logado
- [x] Upload de anexos em transações (storage local, multer diskStorage)
- [x] Export PDF de relatórios (pdfkit — patrimônio, fluxo de caixa, contas a pagar)
- [x] Notificações por e-mail (nodemailer — vencimentos, orçamento estourado, metas atingidas)
- [x] Conciliação bancária (OFX import — SGML e XML, deduplicação por FITID)
- [x] Dark mode funcional (CSS custom properties + tokens semânticos, sem dark: prefixes)
- [x] Múltiplos usuários por household (convite por email, token 48h, aceite cria/vincula conta)

### ✅ FASE 3 — Segurança e Pré-Produção — CONCLUÍDO (2026-06-22)
- [x] Auditoria completa de segurança
- [x] Tokens migrados de `localStorage` → cookies `httpOnly` (proteção XSS)
- [x] JWT access token TTL corrigido: `30d` → `15m`
- [x] JWT refresh token TTL corrigido: `365d` → `7d`
- [x] JWT secrets substituídos por strings criptograficamente fortes (128 chars)
- [x] `cookie-parser` instalado; `JwtStrategy` lê de cookie ou Bearer header
- [x] Rate limiting adicionado em `/auth/refresh` e `/auth/accept-invite`
- [x] Complexidade de senha obrigatória no cadastro (maiúscula + número)
- [x] `getAvatarUrl` corrigido em `layout.tsx` e `settings/page.tsx` (não hardcoda mais `localhost`)
- [x] Logout chama `POST /auth/logout` para limpar cookies no servidor
- [x] CI/CD corrigido: branch `main` → `master` (deploys nunca executavam)
- [x] Credenciais Supabase rotacionadas (`service_role` key + senha do banco)
- [x] Helmet + CSP ativo em produção
- [x] ValidationPipe global com `whitelist` e `forbidNonWhitelisted`
- [x] Dockerfile multi-stage com usuário não-root

### ✅ FASE 3.5 — Ajustes Pós-Auditoria (2026-06-23)
- [x] Migração nodemailer → **Resend SDK** (`RESEND_API_KEY` + `MAIL_FROM`)
- [x] Sistema de convites por e-mail **removido** (invite, accept-invite, endpoints e UI)
- [x] `cookie-parser` corrigido: `import cookieParser from` → `import * as cookieParser from`
- [x] Modelo `Invite` removido do schema Prisma + tabela dropada no Supabase

### ⏳ FASE 4 — Migração para Next.js Full-Stack + Deploy Cloudflare Pages
**Decisão:** Migrar o backend NestJS para Next.js API Routes, eliminando o servidor separado.
**Motivo:** Deploy tudo no Cloudflare Pages (gratuito, sem Railway/Render).
**Stack final:** Next.js 14 App Router + Supabase JS client + `jose` (JWT) + `bcryptjs`

- [x] Fase 4.1 — Setup: `bcryptjs`, `jose`, `@supabase/supabase-js`; libs `prisma.ts`, `auth.ts`, `api-response.ts`, `with-auth.ts`, `storage.ts`
- [x] Fase 4.2 — Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- [x] Fase 4.3 — Usuários e Famílias: `/api/users/me`, `/api/users/me/avatar`, `/api/households/mine`, `/api/households/mine/summary`
- [x] Fase 4.4 — Contas e Cartões: `/api/accounts`, `/api/accounts/[id]`, `/api/cards`, `/api/cards/[id]`, `/api/cards/[id]/freeze`, `/api/cards/[id]/invoice`
- [x] Fase 4.5 — Categorias e Transações: `/api/categories`, `/api/categories/[id]`, `/api/transactions`, `/api/transactions/[id]`, `/api/transactions/summary/monthly`, `/api/transactions/[id]/attachments`, `/api/transactions/import/csv`, `/api/transactions/import/ofx`
- [x] Fase 4.6 — Orçamentos, Metas, Investimentos: `/api/budgets`, `/api/budgets/progress`, `/api/budgets/[id]`, `/api/goals`, `/api/goals/[id]`, `/api/goals/[id]/progress`, `/api/investments`, `/api/investments/portfolio`, `/api/investments/[id]`
- [x] Fase 4.7 — Relatórios e Export PDF: `/api/reports/cash-flow`, `/api/reports/expenses-by-category`, `/api/reports/net-worth`, `/api/reports/upcoming-bills`, `/api/reports/export/transactions.csv`, `/api/reports/export/summary.pdf`
- [x] Fase 4.8 — Limpeza completa: zero referências ao backend NestJS; `getAvatarUrl` e anexos usam URLs absolutas do Supabase; `api.ts` usa `baseURL: ''`; `.env.local` limpo
- [x] Fase 4.9a — **PWA:** manifest.json, service worker, ícones gerados, installable
- [x] Fase 4.9b — **Google OAuth:** fluxo manual (sem NextAuth); `/api/auth/google` + `/api/auth/google/callback`; vincula conta existente por email
- [x] Fase 4.9c — **Middleware JWT real:** substituiu stub por `jwtVerify` com `jose`; rotas protegidas redirecionam para `/login` no servidor
- [x] Fase 4.9d — **Fix "Alex Rivera":** removidos mock fallbacks do layout; middleware elimina flash de usuário fictício
- [x] Fase 4.9e — **Deploy Cloudflare Pages** — ABANDONADO (incompatibilidade fundamental: ver log 2026-06-24)

### ✅ FASE 5 — Migração Real: Supabase Auth + Supabase Client (sem Prisma runtime) — CONCLUÍDO (2026-06-24)

**Decisão:** Substituir Prisma + JWT manual por Supabase Auth + Supabase JS client — mesma arquitetura dos projetos que deployaram no Cloudflare Pages sem problemas.

**O que NÃO muda:** todas as telas, componentes, lógica de negócio, cálculos, endpoints (mesmas URLs), estrutura de tabelas do banco.

**O que mudou:**
- Auth: JWT manual (bcryptjs + jose) → Supabase Auth (Google OAuth incluso, sem implementação manual)
- Banco: `prisma.X.query()` → `supabase.from('X').query()` (37 arquivos de API migrados)
- Schema: removidos `passwordHash`, `googleId`, tabela `RefreshToken`; adicionado `supabaseId` em `User`
- Middleware: verificação JWT → verificação de sessão Supabase via `@supabase/ssr`
- `@prisma/client` removido das dependências de runtime; `prisma` fica só como devDependency

**Passos concluídos:**

- [x] 5.1 — `package.json`: removido `bcryptjs`, `jose`, `next-auth`; adicionado `@supabase/ssr`; `prisma` movido para devDependencies
- [x] 5.2 — Criados `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR) e `lib/supabase/admin.ts` (service role)
- [x] 5.3 — Schema Prisma atualizado; `prisma db push` executado com sucesso
- [x] 5.4 — `lib/with-auth.ts` reescrito para verificar sessão Supabase; `lib/auth.ts` vira shim de tipos
- [x] 5.5 — `middleware.ts` reescrito com `@supabase/ssr` + `createServerClient`
- [x] 5.6 — Rotas de auth antigas deletadas; criadas `/api/auth/callback` (OAuth) e `/api/auth/setup` (perfil pós-signup)
- [x] 5.7 — 37 arquivos de API migrados: zero importações de `@prisma/client` no runtime
- [x] 5.8 — `login/page.tsx` e `register/page.tsx` usam `createClient()` do Supabase diretamente
- [x] 5.9 — `tsc --noEmit` passa sem erros; `lib/prisma.ts` deletado; `.next` cache limpo
- [x] 5.10 — Servidor de dev rodando em http://localhost:3001 — pronto para commit e deploy
- [x] 5.11 — **Fix Edge Runtime:** `export const runtime = 'edge'` adicionado em todos os 40 arquivos de API route (obrigatório para `@cloudflare/next-on-pages`)
- [x] 5.12 — **Fix Suspense:** `useSearchParams()` em `login/page.tsx` isolado em componente `<SearchParamsHandler>` envolto em `<Suspense fallback={null}>`
- [x] 5.13 — **Fix `path` module:** `import { extname } from 'path'` removido de `storage.ts`; substituído por função inline (webpack não consegue empacotar módulos Node.js para Edge Runtime)
- [x] 5.14 — **Varredura proativa concluída:** zero imports de módulos Node.js (`fs`, `crypto`, `stream`, `path`), zero imports Prisma, zero imports JWT/bcrypt restantes no codebase

### ⏳ PÓS-MIGRAÇÃO — Revisão Geral de Integrações

Após o sistema estar funcionando em produção, revisar cada serviço externo:

- [ ] **Supabase** — Verificar Auth providers (Google OAuth configurado), RLS policies, Storage buckets, variáveis de ambiente de produção
- [ ] **GitHub** — Limpar secrets desnecessários (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID); verificar se workflow de CI ainda faz sentido
- [ ] **Google Cloud Console** — Atualizar Authorized redirect URIs para o domínio de produção do Cloudflare; verificar se o OAuth Client está ativo
- [ ] **Cloudflare Pages** — Recriar projeto conectado ao GitHub; configurar variáveis de ambiente de produção; verificar domínio

---

## Entidades do Banco de Dados

| Entidade | Campos principais |
|----------|-------------------|
| User | id, email, name, passwordHash, householdId |
| Household | id, name, currency |
| Account | id, name, type, bank, balance, color |
| Card | id, name, brand, creditLimit, billingDay, dueDay, isFrozen |
| Category | id, name, type (INCOME/EXPENSE), icon, color, parentId |
| Transaction | id, type, amount, date, description, isPaid, categoryId, accountId, cardId, attachments[] |
| Budget | id, name, amount, period, month, year, categoryId |
| Goal | id, name, targetAmount, currentAmount, targetDate, isCompleted |
| Investment | id, name, type, ticker, quantity, purchasePrice, currentPrice |
| RefreshToken | id, token, userId, expiresAt |

---

## API Endpoints Disponíveis

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/me
PATCH  /users/me

GET    /households/mine
GET    /households/mine/summary
PATCH  /households/mine

GET    /accounts
POST   /accounts
GET    /accounts/:id
PATCH  /accounts/:id
DELETE /accounts/:id

GET    /cards
POST   /cards
GET    /cards/:id
PATCH  /cards/:id
PATCH  /cards/:id/freeze
GET    /cards/:id/invoice?month=&year=
DELETE /cards/:id

GET    /categories?type=
POST   /categories
PATCH  /categories/:id
DELETE /categories/:id

GET    /transactions?type=&categoryId=&accountId=&startDate=&endDate=&page=&limit=
POST   /transactions
GET    /transactions/summary/monthly?month=&year=
GET    /transactions/:id
PATCH  /transactions/:id
DELETE /transactions/:id

GET    /budgets?month=&year=
POST   /budgets
GET    /budgets/progress?month=&year=
PATCH  /budgets/:id
DELETE /budgets/:id

GET    /goals
POST   /goals
POST   /goals/:id/progress
PATCH  /goals/:id
DELETE /goals/:id

GET    /investments
POST   /investments
GET    /investments/portfolio
PATCH  /investments/:id
DELETE /investments/:id

GET    /reports/cash-flow?months=
GET    /reports/expenses-by-category?month=&year=
GET    /reports/net-worth
GET    /reports/upcoming-bills?daysAhead=
GET    /reports/export/transactions.csv?type=&startDate=&endDate=
GET    /reports/export/summary.pdf

POST   /transactions/import/csv        (multipart: file + accountId?)
POST   /transactions/import/ofx        (multipart: file + accountId?)
POST   /transactions/:id/attachments   (multipart: file)
DELETE /transactions/:id/attachments/:filename
```

---

## Variáveis de Ambiente

### backend/.env
```
# Transaction pooler — runtime queries
DATABASE_URL="postgresql://postgres.qovqkvcvlrzmtvufursn:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# Conexão direta — migrations
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.qovqkvcvlrzmtvufursn.supabase.co:5432/postgres"

JWT_SECRET="change-this-secret-in-production-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="change-this-refresh-secret-in-production-min-32-chars"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="MY-FINANCE <no-reply@myfinance.app>"
```

### frontend/.env.local
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-this-secret-min-32-chars
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Log de Alterações

### 2026-06-24 (Tarde) — Correções Edge Runtime + Build Passando

#### ✅ Fix 1 — `useSearchParams` sem Suspense
- `@cloudflare/next-on-pages` exige que `useSearchParams()` seja envolvido em `<Suspense>` em páginas estáticas.
- Extraído `SearchParamsHandler` em componente separado dentro de `login/page.tsx`, envolto em `<Suspense fallback={null}>`.
- Commit: `f073da6`

#### ✅ Fix 2 — `export const runtime = 'edge'` faltando em rotas raiz
- `@cloudflare/next-on-pages` requer a declaração em TODA rota dinâmica de API.
- Script adicionou o export nos arquivos de rota sem `[id]` no caminho.
- Commit: `06f0aad`

#### ✅ Fix 3 — `import { extname } from 'path'` em `storage.ts`
- Webpack não consegue empacotar módulos Node.js (`path`, `fs`, etc.) para Edge Runtime.
- Substituído por função inline de 3 linhas.
- Commit: `1f51513`

#### ✅ Fix 4 — Import não utilizado em `users/me/route.ts`
- Commit: `e4e484c`

#### ✅ Fix 5 — `export const runtime = 'edge'` faltando em rotas `[id]`
- O script anterior usava glob PowerShell que trata `[id]` como classe de caractere, pulando todos os arquivos em pastas com colchetes no nome.
- 12 arquivos corrigidos manualmente: `accounts/[id]`, `budgets/[id]`, `cards/[id]`, `cards/[id]/freeze`, `cards/[id]/invoice`, `categories/[id]`, `goals/[id]`, `goals/[id]/progress`, `investments/[id]`, `transactions/[id]`, `transactions/[id]/attachments`, `transactions/[id]/attachments/[filename]`.
- Commit: `803fd11` — **BUILD PASSOU** ✅

#### ❌ App ainda retorna 500 — causa: zero variáveis de ambiente configuradas
- O projeto `my-finance-my` no Cloudflare Pages está sem nenhuma variável.
- **Pendente para amanhã:** adicionar as 4 variáveis (ver seção "Próximo Passo" acima).

---

### 2026-06-24 — Tentativa de Deploy + Reset + Decisão de Migração

#### ❌ Deploy Cloudflare Pages — FRACASSOU (causa raiz: Prisma + Edge Runtime incompatíveis)
- Tentadas múltiplas abordagens: `@cloudflare/next-on-pages`, `@opennextjs/cloudflare`, Cloudflare Workers + GitHub Actions
- Todas falharam por razão fundamental: Prisma requer Node.js; Cloudflare Pages roda Edge Runtime (V8 isolates sem Node.js)
- Worker `my-finance` deployado via GitHub Actions, mas sem variáveis de ambiente configuradas → Internal Server Error
- Upgrade acidental para Next.js 15 durante tentativas → quebrou o app localmente
- **Decisão:** hard reset para commit `251e1b9` (estado de 2026-06-23 noite). Um dia de trabalho descartado.

#### ✅ Hard Reset
```
git reset --hard 251e1b93c9eeaed508fac5ee64e92ef9f55c45e5
git push --force origin master
```
Projeto voltou ao estado de 2026-06-23. Projeto Cloudflare Pages deletado. Secrets GitHub mantidos (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) — podem ser deletados.

#### 🔍 Diagnóstico — Por que esse projeto foi mais difícil que os anteriores
- Projetos anteriores: Next.js na raiz + Supabase client + Supabase Auth → deploy Cloudflare de primeira
- Este projeto: Next.js em subpasta + Prisma (Node.js) + JWT manual → incompatível com Edge Runtime
- A remoção do backend NestJS foi só mudança de estrutura, não de tecnologia — Prisma continuou no runtime

#### 📋 Próximo passo definido
Migração completa para Supabase Auth + Supabase client (Fase 5 acima). Todas as telas e lógica de negócio ficam intactas.

---

### 2026-06-23 (Noite) — Deploy Cloudflare Pages (em andamento)

#### 🚀 Preparação para Produção
- **DATABASE_URL atualizado** para Transaction pooler Supabase (porta 6543, `?pgbouncer=true`); `DIRECT_URL` mantém conexão direta (porta 5432) para migrations.
- **`pdfkit` → `pdf-lib`:** Substituído por versão edge-compatible; rota de export PDF reescrita com API do `pdf-lib`; removido `export const runtime = 'nodejs'`.
- **`wrangler.toml` criado** com `nodejs_compat` e `pages_build_output_dir`.
- **`@cloudflare/next-on-pages@1.13.15` adicionado** (pinado — versão 1.13.16 adicionou peer dep `next>=14.3.0` incompatível com `next@14.2.3`).
- **`.npmrc` com `legacy-peer-deps=true`** para suprimir conflito de peer deps no npm install automático do Cloudflare.
- **`storage.ts` corrigido:** `createClient` movido para dentro de função `getClient()` (lazy) — evita erro "supabaseUrl is required" quando Next.js importa o módulo durante `next build`.

#### ⚠️ Estado atual do deploy (projeto: `myfinance` em `myfinance-c83.pages.dev`)
- Projeto criado no Cloudflare Pages, conectado ao GitHub (`entreambientesoficial/My-Finance`).
- **Build ainda falhando.** Erros corrigidos em sequência: peer dep npm → TypeScript Uint8Array → supabaseUrl no module level.
- Último commit `8b3f0cd` (lazy Supabase client) ainda não teve resultado confirmado.
- **Opções para amanhã:**
  1. Verificar se `8b3f0cd` resolveu o build — se sim, configurar domínio e variáveis de produção.
  2. Se ainda falhar, considerar migrar para **OpenNext** (adaptador oficial recomendado pelo Cloudflare, substituindo o deprecated `@cloudflare/next-on-pages`).
  3. Alternativa: deletar projeto e recriar com configurações ajustadas.

#### Variáveis configuradas no Cloudflare Pages (Production)
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NEXT_PUBLIC_APP_URL` (https://myfinance-c83.pages.dev), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BRAPI_TOKEN`, `NODE_VERSION=20`

---

### 2026-06-23 (Tarde) — UX, Correções de Dados e Conformidade LGPD

#### 🔐 Auth — Correção de Logout Inesperado
- **Access token estendido:** `15m` → `8h` — o TTL curto causava expiração durante o uso normal.
- **Refresh token estendido:** `7d` → `30d` — evita re-login semanal forçado.
- **Race condition corrigida em `api.ts`:** Múltiplas requisições simultâneas com 401 (ex.: React Query na montagem) disparavam várias chamadas de `/auth/refresh` em paralelo. A rotação do token fazia as chamadas subsequentes falharem e o sistema deslogava. Implementado padrão **subscriber queue**: apenas a primeira chamada executa o refresh; as demais aguardam na fila e retentam após o refresh concluir.

#### 📊 Orçamentos — Correção de Dados
- **Filtro de categorias corrigido:** Todas as 40+ categorias apareciam como "AUTOMÁTICO" por causa de um filtro `|| r.amount > 100` que sempre era verdadeiro (fallback = 500 > 100). Removido o bypass; agora só exibe categorias com gasto real OU orçamento manual definido.
- **Hierarquia de categorias:** A query retornava pai e filho separadamente, duplicando entradas. Corrigido com `parentId: null` na query + agregação dos gastos dos filhos no pai.
- **Dados reais no gráfico:** Histórico mensal de 6 meses e "Movimentações de Impacto" agora usam dados reais do banco em vez de arrays de fallback mockados.

#### 📈 Relatórios — Correções de UI e PDF
- **Quebra de valor corrigida:** Valores na tabela de transações quebravam linha entre o sinal (`+`/`-`) e o montante. Resolvido com `whitespace-nowrap` + template literal no `<td>`.
- **PDF — prazo corrigido:** "Próximas Contas a Pagar" no PDF exibia "15 dias" mas consultava 30 dias. Texto e query agora consistentes em **30 dias**.

#### 💳 Transações — OFX e Notas
- **Encoding OFX corrigido:** Extratos OFX de bancos brasileiros usam Windows-1252, mas `file.text()` assume UTF-8, gerando `AÃ§Ã£o` em vez de `Ação`. Corrigido com detecção do cabeçalho OFX (`CHARSET:1252`) e `TextDecoder('windows-1252')`.
- **FITID oculto na UI:** O prefixo `ofx:FITID` armazenado em `notes` para deduplicação era exibido ao usuário. Filtro `notes.startsWith('ofx:')` adicionado na lista de transações (desktop e mobile) sem alterar a lógica de deduplicação.

#### ⚙️ Configurações — Privacidade e LGPD
- **Aba Privacidade adicionada:** Nova aba completa em `/settings` com política de privacidade, base legal (Art. 7º, I, V e IX da Lei 13.709/2018), retenção de dados, segurança, e listagem dos 6 direitos do titular (Art. 18).
- **Seção "Exportar e Encerrar Conta":** Renomeada de "Zona de Perigo" para linguagem acessível a usuários não-técnicos. Inclui botão de download CSV e modal de exclusão de conta com confirmação por digitação de "EXCLUIR".

---

### 2026-06-22 — Auditoria de Segurança + Hardening Completo

#### 🔐 Segurança — Backend
- **Cookies httpOnly:** Tokens JWT migrados de `localStorage` para cookies `httpOnly; Secure; SameSite` — proteção contra XSS. `cookie-parser` instalado, `JwtStrategy` atualizada para extrair de cookie (com fallback para Bearer).
- **JWT TTLs corrigidos:** `JWT_EXPIRES_IN` de `30d` → `15m`; `JWT_REFRESH_EXPIRES_IN` de `365d` → `7d`.
- **JWT secrets fortes:** Substituídos os secrets fracos por strings hexadecimais aleatórias de 128 chars.
- **Rate limiting:** `@Throttle` adicionado nos endpoints `/auth/refresh` e `/auth/accept-invite` (antes sem proteção).
- **Complexidade de senha:** `RegisterDto` e `AcceptInviteDto` agora exigem mínimo 8 chars + ao menos uma letra maiúscula e um número.
- **Logout seguro:** `AuthService.logout` aceita token opcional; controller limpa os dois cookies no servidor.

#### 🔐 Segurança — Frontend
- **Removido `localStorage`:** `login/page.tsx`, `register/page.tsx` e `accept-invite/page.tsx` não armazenam mais tokens.
- **`api.ts` com `withCredentials`:** Axios envia cookies automaticamente; interceptor 401 renova via `/auth/refresh` sem precisar ler token do `localStorage`.
- **`logout` no layout:** Chama `POST /auth/logout` para invalidar o refresh token no banco e limpar cookies — em vez de só apagar o `localStorage`.
- **`getAvatarUrl` corrigido:** `layout.tsx` e `settings/page.tsx` usam `NEXT_PUBLIC_API_URL` em vez de `http://localhost:3001` hardcoded.

#### ⚙️ CI/CD
- **Branch corrigida:** `ci-cd.yml` apontava para `refs/heads/main` — corrigido para `refs/heads/master`. Os jobs de deploy nunca tinham executado.

#### 🔑 Credenciais Supabase
- `SUPABASE_SERVICE_KEY` rotacionada para o novo formato `sb_secret_...` (legacy JWT key descontinuada).
- Senha do banco de dados rotacionada via Supabase Dashboard → Database → Reset password.
- `DATABASE_URL` e `DIRECT_URL` atualizadas com a nova senha.

### 2026-06-20 (Tarde) — UX de Categorias, Gráfico de Caixa e Correções de Configurações

#### 🗂️ Tela de Configurações — Categorias
- **Editar e Excluir TUDO:** Removidas as restrições que impediam editar/excluir categorias e subcategorias padrão (`isDefault`). Agora todos os itens da lista possuem botões de editar (✏️) e excluir (🗑️) visíveis ao passar o mouse, incluindo as categorias que vêm pré-cadastradas no sistema.
- **Formulário unificado de criação/edição:** O mesmo formulário é reutilizado para criação e edição. O título muda de "Nova Categoria" para "Editar Categoria" quando há uma categoria sendo editada. O botão de submissão alterna entre "Criar" e "Salvar". O botão "Cancelar" limpa o estado de edição corretamente.
- **Subcategorias colapsáveis:** As subcategorias deixaram de ficar sempre abertas. Agora ficam ocultas por padrão e expandem ao clicar na linha da categoria pai. Uma seta animada (`▼`/`▲`) indica visualmente o estado de expansão. Categorias sem subcategorias não são clicáveis.
- **Ordenação alfabética:** Categorias principais e subcategorias são agora ordenadas alfabeticamente (A→Z) usando `localeCompare` com suporte ao português (acentos e cedilha tratados corretamente).
- **Paleta de cores corrigida:** Adicionada constante `COLORS` que estava ausente no componente, prevenindo erro de renderização do seletor de cores no formulário de categoria.

#### 📊 Dashboard — Gráfico Fluxo de Caixa
- **Labels em português:** As labels do tooltip do gráfico Recharts foram traduzidas de `income`/`expense` para **Receitas**/**Despesas**.
- **Cores por tipo:** Barra de **Receitas** agora exibe em **verde** (`#10b981`) e barra de **Despesas** em **vermelho** (`#ef4444`), tanto no gráfico desktop (Recharts) quanto no gráfico mobile (barras CSS manuais).
- **Legenda atualizada:** Os pontos coloridos e valores da legenda "Média de Receitas" e "Média de Despesas" abaixo do gráfico também foram atualizados para refletir as novas cores (verde e vermelho respectivamente).

#### 🔐 Segurança e Sidebar
- **Senha não aparece mais na sidebar:** Adicionado `autoComplete="off"` no campo de nome da família e `autoComplete="new-password"` nos campos de senha, impedindo que gerenciadores de senhas do navegador preencham dados incorretos no sidebar.
- **Sidebar em ordem alfabética:** Itens de navegação reorganizados com Dashboard sempre primeiro, seguido dos demais em ordem alfabética: Contas & Cartões → Investimentos → Metas → Orçamentos → Relatórios → Transações.
- **Avatar funcional:** Adicionado helper `getAvatarUrl` que resolve URLs relativas (`/uploads/...`) para o endereço absoluto do backend (`http://localhost:3001/...`), corrigindo a exibição de fotos de perfil carregadas localmente. Configurado `crossOriginResourcePolicy: false` no Helmet do backend para permitir que o frontend acesse as imagens estáticas servidas pelo backend.

### 2026-06-20 — Refatoração de Configurações, Upload de Fotos e Alteração de Senha

- **Configurações Geral:** Migração de cores azuis hardcoded para as variáveis semânticas do Design System, garantindo suporte perfeito e contraste adequado tanto em Light quanto em Dark Mode.
- **Perfil do Usuário:** Adicionado formulário de alteração de senha seguro (com criptografia bcrypt e validações frontend/backend). Criado sistema de upload local de fotos de perfil com Multer no backend, resolvendo a limitação de links externos (como Instagram) devido a bloqueios de CORS/CORP.
- **Família:** Badge "(Você)" adicionada ao usuário logado na listagem de membros, e cards com estilo glassmorphic responsivo. Configurada diretiva `autoComplete` no nome da família para evitar preenchimento de senhas acidental pelos navegadores.
- **Categorias:** Adicionado suporte à hierarquia de subcategorias na aba de gerenciamento, permitindo listar subcategorias de forma identada/aninhada e criá-las diretamente associando um "Categoria Pai" no formulário. Adicionadas subcategorias "Cinema" e "Teatro" sob a categoria principal "Lazer".

### 2026-06-19 (Tarde) — Refatoração de Contas, Orçamentos, Metas, Investimentos, Edição de Transações e Subcategorias
- **Contas & Cartões:** Substituição de imagens externas do banner "Cofres Familiares" por gradientes CSS offline, correção do cálculo de fatura atual zerada, e integração de modal de Aportes com saldos de contas reais e criação de transações.
- **Orçamentos (Budgets):** Implementado cálculo de limite automático baseado nas despesas dos últimos 3 meses, suporte híbrido a limites manuais e IA, e redesign premium glassmorphic do card do Insight de IA com efeito de glow.
- **Metas (Goals):** Substituição de fallbacks mockados por dados reais do Supabase, cálculo dinâmico de estatísticas consolidadas, e fluxo de aportes integrado que deduz saldos das contas e gera logs de despesas no banco.
- **Investimentos (Investments):** Higienização de `purchaseDate` vazio no formulário para evitar erros de validação no backend, débito integrado de saldo de contas ao cadastrar ativos, e acordeão collapsible mobile para detalhar ativos por categoria com opção de exclusão.
- **Edição de Transações:** Criado modal `EditTransactionModal` para desktop/mobile conectado ao endpoint `PATCH /transactions/:id` permitindo alterar qualquer detalhe de lançamentos registrados ou importados.
- **Subcategorias Financeiras:** Criação de script de banco [add-subcategories.ts](file:///c:/APP-SITE-SAAS/MY-FINANCE/backend/prisma/add-subcategories.ts) que renomeou "Transporte" para *"Veículo & Transporte"* e semeou subcategorias padrão sob cada categoria pai. No frontend, atualizamos os seletores de categoria para usar agrupamento com `<optgroup>`.

### 2026-06-19 (Manhã) — Melhorias de UX/UI, Máscaras de Valor e Painel Dinâmico
- **Máscara Monetária Sequencial:** Implementado o componente `<CurrencyInput />` com formatação em tempo real (`R$ 0,00` com preenchimento da direita para a esquerda) nos inputs de valor em todas as telas e modais (Contas, Cartões, Transações, Investimentos, Metas e Orçamentos).
- **Rebranding para MY-FINANCE:** Ajustado logotipo do menu lateral e cabeçalho de "Capital Flow (Residential Finance)" para "My-Finance (Gestão Financeira)".
- **Limpeza do Cabeçalho e Theme Toggle:** Removido ícone estático de calendário e seletor "BRL", introduzindo o componente `<ThemeToggle />` para alternar dinamicamente os temas claro e escuro.
- **Notificações Interativas:** Implementado dropdown de notificações dinâmico no cabeçalho superior que busca contas a vencer reais nos próximos 15 dias via `/reports/upcoming-bills?daysAhead=15`.
- **Cálculo Dinâmico de Cards no Dashboard:** Reformulada a lógica de cálculo dos cards:
  - *Caixa:* Somatório de contas `CHECKING` e `CASH` (sem "cofrinho" ou "reserva" no nome).
  - *Reserva de Emergência:* Somatório de contas `SAVINGS` + contas/investimentos com "cofrinho" ou "reserva" no nome.
  - *Investimentos:* Somatório de contas `INVESTMENT` + ativos da carteira sem esses termos.
- **Empty States Reais no Dashboard:** Removidos mocks rígidos em transações, contas e gráficos. O gráfico de Fluxo de Caixa agora exibe uma mensagem amigável caso não haja dados no período.
- **Insight Inteligente Dinâmico:** Bloco de insights avalia as finanças em tempo real (saldo baixo, incentivo à reserva e incentivo a investimentos) baseado no saldo de Caixa, Reserva e faturas pendentes.
- **Melhorias na Tela de Transações:**
  - *Redução de Padding na Tabela:* Padding reduzido de `px-lg` para `px-md lg:px-sm` para evitar clipping horizontal e expor a coluna **Ações** (excluir, anexo, status de pagamento) em resoluções de notebook.
  - *Acessibilidade do Theme no Card de Resumo:* Ajustado background do card de resumo de transações para `bg-primary dark:bg-primary-container`, mantendo legibilidade ideal com fontes brancas em ambos os temas.
  - *Feedback de Importação:* Nome do arquivo selecionado exibido dinamicamente no progresso de importação.
  - *Dicas OFX/Date Picker:* Inclusão de alerta contendo dicas para arquivos OFX (MS Money/Quicken) e estilo customizado nos inputs de filtro de data.

### 2026-05-28 — FASE 2 CONCLUÍDA (100%)
**Entrega inicial (ainda em 2026-05-27/28):**
- Página Accounts reescrita com modais completos: criar conta bancária e cartão
- Página Settings: 3 abas — Perfil, Família, Categorias
- Backend: export CSV com BOM, import CSV inteligente (detecta separador, mapeia colunas de bancos BR)
- Frontend Transactions: filtros de tipo e período, Export/Import CSV, formulário melhorado
- Sidebar: link /settings + avatar e nome do usuário logado

**Funcionalidades avançadas concluídas:**
- **Dark mode**: Sistema de CSS custom properties (`--c-bg`, `--c-card`, etc.) + tokens semânticos Tailwind (`bg-card`, `text-base`, `text-muted`, `border-base`...); toggle no settings; todas as 8 páginas do dashboard convertidas
- **Upload de anexos**: multer diskStorage em `uploads/attachments/`; endpoint `POST /transactions/:id/attachments`; UI na página Transactions com badge de contagem e modal de gerenciamento
- **Export PDF**: pdfkit (dynamic require); endpoint `GET /reports/export/summary.pdf`; 4 seções: patrimônio, fluxo 3 meses, contas a pagar, rodapé; botão "Exportar PDF" na página Reports
- **Notificações e-mail**: nodemailer global (`MailService`); graceful no-op se SMTP não configurado; 3 alertas via cron: contas a vencer (D-3, 9h), orçamento >80% (diário, 9h), meta atingida (a cada hora)
- **OFX import**: parser dual SGML/XML; deduplicação por FITID (`notes: ofx:${fitid}`); endpoint `POST /transactions/import/ofx`; switcher CSV/OFX na UI
- **Múltiplos usuários**: modelo `Invite` (token 48h, email, expiresAt); `POST /households/invite` envia email com link; página `/accept-invite?token=...`; `POST /auth/accept-invite` cria ou vincula conta existente; UI de convites pendentes na aba Família do Settings

### 2026-06-25 — AUTENTICAÇÃO EM DIAGNÓSTICO (sessão atual)

**Problema em aberto**: Após login (Google OAuth ou email/senha), o dashboard aparece brevemente e redireciona para login.

**Causa raiz identificada**: `withAuth` retornavaa 401 quando não encontrava o perfil na tabela `users`. O `api.ts` redirecionava para `/login` em QUALQUER 401 — mesmo com sessão válida. Isso quebrou email/senha também.

**Correções desta sessão:**
- OAuth flow: voltou para callback server-side (`/api/auth/callback`) que troca código PKCE com o cookie verifier do `req.cookies`
- Tokens OAuth passados via URL hash (`#access_token=...`) para contornar problema de `Set-Cookie` em redirects no Cloudflare Pages
- `withAuth`: admin client + fallback user JWT + auto-criação de perfil
- `api.ts`: 401 só redireciona para login se sessão realmente não existe

**Diagnóstico pendente (verificar no Supabase):**
1. Table Editor → tabela `users`: há registros? Se vazia, perfil nunca foi criado — verificar logs do Cloudflare
2. RLS na tabela `users`: existe política `SELECT WHERE auth.uid() = supabaseId`?
3. `SUPABASE_SERVICE_KEY` no Cloudflare Pages: confirmar que é a chave da aba "Legacy anon, service_role API keys" (começa com `eyJ...`)

**Variáveis de ambiente (Cloudflare Pages) — estado atual:**
- `NEXT_PUBLIC_APP_URL` = https://my-finance-my.pages.dev ✅
- `NEXT_PUBLIC_SUPABASE_URL` = https://szpqjiwwektauiqvbzxe.supabase.co ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = eyJ... ✅
- `SUPABASE_SERVICE_KEY` = Secret configurado (valor começa com eyJ conforme usuário) ⚠️

---

### 2026-05-27 — FASE 1 COMPLETA
- Projeto iniciado com base no protótipo visual do Stitch AI
- Criada estrutura completa do backend NestJS com 11 módulos
- Criada estrutura completa do frontend Next.js 14 com 8 páginas
- Schema Prisma com 10 entidades
- 33 endpoints REST documentados no Swagger
- Seed com dados de demonstração (contas, cartões, transações, metas, investimentos)
- Docker Compose para dev local
