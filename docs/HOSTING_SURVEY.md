# SkyStunt.io — Temporary and free hosting survey

Goal: find a public HTTPS link that stays up for several days and lets browsers play the game. Each row is tagged:

- **[T] tested** in this sandbox, with the result.
- **[F] page** from the provider's own page or docs, with the source ID in `RESEARCH_REGISTER.md`.
- **[E] estimate**, my arithmetic on a page's numbers.

Date of checks: 2026-10-16 (Asia/Calcutta). Test host: one Node process on 0.0.0.0:8080 (`node server/index.js`), with `dist/` built.

## Summary

| Result | Options |
|---|---|
| **Playable offline/solo for up to 30 days (static, no multiplayer)** | ship.place (ship.page), `modest-shirt-zza26.ship.place` |
| **Playable now, multiplayer too, but tied to this sandbox (dies on sandbox restart or when the process stops)** | Cloudflare Quick Tunnel (trycloudflare), localhost.run (`deb2184b04a123.lhr.life`, restarted once after the first tunnel dropped) |
| **Not playable (browser gate or redirect)** | Serveo (warning page), localtunnel (password gate, now dead), Pinggy free (wrong responses), tunl.gg (redirect warning page) |
| **Needs an account. Best candidate for days** | Northflank Sandbox (always-on free tier; limits unpublished) |
| **Needs an account. Not suitable for always-on** | Render free (sleeps, drops WebSockets), Koyeb free (scales to zero), Hugging Face Spaces (sleeps after 48 h idle) |
| **Paid or limited** | Railway Free ($1/mo credit), Fly.io (no free tier; $2.19/mo smallest), Zeabur (free limits unstated), Replit (paid), Sevalla (apps paid) |
| **Ruled out** | Glitch (ended), Cloudflare Workers (CPU limit; Node server would need rewrite), tuns.sh (needs SSH key account; 60-minute sessions per S10) |

**No option yet gives a verified multi-day, browser-playable public URL with no account.** The Northflank Sandbox is the best candidate, but it needs your signup.

## Tested live (sandbox, 2026-10-16)

| Host | How | Account | Result | Multi-day? | Source |
|---|---|---|---|---|---|
| **ship.place (ship.page service), static build** | No (anonymous drop) | [T] `https://modest-shirt-zza26.ship.place/` live. The ship.place root redirects to ship.page, so it is the same service. Free drop: 30 days, expires 2026-11-15. Static files only, so the full server does not run here, but the client's offline solo mode does: browser smoke PASS, offline solo PASS, 0 errors. **Playable solo, no multiplayer.** | 30 days free (90 with a claimed free account). Pro ($4/mo) keeps drops with no expiry (F16). | ship.page pages |
| **Cloudflare Quick Tunnel** | `cloudflared tunnel --url http://localhost:8080` | No | [T] `https://seven-fiction-unified-destinations.trycloudflare.com`: `/healthz` 200, `/` 200, WebSocket join OK, browser smoke PASS, 0 console errors. Still answering at the time of writing. | [F] Stops when the process stops (S38). [F] URL changes on every restart (S40). [T] Died in an earlier sandbox restart (ENOTFOUND). Lifetime beyond that: not stated. | S38, S39, S40 |
| **localhost.run** | `ssh -R 80:localhost:8080 localhost.run` | No (free domains) | [T] `https://deb2184b04a123.lhr.life`: `/healthz` 200, browser smoke PASS, 0 errors. Was answering earlier in this pass; HTTP 502 at the last check, so the tunnel has dropped. | [F] No session length on the page (F15). [S] A third-party blog says no time limit (S09). Not verified against localhost.run's own terms. | F15, S09 |
| **tunl.gg** | `ssh -R 80:localhost:8080 proxy.tunnl.gg` (no key) | No | [T] Tunnel issued (`quiet-pine-ab3699fd.tunnl.gg`). Browser GET returns a `Temporary Redirect` warning page (90 KB HTML), and the WebSocket upgrade gets HTTP 307. **Not playable.** Stopped. | [F] Expires in 24 h, or after 2 h without traffic (tool output). | S10 |
| **tuns.sh (pico.sh)** | `ssh -R 80:localhost:8080 tuns.sh` | Yes (SSH key) | [T] `Permission denied (publickey)`. Not tested further. | [S] Free sessions 60 minutes (S10). | S10 |
| **Serveo** | `ssh -R 80:localhost:8080 serveo.net` | No | [T] WebSocket works. Browser warning interstitial prevents play (`#bSolo` never visible). **Not playable.** Stopped. | Not measured. | Earlier probe |
| **localtunnel** | `npx localtunnel --port 8080` | No | [T] Health 200 and partial WebSocket. Tunnel-password gate blocks browser play. Now returns HTTP 408. **Dead.** | Not measured. | Earlier probe |
| **Pinggy free** | `ssh -p 443 -R0:localhost:8080 a.pinggy.io` | No | [T] `/` returned 15,466 B, not the 2,071 B game shell. WebSocket handshake returned HTTP 200, not 101. **Not usable as-is.** Stopped. | [S] Free sessions capped at 60 minutes (S09). | S09 |

## Not tested here, from provider pages

| Host | Account | What the page says | Verdict | Source |
|---|---|---|---|---|
| **Northflank Sandbox** | Yes (signup) | "Always-on compute – no sleeping", 2 free services, 1 free database, 2 free cron jobs. Compute size of free services is not stated on the pricing page. Third-party listings say "limited" (S06, unverified). | **Best candidate for several days.** Needs your account. Verify the free-service limits in the dashboard before deploying. | F08, S01, S05, S06 |
| Render (free web service) | Yes | Sleeps after 15 min without traffic. Restarts from scratch. WebSocket connections drop when the service sleeps. | Not suitable: sleeping closes room sockets. | F01, S20, S21 |
| Koyeb (free instance) | Yes | Scales to zero after 1 h. One free instance per organisation. | Not suitable. | F02 |
| Hugging Face Spaces | Yes | Free CPU sleeps after 48 h without requests. Docker Spaces need a paid plan (per project notes). Restart failures reported (S30). | Not suitable for an always-on game. | F03, S29, S30 |
| Railway (Free) | Yes | Free plan after trial: $1/mo usage credit. 1 vCPU and 0.5 GB per service. Trial: $5 credit for 30 days. | [E] At $20 per vCPU-mo, the $1 credit covers about 1.5 days of a fully busy 1 vCPU, so Railway Free is not enough for days. Hobby is $5/mo. | F04, S32, S33, S34 |
| Fly.io | Yes | No free tier for new organisations. Smallest always-on Machine $2.19/mo. | Cheap paid option if you pay. | F06 |
| Zeabur (Free) | Yes | $0 plan: one self-managed server. Hosted-runtime limits not stated. | Unverified. Needs a dashboard check. | F07 |
| Replit | Yes | Core $20/mo, Pro $100/mo. No free always-on hosting. | Not suitable for free. | F09 |
| Sevalla | Yes | Static sites free (1 GB, 100 GB bandwidth). Apps from $5/mo, free trial. | Static only for free. | F12 |
| ngrok (free) | Yes | $5 one-time credit, 1 GB, interstitial page on HTTP/S endpoints. | Interstitial blocks the game like Serveo did. Not suitable. | F13 |
| Cloudflare Workers | Yes | Free: 10 ms CPU per request, 128 MB, 50 subrequests. | A Node WebSocket server cannot run there without a rewrite. | F14 |
| Glitch | — | Hosting ended; dashboards available until early 2026. | **Ruled out.** | F10, F11 |

## Unreachable from this sandbox

- `bore.pub`: no connection (HTTP 000).
- `oracle.com`: HTTP 403 from the sandbox (not tested further).

## Recommendation

1. **Now:** the two live links (Cloudflare Quick Tunnel and localhost.run) play the game. They last only as long as this sandbox and its processes run. Do not rely on them for several days.
2. **For several days:** deploy to the Northflank Sandbox. Steps are in `docs/DEPLOY.md` (created in this pass), and I need your confirmation before any account step. Northflank asks for an account and may ask for verification (aicredits.dev listing says card or student email, S06, unverified).
3. **Backup:** Fly.io at about $2.19/mo (F06) if you are willing to pay a small amount.

## How the live link was checked

`tests/browser/smoke.mjs <url>`: checks the title, WebGL 2, `#bSolo` visible, and 0 console errors. The WebSocket probe uses `/tmp/probe.mjs`: `join` with `quick: true` and expects `welcome` and `lobby`.
