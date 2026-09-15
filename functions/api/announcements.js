// Cloudflare Pages Function — edge-cached proxy for jsonbin announcement bins.
// All devices hit THIS endpoint; Cloudflare serves each response from the edge
// cache for TTL_MINUTES, so jsonbin request volume depends on time only —
// never on user count. The same ids live obfuscated in js/broadcast.js as a
// client-side fallback when this proxy is unreachable (e.g. GitHub Pages).
// Optional: set BROADCAST_BIN_ID / BANNER_BIN_ID as Pages env vars in the
// Cloudflare dashboard to override the fallbacks below.
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
const FALLBACK_IDS = {
  broadcast: '6aa8b102ac6210605ace34ce',
  banner: '6aa8b192ac6210605ace3604',
};
// How long each response is cached at Cloudflare's edge (in MINUTES).
// Lower = users see jsonbin edits sooner (but jsonbin gets more requests). Higher = fewer requests.
const TTL_MINUTES = 10;
const TTL_SECONDS = TTL_MINUTES * 60;

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'banner' ? 'banner' : 'broadcast';
  const binId = (type === 'banner' ? env.BANNER_BIN_ID : env.BROADCAST_BIN_ID) || FALLBACK_IDS[type];

  // Normalize cache key: ignore any extra query params so every device shares one cache entry
  const cacheKey = new Request(`${url.origin}/api/announcements?type=${type}`);
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (!res) {
    try {
      const upstream = await fetch(`${JSONBIN_BASE}${binId}/latest`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: TTL_SECONDS },
      });
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${TTL_SECONDS}`,
          'Access-Control-Allow-Origin': '*',
        },
      });
      if (upstream.ok) waitUntil(cache.put(cacheKey, res.clone()));
    } catch {
      res = new Response(JSON.stringify({ error: 'upstream-failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
  return res;
}