# ShieldKid

Ferramenta **open-source** de verificação de idade e controle parental para compliance com a **Lei Felca** (Lei 15.211/2025 — ECA Digital) no Brasil.

> Tipo um Plausible Analytics da verificação de idade. Self-hosted, plug and play, `docker compose up` e pronto.

---

## O que a Lei Felca exige?

Desde 17/03/2026, **todas** as plataformas digitais operando no Brasil precisam:

- Verificar a idade dos usuários (autodeclaração é proibida)
- Vincular contas de menores de 16 a um responsável legal
- Controle parental ativo por padrão
- Gerar logs auditáveis para fiscalização da ANPD

**Penalidades:** multas de até 10% do faturamento no Brasil ou R$50 milhões por infração.

## O que o ShieldKid faz?

- **Verificação de idade via CPF** (API do Serpro) — sem autodeclaração
- **Cache eterno** — 1 consulta ao Serpro por CPF, para sempre (data de nascimento não muda)
- **Detecção de faixa etária** — criança (<12), adolescente (12-15), jovem (16-17), adulto (18+)
- **Monitoramento diário** — webhooks quando usuários cruzam faixas etárias (ex: faz 18 anos)
- **Logs de auditoria** — append-only para compliance com a ANPD
- **SDK JavaScript** — widget drop-in com Shadow DOM
- **API REST + tRPC** — funciona com qualquer linguagem/framework
- **Dashboard** — overview, verificações, configurações

---

## Quick Start

### Docker Compose (recomendado)

```bash
git clone https://github.com/your-org/shieldkid.git
cd shieldkid
cp .env.example .env
# Edite o .env com suas credenciais do Serpro e secrets

docker compose up
```

Pronto! App rodando em `http://localhost:3000`.

### Desenvolvimento local

```bash
# Pré-requisitos: Node.js 22+, pnpm, PostgreSQL

pnpm install
cp .env.example .env
# Edite o .env — configure DATABASE_URL para seu Postgres

pnpm db:push    # Cria as tabelas
pnpm dev        # Inicia o servidor de desenvolvimento
```

### Vercel + Neon (serverless)

1. Faça fork do repositório
2. Deploy no Vercel (botão abaixo)
3. Crie um banco no [Neon](https://neon.tech) (free tier: 0.5GB)
4. Configure as variáveis de ambiente no dashboard do Vercel
5. Execute `pnpm db:push` contra seu banco Neon

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `HMAC_SECRET` | Sim | Secret para hash do CPF (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Sim | Chave para criptografia da data de nascimento (`openssl rand -hex 32`) |
| `SERPRO_API_URL` | Sim | URL da API do Serpro |
| `SERPRO_CLIENT_ID` | Sim | Seu Client ID do Serpro |
| `SERPRO_CLIENT_SECRET` | Sim | Seu Client Secret do Serpro |
| `BETTER_AUTH_SECRET` | Sim | Secret para autenticação do dashboard |
| `SERPRO_MOCK` | Não | `true` para dev sem credenciais do Serpro |
| `WEBHOOK_URL` | Não | URL para receber eventos via webhook |
| `WEBHOOK_SECRET` | Não | Secret HMAC para assinar payloads dos webhooks |

---

## Como usar

### API REST

```bash
# Verificar idade de um usuário por CPF
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Authorization: Bearer sk_seu_token" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "123.456.789-00", "externalUserId": "user_123"}'
```

Resposta:
```json
{
  "verificationId": "uuid",
  "ageBracket": "adult",
  "age": 25,
  "isAdult": true,
  "isMinor": false,
  "requiresGuardian": false,
  "cpfStatus": "regular",
  "source": "serpro"
}
```

### SDK JavaScript

```html
<script src="https://sua-instancia.com/sdk.js"></script>
<script>
  const sk = ShieldKid.init({
    endpoint: 'https://sua-instancia.com',
    token: 'sk_xxx',
    mode: 'gate',
    locale: 'pt-BR',
    onVerified: (result) => {
      if (result.isAdult) {
        // Libera acesso
      }
    },
    onMinor: (result) => {
      if (result.requiresGuardian) {
        // Solicita vinculação com responsável
      }
    },
  });

  sk.open('user_123');
</script>
```

### tRPC (TypeScript)

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'shieldkid';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: { authorization: 'Bearer sk_xxx' },
    }),
  ],
});

const result = await client.verify.byCpf.mutate({
  cpf: '123.456.789-00',
  externalUserId: 'user_123',
});
```

---

## Webhooks

O ShieldKid envia webhooks assinados com HMAC-SHA256 para os seguintes eventos:

| Evento | Quando |
|--------|--------|
| `verification.completed` | Verificação de idade concluída |
| `age_bracket_change` | Usuário cruzou faixa etária (ex: fez 18 anos) |
| `parental.link.created` | Vinculação menor-responsável criada |
| `parental.link.approved` | Responsável aprovou vinculação |

Payload de exemplo:
```json
{
  "event": "age_bracket_change",
  "data": {
    "cpfCacheId": "uuid",
    "previousBracket": "teen_16_17",
    "newBracket": "adult"
  },
  "timestamp": "2026-03-19T03:00:00Z"
}
```

Para verificar a assinatura:
```javascript
const crypto = require('crypto');
const signature = req.headers['x-shieldkid-signature'];
const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
const valid = crypto.timingSafeEqual(
  Buffer.from(signature), Buffer.from(expected)
);
```

---

## Arquitetura

```
Sua App → ShieldKid (self-hosted) → Serpro (API CPF)
                ↓
           PostgreSQL
         ┌─────────────────────┐
         │ cpf_cache (eterno)  │
         │ age_verifications   │
         │ audit_logs          │
         │ pgboss (jobs/cron)  │
         └─────────────────────┘
```

Cada deploy é **single-tenant** — sua plataforma roda sua própria instância. Nenhum dado é compartilhado entre deployments.

### Faixas etárias (Lei Felca)

| Faixa | Idade | Regras |
|-------|-------|--------|
| `child` | < 12 | Acesso muito restrito, responsável obrigatório |
| `teen_12_15` | 12-15 | Responsável obrigatório, controle parental ativo |
| `teen_16_17` | 16-17 | Pode ter conta própria, com restrições |
| `adult` | 18+ | Sem restrições |

### Segurança

- CPF **nunca armazenado em texto claro** — somente hash HMAC-SHA256
- Data de nascimento criptografada com **AES-256-GCM**
- Tokens de API são hasheados antes de armazenar
- Webhooks assinados com **HMAC-SHA256**
- Audit logs são append-only (nunca deletados)

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| API | tRPC v11 + REST |
| Banco de dados | PostgreSQL 17 + Drizzle ORM |
| Jobs/Cron | pg-boss (mesmo Postgres) |
| Auth | Better Auth |
| UI | Tailwind CSS v4 + shadcn/ui v4 |
| SDK | Vanilla JS (< 15KB gzipped) |
| Container | Docker + Docker Compose |

---

## Contratando o Serpro

Cada plataforma precisa contratar seu próprio acesso ao Serpro:

1. Acesse [servicos.serpro.gov.br](https://servicos.serpro.gov.br)
2. Contrate a API **Consulta CPF**
3. Obtenha seu `client_id` e `client_secret`
4. Configure no `.env` (ou no dashboard em Configurações)

**Custo:** ~R$0,40 por CPF consultado (com cache eterno, cada CPF é cobrado apenas 1 vez).

---

## Desenvolvimento

```bash
# Setup
pnpm install
cp .env.example .env

# Rodar em modo dev (usa mock do Serpro)
SERPRO_MOCK=true pnpm dev

# Rodar testes
pnpm test

# Build do SDK
pnpm sdk:build

# Gerar migrations
pnpm db:generate

# Aplicar schema direto no banco
pnpm db:push

# Abrir Drizzle Studio
pnpm db:studio
```

---

## Licença

MIT — use, modifique e distribua livremente.
