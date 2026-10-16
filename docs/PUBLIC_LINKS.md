# SkyStunt.io — Public links (as of 2026-10-16)

| Link | Type | Playable | Multiplayer | Lifetime | Verified |
|---|---|---|---|---|---|
| **https://modest-shirt-zza26.ship.place/** | Static build (offline solo) on ship.place (ship.page service) | **Yes**, solo vs AI offline | **No** (no server on static hosting) | Free anonymous drop expires **2026-11-15** (30 days). Claim with a free account: 90 days from claim. | Browser smoke PASS (title, WebGL 2, 0 errors); offline solo runs to the timer with 0 errors; `rapier` asset 4.3 MB served |
| https://seven-fiction-unified-destinations.trycloudflare.com | Full game (server + client), Cloudflare Quick Tunnel | Yes (solo, online) | Yes, while the tunnel and sandbox run | Ends when the sandbox or cloudflared stops; URL changes on restart | `/healthz` 200; browser smoke PASS; earlier two-browser online test PASS |
| https://deb2184b04a123.lhr.life | Full game (server + client), localhost.run (restarted; the earlier `f8f859a807888e` tunnel had dropped, HTTP 502) | Yes (solo, online) | Yes, while the tunnel and sandbox run | Ends when the tunnel drops or the sandbox stops; no documented session limit | `/healthz` 200; browser smoke PASS, 0 errors (2026-10-16) |

## Not playable (tested)

- https://quiet-pine-ab3699fd.tunnl.gg (tunl.gg): browser gets a redirect warning page; WebSocket upgrade returns HTTP 307. Stopped.
- https://4e77328998210943-34-169-34-249.serveousercontent.com (Serveo): browser warning page blocks play. Stopped.
- https://orange-points-stay.loca.lt (localtunnel): password gate; now HTTP 408.
- https://oiods-34-169-34-249.free.pinggy.net (Pinggy): wrong content, WebSocket handshake HTTP 200 instead of 101.

## What "several days with multiplayer" still needs

A server that stays online. The static drop above does not provide one. Options: Northflank Sandbox (needs your account; see `DEPLOY.md`), or a paid host such as Fly.io at about $2.19/mo (`HOSTING_SURVEY.md`). To pair the static drop with a server, the client would need a `?server=` setting, which is not implemented yet.
