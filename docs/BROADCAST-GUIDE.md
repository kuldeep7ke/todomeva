# Remote Broadcast & Banner Guide (jsonbin.io)

Send messages and promo banners to ALL Todo Meva users by editing JSON online.
**No commit, no build, no deploy needed** — pills appear within 60s, banners on next refresh.

---

## How It Works

```
You edit ONE JSON bin on jsonbin.io  →  Cloudflare edge caches it (10 min)  →  app fetches https://todomeva.pages.dev/api/announcements  →  pill/banner render
```

- The app polls the canonical announcements proxy `https://todomeva.pages.dev/api/announcements` (a Cloudflare Pages Function) every 60 seconds. The Function edge-caches responses for `TTL_MINUTES` (currently 10), so jsonbin request volume depends on time only, never on user count (protects the free quota)
- The proxy URL is its own constant, deliberately NOT derived from where the app is served — one URL serves Cloudflare Pages, GitHub Pages and the APK via CORS (see `docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md`)
- If the proxy is unreachable (e.g. not yet deployed), the app automatically falls back to the direct jsonbin URL
- Works everywhere the app runs (web + Android webview/APK) — no app-marketplace update required

---

## Your Bin

One combined bin holds BOTH features — pills live under `broadcasts`, the banner under `banner`.

| Content | Bin ID | API URL |
|---|---|---|
| Broadcasts + banner | `6aafbef5ffd5d160531bda2a` | https://api.jsonbin.io/v3/b/6aafbef5ffd5d160531bda2a/latest |

Dashboard: https://jsonbin.io → **Bins** → click the Announcements bin → edit → **Save (Ctrl+S)**

> **The bin must be public.** Its "Private" toggle must be OFF ("Set as Private: false"), otherwise browsers get `401 Unauthorized` and nothing shows. To fix a private bin: open it in the dashboard → uncheck Private → Save.

The bin id lives XOR+base64-obfuscated in `js/broadcast.js` (single `BAKED_BIN_ID`) — decoded at runtime so it never appears as plain text in the deployed bundle. It also lives server-side in `functions/api/announcements.js` (`FALLBACK_BIN_ID`). To write a bin id into both files, run `node scripts/broadcast-tool.cjs bake` with `BAKED_BIN_ID` set (no key needed).

---

## Broadcast Pill

Small floating notification centered at the top of the screen. Does NOT block content.

### Current Format (one object per message inside the combined bin's `broadcasts` array)

```json
{
  "broadcasts": [
    {
      "id": "todo-meva-2026-09-15-v1",
      "title": "Welcome to Todo Meva",
      "message": "Broadcasts are live. Edit this bin on jsonbin.io and the pill updates within 60s.",
      "type": "info",
      "pinned": false,
      "expires": "2030-12-31",
      "link": "https://github.com/kuldeep7ke/todomeva"
    }
  ]
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID. **Change it for each new message** — dismissed users only see new IDs |
| `title` | No | Bold heading, 3–5 words |
| `message` | Yes | Main text, 1–2 lines. Emojis work |
| `type` | No | `info` blue · `warning` amber · `success` green · `error` red (default info) |
| `pinned` | No | `true` = always shown, NO dismiss button. Default `false` = user can dismiss |
| `expires` | No | Auto-hidden after this date (YYYY-MM-DD) |
| `link` | No | URL — whole pill becomes clickable, opens in new tab |
| `targetId` | No | Device id — show ONLY on that device (see Settings → Broadcasts → device id). Omit/empty = everyone |

### Behavior
- Multiple broadcasts: add more objects to the `broadcasts` array — they stack vertically
- Each pill has its own X (dismiss); dismissed ids stored per-device in localStorage `todoMeva_dismissedBroadcasts`
- Pinned messages never show an X — always visible until removed from JSON or expired
- Expired messages hidden after `expires` (inclusive local calendar day)
- Polled every 60 seconds while the app is open; the "Refresh" button in Settings forces an immediate poll

---

## Banner Modal

Full-screen overlay popup, centered card. Blocks content until dismissed.

### Current Format (single object under the combined bin's `banner` key)

```json
{
  "banner": {
    "id": "todo-meva-banner-2026-09-15-v1",
    "title": "Todo Meva is ready",
    "content": "Banner promos go here. Image field is optional.",
    "image": "https://placehold.co/800x400/F97316/FFFFFF?text=Todo+Meva",
    "href": "https://github.com/kuldeep7ke/todomeva",
    "width": "480",
    "startDate": "2026-01-01",
    "expires": "2030-12-31",
    "targetId": ""
  }
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID |
| `title` | No | Bold heading at top |
| `content` | Yes | Main text |
| `image` | No | Image URL above content |
| `href` | No | URL — entire card clickable (opens new tab) |
| `width` | No | Card width in px (number). Default `420` |
| `startDate` | No | Show ON and after this local calendar day (YYYY-MM-DD). Before it → hidden |
| `expires` | No | Show THROUGH this local calendar day. From the next day → hidden |
| `targetId` | No | Device id — show ONLY on that device. Omit/empty = everyone |

Both dates are inclusive calendar days in the viewer's timezone: a banner with `2026-08-22 → 2026-08-24` shows all three days, then disappears.

### Scheduling Recipes

One-week campaign:
```json
{ "startDate": "2026-08-22", "expires": "2026-08-24" }
```

Starts next month:
```json
{ "startDate": "2026-09-01", "expires": "2026-09-30" }
```

Permanent (always shows): omit both fields.
Never shows again: set `expires` in the past.

### Behavior
- **Shows once per app launch/refresh/reload**
- The X button appears only after the banner fully displays (waits for image if present), then counts down **7 seconds** (number badge → spinner → X)
- Backdrop click does NOT close
- If `href` set, tapping the card opens the link (X still closes)
- Only visible inside its `startDate` → `expires` window (inclusive local calendar days)

---

## Editing Workflow (Day to Day)

1. Open https://jsonbin.io → login
2. **Bins** → click the Announcements bin
3. Edit the JSON in the editor (pills under `broadcasts`, banner under `banner`)
4. **Ctrl+S / Save**
5. Done — pills update within 60s; banners on next app refresh

Common edits:
| Goal | Do this |
|---|---|
| New announcement | Change `id` (bump vN) + `message`/`title` in the `broadcasts` array |
| Remove old announcement | Delete its object from the `broadcasts` array |
| Stop a banner | Set `expires` to yesterday, or set `"banner": null` |
| Schedule a banner | Set `banner.startDate` (+ optional `expires`) |
| Make banner clickable ad | Set `banner.href` + optional `image` |
| Show only on one device | Add `targetId` = the device id shown in Settings → Broadcasts |

> **Note:** changing the broadcast `id` re-shows the pill even for users who dismissed an older one. Same `id` stays hidden after dismissal.

---

## Technical Notes

- **Fetch path (quota protection)**: app → `https://todomeva.pages.dev/api/announcements` → Cloudflare Pages Function (`functions/api/announcements.js`) → jsonbin. The Function edge-caches responses (`Cache-Control` + Cache API) for `TTL_MINUTES` — currently **10 minutes** — so ALL devices share cached copies and jsonbin is fetched at most ~6×/hour total no matter how many users you have. Full architecture: `docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md`
- **Override the proxy (advanced)**: set localStorage `todoMeva_announcementsApi` to a custom endpoint (e.g. your own proxy or a local dev stub) without rebuilding
- **Propagation delay**: edits reach users within ~10 min worst case (edge TTL). Need faster or slower? Change `TTL_MINUTES` in `functions/api/announcements.js` and push. Noted: below ~15 min the monthly request count approaches the 10k free-tier cap
- **Fallback chain**: if the proxy fails, the app retries the direct `https://api.jsonbin.io/v3/b/<BIN_ID>/latest` (`cache: 'no-store'`) so announcements never go dark
- Response wrapper handled automatically — jsonbin returns `{ record: <your JSON>, metadata: {...} }`; the app reads `.record ?? raw`
- Code: `js/broadcast.js` (fetch + render + dismiss + status). Status label shown in Settings → Broadcasts. To inspect a bin in a browser, open its API URL and confirm `{ record: … }`
- Bin ids in the app + server: `js/broadcast.js` holds one obfuscated `BAKED_BIN_ID`; `functions/api/announcements.js` holds the same id as `FALLBACK_BIN_ID` (override it via the Pages env var `ANNOUNCEMENTS_BIN_ID` in the Cloudflare dashboard; legacy `BROADCAST_BIN_ID` still honored)
- Tooling: `scripts/broadcast-tool.cjs` — `setup` (create the combined bin from `scripts/content/announcements.json`, then bake its id into both files), `bake` (write a dashboard-created bin id into `js/broadcast.js` + `functions/api/announcements.js`), `publish` (push `scripts/content/announcements.json` into the bin). `JSONBIN_MASTER_KEY` env required for `setup`/`publish`; `bake` needs no key

## Troubleshooting

| Symptom | Check |
|---|---|
| Pill/banner not showing | JSON valid? `id` present? Bins are public (Private toggle OFF)? Outside `startDate`–`expires` window? Banner already shown once this app load (refresh to see again)? |
| Changes not appearing | Saved in jsonbin (Ctrl+S)? Edge cache holds up to 10 min — wait or lower `TTL_MINUTES`. Confirm the Pages Function is deployed (check the Cloudflare Pages build ran after the last push) |
| Browser console shows `401` from jsonbin | Bin is private — dashboard → bin → uncheck Private → Save |
| Banner shows but X disabled | Normal — countdown starts only after full display (image included), runs 7s |
| Pill keeps coming back | Its `id` changed since last dismiss — that's by design |