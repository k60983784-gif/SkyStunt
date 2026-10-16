# SkyStunt.io — Test report

Date: 2026-10-15. Environment: Node 20.20.2, Linux sandbox, headless Chromium via Playwright 1.64.1 with SwiftShader software WebGL (no GPU). All numbers below come from runs in this session. Nothing here is a measured result on real hardware.

## Summary

| Suite | Command | Result |
|---|---|---|
| Physics and rules (Node) | `node tests/sim.test.mjs` | **7 / 8 pass.** One failure: AI lap on Canyon Skyway. |
| Multiplayer protocol (local server) | `node tests/multiplayer.test.mjs http://localhost:8080` | **21 / 21 pass** |
| Multiplayer protocol (public tunnel, quick probe) | ad-hoc WebSocket probe | Welcome and lobby messages received by two clients |
| Browser smoke (title, WebGL 2) | `node tests/browser/smoke.mjs` | Pass, 0 console/page errors (local and public URL) |
| Browser solo race | `node tests/browser/solo.mjs` | Pass, 0 errors. Speed 49 km/h, position P8, timer running. |
| Browser online (two players) | `node tests/browser/online.mjs` | Pass, 0 errors (local and public URL). Both clients show 2 players in the same room. |
| Production build | `npx vite build` | Pass. Warning: a chunk is over 2000 kB (Rapier WASM, about 4.3 MB unminified/1.67 MB gzip). |

## Sim test detail (`tests/sim.test.mjs`)

| Check | Result | Measured |
|---|---|---|
| Throttle accelerates the car forward | PASS | 9.5 m/s after 3 s |
| Brake reduces speed | PASS | −0.8 m/s after 2 s braking |
| Steer right produces positive yaw | PASS | Peak yaw rate 1.45 rad/s |
| Bot drives over ramps and gets airborne | PASS | Airborne frames observed |
| Falling below kill plane triggers fell-respawn | PASS | reason `fell` |
| Respawned car is back on the road height | PASS | y = 1.60 |
| Idle car earns no stunt points | PASS | score 0 |
| **AI bot completes one lap on Canyon Skyway** | **FAIL** | laps = 0 after 200 s sim time, 15 respawns |

### Bot lap diagnostics (this session, not in the test suite)

- **Gap-free road:** with ramps, gaps, hazards and wind removed in-process, the same bot completes one lap in 76 s on Canyon (0 respawns) and in 83 s on Neon (2 respawns).
- **Real tracks, 200 s sim time, seeds 1 and 2:** the bot completes **0 laps on all four tracks** (respawns per run: Canyon 15, Neon 21–22, Volcanic 16–24, Glacier 22).
- **Failure point:** the bot launches off the ramp at about 24 m/s and lands outside the road, or stalls on the approach hump at lower speed. The failure is in the jump sections, not in steering on flat road.
- **Tried and rejected:** a speed cap on approach to gaps, at 8, 11, 14, 16, 18, 22 and 28 m/s with look-ahead 20 and 40 samples. None produced a lap. The change was reverted.

### Fix made this session

- **Wedged cars never reset.** A car with speed under 1 m/s and zero wheel contacts (for example resting on a hazard or a wall edge) had no reset rule. On Neon it stayed frozen for the whole race (0 respawns, y ≈ 18). Added: wedged for 3 s → respawn with reason `stuck`. After the change, that case respawns (21 respawns in the same run) instead of freezing. The test suite result was unchanged (7/8).

## Multiplayer detail (`tests/multiplayer.test.mjs`, 21 / 21)

Health endpoint OK · Alice receives welcome with room code · Bob joins Alice · lobby shows both humans · race starts (countdown and racing states) · race has 8 competitors (2 humans, 6 AI) · exactly two human cars · both clients see `phase=racing` · each client sees the other · Alice's throttle moves her car as seen by Bob · server reports speed for Alice's car · Bob (no input) stays near grid · AI bots move under server control · Bob's car persists during grace after disconnect · Bob reconnects with his token and gets the same room · reconnected Bob receives race state · malformed JSON gets an error reply and the server stays up · health still OK afterwards · oversized payload (>1 KB) closes that socket only (close code 1009) · leave message accepted.

## Public link checks (this session)

- `GET /healthz` through the tunnel returned `ok: true`, version 1.0.0, physicsHz 60, snapshotHz 20, maxHumansPerRoom 8.
- `GET /` returned HTTP 200 (2,095 bytes HTML shell).
- Quick-play WebSocket probe: two clients got `welcome` and `lobby` messages. The room code returned in the probe was BXOZG.
- Two-browser online test through the tunnel: both clients reached 2 players in room W6FRH, with 0 errors.

## Not tested

- Real GPU frame rate. SwiftShader runs at a few fps at 1280×760, so FPS was not measured.
- Touch input on a phone or tablet.
- Keyboard input through a browser automation test (only input messages sent over WebSocket were tested).
- Stunt Challenge and Survival Rush rules through automated tests.
- All 8 humans in one room (only 2-human rooms tested).
- Load testing, long sessions, and reconnection across a server restart.
- Docker image build (Docker is not installed in this sandbox).
- Render or any other hosting platform deployment.

## Reproduce

```bash
npm install --legacy-peer-deps
npx vite build
PORT=8080 node server/index.js &
node tests/sim.test.mjs
node tests/multiplayer.test.mjs http://localhost:8080
node tests/browser/smoke.mjs http://localhost:8080/ /tmp/title.png
node tests/browser/solo.mjs http://localhost:8080/
node tests/browser/online.mjs http://localhost:8080/
```

Browser tests need `npx playwright install chromium` and the system libraries that Chromium requires (`sudo npx playwright install-deps chromium` worked in this sandbox).

## Re-run and additional checks (2026-10-16, goal-mode pass)

Run on the same code as before (`shared/` unchanged; `shared/sim.js` verified identical to the clean copy).

| Suite | Command | Result |
|---|---|---|
| Physics and rules | `node tests/sim.test.mjs` | **7 / 8.** Same single failure: Canyon lone-bot lap (laps 0, respawns 15, 197 s). |
| Multiplayer protocol | `node tests/multiplayer.test.mjs http://localhost:8080` | **21 / 21** |
| Browser solo | `node tests/browser/solo.mjs http://localhost:8080/` | Pass, 0 errors, timer running (29.4 s) |
| Browser online (2 players) | `node tests/browser/online.mjs http://localhost:8080/` | Pass, 0 errors, 2 players seen in the room |
| Browser smoke, public links | `node tests/browser/smoke.mjs <url>` | Cloudflare quick tunnel PASS and localhost.run PASS (earlier in this pass); tunl.gg FAIL (redirect warning page) |

### Canyon lap experiments (scratch only, not shipped)

Goal: a straighter line for the lone bot on Canyon. Each variant runs in its own process, because `getTrack` caches the built track.

| Variant | Gap placement (track t) | Seeds 1 and 2 |
|---|---|---|
| Base | gap-1 1.92–2.10; gap-2 5.70–5.90 | laps 0, respawns 15 |
| gap-1 moved to a straight window | gap-1 0.34–0.52 | laps 0, respawns 24 |
| gap-2 moved to a straight window | gap-2 0.34–0.52 | laps 0, respawns 24 |
| Both moved to straight windows | 0.34–0.52 and 0.60–0.78 | laps 0, respawns 24 |

**Result: none passes; all three moves are worse than the base.** Not adopted. `shared/tracks.js` is unchanged. Scripts: `scratch/canyon_one.mjs`.

## Hosting checks (2026-10-16)

See `HOSTING_SURVEY.md` for the full list. Summary of what was run here:

- Cloudflare quick tunnel: `/healthz` 200, browser smoke PASS.
- localhost.run: `/healthz` 200 and browser smoke PASS earlier; HTTP 502 at the last check (tunnel dropped).
- tunl.gg: tunnel issued with no account, but the browser gets a redirect warning page, and the WebSocket upgrade gets HTTP 307. Not playable.
- tuns.sh: rejected with `Permission denied (publickey)`. Needs a key-based account.
- Serveo: WebSocket works; browser warning page blocks play (earlier run).
- localtunnel: now returns HTTP 408. Dead.
- Pinggy free: wrong content length and WebSocket handshake gives HTTP 200, not 101 (earlier run).

## Still not tested

- Several-day uptime of any host (no host has been run for more than a few hours).
- Northflank, Render, Koyeb, Railway, Fly, Zeabur, Hugging Face: not deployed (accounts needed; see `DEPLOY.md`).
- Real-GPU frame rate, touch input, rooms with more than 2 humans, reconnect after a server restart, and load testing: unchanged from the list above.

## Render deploy checks (2026-10-16)

Target: https://skystunt-io.onrender.com (fresh GitHub clone at `263cbf8`; Render build `npm ci --legacy-peer-deps && npx vite build`; start `node server/index.js`).

| Check | Result |
|---|---|
| Clean clone build and run locally | PASS (`vite build` exit 0; `/healthz` 200; index 200, 2095 B) |
| Render deploy | live, about 40 s from create (`dep-db8takcs728c73b0mln0`) |
| `/healthz` and index on Render | 200 |
| `tests/multiplayer.test.mjs` on Render | 20/21. Failed: "oversized payload closes that socket only" (expected close 1009; got 1006 after about 5 s, socket still open for the test). Other 20 pass, including reconnect and malformed JSON. Localhost run 21/21 |
| `tests/browser/smoke.mjs` on Render | PASS (WebGL 2, 0 console errors) |
| `tests/browser/solo.mjs` on Render | PASS (0 errors, timer 00:31.65) |
| `tests/browser/online.mjs` on Render | PASS (2 browsers, same room, 2 players seen, 0 errors) |
| Keep-alive | Ping at start (200) and at +10 min (200). Uptime continuous (790 s at 07:55 UTC, no restart) |

Not tested here: days-long uptime, restarts, sleep after 15 min without pings, load with 4 rooms, touch on a device.
