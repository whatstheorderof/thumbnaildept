import { env, integrationModes } from "@/lib/env";
import { hashString } from "@/lib/utils";

/**
 * YouTube Data API v3 adapter.
 * Quota: search.list = 100 units/call, videos.list & channels.list = 1 unit/call.
 */
export interface VideoHit {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  matchedQuery: string;
}

export interface VideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  duration: string | null;
}

export interface ChannelStats { channelId: string; subscriberCount: number | null; videoCount: number | null }

export interface SearchOptions { maxResults?: number; publishedAfter?: Date; regionCode?: string; order?: "relevance" | "viewCount" | "date" }

export interface YouTubeAdapter {
  mode: "live" | "mock";
  search(query: string, opts?: SearchOptions): Promise<VideoHit[]>;
  videoStats(ids: string[]): Promise<VideoStats[]>;
  channelStats(ids: string[]): Promise<ChannelStats[]>;
  /** Approximate quota units consumed by this adapter instance. */
  quotaUsed(): number;
}

const API = "https://www.googleapis.com/youtube/v3";

class LiveYouTube implements YouTubeAdapter {
  mode = "live" as const;
  private quota = 0;

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API}/${path}`);
    Object.entries({ ...params, key: env.youtubeApiKey! }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`YouTube ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }

  async search(query: string, opts: SearchOptions = {}) {
    this.quota += 100;
    type R = { items: { id: { videoId?: string }; snippet: { title: string; description: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: Record<string, { url: string }> } }[] };
    const data = await this.get<R>("search", {
      part: "snippet", type: "video", q: query, maxResults: String(opts.maxResults ?? 15), order: opts.order ?? "relevance",
      ...(opts.publishedAfter ? { publishedAfter: opts.publishedAfter.toISOString() } : {}),
      ...(opts.regionCode ? { regionCode: opts.regionCode } : {}),
    });
    return data.items.filter((i) => i.id.videoId).map((i) => ({
      videoId: i.id.videoId!, title: decodeEntities(i.snippet.title), description: i.snippet.description,
      channelId: i.snippet.channelId, channelTitle: i.snippet.channelTitle, publishedAt: i.snippet.publishedAt,
      thumbnailUrl: bestThumb(i.snippet.thumbnails, i.id.videoId!), matchedQuery: query,
    }));
  }

  async videoStats(ids: string[]) {
    const out: VideoStats[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      this.quota += 1;
      type R = { items: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string }; contentDetails: { duration: string } }[] };
      const data = await this.get<R>("videos", { part: "statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
      out.push(...data.items.map((v) => ({
        videoId: v.id, viewCount: Number(v.statistics.viewCount ?? 0),
        likeCount: v.statistics.likeCount ? Number(v.statistics.likeCount) : null,
        commentCount: v.statistics.commentCount ? Number(v.statistics.commentCount) : null,
        duration: v.contentDetails.duration,
      })));
    }
    return out;
  }

  async channelStats(ids: string[]) {
    const out: ChannelStats[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      this.quota += 1;
      type R = { items: { id: string; statistics: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean } }[] };
      const data = await this.get<R>("channels", { part: "statistics", id: ids.slice(i, i + 50).join(",") });
      out.push(...data.items.map((c) => ({
        channelId: c.id,
        subscriberCount: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
        videoCount: c.statistics.videoCount ? Number(c.statistics.videoCount) : null,
      })));
    }
    return out;
  }

  quotaUsed() { return this.quota; }
}

function bestThumb(t: Record<string, { url: string }>, id: string) {
  return t.maxres?.url ?? t.standard?.url ?? t.high?.url ?? t.medium?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// ── Development mock ──────────────────────────────────────────────────
// Deterministic, plausible videos with no image URLs (UI shows placeholders).

const MOCK_CHANNELS = ["Northside", "Kilo Studio", "Pocket Atlas", "Fable Works", "Halfmoon", "Copperline", "Little Giant", "Vantage", "Open Field", "Static Bloom"];
const MOCK_FORMATS = ["I Tried {q} for 30 Days", "The Truth About {q}", "{q} — Full Story", "Why {q} Changed Everything", "{q} (Nobody Expected This)", "I Spent 100 Days on {q}", "{q}: What They Don't Tell You", "Testing {q} So You Don't Have To"];

class MockYouTube implements YouTubeAdapter {
  mode = "mock" as const;
  private stats = new Map<string, VideoStats>();
  private channels = new Map<string, ChannelStats>();

  async search(query: string, opts: SearchOptions = {}) {
    const n = Math.min(opts.maxResults ?? 12, 12);
    const title = query.replace(/\b\w/g, (c) => c.toUpperCase());
    const windowDays = opts.publishedAfter ? Math.max(7, (Date.now() - opts.publishedAfter.getTime()) / 86_400_000) : 365;
    return Array.from({ length: n }, (_, i) => {
      const h = hashString(`${query}:${i}`);
      const videoId = `mock${h.toString(36).padStart(7, "0").slice(0, 7)}`;
      const ch = MOCK_CHANNELS[h % MOCK_CHANNELS.length];
      const channelId = `UCmock${hashString(ch).toString(36)}`;
      const ageDays = 1 + (h % Math.floor(windowDays));
      const subs = [8_000, 45_000, 120_000, 480_000, 1_200_000, 3_500_000][(h >>> 3) % 6];
      const views = Math.round(subs * (0.05 + ((h >>> 7) % 400) / 100) * Math.min(1, 0.3 + ageDays / 60));
      this.stats.set(videoId, { videoId, viewCount: views, likeCount: Math.round(views * 0.03), commentCount: Math.round(views * 0.002), duration: `PT${8 + (h % 30)}M${h % 60}S` });
      this.channels.set(channelId, { channelId, subscriberCount: subs, videoCount: 40 + (h % 400) });
      return {
        videoId, title: MOCK_FORMATS[(h >>> 5) % MOCK_FORMATS.length].replace("{q}", title),
        description: `Mock result for “${query}”.`, channelId, channelTitle: ch,
        publishedAt: new Date(Date.now() - ageDays * 86_400_000).toISOString(), thumbnailUrl: null, matchedQuery: query,
      };
    });
  }

  async videoStats(ids: string[]) { return ids.map((id) => this.stats.get(id)).filter((s): s is VideoStats => !!s); }
  async channelStats(ids: string[]) { return ids.map((id) => this.channels.get(id)).filter((s): s is ChannelStats => !!s); }
  quotaUsed() { return 0; }
}

/** A fresh adapter per job so quota accounting is per run. */
export function createYouTube(): YouTubeAdapter {
  return integrationModes().youtube === "live" ? new LiveYouTube() : new MockYouTube();
}
