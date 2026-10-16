# SkyStunt.io — Feature checklist

Status key: **Done** = implemented and exercised by an automated test or a recorded browser run. **Partial** = implemented but with a known gap. **Implemented, untested** = code exists, no test evidence. **Not met** = not delivered.

Date of this check: 2026-10-15. Evidence refers to `docs/TEST_REPORT.md`.

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| 1 | Browser 3D stunt-racing game | **Partial** | Runs in a WebGL 2 browser. Playable locally and through a temporary public tunnel. Not durably deployed (see row 16). |
| 2 | Real vehicle physics (Three.js rendering + Rapier raycast vehicles) | **Done** | `shared/sim.js` uses Rapier 0.21 `DynamicRayCastVehicleController`, 60 Hz fixed step. Sim tests: throttle, brake, steering yaw, ramp airborne, fall respawn, idle scoring. |
| 3 | Four distinct tracks: Neon Skyline, Canyon Skyway, Volcanic Ruins, Glacier Overpass | **Done (build), Partial (AI)** | All four are defined in `shared/tracks.js` with their own theme and scenery. All four build and load in the browser. AI bots do not complete laps on them (see row 14 note and `KNOWN_LIMITATIONS.md`). |
| 4 | At least three modes: Grand Prix, Stunt Challenge, Survival Rush | **Done (code), Partial (tests)** | Mode IDs `grandprix`, `stunt`, `survival` in `shared/constants.js`. Automated tests exercise Grand Prix only; Stunt and Survival scoring/elimination rules are not covered by tests. |
| 5 | Server-authoritative multiplayer | **Done** | Server runs the physics (`server/room.js`), broadcasts snapshots at 20 Hz. Client sends inputs only. 21/21 multiplayer checks pass. |
| 6 | Quick play | **Done** | `join` with `quick: true` returns a room code and lobby. Verified locally and through the public tunnel. |
| 7 | Private room codes | **Done** | Create/join by 5-character code. Test: "bob joins alice". Browser test: second browser joins the room by code. |
| 8 | Bots fill to 8 racers | **Done** | Test: "race has 8 competitors (2 humans + 6 AI)". Lobby fill wait is 12 s (`LOBBY_FILL_SECONDS`). |
| 9 | Reconnect | **Done** | 20 s grace period (`reconnectGraceSec`). Test: Bob disconnects, car persists, reconnects with token, receives race state. |
| 10 | Offline mode | **Done** | Solo race runs the same `shared/sim.js` locally. Browser solo test: speed, position, timer, 0 console errors. |
| 11 | Polished UI (title, setup, lobby, pause, settings, results, HUD, minimap) | **Partial** | All screens are implemented in `src/main.js` and `src/game.js`. Checked by screenshots and headless browser runs only; no design review on real devices. |
| 12 | Touch and keyboard controls | **Partial** | Keyboard and touch are both implemented in `src/controls.js`. Keyboard was not driven by an automated test. Touch was never tested on a phone or tablet. |
| 13 | Tests | **Done (with one failing check)** | Multiplayer 21/21; sim 7/8; browser smoke, solo, online all pass with 0 console errors. The failing sim check is the AI lap test. |
| 14 | Research: ≥80 sources, ≥25 repositories, architecture comparison with 100-point matrix | **Done (counts), estimates only for scores** | 87 named sources (`docs/RESEARCH_REGISTER.md`), 26 repositories with API metadata (4 read in code), 100-point matrix with stated weights (`docs/ARCHITECTURE_MATRIX.md`). Scores are judgement, not measured. |
| 15 | Source deliverable | **Done** | Full project in `/home/user/skystunt`. Not a git repository. |
| 16 | Public HTTPS play link (with deployment) | **Partial** | Live public link: **https://modest-shirt-zza26.ship.place/** (static build, offline solo vs AI, expires 2026-11-15 unless claimed). Full game with multiplayer at temporary links (Cloudflare Quick Tunnel, localhost.run), which last only while this sandbox runs. A multi-day server with multiplayer is not deployed; it needs an account (Northflank Sandbox recommended). See `docs/PUBLIC_LINKS.md`, `docs/HOSTING_SURVEY.md`, `docs/DEPLOY.md`. |
| 17 | Multiplayer status | **Done** | Reported in `TEST_REPORT.md` (room flow, reconnect, malformed-input handling) and in the final message. |
| 18 | Feature checklist | **Done** | This file. |
| 19 | Test report | **Done** | `docs/TEST_REPORT.md`. |
| 20 | Research report | **Done** | `docs/RESEARCH_REPORT.md` states the counts, the depth of each source, and the limits. |
| 21 | Run and deploy instructions | **Done (local), Implemented-untested (Docker, Render)** | `README.md`. Docker is not installed in this sandbox, so the Dockerfile was not built. `render.yaml` was not deployed. |
| 22 | Known limitations | **Done** | `docs/KNOWN_LIMITATIONS.md`. |
| 23 | Third-party notices | **Done** | `THIRD_PARTY_NOTICES.md`. Tracks, cars and audio are original procedural assets. |

## Gameplay features

| Feature | Status | Notes |
|---|---|---|
| Four cars (Bolt, Dart, Titan, Viper) | Done (code) | Different engine force, grip and handling roles in `shared/cars.js`. Not tuned against each other with tests. |
| Stunt scoring (airtime, gap clears, clean landings, drifts) | Partial | Implemented in `updateStunts`. Verified only that an idle car scores 0. Scoring of real stunts is not tested. |
| Respawn on fall, flip, or stuck | Done | Fall and overturn covered by tests. "Stuck" respawn was added this session for wedged cars (see test report). |
| Hazards (spinning bars, swinging bars) | Partial | Implemented as sensors: they stun and cost boost but do not push the car. |
| Wind zones (Canyon) | Partial | Force applied in the sim. No visual effect is rendered. |
| Ghost cars (no car-to-car collision) | Done (by design) | Collision groups disable car-to-car contact. Listed as a limitation. |
| Own-car input prediction | Not met (by design) | Own car is interpolated, not predicted. Listed as a limitation. |
| Loops and alternative routes | Not met | Single-route tracks only. |
