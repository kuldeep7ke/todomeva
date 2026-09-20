# Announcements via Edge-Cached jsonbin Proxy — Guide & Reuse Playbook

A reusable technique for serving in-app announcements (broadcast pills / release
banners) from a [jsonbin.io](https://jsonbin.io) free bin without blowing through
the **10,000 requests/month quota** as your user count grows — on **every**
platform, including installed apps (Android APK).

This playbook is deliberately generic. Replace names/URLs and copy the three
building blocks into any app that needs dashboard-editable announcements.

---

## 1. The problem

jsonbin.io free tier allows ~10,000 requests/month. If every app install fetches
the bin on every app load, quota is consumed **per user**, not per edit:

| Users × loads/month | Direct-fetch requests | Free quota |
|---|---|---|
| 3,000 | ~3,000+ | 10,000 |
| 12,000 | ~12,000+ | 10,000 — exceeded |

Static hosts (GitHub Pages) and installed apps (Android APK) have **no server**,
so the naive fix — "make a server-side request" — is not available on those
platforms at all.

## 2. The solution (one edge proxy for ALL platforms)

A single Cloudflare Pages Function acts as an **edge-cached proxy** between every
app instance and jsonbin:

```
Every app instance ──> https://todomeva.pages.dev/api/announcements
  ├─ Cloudflare Pages web                       │
  ├─ GitHub Pages web                           │  Cloudflare edge cache
  └─ Android APK (installed, no server)         │  ONE copy per TTL window
                                                ▼
                              jsonbin.io/v3/b/<combined-bin-id>/latest
                              (hit only on cache expiry / miss)
```

One combined bin holds everything the app needs (broadcast pills under
`broadcasts`, the promo banner under `banner`), so a single cache key serves the
whole feature: one jsonbin request per TTL window total.

The app calls **your own URL**, never jsonbin directly. On the first request in a
TTL window the function hits jsonbin once and caches the reply at Cloudflare's
edge; every device for that window is served from cache.

**Why it works on every platform:** the platform only decides where the app is
*served from* — it never changes where the app *fetches announcements from*. All
instances call the same absolute HTTPS URL at runtime, so one Cloudflare
deployment backs Cloudflare Pages, GitHub Pages, and APK simultaneously. The only
cross-platform requirements are:

1. **HTTPS** — yes (`https://*.pages.dev`).
2. **CORS** — the function must return `Access-Control-Allow-Origin: *`, because
   GitHub Pages (`https://user.github.io/...`) and the Android WebView
   (`capacitor://localhost` / `https://localhost`) are cross-origin to the proxy.
3. **Android**: `INTERNET` permission + HTTPS network access in the app (already
   present in any app that does cloud sync).

### Quota math

jsonbin requests per month are bounded by **time**, not users:

```
requests/month ≈ 30 × 1440 / TTL_minutes
```

| TTL | Max jsonbin requests/month |
|---|---|
| 3 hours | ~240 |
| 10 min (Todo Meva default) | ~4,320 |
| 30 min | ~1,440 |
| 60 min | ~720 |

Lower TTL = edits appear sooner, more jsonbin requests. Higher = fewer requests,
slower propagation. Everything stays well under 10k for a single bin.

## 3. Building blocks (copy these)

### A. The Cloudflare Pages Function — `functions/api/announcements.js`

A Cloudflare Pages **Function** (`functions/api/announcements.js`) that
normalizes the cache key (ignores extra query params so all devices share one
cache entry), fetches jsonbin on a miss, caches at the edge, and always returns
CORS headers. The bin id is configurable as a Pages **environment variable**
(`ANNOUNCEMENTS_BIN_ID`, legacy `BROADCAST_BIN_ID` honored) with
`FALLBACK_BIN_ID` in code.

```js
// functions/api/announcements.js — single combined announcements bin
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
// Filled in by `node scripts/broadcast-tool.cjs setup` (or bake).
const FALLBACK_BIN_ID = '<combined-bin-id>';
const TTL_MINUTES = 10; // tunable (see quota math, §2)

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const binId = env.ANNOUNCEMENTS_BIN_ID || env.BROADCAST_BIN_ID || FALLBACK_BIN_ID;

  if (!binId) {
    return new Response(JSON.stringify({ error: 'bin-not-configured' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const cacheKey = new Request(`${url.origin}/api/announcements`); // one key for all devices
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (!res) {
    try {
      const upstream = await fetch(`${JSONBIN_BASE}${binId}/latest`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: TTL_MINUTES * 60 },
      });
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${TTL_MINUTES * 60}`,
          'Access-Control-Allow-Origin': '*', // cross-origin: GH Pages + APK
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
```

> **Todo Meva reference (how this app actually runs it):**
> - `functions/api/announcements.js` is deployed to the **`todomeva`** Cloudflare
>   Pages project by `.github/workflows/deploy-cloudflare.yml` (it runs
>   `wrangler pages deploy .`, which bundles `functions/`, and auto-creates the
>   project with `pages project create todomeva ... || true` if missing). No
>   per-project config is needed.
> - **No dashboard environment variables are required.** `FALLBACK_BIN_ID` in the
>   function carries the combined bin id server-side; the dashboard controls are
>   optional overrides (`ANNOUNCEMENTS_BIN_ID`, legacy `BROADCAST_BIN_ID`).
> - The app's canonical endpoint is
>   `https://todomeva.pages.dev/api/announcements`. It is deliberately
>   decoupled from where the app is served (see §3-B).

### B. The app-side endpoint constant (decoupled from the app's origin)

Define the announcement URL as its **own** constant with an optional override.
Do **not** derive it from `location.origin` / `SITE_URL` — on GitHub Pages
`/api/announcements` would resolve to the GitHub host and 404, silently engaging
the jsonbin fallback (unbounded per-user quota). The constant must be an
absolute URL so every deployment — CF Pages, GH Pages, APK — fetches through the
same shared proxy.

```js
const ANNOUNCEMENTS_API = () =>
  localStorage.getItem('todoMeva_announcementsApi') ||
  'https://todomeva.pages.dev/api/announcements';
const ANNOUNCEMENTS_URL = () => ANNOUNCEMENTS_API().replace(/\/+$/, '');
```

- Default: shared Cloudflare proxy — correct for every default build (web, GH
  Pages, APK) with **zero configuration**.
- Override `todoMeva_announcementsApi` (localStorage, no rebuild) only if you run
  your own proxy or a local dev stub.

### C. The app-side fetch pattern (proxy first, graceful fallback)

`js/broadcast.js` implements `loadAnnouncement()`, which fetches the combined bin
once (banner + broadcasts together) and unwraps both families from the record:

```js
async function loadAnnouncement() {
  const viaProxy = await fetchJson(ANNOUNCEMENTS_URL());   // primary: edge-cached proxy
  const raw = viaProxy !== null ? viaProxy : await fetchJson(JSONBIN_LATEST(BIN_ID()));
  return {
    broadcasts: raw?.record?.broadcasts ?? raw?.broadcasts ?? [],
    banner: raw?.record?.banner ?? raw?.banner ?? null,
  };
}
```

`fetchJson` uses `{ cache: 'no-store' }` so each poll is a fresh proxy call (the
edge still absorbs the jsonbin hit). Response shape is jsonbin's
(`{ record: ... }`); unwrap via `res?.record ?? res`. Parse
`expires`/`startDate` and skip stale/dismissed entries/banners. On any failure
return `null` — silent, no pill/banner (and the banner overlay must never paint
if there is no valid banner — the splash stays up as a skeleton instead).

## 4. How it works on each platform

| Platform | Hosts app | Fetch URL | Needs CORS | Result |
|---|---|---|---|---|
| Cloudflare Pages (`todomeva`) | project | same/cross-origin proxy | no | edge-cached |
| GitHub Pages | `user.github.io/<repo>/` | cross-origin proxy | yes | edge-cached |
| Android APK | bundled WebView | cross-origin proxy | yes | edge-cached |
| Any other host (Netlify/Vercel/custom) | same | cross-origin proxy | yes | edge-cached |

All four are identical from the function's point of view — a plain GET to the
same absolute URL. Nothing is platform-specific in the app code.

## 5. Setting it up for a NEW app (reuse checklist)

1. **jsonbin** — create a bin; paste the combined record
   (`{ "broadcasts": [...], "banner": { ... } }` — see
   `scripts/content/announcements.json` for the template). Copy the bin ID.
   (**Keep the bin public** — a private bin returns `401`.)
2. **Cloudflare Pages** — create a project (new, or reuse an existing one so the
   function rides the same edge cache). Add a `functions/api/announcements.js`
   exactly as in §3-A and `functions/` must be deployed (Cloudflare auto-runs
   Functions; no config). In Todo Meva this is automatic: the deploy workflow
   deploys to the `todomeva` project and creates a missing project
   (`pages project create todomeva ... || true`).
3. **Bin ID** — optional. Set `ANNOUNCEMENTS_BIN_ID` (or legacy
   `BROADCAST_BIN_ID`) as a Production env var in the Pages dashboard, **or**
   bake the id into both files with `node scripts/broadcast-tool.cjs bake`
   (writes the obfuscated `BAKED_BIN_ID` into `js/broadcast.js` and
   `FALLBACK_BIN_ID` into `functions/api/announcements.js` — server-side, never
   in app bundles).
4. **App** — add the `ANNOUNCEMENTS_API` constant (§3-B) and the fetch pattern
   (§3-C). Wire the pills/banner UI to the fetched records.
5. **TTL** — tune `TTL_MINUTES` per the quota math (§2).
6. **Build every platform** — build the static export for GH Pages/deploy and the
   APK; no per-platform branches. The proxy URL is the same in all bundles.
7. **Verify cross-origin** — in browser DevTools on the GH Pages URL and in the
   APK, confirm the proxy responds with `access-control-allow-origin: *` and
   `cache-control: public, max-age=...`.

## 6. Editing announcements (day-to-day)

- Edit the record in the **jsonbin dashboard** — no app update needed.
- Change appears after `TTL_MINUTES` (edge cache) plus the next app poll (app
  polls every 60s while open; banner shows on next app load).
- Edit results are visible on web **and** installed APKs at the same time
  (same endpoint, shared cache).

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Nothing on GH Pages / APK | App derived its announcements URL from `location.origin` (old config) and 404'd | Use the absolute proxy constant (§3-B); don't derive from the app's origin |
| 404 on proxy | Wrong host / bin missing / project not yet deployed | Check the function deployed (`https://todomeva.pages.dev/api/announcements` via `curl -I`) |
| CORS error in browser/WebView | Function header missing | Ensure `Access-Control-Allow-Origin: *` |
| Stale content | Edge TTL + poll interval | Lower `TTL_MINUTES`, push, reload app |
| jsonbin usage climbing | Proxy bypassed (fallback engaged) | Check app network tab: requests must go to `todomeva.pages.dev/api/announcements`, not `api.jsonbin.io` |
| Quota exceeded (4xx/429) | Very low TTL or many bins | Raise `TTL_MINUTES`; check Cloudflare analytics for request volume |

## 8. Monitoring

- **Cloudflare Pages → Functions** tab: per-URL request volume, latency, status —
  confirms the proxy is absorbing traffic.
- **jsonbin dashboard**: usage meter — should be flat (~time-based spikes), not
  scaling with users.

## 9. Notes & trade-offs

- **Multiple record families**: combine them in ONE bin (one cache key, one
  jsonbin hit per TTL window — like Todo Meva's `broadcasts` + `banner`). Split
  into separate bins only when families need different TTLs or ownership; each
  extra bin keeps its own bin id and cache key in the same function.
- **Unbounded per-user churn**: capped at TTL; the pattern trades *real-time per
  user* for *bounded global cost*.
- **Offline**: if the proxy (and fallback) are unreachable, the app shows no
  announcement — same as any fetch-based feature. The APK should already be
  offline-first for its data.