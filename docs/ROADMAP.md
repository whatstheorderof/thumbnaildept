# Roadmap

The schema, adapters and UI slots for every phase already exist. Each phase below fills in a service and replaces that tab's empty state.

## Phase 2: finish research
- [x] YouTube integration, scoring, research UI, reference storage
- [ ] **Contact sheet**: `services/research/contact-sheet.ts` using Sharp. A grid of 12–20 selected thumbnails, each labelled with ref #, views, age and views/day, plus a header with category, date and topic. Save as `contact-sheet.jpg` in the run's storage folder, set `research_runs.contact_sheet_path`, and add a download button on the Research tab.
- [ ] Channel outperformance using each channel's real median views. The `outperformanceScore()` function already accepts `medianViews`. It needs a `search.list?channelId=` sample per channel.

## Phase 3: DNA and concepts
- [ ] `ClaudeAdapter.analyseThumbnails()`: vision call over the selected images and metadata, writing per-reference `youtube_references.analysis` and `tags`, plus a `novelty_score`. Once novelty exists the scoring model picks up its 10% weight automatically.
- [ ] Aggregate Market DNA, Client DNA (from `client_references`) and Channel DNA (from the client's recent uploads) into `trend_dna`.
- [ ] Creative DNA (`creative_briefs`): preserve, adopt, avoid, differentiate. Honour `channels.locked_characteristics`.
- [ ] Concepts A/B/C (`concepts`) with every spec field. The prompt must forbid copying individual references.

## Phase 4: generation
- [ ] `services/generations.ts → queueConceptGenerations()`: `settings.generation.candidatesPerConcept` images per concept through `LeonardoAdapter.createGeneration`. Mark the job GENERATING.
- [ ] The webhook path is already built and tested (`applyCompletedGeneration`).
- [ ] Prompts generate backgrounds, scenes, objects and lighting only. No typography. Real client photos are composited, not regenerated.

## Phase 5: compositor
- [ ] `services/compositor/`: Sharp + SVG renderer for `compositions.layers`. Layer types: image, subject, background, text (font, size, weight, line height, tracking, fill, stroke, shadow, glow, rotation, alignment), gradient, colour overlay, arrow, circle, shape, logo; adjustments: blur, brightness, contrast, saturation.
- [ ] 1280×720 canvas with the duration-label safe zone. The Composite tab already draws its outline.
- [ ] Feed preview: place the candidate among competing references in desktop, search, sidebar and mobile layouts.

## Phase 6: critic, review, delivery
- [ ] Critic: 10 dimensions, weighted from `settings.critic.weights`, verdict from the configured thresholds; multi-size test at 1280/320/160.
- [ ] Review actions APPROVE, EDIT, REGENERATE, REJECT writing to `reviews` (and recording `duration_seconds` for analytics).
- [ ] Export `JOBxxxx-final.jpg/.png`, `-preview`, `-mobile-preview`, `-feed-preview` to the `deliverables` bucket, plus an auto-drafted delivery message. The Delivery tab already shows the files and has a copy button.

## Phase 7: library and automation
- [x] Reference Library browse/filter, Patterns, Analytics, performance entry, automation endpoints
- [x] Reference Hunt research stage (`npm run td -- reference-hunt`)
- [ ] Reference Hunt in the UI, with `data.json` and `trend-dna.json` written alongside images and the contact sheet under `reference-hunts/<slug-date>/`
- [ ] Monthly trend refresh: `services/research/trend-refresh.ts` runs a hunt per default category and diffs it against the previous snapshot. Trigger it from Vercel Cron via `/api/cron/trend-refresh`, protected by `CRON_SECRET`.
