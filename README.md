# LPweb.dev | Assessoria Financeira

Sistema web para controle de empréstimos a clientes: cadastro, parcelas, cobranças do dia/mês,
comissões, histórico, relatório em PDF e envio diário pelo Telegram.

**Stack:** Next.js (App Router) + TypeScript + Tailwind • Supabase (PostgreSQL, Auth e RLS) •
Vercel (hospedagem + Vercel Cron) • `@react-pdf/renderer` • Telegram Bot API • PWA instalável.

---

## 1) Criar o projeto no Supabase e rodar o SQL

1. Acesse <https://supabase.com> → **New project**. Escolha um nome, uma senha forte para o banco e a
   região **South America (São Paulo)**.
2. No projeto, abra **SQL Editor → New query**, cole **todo** o conteúdo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique em **Run**.
   Isso cria as tabelas (`clientes`, `emprestimos`, `parcelas`, `historico`, `configuracoes`), o RLS
   (somente usuários autenticados), os gatilhos de histórico e a função `criar_emprestimo`.
3. *(Opcional, para testar)* rode também [`supabase/seed.sql`](supabase/seed.sql): cadastra os 9 clientes
   do PDF com empréstimos **de exemplo** (valores inventados). Apague-os antes de usar de verdade.
4. Crie o **único usuário** do sistema: **Authentication → Users → Add user → Create new user**
   (e-mail + senha, marque *Auto Confirm User*).
5. **Desative o cadastro público**: **Authentication → Sign In / Providers** (ou *Providers → Email*) →
   desmarque **Allow new users to sign up**. Assim só o usuário que você criou consegue entrar.
6. Copie as chaves em **Project Settings → API** (ou *API Keys*):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - chave **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - chave **service_role / secret** → `SUPABASE_SERVICE_ROLE_KEY` (**secreta**: só no servidor)

> Para rodar de novo o seed com datas relativas a hoje: `npm run seed:sql` regenera `supabase/seed.sql`.

## 2) Configurar as variáveis na Vercel

Em **Vercel → seu projeto → Settings → Environment Variables**, cadastre (Production):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role/secret |
| `TELEGRAM_BOT_TOKEN` | token do bot (passo abaixo) |
| `TELEGRAM_CHAT_ID` | seu chat id (também pode ser salvo na tela **Configurações**) |
| `CRON_SECRET` | texto longo e aleatório (ex.: `openssl rand -hex 32`) |

O arquivo [`.env.example`](.env.example) lista as mesmas variáveis, sem valores. Para desenvolvimento local,
copie-o para `.env.local`.

**Telegram:** no app do Telegram, converse com **@BotFather** → `/newbot` → guarde o *token*. Abra a conversa
com o seu bot e envie `/start` (o bot só consegue escrever depois disso). Descubra seu chat id com
**@userinfobot**.

## 3) Deploy e instalar no celular

1. Suba o código para um repositório (GitHub/GitLab/Bitbucket).
2. Na Vercel: **Add New → Project → Import** o repositório. O framework (Next.js) é detectado sozinho.
   Confira as variáveis do passo 2 e clique em **Deploy**.
3. O [`vercel.json`](vercel.json) já agenda o relatório: `"0 11 * * *"` (11:00 UTC = **08:00 de Brasília**)
   chamando `/api/cron/relatorio-diario`. A Vercel envia `Authorization: Bearer <CRON_SECRET>` sozinha;
   sem esse segredo a rota responde 401. No plano gratuito o disparo pode atrasar alguns minutos.
   Acompanhe em **Settings → Cron Jobs** (há o botão *Run*).
4. Abra o endereço do deploy, entre com o usuário criado e, em **Configurações**, salve o chat id e clique em
   **Enviar relatório de teste agora**.
5. **Instalar como app (PWA)** — precisa abrir pelo endereço `https://` da Vercel:
   - **Android (Chrome):** menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*).
   - **iPhone (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

## Rodando localmente

```bash
npm install
cp .env.example .env.local    # preencha com os dados do seu projeto Supabase
npm run dev                   # http://localhost:3000
```

**Sem criar conta no Supabase** (backend de teste local: Postgres embarcado com a migração e o seed reais +
um "Telegram" falso que só registra o que recebe):

```bash
npm run dev:falso             # terminal 1 → http://127.0.0.1:54321
# terminal 2 — variáveis (PowerShell: $env:NOME="valor"):
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=chave-anon-falsa
#   SUPABASE_SERVICE_ROLE_KEY=chave-service-falsa
#   TELEGRAM_BOT_TOKEN=123456:teste   TELEGRAM_CHAT_ID=999111
#   TELEGRAM_API_BASE=http://127.0.0.1:54321   CRON_SECRET=segredo-local
npm run dev                   # login: dono@lpweb.dev / senha-de-teste
```

## Testes

```bash
npm test          # 110 testes: comissão (50/100), status por data, parcelas, cobranças, relatório/PDF,
                  # Telegram, CSV, cron e o SQL (RLS, gatilhos, seed) rodando num Postgres embarcado
npm run typecheck && npm run lint && npm run build
```

## Trocar a logo

A logo em `public/logo/` é **provisória** (na paleta do projeto). Substitua mantendo os nomes:
`logo-claro.svg` (fundo branco / modo claro) e `logo-escuro.svg` (fundo escuro / modo escuro e cabeçalho do PDF).
Depois rode `npm run assets` para regenerar os PNGs (`logo-*.png`, usados no PDF) e os ícones do PWA.

## Regras e decisões de implementação

- **Status de cobrança** é calculado (nunca gravado) com a data de hoje em `America/Sao_Paulo`:
  em aberto (vence hoje/futuro) · atrasada (1–30 dias) · dívida (> 30 dias).
- **Comissão** sobre o valor emprestado: Geize > R$ 1.000,00 → R$ 100,00; ≤ R$ 1.000,00 → R$ 50,00;
  Rosangela e sem indicação → 0 (relatórios mostram “—”). Se a indicação do cliente mudar, a comissão dos
  empréstimos dele é recalculada.
- **“30 dias”**: `numero_parcelas = 30` significa pagamento único — gera **uma** parcela (valor = `valor_parcela`)
  no vencimento informado. Por isso 30 parcelas mensais não são possíveis (o formulário aceita 1–24 ou 30 dias).
- **Totais do PDF** são sempre a soma real das linhas da tabela (uma linha por empréstimo). O indicador
  “VALOR A PAGAR” é o saldo das parcelas em aberto; a coluna “VALOR A PAGAR” é o total do empréstimo com
  juros; a linha TOTAIS mostra também o valor já pago (total = saldo + pago). Empréstimo parcialmente pago
  aparece como “Parcial 1/3” na coluna PAGO.
- **Cobranças do dia**: o status é calculado em relação à data escolhida (padrão: hoje).
- **Data do empréstimo** (`data_emprestimo`, campo extra, padrão = hoje) define o mês no relatório de comissões.
- **Excluir cliente**: só sem empréstimos; com empréstimos, apenas **arquivar** (vai para o histórico).
  O banco também bloqueia a exclusão (gatilho + chave estrangeira).
- **Hora do relatório**: fica registrada em Configurações, mas o horário real do disparo é o do `vercel.json`
  (no plano gratuito, 1 execução por dia).
- **Importação CSV** (`;` ou `,`; UTF-8 ou Windows-1252): reaproveita cliente com mesmo nome + telefone;
  não duplica empréstimo já existente; `valor_pago` vazio = **não pago**; `valor_pago` só marca parcelas
  inteiras (em ordem) e avisa se sobrar resto. Coluna opcional extra: `data_emprestimo`.
- **Segurança**: RLS em todas as tabelas (só `authenticated`); histórico somente leitura para o usuário
  (escrito por gatilho `SECURITY DEFINER`); toda página e Server Action valida a sessão; a rota do cron exige
  `CRON_SECRET` (falha fechada); a service role key só é usada no servidor.
