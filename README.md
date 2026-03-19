# ShieldKid

Open-source age verification & parental control for compliance with Brazil's **Lei Felca** (Lei 15.211/2025 — ECA Digital).

## What it does

- **Age verification via CPF** (Serpro API) — no self-declaration
- **Eternal cache** — one Serpro query per CPF, forever (birthdate doesn't change)
- **Age bracket detection** — child (<12), teen 12-15, teen 16-17, adult (18+)
- **Daily age transition monitoring** — webhooks when users cross age brackets
- **Audit logging** — append-only logs for ANPD compliance
- **JS SDK** — drop-in widget with Shadow DOM isolation
- **REST + tRPC API** — works with any language/framework

## Quick Start

### Option A: Docker Compose (recommended)

```bash
git clone https://github.com/your-org/shieldkid.git
cd shieldkid
cp .env.example .env
# Edit .env with your Serpro credentials and secrets

docker compose -f docker/docker-compose.yml up
```

App runs at `http://localhost:3000`.

### Option B: Local Development

```bash
pnpm install
cp .env.example .env
# Edit .env — set DATABASE_URL to your Postgres instance

pnpm db:push    # Create tables
pnpm dev        # Start dev server
```

### Option C: Vercel + Neon

1. Fork this repo
2. Deploy to Vercel
3. Create a Neon database (free tier)
4. Set environment variables in Vercel dashboard
5. Run `pnpm db:push` against your Neon database

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `HMAC_SECRET` | Yes | Secret for CPF hashing (generate: `openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Yes | Key for birthdate encryption (generate: `openssl rand -hex 32`) |
| `SERPRO_API_URL` | Yes | Serpro API gateway URL |
| `SERPRO_CLIENT_ID` | Yes | Your Serpro client ID |
| `SERPRO_CLIENT_SECRET` | Yes | Your Serpro client secret |
| `BETTER_AUTH_SECRET` | Yes | Dashboard auth secret |
| `SERPRO_MOCK` | No | Set `true` for dev without Serpro credentials |
| `WEBHOOK_URL` | No | URL to receive webhook events |
| `WEBHOOK_SECRET` | No | HMAC secret for webhook signatures |

## API Usage

### REST API

```bash
# Verify a user's age by CPF
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Authorization: Bearer sk_your_token" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "123.456.789-00", "externalUserId": "user_123"}'
```

Response:
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

### JS SDK

```html
<script src="https://your-instance.com/sdk.js"></script>
<script>
  const sk = ShieldKid.init({
    endpoint: 'https://your-instance.com',
    token: 'sk_xxx',
    mode: 'gate',
    onVerified: (result) => console.log(result),
    onMinor: (result) => console.log('Minor:', result),
  });

  sk.open('user_123');
</script>
```

## Architecture

```
Your App → ShieldKid (self-hosted) → Serpro (CPF API)
                ↓
           PostgreSQL
         (cache + jobs + audit)
```

Each deployment is **single-tenant** — your platform runs its own instance. No data sharing between deployments.

## Security

- CPF is **never stored in plaintext** — only HMAC-SHA256 hash
- Birthdate is encrypted with **AES-256-GCM**
- API tokens are hashed before storage
- Webhooks are signed with **HMAC-SHA256**
- Audit logs are append-only

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| API | tRPC v11 + REST adapter |
| Database | PostgreSQL 17 + Drizzle ORM |
| Jobs | pg-boss (runs on same Postgres) |
| Auth | Better Auth |
| UI | Tailwind CSS v4 + shadcn/ui |
| SDK | Vanilla JS (< 15KB gzipped) |

## Serpro Setup

Each platform needs its own Serpro contract:

1. Go to [servicos.serpro.gov.br](https://servicos.serpro.gov.br)
2. Contract the **Consulta CPF** API
3. Get your `client_id` and `client_secret`
4. Add them to your `.env` file

Cost: ~R$0.40 per unique CPF query (cached eternally after first query).

## License

MIT
