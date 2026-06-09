# noalanPRO Ops

Private internal app for managing customers, invoices, payments, and bills —
built to keep your books in a QuickBooks-friendly shape.

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** Supabase (Postgres + Auth), shared with the marketing site's project
- **Hosting:** Cloudflare static assets (auto-deploys from GitHub), at `app.noalanpro.com`

## Develop

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

## Environment

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public; row access is gated by RLS) |

## Database

Schema + Row Level Security live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
See [`supabase/README.md`](supabase/README.md) to apply it and create your login user.

## Build

```bash
npm run build   # type-checks then outputs static files to dist/
```
