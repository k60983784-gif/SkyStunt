# SkyStunt.io

Browser 3D stunt racing. Real raycast-vehicle physics (Rapier, 60 Hz fixed step), four distinct tracks, three game modes, server-authoritative multiplayer rooms with AI fill, and an offline solo mode.

## Layout
- `shared/` — simulation used by both the server (authority) and the browser (offline mode): `sim.js` (physics, race rules, stunt scoring, bots), `tracks.js` (track generation), `cars.js`, `constants.js`, `protocol.js` (message validation), `math.js`.
- `server/` — `index.js` (HTTP static + `/healthz` + WebSocket `/ws`, matchmaking, rate limits), `room.js` (room lifecycle, lobby, bot fill, reconnect grace).
- `src/` — client: `main.js` (menus), `game.js` (race runtime, interpolation, HUD), `render.js` (Three.js world), `net.js`, `controls.js` (keyboard + touch), `audio.js` (synth audio).
- `tests/` — `sim.test.mjs` (physics/rules, Node), `multiplayer.test.mjs` (two WebSocket clients vs a running server), `browser/*.mjs` (Playwright).

## Run locally
Requirements: Node.js 20.19+ (tested on 20.20.2), npm, a WebGL 2 browser.
```bash
npm install --legacy-peer-deps
npx vite build          # produces dist/
npm start               # http://localhost:8080  (health: /healthz)
```
Development client with hot reload: `npx vite` (port 5173); it talks to the server on `/ws` through the same origin only when the server is also running, so for multiplayer use `npm start` against the built client.

## Tests
```bash
node tests/sim.test.mjs                               # physics and rules (no server needed)
node tests/multiplayer.test.mjs http://localhost:8080 # needs the server running
node tests/browser/smoke.mjs http://localhost:8080/ /tmp/title.png   # needs: npx playwright install chromium (+ system libs)
node tests/browser/solo.mjs http://localhost:8080/
node tests/browser/online.mjs http://localhost:8080/
```

## Configuration
Environment variables (see `.env.example`): `PORT`, `HOST`, `MAX_ROOMS`, `MAX_CONNECTIONS`, `SKYSTUNT_LOG`. No secrets are required.

## Deploy
- Full steps: `docs/DEPLOY.md`. Hosting results: `docs/HOSTING_SURVEY.md`.
- Temporary public link (ends with this machine's process): `scripts/temp-public-link.sh localhost.run` (or `cloudflare`).
- Docker: `docker build -t skystunt . && docker run -p 8080:8080 skystunt`. Health check: `GET /healthz`. Not built in the sandbox (Docker not installed).
- Render: `render.yaml` is included, but the free tier sleeps and drops WebSocket connections, so use the paid plan there.
- Public link (static, offline solo only, expires 2026-11-15 unless claimed): https://modest-shirt-zza26.ship.place/ . Packaged in `deploy/skystunt-static.zip`.
- Multi-day hosting WITH multiplayer is NOT deployed. The recommended option is Northflank Sandbox (needs an account).

## Docs
- `docs/FEATURE_CHECKLIST.md` — every requested feature with status and evidence.
- `docs/TEST_REPORT.md` — test results and what was not tested.
- `docs/RESEARCH_REPORT.md` — research summary and status against the brief.
- `docs/RESEARCH_REGISTER.md` — 87 named sources (26 repositories, 17 fetched pages, 45 search results) with the claim used.
- `docs/ARCHITECTURE_MATRIX.md` — 100-point architecture comparison (estimates, not measurements).
- `docs/HOSTING_SURVEY.md` — every temporary and free host checked, with results.
- `docs/DEPLOY.md` — run, tunnel, Docker, and several-day deploy steps.
- `docs/KNOWN_LIMITATIONS.md` — gameplay, platform, hosting and research limitations.

## Known limitations
Summary (full list in `docs/KNOWN_LIMITATIONS.md`): AI bots do not complete laps on the four real tracks (they finish gap-free road only); cars do not collide with each other; own-car input is not predicted; hazards are sensors; touch was not tested on a device; there is no durable public deployment; research target was not met.
