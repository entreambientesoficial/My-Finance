# Guia de Deploy em Produção — MY-FINANCE

> Stack: NestJS (Railway) + Next.js (Cloudflare Pages) + PostgreSQL (Supabase) + Supabase Storage

---

## Pré-requisitos

- [ ] Conta no [Railway](https://railway.app)
- [ ] Conta no [Cloudflare](https://dash.cloudflare.com) (já tem ✅)
- [ ] Projeto ativo no [Supabase](https://supabase.com/dashboard) (já tem ✅)
- [ ] Repositório no GitHub com o código (necessário para CI/CD)

---

## 1. Supabase — Banco de Dados + Storage

### 1.1 Banco de Dados
1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) e confirme que o projeto está ativo
2. Em **Project Settings → Database**, copie:
   - **Transaction Pooler** (porta 6543) → `DATABASE_URL`
   - **Direct Connection** (porta 5432) → `DIRECT_URL`

### 1.2 Storage — Criar buckets
> Necessário para avatars e anexos de transações

1. No Supabase, vá em **Storage → Buckets → New bucket**
2. Crie o bucket `avatars`:
   - Name: `avatars`
   - Public bucket: ✅ **SIM** (para URLs públicas)
3. Crie o bucket `attachments`:
   - Name: `attachments`
   - Public bucket: ✅ **SIM**
4. Em **Project Settings → API**, copie:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_KEY` ⚠️ nunca expor no frontend

---

## 2. Backend — Railway

### 2.1 Criar projeto
1. Acesse [Railway](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Selecione seu repositório e configure:
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile`

### 2.2 Variáveis de ambiente no Railway
Vá em **Variables** e adicione:

```env
NODE_ENV=production
PORT=3001

# Database (Supabase)
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# JWT — gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="[GERE_UM_SEGREDO_SEGURO_64_CHARS]"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="[GERE_OUTRO_SEGREDO_SEGURO_64_CHARS]"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS — URL do seu Cloudflare Pages
FRONTEND_URL="https://my-finance.pages.dev"

# Supabase Storage
SUPABASE_URL="https://[SEU-PROJECT-ID].supabase.co"
SUPABASE_SERVICE_KEY="[SUA-SERVICE-ROLE-KEY]"

# SMTP (opcional — para notificações por e-mail)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="MY-FINANCE <no-reply@myfinance.app>"
```

### 2.3 Obter a URL do backend
Após o deploy: **Settings → Networking → Generate Domain**
Ex: `https://my-finance-backend.up.railway.app`

---

## 3. Frontend — Cloudflare Pages

### 3.1 Criar projeto no Cloudflare Pages
1. No [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages**
2. Clique em **Connect to Git** → Selecione seu repositório
3. Configure o build:
   - **Project name**: `my-finance`
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Node.js version**: `20`

### 3.2 Variáveis de ambiente no Cloudflare Pages
Em **Settings → Environment variables**, adicione para **Production**:

```env
NEXT_PUBLIC_API_URL=https://my-finance-backend.up.railway.app
NODE_VERSION=20
```

### 3.3 Domínio customizado
1. Em **Custom domains**, clique em **Set up a custom domain**
2. Insira seu domínio (ex: `app.meufinance.com.br`)
3. Siga as instruções de DNS — o Cloudflare gerencia o SSL automaticamente ✅

---

## 4. GitHub Secrets (para CI/CD automático)

Vá em **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Onde obter |
|--------|-----------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens → Create token |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create token (Cloudflare Pages: Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → URL: `dash.cloudflare.com/[ACCOUNT_ID]` |
| `NEXT_PUBLIC_API_URL` | URL do Railway gerada no passo 2.3 |

---

## 5. Verificação Pós-Deploy

- [ ] Acesse a URL do Cloudflare Pages e teste o login
- [ ] Crie uma transação e verifique no Supabase
- [ ] Faça upload de avatar e confirme a URL pública do Supabase Storage
- [ ] Verifique logs no Railway: `railway logs`

---

## 6. Checklist de Segurança (já implementado)

- [x] Swagger desabilitado em produção
- [x] Logs de debug removidos
- [x] Rate limiting: `/login` 10/min, `/register` 5/min
- [x] fileFilter em todos os uploads (bloqueia .exe, .php, .sh)
- [x] Helmet com CSP ativo em produção
- [x] CORS só aceita `FRONTEND_URL` definida
- [x] Senhas com mínimo 8 caracteres (bcrypt fator 10)
- [x] Upload de arquivos migrado para Supabase Storage (sem disco efêmero)
- [x] JWT tokens com rotação (refresh token = uso único)
- [x] Isolamento multi-tenant por `householdId` em todos os endpoints
- [x] Usuário não-root no Docker (usuário `nestjs`)

---

## Referências rápidas

- Railway CLI: `npm install -g @railway/cli` → `railway login` → `railway link`
- Supabase Dashboard: https://supabase.com/dashboard
- Cloudflare Pages: https://dash.cloudflare.com → Workers & Pages
