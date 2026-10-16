# SkyStunt.io — Public links (as of 2026-10-16)

| Link | Type | Playable | Multiplayer | Lifetime | Verified |
|---|---|---|---|---|---|
| **https://skystunt-io.onrender.com** | **Full game (server + client), Render free web service (Node, Oregon)** | **Yes**: solo, online, 2-browser online room | **Yes** | Runs while the Render service is up. Free instances sleep after 15 min idle; keep-alive pings `/healthz` every 10 min. Render may restart free instances; rooms in memory are lost on restart. No card needed. | Deployed 2026-10-16 (`srv-db8takcs728c73b0mln0`); `/healthz` 200; multiplayer 20/21 (oversized-frame check differs, see TEST_REPORT); smoke PASS, solo PASS, online PASS, 0 errors; uptime continuous 13+ min with keep-alive |
| **https://modest-shirt-zza26.ship.place/** | Static build (offline solo) on ship.place (ship.page service) | **Yes**, solo vs AI offline | **No** (no server on static hosting) | Free anonymous drop expires **2026-11-15** (30 days). Claim with a free account: 90 days from claim. | Browser smoke PASS (title, WebGL 2, 0 errors); offline solo runs to the timer with 0 errors; `rapier` asset 4.3 MB served |
| https://seven-fiction-unified-destinations.trycloudflare.com | Full game (server + client), Cloudflare Quick Tunnel | Yes (solo, online) | Yes, while the tunnel and sandbox run | Ends when the sandbox or cloudflared stops; URL changes on restart | `/healthz` 200; browser smoke PASS; earlier two-browser online test PASS |
| https://deb2184b04a123.lhr.life | Full game (server + client), localhost.run (restarted; the earlier `f8f859a807888e` tunnel had dropped, HTTP 502) | Yes (solo, online) | Yes, while the tunnel and sandbox run | Ends when the tunnel drops or the sandbox stops; no documented session limit | `/healthz` 200; browser smoke PASS, 0 errors (2026-10-16) |

## Not playable (tested)

- https://quiet-pine-ab3699fd.tunnl.gg (tunl.gg): browser gets a redirect warning page; WebSocket upgrade returns HTTP 307. Stopped.
- https://4e77328998210943-34-169-34-249.serveousercontent.com (Serveo): browser warning page blocks play. Stopped.
- https://orange-points-stay.loca.lt (localtunnel): password gate; now HTTP 408.
- https://oiods-34-169-34-249.free.pinggy.net (Pinggy): wrong content, WebSocket handshake HTTP 200 instead of 101.

## Several-day multiplayer

The Render link above is the multi-day host. It was chosen because it needs no card. Northflank was dropped: its free Sandbox still required a payment method (HTTP 409). Multi-day stability is not yet proven: the service has run 13+ minutes with keep-alive, and days-long uptime, restarts, and capacity are untested. The static ship.place drop stays offline solo only.
