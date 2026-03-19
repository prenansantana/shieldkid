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

## Estrutura

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard pages (overview, verifications, settings)
│   ├── api/trpc/[trpc]/          # tRPC handler
│   ├── api/v1/verify/            # REST API endpoint
│   └── api/cron/age-transitions/ # Vercel Cron (serverless fallback)
├── server/
│   ├── db/schema.ts              # Drizzle schema (todas as tabelas)
│   ├── db/index.ts               # DB client (lazy init)
│   ├── trpc/                     # tRPC routers (verify, compliance)
│   ├── services/                 # Serpro, pgboss jobs, webhook, audit
│   └── lib/                      # Crypto (HMAC/AES), age brackets, auth
├── components/                   # React components (shadcn)
└── sdk/                          # JS SDK (vanilla, Shadow DOM)
docker/
├── Dockerfile                    # Multi-stage (deps → build → standalone)
└── docker-compose.yml            # App + Postgres
```

## Arquitetura

- **Single-tenant** — cada plataforma roda sua própria instância
- **Cache eterno** — CPF verificado 1x no Serpro, resultado salvo para sempre (birthDate não muda)
- **CPF nunca em texto claro** — HMAC-SHA256 para hash, AES-256-GCM para birthDate
- **Faixas etárias:** child (<12), teen_12_15 (12-15), teen_16_17 (16-17), adult (18+)
- **pgboss cron diário** — detecta transições de faixa etária e dispara webhooks

## Convenções

- Código em inglês, comentários e UI em português quando voltados ao usuário brasileiro
- Imports com `@/` apontam para `src/`
- Zod v4 usa `import { z } from "zod/v4"`
- DB é lazy (proxy) — nunca falha no build
- Variáveis sensíveis em `.env`, nunca no código
- Audit logs são append-only, nunca deletados
