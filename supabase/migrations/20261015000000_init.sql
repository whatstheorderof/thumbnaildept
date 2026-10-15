-- ════════════════════════════════════════════════════════════════════
-- Thumbnail Department — initial schema
-- UUID primary keys everywhere, timestamps on every record, a
-- human-readable JOB-000001 id on orders, RLS on every table.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── Shared helpers ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Enums ───────────────────────────────────────────────────────────
create type public.order_status as enum (
  'NEW', 'RESEARCHING', 'RESEARCH_COMPLETE', 'CONCEPTING', 'CONCEPTS_READY',
  'GENERATING', 'GENERATIONS_READY', 'REVIEW', 'REVISION', 'APPROVED',
  'READY_TO_DELIVER', 'DELIVERED', 'CANCELLED'
);

create type public.marketplace as enum ('fiverr', 'upwork', 'direct', 'other');

create type public.dna_source as enum ('market', 'client', 'channel', 'creative');

-- ── users ───────────────────────────────────────────────────────────
-- Profile row for each Supabase Auth user (created by trigger on signup).
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'designer' check (role in ('admin', 'designer', 'reviewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── clients ─────────────────────────────────────────────────────────
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  marketplace           public.marketplace not null default 'fiverr',
  marketplace_username  text,
  email                 text,
  channel_url           text,
  brand_colours         text[] not null default '{}',
  preferred_fonts       text[] not null default '{}',
  visual_preferences    text,
  things_to_avoid       text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index clients_marketplace_username_key
  on public.clients (marketplace, lower(marketplace_username)) where marketplace_username is not null;
create index clients_name_idx on public.clients (lower(name));

-- ── channels ────────────────────────────────────────────────────────
create table public.channels (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid references public.clients (id) on delete set null,
  youtube_channel_id      text,
  url                     text not null,
  handle                  text,
  title                   text,
  subscriber_count        bigint,
  video_count             integer,
  median_views            bigint,          -- used for channel-outperformance scoring
  channel_dna             jsonb,           -- persistent Channel DNA (Phase 3)
  locked_characteristics  jsonb not null default '[]'::jsonb,
  last_analysed_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index channels_url_key on public.channels (lower(url));
create index channels_client_idx on public.channels (client_id);

-- ── orders ──────────────────────────────────────────────────────────
create sequence public.order_job_number_seq start 1;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  job_number            bigint not null unique default nextval('public.order_job_number_seq'),
  job_id                text generated always as ('JOB-' || lpad(job_number::text, 6, '0')) stored unique,
  client_id             uuid references public.clients (id) on delete set null,
  channel_id            uuid references public.channels (id) on delete set null,
  marketplace           public.marketplace not null default 'fiverr',
  marketplace_order_id  text,
  video_title           text not null,
  video_description     text,
  channel_url           text,
  requested_text        text,
  category              text,
  auto_detect_category  boolean not null default false,
  detected_category     text,
  category_confidence   numeric(4, 3),
  client_notes          text,
  things_to_avoid       text,
  deadline              timestamptz,
  status                public.order_status not null default 'NEW',
  status_changed_at     timestamptz not null default now(),
  sale_price            numeric(10, 2) not null default 20.00,
  currency              text not null default 'GBP',
  marketplace_fee       numeric(10, 2),
  assigned_to           uuid references public.users (id) on delete set null,
  created_by            uuid references public.users (id) on delete set null,
  approved_by           uuid references public.users (id) on delete set null,
  approved_at           timestamptz,
  started_at            timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter sequence public.order_job_number_seq owned by public.orders.job_number;
create unique index orders_marketplace_order_key
  on public.orders (marketplace, marketplace_order_id) where marketplace_order_id is not null;
create index orders_status_idx on public.orders (status);
create index orders_client_idx on public.orders (client_id);
create index orders_deadline_idx on public.orders (deadline);

-- ── order_assets ────────────────────────────────────────────────────
-- Client-supplied production material. Always tied to a job and/or client.
create table public.order_assets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete cascade,
  kind            text not null default 'client_asset'
                    check (kind in ('client_asset', 'face_photo', 'logo', 'font', 'brand', 'other')),
  is_approved_face boolean not null default false,
  storage_bucket  text not null default 'order-assets',
  storage_path    text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  width           integer,
  height          integer,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint order_assets_owner check (order_id is not null or client_id is not null)
);
create index order_assets_order_idx on public.order_assets (order_id);
create index order_assets_client_idx on public.order_assets (client_id);

-- ── client_references ───────────────────────────────────────────────
-- References the client explicitly supplied (uploads or pasted URLs).
create table public.client_references (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  source        text not null check (source in ('upload', 'url')),
  url           text,
  storage_bucket text default 'order-assets',
  storage_path  text,
  file_name     text,
  mime_type     text,
  note          text,
  analysis      jsonb,              -- Client DNA input (Phase 3)
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint client_references_has_content check (url is not null or storage_path is not null)
);
create index client_references_order_idx on public.client_references (order_id);

-- ── research_runs ───────────────────────────────────────────────────
create table public.research_runs (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references public.orders (id) on delete cascade,  -- null for reference hunts
  kind                text not null default 'order' check (kind in ('order', 'reference_hunt', 'trend_refresh')),
  topic               text,
  category            text,
  slug                text,
  queries             jsonb not null default '[]'::jsonb,
  params              jsonb not null default '{}'::jsonb,
  scoring_weights     jsonb,
  status              text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  error               text,
  source              text not null default 'live' check (source in ('live', 'mock', 'seed')),
  video_count         integer not null default 0,
  storage_prefix      text,
  contact_sheet_path  text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index research_runs_order_idx on public.research_runs (order_id, created_at desc);
create index research_runs_kind_idx on public.research_runs (kind, category);

-- ── youtube_references ──────────────────────────────────────────────
-- Market references. Analysis/inspiration only — never production artwork.
create table public.youtube_references (
  id                    uuid primary key default gen_random_uuid(),
  research_run_id       uuid not null references public.research_runs (id) on delete cascade,
  video_id              text not null,
  title                 text not null,
  description           text,
  channel_id            text,
  channel_title         text,
  channel_subscribers   bigint,
  published_at          timestamptz,
  view_count            bigint,
  like_count            bigint,
  comment_count         bigint,
  duration              text,
  thumbnail_url         text,
  stored_image_path     text,
  matched_query         text,
  category              text,
  sub_category          text,
  -- metrics
  age_days              numeric(10, 2),
  views_per_day         numeric(14, 2),
  -- component scores, each 0–100; null = not yet available
  velocity_score        numeric(6, 2),
  recency_score         numeric(6, 2),
  outperformance_score  numeric(6, 2),
  relevance_score       numeric(6, 2),
  novelty_score         numeric(6, 2),
  reference_score       numeric(6, 2),
  rank                  integer,
  performance_type      text,           -- breakout | steady | evergreen | small-channel-winner
  -- curation
  included              boolean not null default false,
  excluded              boolean not null default false,
  favourite             boolean not null default false,
  locked                boolean not null default false,
  tags                  text[] not null default '{}',
  analysis              jsonb,          -- per-thumbnail vision analysis (Phase 3)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (research_run_id, video_id)
);
create index youtube_references_run_idx on public.youtube_references (research_run_id, reference_score desc);
create index youtube_references_tags_idx on public.youtube_references using gin (tags);

-- ── trend_dna ───────────────────────────────────────────────────────
create table public.trend_dna (
  id                        uuid primary key default gen_random_uuid(),
  research_run_id           uuid references public.research_runs (id) on delete cascade,
  order_id                  uuid references public.orders (id) on delete cascade,
  channel_id                uuid references public.channels (id) on delete cascade,
  source                    public.dna_source not null default 'market',
  category                  text,
  reference_count           integer not null default 0,
  attributes                jsonb not null default '{}'::jsonb,
  common_patterns           jsonb not null default '[]'::jsonb,
  emerging_patterns         jsonb not null default '[]'::jsonb,
  declining_patterns        jsonb not null default '[]'::jsonb,
  visual_opportunities      jsonb not null default '[]'::jsonb,
  overused_conventions      jsonb not null default '[]'::jsonb,
  contrarian_opportunities  jsonb not null default '[]'::jsonb,
  summary                   text,
  model                     text,
  source_mode               text not null default 'live' check (source_mode in ('live', 'mock', 'seed')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index trend_dna_order_idx on public.trend_dna (order_id, source);
create index trend_dna_category_idx on public.trend_dna (category, created_at desc);

-- ── creative_briefs (Creative DNA) ──────────────────────────────────
create table public.creative_briefs (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  market_dna_id    uuid references public.trend_dna (id) on delete set null,
  client_dna_id    uuid references public.trend_dna (id) on delete set null,
  channel_dna_id   uuid references public.trend_dna (id) on delete set null,
  preserve         jsonb not null default '[]'::jsonb,
  adopt            jsonb not null default '[]'::jsonb,
  avoid            jsonb not null default '[]'::jsonb,
  differentiate    jsonb not null default '[]'::jsonb,
  summary          text,
  model            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index creative_briefs_order_idx on public.creative_briefs (order_id, created_at desc);

-- ── style_patterns ──────────────────────────────────────────────────
create table public.style_patterns (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  slug                 text not null unique,
  description          text,
  subject_position     text,
  primary_object       text,
  object_treatment     text,
  background           text,
  text_treatment       text,
  curiosity_mechanism  text,
  emotional_mechanism  text,
  layout               jsonb not null default '{}'::jsonb,
  categories           text[] not null default '{}',
  tags                 text[] not null default '{}',
  created_by           uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── concepts ────────────────────────────────────────────────────────
create table public.concepts (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  creative_brief_id    uuid references public.creative_briefs (id) on delete set null,
  style_pattern_id     uuid references public.style_patterns (id) on delete set null,
  slot                 text not null check (slot in ('A', 'B', 'C')),
  strategy             text not null check (strategy in ('category_leader', 'current_trend', 'contrarian')),
  name                 text not null,
  visual_hook          text,
  viewer_question      text,
  composition          text,
  foreground           text,
  background           text,
  human_subject        text,
  object               text,
  expression           text,
  colour_strategy      text,
  text_recommendation  text,
  generation_prompt    text,
  negative_prompt      text,
  reference_rationale  text,
  why_it_may_work      text,
  risk                 text,
  status               text not null default 'proposed' check (status in ('proposed', 'selected', 'rejected')),
  source_mode          text not null default 'live' check (source_mode in ('live', 'mock', 'seed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index concepts_order_idx on public.concepts (order_id, slot);

-- ── generations ─────────────────────────────────────────────────────
create table public.generations (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  concept_id              uuid references public.concepts (id) on delete set null,
  provider                text not null default 'leonardo',
  provider_generation_id  text,
  model                   text,
  prompt                  text not null,
  negative_prompt         text,
  settings                jsonb not null default '{}'::jsonb,
  num_images              integer not null default 4,
  status                  text not null default 'queued' check (status in ('queued', 'pending', 'complete', 'failed')),
  cost                    numeric(12, 6),
  cost_currency           text default 'USD',
  error                   text,
  source_mode             text not null default 'live' check (source_mode in ('live', 'mock', 'seed')),
  requested_at            timestamptz,
  completed_at            timestamptz,
  generation_time_ms      integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index generations_provider_id_key on public.generations (provider, provider_generation_id)
  where provider_generation_id is not null;
create index generations_order_idx on public.generations (order_id);

-- ── generation_images ───────────────────────────────────────────────
create table public.generation_images (
  id                 uuid primary key default gen_random_uuid(),
  generation_id      uuid not null references public.generations (id) on delete cascade,
  provider_image_id  text,
  source_url         text,
  storage_bucket     text default 'generations',
  storage_path       text,
  width              integer,
  height             integer,
  nsfw               boolean not null default false,
  created_at         timestamptz not null default now()
);
create index generation_images_generation_idx on public.generation_images (generation_id);

-- ── compositions ────────────────────────────────────────────────────
-- A 1280×720 layered thumbnail (editable layers + rendered output).
create table public.compositions (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  concept_id           uuid references public.concepts (id) on delete set null,
  generation_image_id  uuid references public.generation_images (id) on delete set null,
  parent_id            uuid references public.compositions (id) on delete set null,
  version              integer not null default 1,
  layers               jsonb not null default '[]'::jsonb,
  render_path          text,
  preview_paths        jsonb not null default '{}'::jsonb,
  critic_scores        jsonb,
  critic_total         numeric(5, 2),
  critic_verdict       text check (critic_verdict in ('reject', 'marginal', 'review')),
  critic_summary       text,
  multisize            jsonb,
  is_candidate         boolean not null default true,
  status               text not null default 'draft' check (status in ('draft', 'rendered', 'scored', 'approved', 'rejected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index compositions_order_idx on public.compositions (order_id, critic_total desc nulls last);

-- ── reviews ─────────────────────────────────────────────────────────
create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  composition_id    uuid references public.compositions (id) on delete set null,
  reviewer_id       uuid references public.users (id) on delete set null,
  decision          text not null check (decision in ('approve', 'edit', 'regenerate', 'reject')),
  is_winner         boolean not null default false,
  notes             text,
  duration_seconds  integer,
  created_at        timestamptz not null default now()
);
create index reviews_order_idx on public.reviews (order_id, created_at desc);

-- ── revisions ───────────────────────────────────────────────────────
create table public.revisions (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete cascade,
  revision_number        integer not null,
  raw_feedback           text not null,
  structured             jsonb,          -- { preserve: [], change: [], remove: [], add: [] }
  base_composition_id    uuid references public.compositions (id) on delete set null,
  result_composition_id  uuid references public.compositions (id) on delete set null,
  status                 text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  source_mode            text not null default 'live' check (source_mode in ('live', 'mock', 'seed')),
  created_by             uuid references public.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  resolved_at            timestamptz,
  unique (order_id, revision_number)
);

-- ── deliverables ────────────────────────────────────────────────────
create table public.deliverables (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  composition_id    uuid references public.compositions (id) on delete set null,
  kind              text not null check (kind in ('final_jpg', 'final_png', 'preview', 'mobile_preview', 'feed_preview')),
  file_name         text not null,
  storage_bucket    text not null default 'deliverables',
  storage_path      text not null,
  delivery_message  text,
  created_at        timestamptz not null default now()
);
create index deliverables_order_idx on public.deliverables (order_id);

-- ── performance_results ─────────────────────────────────────────────
create table public.performance_results (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid references public.orders (id) on delete cascade,
  composition_id     uuid references public.compositions (id) on delete set null,
  concept_id         uuid references public.concepts (id) on delete set null,
  style_pattern_id   uuid references public.style_patterns (id) on delete set null,
  creative_brief_id  uuid references public.creative_briefs (id) on delete set null,
  video_url          text,
  published_at       timestamptz,
  impressions        bigint,
  ctr                numeric(6, 3),   -- percent, e.g. 6.4
  views              bigint,
  watch_time_hours   numeric(12, 2),
  ab_test_winner     boolean,
  notes              text,
  recorded_by        uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index performance_results_order_idx on public.performance_results (order_id);

-- ── automation_events ───────────────────────────────────────────────
-- Every inbound automation call and outgoing webhook, for auditing/retries.
create table public.automation_events (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references public.orders (id) on delete set null,
  direction        text not null check (direction in ('inbound', 'outgoing')),
  event_type       text not null,
  payload          jsonb not null default '{}'::jsonb,
  target_url       text,
  status           text not null default 'pending'
                     check (status in ('pending', 'sent', 'failed', 'received', 'skipped', 'rejected')),
  response_status  integer,
  error            text,
  attempts         integer not null default 0,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index automation_events_order_idx on public.automation_events (order_id, created_at desc);
create index automation_events_type_idx on public.automation_events (event_type, created_at desc);

-- ── Supporting tables (beyond the spec list) ────────────────────────

-- Human-readable job activity timeline.
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references public.orders (id) on delete cascade,
  actor_type  text not null default 'user' check (actor_type in ('user', 'automation', 'system')),
  actor_id    uuid references public.users (id) on delete set null,
  action      text not null,
  message     text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_log_order_idx on public.activity_log (order_id, created_at desc);

-- Per-job API expenses.
create table public.cost_entries (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders (id) on delete cascade,
  research_run_id uuid references public.research_runs (id) on delete set null,
  provider     text not null check (provider in ('anthropic', 'leonardo', 'youtube', 'storage', 'other')),
  operation    text not null,
  units        jsonb not null default '{}'::jsonb,
  cost         numeric(12, 6) not null default 0,
  currency     text not null default 'USD',
  source_mode  text not null default 'live' check (source_mode in ('live', 'mock', 'seed')),
  created_at   timestamptz not null default now()
);
create index cost_entries_order_idx on public.cost_entries (order_id);

-- Configurable settings (scoring weights, critic thresholds, pricing …).
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- ── updated_at triggers ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'clients', 'channels', 'orders', 'research_runs', 'youtube_references',
    'trend_dna', 'creative_briefs', 'style_patterns', 'concepts', 'generations',
    'compositions', 'revisions', 'performance_results', 'app_settings'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Track when status changes.
create or replace function public.orders_status_changed()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end $$;
create trigger orders_status_changed before update on public.orders
  for each row execute function public.orders_status_changed();

-- ── Views ───────────────────────────────────────────────────────────
create view public.client_stats with (security_invoker = true) as
select
  c.id as client_id,
  count(distinct o.id)                                                as job_count,
  count(distinct o.id) filter (where o.status = 'DELIVERED')          as delivered_count,
  coalesce(round(avg(rc.revision_count)::numeric, 2), 0)              as avg_revision_count,
  max(o.created_at)                                                   as last_order_at
from public.clients c
left join public.orders o on o.client_id = c.id
left join lateral (
  select count(*) as revision_count from public.revisions r where r.order_id = o.id
) rc on o.id is not null
group by c.id;

create view public.order_costs with (security_invoker = true) as
select
  order_id,
  sum(cost) filter (where provider = 'anthropic') as claude_cost,
  sum(cost) filter (where provider = 'leonardo')  as leonardo_cost,
  sum(cost) filter (where provider = 'storage')   as storage_cost,
  sum(cost) filter (where provider not in ('anthropic', 'leonardo', 'storage')) as other_cost,
  sum(cost) as total_cost,
  max(currency) as currency
from public.cost_entries
where order_id is not null
group by order_id;

-- ── Row level security ──────────────────────────────────────────────
-- Internal tool: any signed-in team member may read/write. The service
-- role (API routes, webhooks, scripts) bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'clients', 'channels', 'orders', 'order_assets', 'client_references',
    'research_runs', 'youtube_references', 'trend_dna', 'creative_briefs', 'concepts',
    'generations', 'generation_images', 'compositions', 'reviews', 'revisions',
    'deliverables', 'style_patterns', 'performance_results', 'automation_events',
    'activity_log', 'cost_entries', 'app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "team members have full access" on public.%I
                    for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ── Storage ─────────────────────────────────────────────────────────
-- order-assets: client photos, logos, client-supplied references
-- research:     downloaded market reference thumbnails + contact sheets
--               (analysis only — never reusable artwork)
-- generations:  stored copies of AI generations
-- deliverables: final exports
insert into storage.buckets (id, name, public)
values
  ('order-assets', 'order-assets', false),
  ('research',     'research',     false),
  ('generations',  'generations',  false),
  ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

create policy "team members read thumbnail department buckets" on storage.objects
  for select to authenticated
  using (bucket_id in ('order-assets', 'research', 'generations', 'deliverables'));

create policy "team members write thumbnail department buckets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('order-assets', 'research', 'generations', 'deliverables'));

create policy "team members update thumbnail department buckets" on storage.objects
  for update to authenticated
  using (bucket_id in ('order-assets', 'research', 'generations', 'deliverables'));

create policy "team members delete thumbnail department buckets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('order-assets', 'research', 'generations', 'deliverables'));
