# ShieldKid

Ferramenta open-source de verificação de idade e controle parental para compliance com a **Lei Felca** (Lei 15.211/2025 — ECA Digital).

## Comandos

```bash
pnpm dev          # Dev server (Next.js + Turbopack)
pnpm build        # Build de produção
pnpm lint         # ESLint
pnpm db:push      # Aplicar schema no banco (Drizzle)
pnpm db:generate  # Gerar migrations (Drizzle)
pnpm db:migrate   # Rodar migrations
pnpm db:studio    # Drizzle Studio (UI pro banco)
pnpm test         # Testes unitários (Vitest)
pnpm test:e2e     # Testes E2E (Playwright)
pnpm sdk:build    # Build do SDK JS (tsup → dist/sdk/)
```

## Stack

- **Next.js 16** (App Router) — framework fullstack
- **tRPC v11** — API type-safe
- **Drizzle ORM** — ORM leve, type-safe
- **PostgreSQL 17** — banco de dados
- **pg-boss** — jobs e cron sobre o mesmo Postgres
- **Better Auth** — auth do dashboard admin
- **Tailwind CSS v4 + shadcn/ui v4** — UI
- **Zod v4** — validação de schemas
- **InsightFace (buffalo_l)** — estimativa de idade por IA (microserviço Python)

## Estrutura

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard pages (overview, verifications, webhooks, settings)
│   ├── (auth)/                   # Login page
│   ├── setup/                    # Onboarding wizard (first access)
│   ├── mock/                     # Páginas de teste (sdk, face)
│   ├── api/trpc/[trpc]/          # tRPC handler
│   ├── api/v1/verify/            # REST API — verificação unificada (JSON ou multipart)
│   ├── api/v1/users/             # REST API — status do usuário
│   ├── api/v1/age-ai-proxy/      # Proxy para o serviço de IA (demo)
│   ├── api/dashboard/            # Dashboard APIs (settings, tokens, jobs)
│   ├── api/mock/webhook/         # Mock webhook receiver (dev/test)
│   └── api/cron/age-transitions/ # Vercel Cron (serverless fallback)
├── server/
│   ├── db/schema.ts              # Drizzle schema (todas as tabelas)
│   ├── db/index.ts               # DB client (lazy init)
│   ├── trpc/                     # tRPC routers (verify, compliance)
│   ├── services/                 # Serpro, age-ai, pgboss jobs, webhook, audit
│   └── lib/                      # Crypto (HMAC/AES), age brackets, auth
├── components/                   # React components (shadcn)
└── sdk/                          # JS SDK (vanilla, Shadow DOM, câmera)
services/
└── age-ai/                       # Microserviço Python (InsightFace)
    ├── main.py                   # FastAPI app
    ├── Dockerfile                # python:3.12-slim + InsightFace + ONNX
    └── requirements.txt
docker-compose.yml                # App + Postgres + age-ai
```

## Arquitetura

- **Single-tenant** — cada plataforma roda sua própria instância
- **Serpro opcional** — sem Serpro, usa apenas IA para estimar idade
- **3 métodos de verificação:** `face` (selfie/IA), `cpf` (Serpro), `cpf+face` (ambos)
- **Cache eterno** — CPF verificado 1x no Serpro, resultado salvo para sempre (birthDate não muda)
- **CPF nunca em texto claro** — HMAC-SHA256 para hash, AES-256-GCM para birthDate
- **Faixas etárias:** child (<12), teen_12_15 (12-15), teen_16_17 (16-17), adult (18+)
- **Cruzamento IA + CPF** — margem de tolerância dinâmica, detecta fraude
- **pgboss** — webhooks com retry (3x backoff exponencial), cron diário de transição de faixa
- **Webhooks configuráveis via dashboard** — URL, secret e eventos (não por env vars)
- **SDK com câmera** — widget abre webcam, captura selfie, envia para verificação

## Fluxo de verificação

```
POST /api/v1/verify (JSON ou multipart)
  ├── Imagem presente? → exige sessionId (obtido via POST /api/v1/verify/session)
  ├── CPF fornecido + Serpro configurado? → cache → Serpro → idade verificada
  ├── Imagem fornecida + age-ai disponível? → IA estima idade
  └── Resultado:
      ├── Serpro + IA → cruza idades, retorna action (allow/flag/block)
      ├── Só Serpro   → source: "serpro" ou "cache"
      ├── Só IA       → source: "ai"
      └── Nenhum      → erro 400
```

## Proteção de sessão (anti-fraude)

- Imagens só são aceitas com `sessionId` válido (HMAC-signed, 2 min TTL, single-use)
- O SDK obtém a sessão automaticamente ao abrir a câmera
- Impede que chamem a API diretamente com uma foto qualquer da internet
- CPF puro (sem imagem) não exige sessão

## pgboss (jobs e webhooks)

- Inicializado via `src/instrumentation.ts` (Next.js instrumentation hook)
- Queues: `webhook-dispatch` (retry 3x, backoff 10s), `age-check-transitions` (cron `0 3 * * *`)
- pgboss v10+ exige `createQueue()` antes de `work()` — nomes não podem ter `:`
- Em serverless (Vercel), pgboss não roda — usar Vercel Cron + `dispatchWebhook()` direto
- Jobs concluídos/falhados são removidos após 60s (retenção curta)

## Convenções

- Código em inglês, comentários e UI em português quando voltados ao usuário brasileiro
- Imports com `@/` apontam para `src/`
- Zod v4 usa `import { z } from "zod/v4"`
- DB é lazy (proxy) — nunca falha no build
- Variáveis sensíveis em `.env`, nunca no código
- Audit logs são append-only, nunca deletados
- `verification_source` enum: `"serpro"`, `"cache"`, `"ai"`
