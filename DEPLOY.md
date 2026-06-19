# Guia de Implantação em Produção (MY-FINANCE)

Este guia descreve o processo passo a passo para colocar a aplicação **MY-FINANCE** em produção.

---

## 1. Banco de Dados (Supabase)

A aplicação utiliza o Supabase como banco de dados PostgreSQL.

1. **Reativação/Criação:** 
   - Certifique-se de que o seu projeto no [Supabase Dashboard](https://supabase.com/dashboard) esteja ativo e online.
2. **Obtenção das Connection Strings:**
   - Acesse *Project Settings -> Database* no painel do Supabase.
   - Copie a URL do **Transaction Connection Pooler** (porta 6543) com o parâmetro `pgbouncer=true`. Esta será a variável `DATABASE_URL`.
   - Copie a URL de **Direct Connection** (porta 5432). Esta será a variável `DIRECT_URL`.
3. **Backups Automáticos:**
   - O Supabase realiza backups diários automaticamente. Você pode gerenciar e restaurar backups na aba *Database -> Backups*.

---

## 2. Deploy do Backend (Railway)

O backend é construído em NestJS e possui um Dockerfile pronto para uso em `backend/Dockerfile`.

1. **Criar Novo Serviço:**
   - No [Railway Dashboard](https://railway.app/), crie um novo projeto e conecte seu repositório GitHub.
   - Selecione a pasta `/backend` como a raiz do serviço ou aponte para o Dockerfile correspondente.
2. **Variáveis de Ambiente (Environment Variables):**
   - Adicione as seguintes variáveis no painel do Railway:
     ```env
     PORT=3001
     NODE_ENV=production
     DATABASE_URL="sua-url-do-pooler-do-supabase-com-senha"
     DIRECT_URL="sua-url-direta-do-supabase-com-senha"
     JWT_SECRET="segredo-longo-e-seguro-minimo-32-caracteres"
     JWT_REFRESH_SECRET="outro-segredo-longo-e-seguro"
     JWT_EXPIRES_IN="15m"
     JWT_REFRESH_EXPIRES_IN="7d"
     FRONTEND_URL="https://sua-app-frontend.vercel.app"
     ```
3. **Execução de Migrações:**
   - O Dockerfile do backend executa `npx prisma migrate deploy` automaticamente durante a inicialização do container, aplicando todas as migrações pendentes no Supabase.

---

## 3. Deploy do Frontend (Vercel)

O frontend é construído em Next.js e utiliza o App Router.

1. **Criar Projeto na Vercel:**
   - No [Vercel Dashboard](https://vercel.com/), clique em *Add New -> Project* e importe seu repositório GitHub.
   - Defina o **Root Directory** como `frontend`.
   - O framework preset deve ser detectado automaticamente como *Next.js*.
2. **Variáveis de Ambiente:**
   - Adicione as seguintes variáveis no painel da Vercel:
     ```env
     NEXTAUTH_URL="https://sua-app-frontend.vercel.app"
     NEXTAUTH_SECRET="um-segredo-seguro-para-criptografia-next-auth"
     BACKEND_URL="https://seu-api-backend.railway.app"
     NEXT_PUBLIC_API_URL="https://seu-api-backend.railway.app"
     ```
3. **Deploy:**
   - Clique em *Deploy*. A Vercel construirá e otimizará o build de produção do Next.js. Deploy automáticos serão ativados para cada push na branch principal (`main` ou `master`).

---

## 4. Domínio Customizado e SSL

1. **Frontend (Vercel):**
   - Acesse *Settings -> Domains* no seu projeto Vercel.
   - Insira o domínio desejado (ex: `app.meufinance.com.br`).
   - Siga as instruções para criar os apontamentos CNAME ou A na sua zona de DNS (ex: no GoDaddy, Cloudflare, Registro.br).
   - O certificado SSL (HTTPS) será gerado automaticamente.
2. **Backend (Railway):**
   - Vá nas configurações do serviço do backend no Railway.
   - Sob a seção *Networking*, clique em *Generate Domain* para obter um subdomínio seguro padrão do Railway (`https://...up.railway.app`) ou insira o seu subdomínio customizado (ex: `api.meufinance.com.br`) criando o apontamento DNS correspondente.

---

## 5. Verificação Pós-Deploy

1. Acesse o domínio de produção do frontend.
2. Realize o login ou cadastro e confirme que o fluxo de autenticação via JWT está se comunicando com o backend corretamente.
3. Teste a criação de uma conta bancária ou transação para verificar se a gravação de dados no Supabase e a invalidação de cache no Next.js (via React Query) estão em sincronia.
