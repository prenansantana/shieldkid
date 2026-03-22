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

- **Verificação de idade por selfie** (IA) — câmera abre no widget, estima idade por reconhecimento facial
- **Verificação de idade por CPF** (Serpro) — opcional, para quem tem contrato com o Serpro
- **Cruzamento IA + CPF** — se ambos disponíveis, cruza com margem de erro para detectar fraude
- **Cache eterno** — 1 consulta ao Serpro por CPF, para sempre (data de nascimento não muda)
- **Detecção de faixa etária** — criança (<12), adolescente (12-15), jovem (16-17), adulto (18+)
- **Monitoramento diário** — webhooks quando usuários cruzam faixas etárias (ex: faz 18 anos)
- **Logs de auditoria** — append-only para compliance com a ANPD
- **SDK JavaScript com câmera** — widget drop-in com Shadow DOM, abre a câmera e captura selfie
- **API REST + tRPC** — funciona com qualquer linguagem/framework
- **Dashboard** — overview, verificações, configurações

---

## Quick Start

### Docker Compose (recomendado)

```bash
git clone https://github.com/your-org/shieldkid.git
cd shieldkid
cp .env.example .env
# Edite o .env com seus secrets (Serpro é opcional)

docker compose up
```

Pronto! App rodando em `http://localhost:3000`.

No primeiro acesso, o sistema redireciona para `/setup` onde você:
1. Cria a conta de administrador
2. Configura o Serpro (opcional — pode pular e usar apenas IA)
3. Gera os tokens de API (chave pública para o SDK + chave secreta para o servidor)

### Desenvolvimento local

```bash
# Pré-requisitos: Node.js 22+, pnpm, Docker (para Postgres e age-ai)

pnpm install
cp .env.example .env

# Subir Postgres e o serviço de IA
docker compose up -d postgres age-ai

pnpm db:push    # Cria as tabelas
pnpm dev        # Inicia o servidor de desenvolvimento
```

### Vercel + Neon (serverless)

1. Faça fork do repositório
2. Deploy no Vercel
3. Crie um banco no [Neon](https://neon.tech) (free tier: 0.5GB)
4. Configure as variáveis de ambiente no dashboard do Vercel
5. Execute `pnpm db:push` contra seu banco Neon

> **Nota:** No modo serverless, o serviço de IA (age-ai) precisa rodar separadamente (ex: Railway, Fly.io).

---

## Métodos de Verificação

O ShieldKid suporta 3 métodos, configuráveis no SDK:

| Método | Como funciona | Requisitos |
|--------|---------------|------------|
| `face` (padrão) | Abre câmera, tira selfie, IA estima idade | Serviço age-ai rodando |
| `cpf` | Usuário digita CPF, Serpro retorna data de nascimento | Contrato com Serpro |
| `cpf+face` | CPF + selfie, cruza ambos com margem de erro | Ambos os serviços |

### Quando usar cada um?

- **Sem Serpro?** Use `face` — a IA estima a idade pela selfie. Zero custo por verificação.
- **Com Serpro?** Use `cpf` para precisão exata ou `cpf+face` para anti-fraude (detecta criança usando CPF de adulto).

### Cruzamento IA + CPF

Quando ambos estão disponíveis (`cpf+face`), o ShieldKid cruza as idades com margem de tolerância:

| Idade verificada | Tolerância |
|------------------|-----------|
| < 13 anos | ±8 anos |
| 13-17 anos | ±10 anos |
| 18+ anos | ±15 anos |

Se a diferença for maior que a tolerância, a resposta inclui `action: "flag"` ou `action: "block"` (se suspeito de fraude).

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `HMAC_SECRET` | Sim | Secret para hash do CPF (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Sim | Chave para criptografia da data de nascimento (`openssl rand -hex 32`) |
| `BETTER_AUTH_SECRET` | Sim | Secret para autenticação do dashboard |
| `AGE_AI_URL` | Não | URL do serviço de IA (default: `http://localhost:8100`) |
| `SERPRO_API_URL` | Não | URL da API do Serpro |
| `SERPRO_CLIENT_ID` | Não | Seu Client ID do Serpro |
| `SERPRO_CLIENT_SECRET` | Não | Seu Client Secret do Serpro |
| `SERPRO_MOCK` | Não | `true` para usar mock do Serpro em dev |
| `CRON_SECRET` | Não | Secret para autenticar o endpoint de cron (Vercel) |

---

## Tokens de API (Segurança)

O ShieldKid usa dois tipos de token, similar ao modelo do Stripe:

| Tipo | Prefixo | Onde usar | Permissões |
|------|---------|-----------|------------|
| **Pública** | `sk_pub_xxx` | Browser / SDK / client-side | Criar sessões, enviar verificações |
| **Secreta** | `sk_secret_xxx` | Servidor / backend | Acesso completo (ler status, webhooks, tRPC) |

> **Nunca use a chave secreta (`sk_secret_xxx`) em código client-side.** Qualquer pessoa pode extrair tokens do browser via DevTools. A chave pública (`sk_pub_xxx`) é segura para o browser porque só permite criar sessões e enviar verificações — não pode ler resultados nem consultar dados de usuários.

Ambos os tokens são gerados automaticamente no setup. Você pode criar tokens adicionais no dashboard em **Configurações > Tokens**.

---

## Como usar

### 1. SDK JavaScript — HTML puro (script tag)

O widget abre a câmera, captura a selfie, envia pro ShieldKid e retorna o resultado via callback. Tudo isolado em Shadow DOM. Funciona em qualquer site — sem framework, sem build.

```html
<script src="https://sua-instancia.com/sdk.js"></script>
<script>
  const sk = ShieldKid.init({
    endpoint: 'https://sua-instancia.com',
    token: 'sk_pub_xxx',   // chave PÚBLICA — segura no browser
    method: 'face',         // 'face' | 'cpf' | 'cpf+face'
    mode: 'gate',           // 'gate' (não fecha) | 'inline' (permite fechar)
    locale: 'pt-BR',
    onVerified: (result) => {
      console.log(result.ageBracket); // "child" | "teen_12_15" | "teen_16_17" | "adult"
      console.log(result.age);        // 25
      console.log(result.source);     // "ai" | "serpro" | "cache"

      if (result.isAdult) {
        // Libera acesso completo
      }
    },
    onMinor: (result) => {
      if (result.requiresGuardian) {
        // Solicita vinculação com responsável
      }
    },
    onError: (error) => {
      console.error(error.message);
    },
  });

  // Abrir o widget para um usuário
  sk.open('user_123');
</script>
```

### 2. SDK — React

```tsx
'use client'; // necessário no Next.js App Router

import { useEffect } from 'react';
import { ShieldKid } from '@shieldkid/sdk';

interface AgeGateProps {
  userId: string;
  onVerified: (result: any) => void;
}

export function AgeGate({ userId, onVerified }: AgeGateProps) {
  useEffect(() => {
    const sk = ShieldKid.init({
      endpoint: 'https://sua-instancia.com',
      token: 'sk_pub_xxx',  // chave pública
      method: 'face',
      mode: 'gate',
      onVerified,
      onMinor: (result) => {
        // redirecionar para fluxo de responsável
      },
    });

    sk.open(userId);
  }, [userId, onVerified]);

  return null; // o widget abre como modal
}

// Uso:
// <AgeGate userId="user_123" onVerified={(r) => console.log(r)} />
```

### 3. SDK — Vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { ShieldKid } from '@shieldkid/sdk';

const props = defineProps<{
  userId: string;
}>();

const emit = defineEmits<{
  verified: [result: any];
}>();

onMounted(() => {
  const sk = ShieldKid.init({
    endpoint: 'https://sua-instancia.com',
    token: 'sk_pub_xxx',  // chave pública
    method: 'face',
    mode: 'gate',
    onVerified: (result) => emit('verified', result),
  });

  sk.open(props.userId);
});
</script>

<template>
  <!-- o widget abre como modal, não precisa de template -->
  <slot />
</template>

<!-- Uso: <AgeGate userId="user_123" @verified="handleResult" /> -->
```

### 4. SDK — Next.js (client + server)

**Client-side** — componente que abre o widget:
```tsx
'use client';

import { useEffect } from 'react';

export function AgeGate({ userId }: { userId: string }) {
  useEffect(() => {
    // Dynamic import para evitar SSR
    import('@shieldkid/sdk').then(({ ShieldKid }) => {
      const sk = ShieldKid.init({
        endpoint: process.env.NEXT_PUBLIC_SHIELDKID_URL!,
        token: process.env.NEXT_PUBLIC_SHIELDKID_PUB_KEY!,  // sk_pub_xxx
        method: 'face',
        onVerified: async (result) => {
          // Enviar verificationId pro seu backend para validação
          await fetch('/api/verify-callback', {
            method: 'POST',
            body: JSON.stringify({ verificationId: result.verificationId }),
          });
        },
      });
      sk.open(userId);
    });
  }, [userId]);

  return null;
}
```

**Server-side** — consultar status com chave secreta:
```typescript
// app/api/check-user/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  const res = await fetch(
    `${process.env.SHIELDKID_URL}/api/v1/users/${userId}/status`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SHIELDKID_SECRET_KEY}`,  // sk_secret_xxx
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
```

### 5. Node.js / Backend (qualquer linguagem)

Use a API REST diretamente com a chave secreta:

```typescript
// Verificar idade por CPF (server-side)
const res = await fetch('https://sua-instancia.com/api/v1/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer sk_secret_xxx',  // chave secreta — só no servidor
  },
  body: JSON.stringify({
    cpf: '123.456.789-00',
    externalUserId: 'user_123',
  }),
});

// Consultar status do usuário
const status = await fetch(
  'https://sua-instancia.com/api/v1/users/user_123/status',
  { headers: { Authorization: 'Bearer sk_secret_xxx' } }
);
```

### 6. API REST

```bash
# Verificar idade por CPF (JSON) — sem sessão necessária
curl -X POST https://sua-instancia.com/api/v1/verify \
  -H "Authorization: Bearer sk_secret_xxx" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "123.456.789-00", "externalUserId": "user_123"}'
```

> **Selfie via API REST:** o envio de imagens requer um `sessionId` obtido via
> `POST /api/v1/verify/session`. O SDK faz isso automaticamente. Se você estiver
> integrando sem o SDK, veja abaixo:

```bash
# 1. Criar sessão (válida por 2 min, uso único)
SESSION=$(curl -s -X POST https://sua-instancia.com/api/v1/verify/session \
  -H "Authorization: Bearer sk_secret_xxx" | jq -r '.sessionId')

# 2. Verificar idade por selfie (multipart com sessionId)
curl -X POST https://sua-instancia.com/api/v1/verify \
  -H "Authorization: Bearer sk_secret_xxx" \
  -F "externalUserId=user_123" \
  -F "sessionId=$SESSION" \
  -F "image=@selfie.jpg"

# 3. Verificar com CPF + selfie
curl -X POST https://sua-instancia.com/api/v1/verify \
  -H "Authorization: Bearer sk_secret_xxx" \
  -F "externalUserId=user_123" \
  -F "cpf=12345678900" \
  -F "sessionId=$SESSION" \
  -F "image=@selfie.jpg"
```

**Resposta (somente IA):**
```json
{
  "verificationId": "uuid",
  "ageBracket": "adult",
  "age": 25,
  "isAdult": true,
  "isMinor": false,
  "requiresGuardian": false,
  "source": "ai",
  "estimatedAge": 25,
  "confidence": 0.97,
  "processingMs": 18
}
```

**Resposta (CPF + selfie):**
```json
{
  "verificationId": "uuid",
  "ageBracket": "teen_16_17",
  "age": 16,
  "isAdult": false,
  "isMinor": true,
  "requiresGuardian": false,
  "source": "serpro",
  "cpfStatus": "regular",
  "estimatedAge": 17,
  "confidence": 0.94,
  "action": "allow",
  "consistent": true,
  "ageDifference": 1
}
```

### 7. Consultar status de um usuário

> Requer chave secreta (`sk_secret_xxx`). Chaves públicas recebem 403.

```bash
curl https://sua-instancia.com/api/v1/users/user_123/status \
  -H "Authorization: Bearer sk_secret_xxx"
```

```json
{
  "verified": true,
  "externalUserId": "user_123",
  "ageBracket": "teen_16_17",
  "ageAtVerification": 16,
  "source": "ai",
  "requiresGuardian": false,
  "permissions": {
    "canAccessPlatform": true,
    "canMakePurchases": true,
    "canReceiveAds": false,
    "canUseLootBoxes": false,
    "requiresGuardianApproval": false,
    "dataProfilingAllowed": false
  }
}
```

### 8. tRPC (TypeScript)

> Requer chave secreta (`sk_secret_xxx`).

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'shieldkid';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: { authorization: 'Bearer sk_secret_xxx' },
    }),
  ],
});

// Verificar por CPF (requer Serpro configurado)
const result = await client.verify.byCpf.mutate({
  cpf: '123.456.789-00',
  externalUserId: 'user_123',
});
```

---

## Webhooks

O ShieldKid envia webhooks assinados com HMAC-SHA256. Os webhooks são enfileirados via **pgboss** (mesmo Postgres) com **retry automático** — se o envio falhar, tenta novamente até 3 vezes com backoff exponencial (~10s, ~40s, ~90s).

Configure URL, secret e eventos no dashboard em **Configurações**. O histórico de webhooks e status do pgboss são visíveis em **Webhooks** no menu.

### Eventos disponíveis

| Evento | Quando |
|--------|--------|
| `verification.completed` | Verificação de idade concluída |
| `age_bracket_change` | Usuário cruzou faixa etária (cron diário às 03:00 UTC) |

### Payload de exemplo

```json
{
  "event": "verification.completed",
  "data": {
    "verificationId": "uuid",
    "externalUserId": "user_123",
    "ageBracket": "adult",
    "age": 25,
    "source": "ai"
  },
  "timestamp": "2026-03-21T18:30:00Z"
}
```

### Headers

| Header | Descrição |
|--------|-----------|
| `X-ShieldKid-Signature` | HMAC-SHA256 do body com o webhook secret |
| `X-ShieldKid-Event` | Nome do evento (ex: `verification.completed`) |
| `Content-Type` | `application/json` |

### Verificar assinatura

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

### Cron de transição de faixa

O pgboss executa diariamente às 03:00 UTC um job que verifica todos os CPFs em cache. Se algum usuário fez aniversário e cruzou uma faixa etária (ex: fez 12, 16 ou 18 anos), dispara o evento `age_bracket_change`.

Em deployments serverless (Vercel), use o endpoint `GET /api/cron/age-transitions` como Vercel Cron:
```json
{ "crons": [{ "path": "/api/cron/age-transitions", "schedule": "0 3 * * *" }] }
```

---

## Arquitetura

```
Sua App → SDK (câmera) → ShieldKid (self-hosted) → Serpro (opcional)
                               ↓              ↓
                          age-ai (IA)     PostgreSQL
                         (InsightFace)   ┌─────────────────┐
                                         │ cpf_cache        │
                                         │ age_verification  │
                                         │ audit_log         │
                                         │ pgboss (jobs)     │
                                         └─────────────────┘
```

Cada deploy é **single-tenant** — sua plataforma roda sua própria instância. Nenhum dado é compartilhado entre deployments.

### Serviço de IA (age-ai)

Microserviço Python com **InsightFace** (modelo buffalo_l) que estima idade a partir de uma foto facial.

- **MAE:** ~7 anos de margem
- **Latência:** ~15-21ms por imagem (CPU)
- **Sem GPU:** roda com ONNX Runtime em CPU
- **Endpoint:** `POST /analyze` com imagem multipart

O container é definido no `docker-compose.yml` e sobe automaticamente com `docker compose up`.

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
- **Imagens só aceitas via SDK** — o envio de selfies exige um token de sessão (`sessionId`) que:
  - É gerado pelo servidor via `POST /api/v1/verify/session`
  - É assinado com HMAC (não pode ser forjado)
  - Expira em 2 minutos
  - É single-use (não pode ser reutilizado)
  - O SDK obtém a sessão automaticamente ao abrir a câmera

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| API | tRPC v11 + REST |
| Banco de dados | PostgreSQL 17 + Drizzle ORM |
| IA | InsightFace (buffalo_l) + ONNX Runtime |
| Jobs/Cron | pg-boss (mesmo Postgres) |
| Auth | Better Auth |
| UI | Tailwind CSS v4 + shadcn/ui v4 |
| SDK | Vanilla JS com câmera (< 15KB gzipped) |
| Container | Docker + Docker Compose |

---

## Contratando o Serpro (opcional)

O Serpro é **opcional**. Sem ele, o ShieldKid funciona apenas com IA (estimativa por selfie).

Se quiser precisão exata (data de nascimento via CPF):

1. Acesse [servicos.serpro.gov.br](https://servicos.serpro.gov.br)
2. Contrate a API **Consulta CPF**
3. Obtenha seu `client_id` e `client_secret`
4. Configure no `.env` ou no dashboard em Configurações

**Custo:** ~R$0,40 por CPF consultado (com cache eterno, cada CPF é cobrado apenas 1 vez).

---

## Desenvolvimento

```bash
# Setup
pnpm install
cp .env.example .env

# Subir serviços (Postgres + IA)
docker compose up -d postgres age-ai

# Aplicar schema no banco
pnpm db:push

# Rodar em modo dev (usa mock do Serpro)
SERPRO_MOCK=true pnpm dev

# Rodar testes
pnpm test

# Build do SDK
pnpm sdk:build

# Gerar migrations
pnpm db:generate

# Abrir Drizzle Studio
pnpm db:studio
```

### Páginas de teste

| URL | O que faz |
|-----|-----------|
| `/setup` | Onboarding (cria admin, configura Serpro, gera token) |
| `/mock/sdk` | Testa o widget SDK com câmera |
| `/mock/face` | Testa a IA diretamente (sem widget) |
| `/webhooks` | Dashboard de webhooks (histórico, agendamentos pgboss) |

---

## Roadmap

O ShieldKid está em desenvolvimento ativo. Abaixo o que já funciona e o que está planejado.

### Implementado

- [x] Verificação de idade por selfie (IA — InsightFace)
- [x] Verificação de idade por CPF (Serpro — opcional)
- [x] Cruzamento IA + CPF com detecção de fraude
- [x] Cache eterno de CPF (1 consulta = para sempre)
- [x] Proteção de sessão (imagens só aceitas via SDK)
- [x] SDK JavaScript com câmera (Shadow DOM, 3 modos: face/cpf/cpf+face)
- [x] API REST unificada (`POST /api/v1/verify`)
- [x] API de status do usuário (`GET /api/v1/users/:id/status`)
- [x] Dashboard admin (overview, verificações, configurações)
- [x] Gerenciamento de tokens de API (criar, revogar, chave pública vs secreta)
- [x] Onboarding (setup do admin no primeiro acesso)
- [x] Logs de auditoria append-only
- [x] Faixas etárias conforme Lei Felca (child, teen_12_15, teen_16_17, adult)
- [x] Permissões mapeadas por faixa (canAccessPlatform, canMakePurchases, etc.)
- [x] Docker Compose (app + Postgres + age-ai)
- [x] Mock do Serpro para desenvolvimento
- [x] **Webhooks** — pgboss com retry automático (3x backoff), HMAC-SHA256, dashboard de histórico
- [x] **Cron de transição de faixa** — pgboss diário às 03:00 UTC + fallback Vercel Cron

### Em desenvolvimento

- [ ] **Controle parental** — fluxo de vinculação menor ↔ responsável legal (email com link mágico, aprovação, configurações de tempo/conteúdo/compras)

### Planejado

- [ ] **SDK Mobile (React Native)** — widget nativo com câmera para apps iOS/Android
- [ ] **SDK Mobile (Swift/Kotlin)** — SDKs nativos para plataformas que não usam React Native
- [ ] **Relatórios de compliance** — exportação em formato ANPD para fiscalização
- [ ] **Liveness detection** — garantir que a selfie é de uma pessoa real (anti-spoofing)
- [ ] **Documentação interativa** — API docs com OpenAPI/Swagger
- [ ] **Notificações por email** — alertas para admin e responsáveis (Resend ou SMTP)

---

### Contribuindo

Contribuições são bem-vindas! Abra uma issue para discutir a feature antes de enviar um PR.

---

## Licença

MIT — use, modifique e distribua livremente.
