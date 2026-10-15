-- ════════════════════════════════════════════════════════════════════
-- Thumbnail Department — development seed
-- Three demo jobs (gaming, documentary, finance) at different pipeline
-- stages, with plausible references, DNA, concepts and candidates.
-- No real API calls; every generated record is marked source 'seed'.
-- Reference thumbnails have no image URL, so the UI renders labelled
-- placeholder tiles for them.
--
-- Local login:  dev@thumbnaildept.local / thumbnaildept-dev
-- ════════════════════════════════════════════════════════════════════

-- ── Dev user (local only) ───────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@thumbnaildept.local',
  extensions.crypt('thumbnaildept-dev', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Dev Designer"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"dev@thumbnaildept.local"}',
  'email', '00000000-0000-4000-8000-000000000001', now(), now(), now()
);

update public.users set role = 'admin' where id = '00000000-0000-4000-8000-000000000001';

-- ── Settings ────────────────────────────────────────────────────────
insert into public.app_settings (key, value) values
  ('scoring_weights', '{"velocity":35,"recency":25,"outperformance":20,"relevance":10,"novelty":10}'),
  ('critic', '{"rejectBelow":70,"reviewFrom":80,"weights":{"visualClarity":12,"mobileReadability":12,"focalHierarchy":10,"curiosity":12,"titleComplement":10,"categoryRelevance":8,"competitiveDifferentiation":12,"clientFit":8,"artefactQuality":10,"honesty":6}}'),
  ('pricing', '{"defaultSalePrice":20,"currency":"GBP","marketplaceFeePct":{"fiverr":20,"upwork":10,"direct":0,"other":0},"usdToGbp":0.79}'),
  ('generation', '{"candidatesPerConcept":4,"width":1344,"height":768}'),
  ('research', '{"queryCount":8,"maxVideos":60,"publishedWithinDays":180,"autoIncludeTop":16}')
on conflict (key) do update set value = excluded.value;

-- ── Clients ─────────────────────────────────────────────────────────
insert into public.clients (id, name, marketplace, marketplace_username, channel_url, brand_colours, preferred_fonts, visual_preferences, things_to_avoid, notes) values
  ('10000000-0000-4000-8000-000000000001', 'Rory Plays', 'fiverr', 'roryplaysmc',
   'https://www.youtube.com/@roryplaysmc', '{"#7CFF4F","#121212"}', '{"Bebas Neue","Inter Black"}',
   'Big reaction face on the left, bright greens, one bold object.', 'No red arrows. No "INSANE" style text.', 'Returning client — Minecraft survival series.'),
  ('10000000-0000-4000-8000-000000000002', 'Lost Places Collective', 'fiverr', 'lostplacescollective',
   'https://www.youtube.com/@lostplacescollective', '{"#D9CBB0","#1C2A33"}', '{"GT Sectra","Söhne"}',
   'Cinematic, muted, documentary feel. Likes negative space.', 'No faces pulling exaggerated expressions. No neon.', 'Long-form documentary channel, ~180k subs.'),
  ('10000000-0000-4000-8000-000000000003', 'Pennywise with Priya', 'upwork', 'priyafinance',
   'https://www.youtube.com/@pennywisepriya', '{"#FFD23F","#0B3D2E"}', '{"Poppins ExtraBold"}',
   'Clean, friendly, numbers visible. Priya always on camera.', 'Nothing that looks like crypto hype.', null);

-- ── Channels ────────────────────────────────────────────────────────
insert into public.channels (id, client_id, youtube_channel_id, url, handle, title, subscriber_count, video_count, median_views, locked_characteristics) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'UCseedrory0001', 'https://www.youtube.com/@roryplaysmc', '@roryplaysmc', 'Rory Plays', 412000, 286, 160000,
   '[{"label":"Lime-green outline on subject","locked":true},{"label":"Rory face at left third","locked":true}]'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'UCseedlost0002', 'https://www.youtube.com/@lostplacescollective', '@lostplacescollective', 'Lost Places Collective', 181000, 74, 95000,
   '[{"label":"Serif title type when text is used","locked":true}]'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'UCseedpriya003', 'https://www.youtube.com/@pennywisepriya', '@pennywisepriya', 'Pennywise with Priya', 58000, 132, 21000, '[]');

-- ── Style patterns ──────────────────────────────────────────────────
insert into public.style_patterns (id, name, slug, description, subject_position, primary_object, object_treatment, background, text_treatment, curiosity_mechanism, emotional_mechanism, categories, tags, layout) values
  ('a0000000-0000-4000-8000-000000000001', 'SCALE SHOCK', 'scale-shock',
   'A person reacting to an object rendered at an impossible scale.',
   'left 35%', 'right 55%', 'exaggerated scale', 'simplified', 'none',
   'unexpected difference in scale/value', 'awe', '{"Gaming","Lifestyle","Food"}', '{"oversized-object","large-face","no-text"}',
   '{"subject":{"x":0,"w":0.35},"object":{"x":0.45,"w":0.55}}'),
  ('a0000000-0000-4000-8000-000000000002', 'SILENT MYSTERY', 'silent-mystery',
   'A single desolate subject in deep negative space with no text; the image itself poses the question.',
   'none', 'centre-right 40%', 'small, isolated, lit', 'atmospheric, desaturated', 'none',
   'something is missing or wrong in an otherwise quiet scene', 'unease', '{"Documentary","True Crime","Travel"}', '{"no-text","minimal","documentary"}',
   '{"object":{"x":0.55,"w":0.4},"negativeSpace":"left"}'),
  ('a0000000-0000-4000-8000-000000000003', 'FACE + PROOF', 'face-proof',
   'Presenter face beside one oversized piece of evidence (a number, a receipt, a chart).',
   'left 40%', 'right 50%', 'flat, high-contrast, legible', 'solid colour field', '2–3 words max, set as the proof itself',
   'a specific, surprising number', 'trust + surprise', '{"Finance","Business","Education"}', '{"large-face","clean","high-saturation"}',
   '{"subject":{"x":0,"w":0.4},"proof":{"x":0.5,"w":0.5}}'),
  ('a0000000-0000-4000-8000-000000000004', 'BEFORE / AFTER SPLIT', 'before-after-split',
   'Hard vertical split comparing two states of the same subject.',
   'centre seam', 'both halves', 'matched framing either side', 'contrasting palettes per half', 'optional single label per side',
   'how did it get from A to B?', 'aspiration', '{"Fitness","Beauty","Lifestyle","Finance"}', '{"split-screen","before-after"}',
   '{"split":0.5}');

-- ── Orders ──────────────────────────────────────────────────────────
insert into public.orders (id, client_id, channel_id, marketplace, marketplace_order_id, video_title, video_description, channel_url, requested_text, category, auto_detect_category, client_notes, things_to_avoid, deadline, status, sale_price, marketplace_fee, created_by, assigned_to, started_at, created_at) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'fiverr', 'FO1A2B3C4D', 'I Survived 100 Days in Hardcore Minecraft as a Ghost',
   'No hitting, no breaking blocks — only haunting. Can a ghost actually beat hardcore?',
   'https://www.youtube.com/@roryplaysmc', 'GHOST ONLY', 'Gaming', false,
   'Make it feel spooky but still fun. My face should be on it.', 'No red arrows.',
   now() + interval '2 days', 'GENERATIONS_READY', 20.00, 4.00,
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now() - interval '20 hours', now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
   'fiverr', 'FO9Z8Y7X6W', 'The Town That Vanished Overnight',
   'In 1987 an entire mining town in Nevada emptied in a single night. We went to find out why.',
   'https://www.youtube.com/@lostplacescollective', null, 'Documentary', false,
   'We like quiet, eerie images. Text optional.', 'No neon, no shocked faces.',
   now() + interval '1 day', 'REVIEW', 20.00, 4.00,
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days 4 hours'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003',
   'upwork', 'UP-55821', 'I Tracked Every Pound I Spent for a Year',
   'Every coffee, every bill, every impulse buy — 12 months of spending data and what it taught me.',
   'https://www.youtube.com/@pennywisepriya', '£31,402', null, true,
   'Show the total somehow. I can send a photo.', 'Crypto vibes, fake cash piles.',
   now() + interval '3 days', 'RESEARCH_COMPLETE', 20.00, 2.00,
   '00000000-0000-4000-8000-000000000001', null, now() - interval '3 hours', now() - interval '4 hours');

update public.orders set detected_category = 'Finance', category = 'Finance', category_confidence = 0.94
where id = '30000000-0000-4000-8000-000000000003';

-- Client assets (metadata only — no files in the seed bucket)
insert into public.order_assets (order_id, client_id, kind, is_approved_face, storage_path, file_name, mime_type, size_bytes, width, height) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'face_photo', true, 'seed/rory-shocked.png', 'rory-shocked.png', 'image/png', 2480112, 2000, 2400),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'logo', false, 'seed/rory-logo.png', 'rory-logo.png', 'image/png', 84211, 800, 800),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'face_photo', true, 'seed/priya-smile.jpg', 'priya-smile.jpg', 'image/jpeg', 1840003, 3000, 2000);

insert into public.client_references (order_id, client_id, source, url, note) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'url', 'https://www.youtube.com/watch?v=seedref00001', 'Love the glow on this one'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'url', 'https://www.youtube.com/watch?v=seedref00002', 'Our best performer last year');

-- ── Research runs ───────────────────────────────────────────────────
insert into public.research_runs (id, order_id, kind, topic, category, slug, queries, params, scoring_weights, status, source, started_at, completed_at) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'order', 'minecraft hardcore ghost challenge', 'Gaming', 'job-000001-research',
   '["minecraft 100 days hardcore","minecraft but I am a ghost","minecraft challenge can''t break blocks","100 days minecraft new challenge","minecraft haunting challenge","minecraft survival weird rules"]',
   '{"publishedWithinDays":180}', '{"velocity":35,"recency":25,"outperformance":20,"relevance":10,"novelty":10}', 'complete', 'seed', now() - interval '20 hours', now() - interval '19 hours 50 minutes'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'order', 'abandoned town mystery documentary', 'Documentary', 'job-000002-research',
   '["abandoned town documentary","town disappeared overnight","ghost town nevada history","mining town abandoned mystery","the town that vanished","unsolved disappearance town"]',
   '{"publishedWithinDays":365}', '{"velocity":35,"recency":25,"outperformance":20,"relevance":10,"novelty":10}', 'complete', 'seed', now() - interval '2 days', now() - interval '47 hours'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'order', 'tracking spending for a year', 'Finance', 'job-000003-research',
   '["I tracked my spending for a year","how much I spent in a year","spending every pound uk","budget challenge 12 months","what I spent in 2026","money diary year"]',
   '{"publishedWithinDays":180}', '{"velocity":35,"recency":25,"outperformance":20,"relevance":10,"novelty":10}', 'complete', 'seed', now() - interval '3 hours', now() - interval '2 hours 55 minutes');

-- Reference rows: (run, video_id, title, channel, subscribers, views, days_ago, relevance, tags)
with raw (run_id, video_id, title, channel_title, subs, views, days_ago, relevance, tags) as (values
  -- Gaming
  ('40000000-0000-4000-8000-000000000001'::uuid, 'gm00001', 'I Survived 100 Days as a Warden in Hardcore Minecraft', 'Blockwise', 2100000::bigint, 3400000::bigint, 21, 88, '{"large-face","high-saturation","oversized-object"}'::text[]),
  ('40000000-0000-4000-8000-000000000001', 'gm00002', 'Minecraft But I Can''t Touch The Ground', 'Pixel Pete', 640000, 1900000, 9, 72, '{"large-face","chaotic"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00003', '100 Days as a GHOST in Minecraft', 'Haunt Craft', 88000, 1250000, 14, 97, '{"no-text","high-saturation","small-channel"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00004', 'I Spent 100 Days in a Haunted Minecraft World', 'Mossy', 1300000, 2200000, 47, 81, '{"documentary","clean"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00005', 'Minecraft Hardcore but Mobs Are Invisible', 'Kaz Plays', 310000, 980000, 6, 69, '{"split-screen","large-face"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00006', 'Surviving Hardcore with ONE Heart', 'Blockwise', 2100000, 5100000, 120, 58, '{"large-face","high-saturation"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00007', 'Can a Ghost Beat Minecraft?', 'Tiny Ender', 24000, 410000, 11, 95, '{"minimal","no-text","small-channel"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00008', '100 Days Minecraft – Ancient City Only', 'Mossy', 1300000, 1600000, 63, 54, '{"oversized-object","clean"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00009', 'Minecraft but Every Block is Cursed', 'Pixel Pete', 640000, 720000, 28, 61, '{"chaotic","high-saturation"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00010', 'I Became a Phantom for 100 Days', 'Nightloaf', 150000, 860000, 17, 90, '{"large-face","oversized-object"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00011', 'Beating Hardcore Without Breaking Blocks', 'Kaz Plays', 310000, 540000, 33, 84, '{"before-after","clean"}'),
  ('40000000-0000-4000-8000-000000000001', 'gm00012', 'The Scariest 100 Days in Minecraft History', 'Grimstone', 980000, 3900000, 160, 66, '{"chaotic","large-face"}'),
  -- Documentary
  ('40000000-0000-4000-8000-000000000002', 'dc00001', 'The Village That Was Erased From Every Map', 'Fieldnote', 420000, 1800000, 38, 92, '{"documentary","minimal","no-text"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00002', 'Why Everyone Left This Desert Town', 'Atlas Unfolded', 1900000, 2600000, 72, 89, '{"documentary","clean"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00003', 'Inside America''s Loneliest Ghost Town', 'Rust & Road', 95000, 1150000, 26, 86, '{"documentary","no-text","small-channel"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00004', 'The 1,000 People Who Disappeared in One Night', 'Unexplained Archive', 3100000, 6400000, 190, 74, '{"large-face","chaotic"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00005', 'A Town Frozen in 1987', 'Slow Docs', 61000, 690000, 19, 94, '{"minimal","no-text","documentary","small-channel"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00006', 'The Mining Town That Burned For 60 Years', 'Atlas Unfolded', 1900000, 4100000, 240, 70, '{"documentary","high-saturation"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00007', 'Nobody Knows Why This Town Is Empty', 'Fieldnote', 420000, 980000, 12, 91, '{"minimal","documentary"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00008', 'The Last Resident of a Nevada Ghost Town', 'Human Scale', 230000, 760000, 44, 83, '{"large-face","documentary"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00009', 'Abandoned: The Real Story', 'Rust & Road', 95000, 210000, 8, 77, '{"clean"}'),
  ('40000000-0000-4000-8000-000000000002', 'dc00010', 'What Happened in Centralia? (Full Documentary)', 'Deep Archive', 5400000, 12000000, 330, 60, '{"documentary","large-face"}'),
  -- Finance
  ('40000000-0000-4000-8000-000000000003', 'fn00001', 'I Tracked Every Penny for 365 Days', 'Money with Mo', 820000, 1400000, 18, 96, '{"large-face","clean","high-saturation"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00002', 'What I Spent in 2025 (Shocking)', 'Lou Saves', 210000, 520000, 70, 88, '{"large-face","chaotic"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00003', 'My Exact Spending: 12 Months, Every Receipt', 'The Frugal Desk', 34000, 610000, 23, 93, '{"minimal","clean","small-channel"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00004', 'How I Saved £20k on a Normal Salary', 'Money with Mo', 820000, 2900000, 95, 52, '{"large-face","high-saturation"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00005', 'I Spent £0 for 30 Days', 'Lou Saves', 210000, 1100000, 41, 58, '{"large-face","before-after"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00006', 'The Real Cost of Living in London (One Year of Data)', 'City Ledger', 145000, 890000, 15, 82, '{"documentary","clean"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00007', 'Where Does My Money Go?', 'Penny Notes', 12000, 280000, 10, 85, '{"minimal","no-text","small-channel"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00008', 'Budget With Me: Full Year Review', 'The Frugal Desk', 34000, 150000, 120, 79, '{"clean"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00009', 'I Analysed 10 Years of My Bank Statements', 'Data & Dollars', 470000, 1700000, 30, 80, '{"split-screen","clean"}'),
  ('40000000-0000-4000-8000-000000000003', 'fn00010', 'Millionaire Reacts: Your Spending', 'Rich Takes', 2600000, 3200000, 55, 40, '{"large-face","chaotic","high-saturation"}')
),
metrics as (
  select r.*,
    r.views::numeric / greatest(r.days_ago, 1) as vpd,
    least(100, greatest(0, (log(r.views::numeric / greatest(r.days_ago, 1) + 1) - 2) * 25)) as velocity,
    100 * exp(-r.days_ago / 45.0) as recency,
    least(100, greatest(0, 50 + 25 * log(greatest(r.views::numeric / greatest(r.subs * 0.15, 1), 0.01)))) as outperf
  from raw r
)
insert into public.youtube_references (
  research_run_id, video_id, title, channel_id, channel_title, channel_subscribers, published_at, view_count,
  thumbnail_url, matched_query, category, age_days, views_per_day, velocity_score, recency_score,
  outperformance_score, relevance_score, novelty_score, reference_score, performance_type, tags
)
select
  m.run_id, m.video_id, m.title, 'UCseed_' || md5(m.channel_title), m.channel_title, m.subs,
  now() - make_interval(days => m.days_ago), m.views,
  null, null,
  case m.run_id
    when '40000000-0000-4000-8000-000000000001' then 'Gaming'
    when '40000000-0000-4000-8000-000000000002' then 'Documentary'
    else 'Finance' end,
  m.days_ago, round(m.vpd, 2), round(m.velocity, 2), round(m.recency, 2), round(m.outperf, 2), m.relevance, null,
  -- novelty not yet available → redistribute its weight across the other four (35+25+20+10 = 90)
  round((m.velocity * 35 + m.recency * 25 + m.outperf * 20 + m.relevance * 10) / 90.0, 2),
  case
    when m.subs < 100000 and m.outperf >= 80 then 'small-channel-winner'
    when m.days_ago <= 30 and m.vpd >= 30000 then 'breakout'
    when m.days_ago > 120 then 'evergreen'
    else 'steady' end,
  m.tags
from metrics m;

-- rank within run, include the top 8
update public.youtube_references y set rank = r.rn, included = r.rn <= 8
from (
  select id, row_number() over (partition by research_run_id order by reference_score desc) as rn
  from public.youtube_references
) r where r.id = y.id;

update public.youtube_references set favourite = true, locked = true where video_id in ('gm00003', 'dc00005', 'fn00003');
update public.youtube_references set excluded = true, included = false where video_id in ('dc00010', 'fn00010');

update public.research_runs rr set video_count = (select count(*) from public.youtube_references y where y.research_run_id = rr.id);

-- ── Market DNA ──────────────────────────────────────────────────────
insert into public.trend_dna (id, research_run_id, order_id, source, category, reference_count, attributes, common_patterns, emerging_patterns, declining_patterns, visual_opportunities, overused_conventions, contrarian_opportunities, summary, model, source_mode) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'market', 'Gaming', 8,
   '{"faces":{"present":0.75,"avgScale":"large"},"text":{"present":0.38,"avgWords":2.1},"dominantColours":["#7CFF4F","#6A3CFF","#0E0E12"],"saturation":"high","layout":{"splitScreen":0.12,"beforeAfter":0.12}}',
   '["Creator face occupying 30–40% of frame, mouth open","Single transformed character model as the hero object","Glow/outline separating subject from busy world background"]',
   '["Translucent/ghosted character treatments with cool cyan rim light","No-text thumbnails from small channels outperforming","Dark, low-key backgrounds instead of daylight biomes"]',
   '["Red arrows and circles","All-caps three-word titles in the image"]',
   '["Use transparency itself as the hook: the face half-fading","A cool, dark palette would stand apart from the lime/purple feed"]',
   '["Shocked face + giant number","Daylight grass-block backgrounds"]',
   '["Show the world from the ghost''s point of view, no face at all"]',
   'Breakout gaming references lean on a single transformed character and a dark, glowing palette; text is increasingly optional.',
   'seed', 'seed'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'market', 'Documentary', 8,
   '{"faces":{"present":0.25},"text":{"present":0.25,"avgWords":1.4},"dominantColours":["#C9B79C","#24323C","#8A7D6B"],"saturation":"low","negativeSpace":"high"}',
   '["Wide establishing shot of an empty place","Desaturated, filmic grade","One small human-scale detail (a chair, a light, a car) carrying the story"]',
   '["Single lit window or light source in an otherwise dead scene","Map/archival overlays at low opacity"]',
   '["Red-circle annotations","Presenter face in the corner"]',
   '["A frozen moment — a table still laid, a calendar on 1987","Dusk blue palette is under-used in this set"]',
   '["Drone shot of rooftops with big sans-serif title"]',
   '["Extreme close-up of one object instead of the wide town shot"]',
   'Top documentary references are quiet: wide, desaturated and text-light, with one human detail implying a story.',
   'seed', 'seed');

insert into public.trend_dna (id, order_id, channel_id, source, category, reference_count, common_patterns, summary, model, source_mode) values
  ('50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'channel', 'Gaming', 24,
   '["Rory face at left third with lime outline","Bebas Neue in white with black stroke, ≤2 words","High-key, saturated biome backgrounds"]',
   'Rory''s channel is recognisable by the lime outline and left-third face; text is short and condensed.', 'seed', 'seed'),
  ('50000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'channel', 'Documentary', 18,
   '["Muted earth palette","Serif title when text is used","Wide shots with a lot of sky"]',
   'Lost Places keeps a consistent filmic grade and serif type; they avoid faces.', 'seed', 'seed');

-- ── Creative briefs (Creative DNA) ──────────────────────────────────
insert into public.creative_briefs (id, order_id, market_dna_id, channel_dna_id, preserve, adopt, avoid, differentiate, summary, model) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003',
   '["Rory face left third with lime outline","Condensed white type, ≤2 words"]',
   '["Ghosted/translucent treatment with cool rim light","Darker background than usual"]',
   '["Red arrows","Shocked face + big number","Daylight biomes"]',
   '["Make transparency the hook — Rory half-faded into the scene"]',
   'Keep Rory''s signature framing but move into a darker, cooler palette where the ghost effect becomes the story.', 'seed'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000004',
   '["Muted filmic grade","Serif type if text"]',
   '["One lit detail in a dead scene","Dusk-blue palette"]',
   '["Faces","Neon","Red annotations"]',
   '["Frozen-moment close detail (calendar stopped in 1987)"]',
   'Quiet, cinematic, text-optional. The image should ask "what happened here?" by itself.', 'seed');

-- ── Concepts ────────────────────────────────────────────────────────
insert into public.concepts (id, order_id, creative_brief_id, style_pattern_id, slot, strategy, name, visual_hook, viewer_question, composition, foreground, background, human_subject, object, expression, colour_strategy, text_recommendation, generation_prompt, negative_prompt, reference_rationale, why_it_may_work, risk, status, source_mode) values
  ('70000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A', 'category_leader',
   'Ghost Rory vs The Warden', 'Translucent Rory face beside a towering Warden that can''t see him', 'How does a ghost survive this?',
   'Face left 35%, Warden right 55% at exaggerated scale', 'Rory (real photo) with ghosted edges', 'Deep dark cave, cyan rim light', 'Rory — client photo, preserved', 'Warden mob', 'Wide-eyed, half grin',
   'Near-black with cyan/lime accents', '"GHOST ONLY" — 2 words, condensed white', 'Dark Minecraft deep-dark cave interior, enormous Warden mob looming on right side, cyan rim light, volumetric fog, cinematic, empty left third for subject',
   'text, letters, watermark, human face, extra limbs', 'Pattern from gm00001/gm00010: single transformed character + oversized mob', 'Proven category structure; Rory''s face keeps channel recognition', 'Looks like many 100-days thumbnails', 'proposed', 'seed'),
  ('70000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', null, 'B', 'current_trend',
   'Fading Out', 'Rory''s face dissolving into particles on the left, glowing hardcore heart on right', 'Is he dying or becoming a ghost?',
   'Face left 40% dissolving, heart icon right', 'Rory, dissolving edge effect (compositor)', 'Dark gradient, falling particles', 'Rory — client photo', 'Hardcore heart', 'Calm, eerie', 'Cool cyan + single red heart', 'No text', 'Dark atmospheric gradient with drifting cyan soul particles, single glowing Minecraft hardcore heart floating on right, cinematic lighting',
   'text, watermark, face, hands', 'Emerging pattern: no-text small-channel winners (gm00003, gm00007)', 'Rides the no-text trend; strong at mobile size', 'Heart may read as small at 160px', 'proposed', 'seed'),
  ('70000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', null, 'C', 'contrarian',
   'Ghost POV', 'First-person view of a village from above — players below don''t notice you', 'What would you do if no one could see you?',
   'High-angle POV, villagers small in lower third', 'Faint translucent hands at frame edge', 'Night village, warm windows', 'None (Rory logo bottom-right)', 'Village', 'n/a', 'Warm windows vs cold blue night', 'No text', 'High-angle first-person view floating above a Minecraft village at night, warm lit windows, cold blue moonlight, tiny villagers below, faint translucent hands at bottom edge of frame',
   'text, watermark, realistic human', 'Contrarian opportunity from Market DNA', 'Nothing else in the feed looks like this', 'Loses Rory''s face — weaker channel recognition', 'proposed', 'seed'),
  ('70000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', null, 'A', 'category_leader',
   'Main Street, Empty', 'Wide dusk shot down an empty main street, one car door open', 'Why is the door still open?',
   'Rule-of-thirds wide, vanishing point centre-right', 'Open car door', 'Desert ridge, dusk sky', 'None', 'Car with open door', 'n/a', 'Dusk blue with warm sodium streetlight', 'Optional serif: "1987"', 'Wide cinematic shot down an empty 1980s Nevada mining town main street at dusk, single car with driver door open, one sodium streetlight on, desaturated filmic grade',
   'text, people, watermark, modern cars', 'Common pattern: wide empty establishing shot (dc00001, dc00002)', 'Category-native, instantly readable', 'Familiar look', 'proposed', 'seed'),
  ('70000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'B', 'current_trend',
   'One Light On', 'Dead town at night with a single lit window', 'Who is still there?',
   'Wide, small lit window at right third', 'Lit window', 'Dark town silhouette, stars', 'None', 'House with one lit window', 'n/a', 'Near-black blue with one warm point', 'No text', 'Abandoned desert mining town at night, all buildings dark except one small house with a single warm lit window, starry sky, cinematic, quiet',
   'text, people, neon, watermark', 'Emerging pattern: single lit detail in dead scene', 'Very strong curiosity at small sizes', 'Dark images can look muddy on some screens', 'proposed', 'seed'),
  ('70000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', null, 'C', 'contrarian',
   'Frozen Calendar', 'Extreme close-up of a dusty kitchen calendar stuck on October 1987', 'What happened that day?',
   'Tight close-up, calendar fills 70%', 'Calendar page, a circled date', 'Blurred dusty kitchen', 'None', 'Calendar', 'n/a', 'Warm sepia with one red circled date', 'No text (the calendar is the text)', 'Extreme close-up of a dusty paper wall calendar showing October 1987 with one date circled in faded red pen, abandoned kitchen softly blurred behind, shallow depth of field',
   'legible brand names, watermark, people', 'Contrarian: close object instead of wide shot', 'Stands completely apart from wide-shot feed', 'The calendar text must be rendered by the compositor for legibility', 'proposed', 'seed');

-- ── Generations + images ────────────────────────────────────────────
insert into public.generations (id, order_id, concept_id, provider, provider_generation_id, model, prompt, negative_prompt, settings, num_images, status, cost, source_mode, requested_at, completed_at, generation_time_ms) values
  ('80000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000011', 'leonardo', 'seed-gen-0011', 'seed-model', 'Dark Minecraft deep-dark cave interior, enormous Warden mob…', 'text, letters, watermark', '{"width":1344,"height":768,"alchemy":true}', 4, 'complete', 0.118, 'seed', now() - interval '6 hours', now() - interval '5 hours 59 minutes', 41200),
  ('80000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000012', 'leonardo', 'seed-gen-0012', 'seed-model', 'Dark atmospheric gradient with drifting cyan soul particles…', 'text, watermark', '{"width":1344,"height":768,"alchemy":true}', 4, 'complete', 0.118, 'seed', now() - interval '6 hours', now() - interval '5 hours 59 minutes', 38900),
  ('80000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000013', 'leonardo', 'seed-gen-0013', 'seed-model', 'High-angle first-person view floating above a Minecraft village…', 'text, watermark', '{"width":1344,"height":768,"alchemy":true}', 4, 'complete', 0.118, 'seed', now() - interval '6 hours', now() - interval '5 hours 58 minutes', 44700),
  ('80000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000021', 'leonardo', 'seed-gen-0021', 'seed-model', 'Wide cinematic shot down an empty 1980s Nevada mining town…', 'text, people', '{"width":1344,"height":768}', 4, 'complete', 0.118, 'seed', now() - interval '30 hours', now() - interval '29 hours 59 minutes', 40100),
  ('80000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000022', 'leonardo', 'seed-gen-0022', 'seed-model', 'Abandoned desert mining town at night, single warm lit window…', 'text, people, neon', '{"width":1344,"height":768}', 4, 'complete', 0.118, 'seed', now() - interval '30 hours', now() - interval '29 hours 59 minutes', 39800),
  ('80000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000023', 'leonardo', 'seed-gen-0023', 'seed-model', 'Extreme close-up of a dusty paper wall calendar, October 1987…', 'legible brand names', '{"width":1344,"height":768}', 4, 'complete', 0.118, 'seed', now() - interval '30 hours', now() - interval '29 hours 58 minutes', 42300);

insert into public.generation_images (generation_id, provider_image_id, width, height)
select g.id, g.provider_generation_id || '-img-' || n, 1344, 768
from public.generations g cross join generate_series(1, 4) n;

-- ── Compositions + critic (documentary job is in REVIEW) ────────────
insert into public.compositions (id, order_id, concept_id, generation_image_id, version, layers, critic_scores, critic_total, critic_verdict, critic_summary, multisize, status) values
  ('90000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000022',
   (select id from public.generation_images where provider_image_id = 'seed-gen-0022-img-2'), 1,
   '[{"type":"image","role":"background","fit":"cover"},{"type":"gradient","from":"#00000000","to":"#000000AA","angle":180}]',
   '{"visualClarity":9,"mobileReadability":9,"focalHierarchy":9,"curiosity":9,"titleComplement":8,"categoryRelevance":9,"competitiveDifferentiation":8,"clientFit":9,"artefactQuality":8,"honesty":9}',
   87.4, 'review', 'The single lit window survives down to 160×90 and poses the title''s question without text. Slight banding in the sky.', '{"160x90":{"subjectVisible":true,"textReadable":null,"notes":"Window still reads"}}', 'scored'),
  ('90000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000023',
   (select id from public.generation_images where provider_image_id = 'seed-gen-0023-img-1'), 1,
   '[{"type":"image","role":"background","fit":"cover"},{"type":"text","text":"OCT 1987","fontFamily":"GT Sectra","fontSize":96,"fill":"#2B2016","x":640,"y":180}]',
   '{"visualClarity":8,"mobileReadability":7,"focalHierarchy":9,"curiosity":9,"titleComplement":9,"categoryRelevance":8,"competitiveDifferentiation":10,"clientFit":8,"artefactQuality":8,"honesty":9}',
   84.6, 'review', 'Most distinctive candidate in the feed. Calendar type loses legibility at 160×90; consider larger date numerals.', '{"160x90":{"subjectVisible":true,"textReadable":false,"notes":"Date numerals too small"}}', 'scored'),
  ('90000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000021',
   (select id from public.generation_images where provider_image_id = 'seed-gen-0021-img-3'), 1,
   '[{"type":"image","role":"background","fit":"cover"},{"type":"text","text":"1987","fontFamily":"GT Sectra","fontSize":160,"fill":"#F2E8D5","x":120,"y":560}]',
   '{"visualClarity":8,"mobileReadability":8,"focalHierarchy":7,"curiosity":8,"titleComplement":8,"categoryRelevance":10,"competitiveDifferentiation":6,"clientFit":9,"artefactQuality":9,"honesty":9}',
   80.8, 'review', 'Solid and on-brand, but closest to the existing feed. Open car door is small at mobile size.', '{"160x90":{"subjectVisible":false,"textReadable":true,"notes":"Car door disappears"}}', 'scored'),
  ('90000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000021',
   (select id from public.generation_images where provider_image_id = 'seed-gen-0021-img-1'), 1, '[]',
   '{"visualClarity":6,"mobileReadability":6,"focalHierarchy":5,"curiosity":6,"titleComplement":7,"categoryRelevance":8,"competitiveDifferentiation":5,"clientFit":7,"artefactQuality":4,"honesty":9}',
   61.0, 'reject', 'Auto-rejected: warped building geometry and a duplicated streetlight.', null, 'rejected');

-- ── Activity ────────────────────────────────────────────────────────
insert into public.activity_log (order_id, actor_type, actor_id, action, message, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'user', '00000000-0000-4000-8000-000000000001', 'order.created', 'Order created from Fiverr FO1A2B3C4D', now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000001', 'system', null, 'research.complete', 'Research complete — 12 videos, 8 selected', now() - interval '19 hours 50 minutes'),
  ('30000000-0000-4000-8000-000000000001', 'system', null, 'concepts.complete', '3 concepts generated (A/B/C)', now() - interval '7 hours'),
  ('30000000-0000-4000-8000-000000000001', 'system', null, 'generation.complete', '12 candidate images ready', now() - interval '5 hours 58 minutes'),
  ('30000000-0000-4000-8000-000000000002', 'user', '00000000-0000-4000-8000-000000000001', 'order.created', 'Order created from Fiverr FO9Z8Y7X6W', now() - interval '2 days 4 hours'),
  ('30000000-0000-4000-8000-000000000002', 'system', null, 'research.complete', 'Research complete — 10 videos, 8 selected', now() - interval '47 hours'),
  ('30000000-0000-4000-8000-000000000002', 'system', null, 'critic.complete', '4 candidates scored · 1 auto-rejected', now() - interval '28 hours'),
  ('30000000-0000-4000-8000-000000000002', 'system', null, 'review.required', 'Top 3 candidates ready for human review', now() - interval '28 hours'),
  ('30000000-0000-4000-8000-000000000003', 'automation', null, 'order.created', 'Order created via POST /api/orders', now() - interval '4 hours'),
  ('30000000-0000-4000-8000-000000000003', 'system', null, 'category.detected', 'Category detected: Finance (94%)', now() - interval '4 hours'),
  ('30000000-0000-4000-8000-000000000003', 'system', null, 'research.complete', 'Research complete — 10 videos, 8 selected', now() - interval '2 hours 55 minutes');

-- ── Costs (USD) ─────────────────────────────────────────────────────
insert into public.cost_entries (order_id, provider, operation, units, cost, source_mode) values
  ('30000000-0000-4000-8000-000000000001', 'anthropic', 'research.queries', '{"inputTokens":1200,"outputTokens":300}', 0.0081, 'seed'),
  ('30000000-0000-4000-8000-000000000001', 'anthropic', 'trend_dna.vision', '{"inputTokens":14200,"outputTokens":2100}', 0.0741, 'seed'),
  ('30000000-0000-4000-8000-000000000001', 'anthropic', 'concepts', '{"inputTokens":5200,"outputTokens":2600}', 0.0546, 'seed'),
  ('30000000-0000-4000-8000-000000000001', 'leonardo', 'generation', '{"images":12}', 0.354, 'seed'),
  ('30000000-0000-4000-8000-000000000001', 'youtube', 'search+videos', '{"quotaUnits":612}', 0, 'seed'),
  ('30000000-0000-4000-8000-000000000002', 'anthropic', 'research.queries', '{"inputTokens":1100,"outputTokens":280}', 0.0075, 'seed'),
  ('30000000-0000-4000-8000-000000000002', 'anthropic', 'trend_dna.vision', '{"inputTokens":13800,"outputTokens":2000}', 0.0714, 'seed'),
  ('30000000-0000-4000-8000-000000000002', 'anthropic', 'concepts', '{"inputTokens":5100,"outputTokens":2500}', 0.0528, 'seed'),
  ('30000000-0000-4000-8000-000000000002', 'leonardo', 'generation', '{"images":12}', 0.354, 'seed'),
  ('30000000-0000-4000-8000-000000000002', 'anthropic', 'critic', '{"inputTokens":9600,"outputTokens":1400}', 0.0498, 'seed'),
  ('30000000-0000-4000-8000-000000000003', 'anthropic', 'category.detect', '{"inputTokens":400,"outputTokens":40}', 0.0018, 'seed'),
  ('30000000-0000-4000-8000-000000000003', 'anthropic', 'research.queries', '{"inputTokens":1150,"outputTokens":290}', 0.0078, 'seed');
