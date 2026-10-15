/**
 * Row types for the Thumbnail Department schema (supabase/migrations).
 * Hand-maintained for readability; run `npm run db:types` to generate the
 * full Supabase types into supabase.generated.ts if you want them too.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/lib/domain/status";

export type DB = SupabaseClient;
export type Marketplace = "fiverr" | "upwork" | "direct" | "other";
export type SourceMode = "live" | "mock" | "seed";
type Ts = string;
type Json = unknown;

export interface UserRow { id: string; email: string; full_name: string | null; role: "admin" | "designer" | "reviewer"; created_at: Ts; updated_at: Ts }

export interface ClientRow {
  id: string; name: string; marketplace: Marketplace; marketplace_username: string | null; email: string | null;
  channel_url: string | null; brand_colours: string[]; preferred_fonts: string[]; visual_preferences: string | null;
  things_to_avoid: string | null; notes: string | null; created_at: Ts; updated_at: Ts;
}

export interface ClientStatsRow { client_id: string; job_count: number; delivered_count: number; avg_revision_count: number; last_order_at: Ts | null }

export interface LockedCharacteristic { label: string; locked: boolean }

export interface ChannelRow {
  id: string; client_id: string | null; youtube_channel_id: string | null; url: string; handle: string | null; title: string | null;
  subscriber_count: number | null; video_count: number | null; median_views: number | null; channel_dna: Json | null;
  locked_characteristics: LockedCharacteristic[]; last_analysed_at: Ts | null; created_at: Ts; updated_at: Ts;
}

export interface OrderRow {
  id: string; job_number: number; job_id: string; client_id: string | null; channel_id: string | null;
  marketplace: Marketplace; marketplace_order_id: string | null; video_title: string; video_description: string | null;
  channel_url: string | null; requested_text: string | null; category: string | null; auto_detect_category: boolean;
  detected_category: string | null; category_confidence: number | null; client_notes: string | null; things_to_avoid: string | null;
  deadline: Ts | null; status: OrderStatus; status_changed_at: Ts; sale_price: number; currency: string; marketplace_fee: number | null;
  assigned_to: string | null; created_by: string | null; approved_by: string | null; approved_at: Ts | null;
  started_at: Ts | null; delivered_at: Ts | null; created_at: Ts; updated_at: Ts;
}

export type AssetKind = "client_asset" | "face_photo" | "logo" | "font" | "brand" | "other";
export interface OrderAssetRow {
  id: string; order_id: string | null; client_id: string | null; kind: AssetKind; is_approved_face: boolean;
  storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  width: number | null; height: number | null; created_by: string | null; created_at: Ts;
}

export interface ClientReferenceRow {
  id: string; order_id: string; client_id: string | null; source: "upload" | "url"; url: string | null; storage_bucket: string | null;
  storage_path: string | null; file_name: string | null; mime_type: string | null; note: string | null; analysis: Json | null; created_at: Ts;
}

export interface ResearchRunRow {
  id: string; order_id: string | null; kind: "order" | "reference_hunt" | "trend_refresh"; topic: string | null; category: string | null;
  slug: string | null; queries: string[]; params: Record<string, unknown>; scoring_weights: Record<string, number> | null;
  status: "pending" | "running" | "complete" | "failed"; error: string | null; source: SourceMode; video_count: number;
  storage_prefix: string | null; contact_sheet_path: string | null; started_at: Ts | null; completed_at: Ts | null; created_at: Ts; updated_at: Ts;
}

export interface YoutubeReferenceRow {
  id: string; research_run_id: string; video_id: string; title: string; description: string | null; channel_id: string | null;
  channel_title: string | null; channel_subscribers: number | null; published_at: Ts | null; view_count: number | null;
  like_count: number | null; comment_count: number | null; duration: string | null; thumbnail_url: string | null;
  stored_image_path: string | null; matched_query: string | null; category: string | null; sub_category: string | null;
  age_days: number | null; views_per_day: number | null; velocity_score: number | null; recency_score: number | null;
  outperformance_score: number | null; relevance_score: number | null; novelty_score: number | null; reference_score: number | null;
  rank: number | null; performance_type: string | null; included: boolean; excluded: boolean; favourite: boolean; locked: boolean;
  tags: string[]; analysis: Json | null; created_at: Ts; updated_at: Ts;
}

export interface TrendDnaRow {
  id: string; research_run_id: string | null; order_id: string | null; channel_id: string | null;
  source: "market" | "client" | "channel" | "creative"; category: string | null; reference_count: number; attributes: Record<string, unknown>;
  common_patterns: string[]; emerging_patterns: string[]; declining_patterns: string[]; visual_opportunities: string[];
  overused_conventions: string[]; contrarian_opportunities: string[]; summary: string | null; model: string | null; source_mode: SourceMode; created_at: Ts;
}

export interface CreativeBriefRow {
  id: string; order_id: string; market_dna_id: string | null; client_dna_id: string | null; channel_dna_id: string | null;
  preserve: string[]; adopt: string[]; avoid: string[]; differentiate: string[]; summary: string | null; created_at: Ts;
}

export interface ConceptRow {
  id: string; order_id: string; creative_brief_id: string | null; style_pattern_id: string | null; slot: "A" | "B" | "C";
  strategy: "category_leader" | "current_trend" | "contrarian"; name: string; visual_hook: string | null; viewer_question: string | null;
  composition: string | null; foreground: string | null; background: string | null; human_subject: string | null; object: string | null;
  expression: string | null; colour_strategy: string | null; text_recommendation: string | null; generation_prompt: string | null;
  negative_prompt: string | null; reference_rationale: string | null; why_it_may_work: string | null; risk: string | null;
  status: "proposed" | "selected" | "rejected"; source_mode: SourceMode; created_at: Ts;
}

export interface GenerationRow {
  id: string; order_id: string; concept_id: string | null; provider: string; provider_generation_id: string | null; model: string | null;
  prompt: string; negative_prompt: string | null; settings: Record<string, unknown>; num_images: number;
  status: "queued" | "pending" | "complete" | "failed"; cost: number | null; cost_currency: string | null; error: string | null;
  source_mode: SourceMode; requested_at: Ts | null; completed_at: Ts | null; generation_time_ms: number | null; created_at: Ts;
}

export interface GenerationImageRow {
  id: string; generation_id: string; provider_image_id: string | null; source_url: string | null; storage_bucket: string | null;
  storage_path: string | null; width: number | null; height: number | null; nsfw: boolean; created_at: Ts;
}

export interface CompositionRow {
  id: string; order_id: string; concept_id: string | null; generation_image_id: string | null; parent_id: string | null; version: number;
  layers: Json[]; render_path: string | null; preview_paths: Record<string, string>; critic_scores: Record<string, number> | null;
  critic_total: number | null; critic_verdict: "reject" | "marginal" | "review" | null; critic_summary: string | null;
  multisize: Record<string, unknown> | null; is_candidate: boolean; status: string; created_at: Ts;
}

export interface ReviewRow { id: string; order_id: string; composition_id: string | null; reviewer_id: string | null; decision: "approve" | "edit" | "regenerate" | "reject"; is_winner: boolean; notes: string | null; duration_seconds: number | null; created_at: Ts }

export interface StructuredRevision { preserve: string[]; change: string[]; remove: string[]; add: string[] }
export interface RevisionRow {
  id: string; order_id: string; revision_number: number; raw_feedback: string; structured: StructuredRevision | null;
  base_composition_id: string | null; result_composition_id: string | null; status: "open" | "in_progress" | "resolved";
  source_mode: SourceMode; created_by: string | null; created_at: Ts; resolved_at: Ts | null;
}

export interface DeliverableRow { id: string; order_id: string; composition_id: string | null; kind: string; file_name: string; storage_bucket: string; storage_path: string; delivery_message: string | null; created_at: Ts }

export interface StylePatternRow {
  id: string; name: string; slug: string; description: string | null; subject_position: string | null; primary_object: string | null;
  object_treatment: string | null; background: string | null; text_treatment: string | null; curiosity_mechanism: string | null;
  emotional_mechanism: string | null; layout: Record<string, unknown>; categories: string[]; tags: string[]; created_at: Ts;
}

export interface PerformanceResultRow {
  id: string; order_id: string | null; composition_id: string | null; concept_id: string | null; style_pattern_id: string | null;
  creative_brief_id: string | null; video_url: string | null; published_at: Ts | null; impressions: number | null; ctr: number | null;
  views: number | null; watch_time_hours: number | null; ab_test_winner: boolean | null; notes: string | null; created_at: Ts;
}

export interface AutomationEventRow {
  id: string; order_id: string | null; direction: "inbound" | "outgoing"; event_type: string; payload: Record<string, unknown>;
  target_url: string | null; status: string; response_status: number | null; error: string | null; attempts: number; created_at: Ts; sent_at: Ts | null;
}

export interface ActivityRow { id: string; order_id: string | null; actor_type: "user" | "automation" | "system"; actor_id: string | null; action: string; message: string; data: Record<string, unknown>; created_at: Ts }

export interface CostEntryRow { id: string; order_id: string | null; research_run_id: string | null; provider: string; operation: string; units: Record<string, unknown>; cost: number; currency: string; source_mode: SourceMode; created_at: Ts }
