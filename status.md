# MY-FINANCE — Status do Projeto

> Atualizado em: 2026-06-20 (tarde)
> Stack: NestJS + Next.js 14 + PostgreSQL (Supabase) + Prisma

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

### ⏳ FASE 3 — Produção
- [ ] CI/CD (GitHub Actions)
- [ ] Dockerfile backend + frontend
- [ ] Deploy backend (Railway/Render)
- [ ] Deploy frontend (Vercel)
- [ ] Domínio + SSL
- [ ] Monitoramento (Sentry)
- [ ] Backup automático do banco
- [ ] Rate limiting + Helmet (segurança)

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
| Invite | id, householdId, email, token, expiresAt, acceptedAt |

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

POST   /auth/accept-invite             (token, name, password)

POST   /households/invite              (email)
GET    /households/invites
DELETE /households/invites/:id
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

### 2026-05-27 — FASE 1 COMPLETA
- Projeto iniciado com base no protótipo visual do Stitch AI
- Criada estrutura completa do backend NestJS com 11 módulos
- Criada estrutura completa do frontend Next.js 14 com 8 páginas
- Schema Prisma com 10 entidades
- 33 endpoints REST documentados no Swagger
- Seed com dados de demonstração (contas, cartões, transações, metas, investimentos)
- Docker Compose para dev local
