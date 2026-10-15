# Thumbnail Department

Internal production tool for a research-led YouTube thumbnail service (£20 marketplace orders). Every job starts by researching what's breaking out in the client's category right now, rather than starting from a generic AI prompt. A human approves every order before it's delivered.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui-style components · Supabase (Postgres, Auth, Storage) · YouTube Data API · Claude · Leonardo · Sharp · Vercel

---

## Quick start (local)

Needs Node 20+ and Docker (for local Supabase).

```bash
npm install
cp .env.example .env.local
npx supabase start          # starts Postgres/Auth/Storage, applies migrations + seed
```

`supabase start` prints an **API URL**, an **anon key** and a **service_role key**. Put them in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
AUTOMATION_API_KEY=any-long-random-string
```

```bash
npm run dev
```

Open http://localhost:3000 and sign in as **dev@thumbnaildept.local / thumbnaildept-dev** (seed user, local only).

With no YouTube, Anthropic or Leonardo keys set, those integrations run on **development mocks**. A banner says so, and everything they produce is labelled *Dev mock*. Add the keys to go live. You don't need to change any code.

`npx supabase db reset` rebuilds the database from the migration and seed at any time.

## Deploying (Vercel + hosted Supabase)

1. Create a Supabase project. Run `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply the schema. Don't run `seed.sql` in production: it creates the dev user.
2. Create real users under Supabase → Authentication → Users. Sign-up is internal only; there's no public sign-up page.
3. Import the GitHub repo into Vercel and set every variable from `.env.example` in Project → Settings → Environment Variables.
4. In Supabase → Authentication → URL configuration, set the Site URL to your Vercel domain.
5. In Leonardo, set the webhook URL to `https://<domain>/api/webhooks/leonardo` and the webhook API key to the same value as `LEONARDO_WEBHOOK_SECRET`.

## What's built (Phase 1, plus the research core of Phase 2)

| Area | Status |
|---|---|
| Database: all 22 spec tables plus `activity_log`, `cost_entries`, `app_settings`; UUIDs, timestamps, `JOB-000001` ids, RLS, storage buckets | ✅ |
| Auth (Supabase email/password), protected routes, session refresh in `src/proxy.ts` | ✅ |
| Dashboard: pipeline counts, due next, activity, month revenue/contribution | ✅ |
| Orders: list, search and filter; **+ NEW THUMBNAIL JOB** form with every spec field, multiple uploads, reference URLs, category auto-detect | ✅ |
| Order page: production-state bar, status controls, all 11 tabs | ✅ (later-phase tabs show data when it exists, otherwise a labelled empty state) |
| Status machine with enforced transitions; **only a signed-in human can approve** | ✅ |
| Uploads: browser → Supabase Storage via signed URLs, always scoped to a job/client | ✅ |
| Clients: profiles, brand colours/fonts, approved face photos, saved assets, previous jobs, average revisions | ✅ |
| Channels: profiles and locked characteristics | ✅ (Channel DNA analysis is Phase 3) |
| Research: Claude → queries → YouTube (date-filtered) → stats → scoring → selection → thumbnail download | ✅ |
| Reference scoring: configurable weights, every component stored separately, missing components reweighted | ✅ |
| Research UI: grid, 7 filters, include/exclude/favourite/lock | ✅ |
| Revisions: Claude splits feedback into PRESERVE / CHANGE / REMOVE / ADD, with full history | ✅ |
| Settings: scoring weights, critic thresholds, pricing/fees, pipeline sizes, integration status | ✅ |
| Cost tracking per job and margin estimate | ✅ |
| Automation API, outgoing webhooks, Leonardo webhook | ✅ |
| Claude Code commands | ✅ (`generate` reports "Phase 4") |
| Reference Library, Patterns, Analytics, performance entry | ✅ basic versions working on real data |
| Seed data: gaming, documentary, finance jobs at different stages | ✅ |

See **docs/ROADMAP.md** for Phases 2–7.

## Automation API (Make.com)

Every request sends `Authorization: Bearer $AUTOMATION_API_KEY` (or `x-api-key`). Jobs can be addressed by UUID or `JOB-000123`.

```bash
# create a job (clientName finds or creates a returning client)
curl -X POST $APP/api/orders -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d '{
  "marketplace": "fiverr", "marketplaceOrderId": "FO123", "clientName": "Rory Plays", "clientUsername": "roryplaysmc",
  "videoTitle": "I Survived 100 Days…", "channelUrl": "https://youtube.com/@roryplaysmc",
  "autoDetectCategory": true, "referenceUrls": ["https://youtube.com/watch?v=…"], "deadline": "2026-10-20T18:00:00Z"
}'

curl -X POST $APP/api/orders/JOB-000004/start      -H "Authorization: Bearer $KEY"   # run research
curl -X POST $APP/api/orders/JOB-000004/revision   -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d '{"feedback":"…"}'
curl -X POST $APP/api/orders/JOB-000004/transition -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d '{"to":"DELIVERED"}'
curl $APP/api/orders?status=REVIEW -H "Authorization: Bearer $KEY"
```

Automation can never move a job to `APPROVED`; that returns 409.

**Outgoing webhooks:** set `OUTGOING_WEBHOOK_URL`. Each event is POSTed as `{ event, orderId, data, sentAt }` with an `x-thumbnaildept-signature: sha256=<hmac>` header signed with `OUTGOING_WEBHOOK_SECRET`. Events: `research.complete`, `concepts.complete`, `generation.complete`, `review.required`, `job.approved`, `delivery.ready`. Every event, sent or not, is logged in `automation_events` and appears on the job's Activity tab.

## Claude Code

```
/thumbnail JOB-000124        advance the job to its next automated stage
/research JOB-000124
/reference-hunt "true crime documentary" --category "True Crime" --days 90
/review JOB-000124           top candidates and critic scores
/generate JOB-000124         (Phase 4)
/job-status JOB-000124
```

These commands wrap `npm run td -- <command> …` (`scripts/td.ts`), which calls the same services as the web UI.

## Code map

```
src/
  app/(app)/…            pages (server components) + server actions per section
  app/api/…              automation endpoints, Leonardo webhook, health
  proxy.ts               auth session refresh / route protection (Next 16 "proxy")
  lib/domain/            status machine, categories, actor
  lib/services/          business logic — orders, clients, uploads, research, revisions,
                         costs, settings, automation, generations (UI, API and CLI all call these)
  lib/adapters/          youtube / claude / leonardo — live implementation + labelled dev mock
  lib/supabase/          server (user session), admin (service role), browser clients
  components/ui/         shadcn-style primitives
  components/app|order/  app shell, thumbnails, order tabs
supabase/migrations/     schema
supabase/seed.sql        dev seed
scripts/td.ts            CLI
.claude/commands/        Claude Code slash commands
```

**Rights:** client uploads and supplied references stay tied to their job and client. Market reference thumbnails go only to the `research` bucket and are used for analysis. They are never treated as production artwork.
