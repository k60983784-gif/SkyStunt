# SkyStunt.io — Architecture comparison (100-point matrix)

**Status: scored by judgement, not measured.** No benchmark was run for any option. Each score is an estimate. Source IDs (R, F, S) point to `RESEARCH_REGISTER.md`. A cell marked "judgement" has no direct source. Treat the total as ±5 points. The matrix is a decision aid, not proof.

## Weights (fixed before scoring, total 100)

| # | Criterion | Weight | What it measures |
|---|---|---:|---|
| C1 | Fit with an authoritative Rapier simulation shared with offline mode | 15 | Can the same `shared/sim.js` run on the server and offline? |
| C2 | Licence and dependency risk | 10 | Permissive licence, maintained, no lock-in |
| C3 | Build effort to a working game (remaining, from this point) | 15 | Work still needed to reach a playable, tested state |
| C4 | Reconnect and room lifecycle | 10 | Seat hold, reconnect token, room cleanup |
| C5 | Transport efficiency and latency | 10 | Message size, framing, head-of-line blocking |
| C6 | Security and input validation | 10 | Input validation, rate limits, server authority |
| C7 | Hosting footprint (fit for free or cheap temporary hosting) | 10 | One process, one port, no UDP, no extra database |
| C8 | Testability in this repo | 10 | Automated tests possible without special infrastructure |
| C9 | Maintenance health | 10 | Recent commits, stars, bus factor |

## Options

- **A. Custom authoritative `ws` server with shared Rapier sim** (what is shipped).
- **B. Colyseus** (rooms, schema state sync, reconnection built in).
- **C. Nakama** (managed game backend, authoritative match handler).
- **D. geckos.io** (UDP-like data channels over WebRTC, Node server).
- **E. Socket.IO with a custom room loop**.
- **F. Peer-to-peer WebRTC, client authoritative** (no game server).

## Scores (out of each weight)

| Criterion (weight) | A ws | B Colyseus | C Nakama | D geckos | E Socket.IO | F P2P |
|---|---:|---:|---:|---:|---:|---:|
| C1 Sim fit (15) | 14 | 9 | 5 | 10 | 13 | 6 |
| C2 Licence/deps (10) | 10 | 10 | 9 | 9 | 10 | 10 |
| C3 Remaining effort (15) | 12 | 11 | 6 | 7 | 9 | 6 |
| C4 Reconnect/rooms (10) | 6 | 9 | 8 | 5 | 8 | 3 |
| C5 Transport (10) | 7 | 8 | 7 | 10 | 6 | 9 |
| C6 Security (10) | 6 | 7 | 9 | 6 | 6 | 2 |
| C7 Hosting footprint (10) | 8 | 8 | 5 | 5 | 8 | 10 |
| C8 Testability (10) | 8 | 8 | 6 | 5 | 7 | 4 |
| C9 Maintenance (10) | 6 | 9 | 8 | 6 | 9 | 6 |
| **Total (100)** | **77** | **79** | **63** | **63** | **76** | **56** |

## Reasons for each score

**A. Custom `ws` + shared Rapier sim**
- C1 14: one simulation runs on the server and offline (`shared/sim.js`). Tests confirm both paths (`tests/sim.test.mjs`, `tests/multiplayer.test.mjs`).
- C2 10: `ws` is MIT (R10). Rapier is Apache-2.0 (R06).
- C3 12: already built and tested. Remaining work: Canyon bot lap, touch, real-GPU FPS.
- C4 6: 20 s grace and token reconnect exist (tested). No general seat-reservation API.
- C5 7: JSON text over WebSocket at 20 Hz snapshots (S17 uses a similar rate). Head-of-line blocking applies (S36).
- C6 6: validation, `maxPayload` 1024, and rate limits exist. No auth, accounts, or anti-cheat beyond server authority.
- C7 8: one Node process and one port. Works with HTTP tunnels (tested, see `HOSTING_SURVEY.md`).
- C8 8: 21 multiplayer checks, 8 sim checks, and 3 browser scripts.
- C9 6: small custom codebase. Bus factor is one.

**B. Colyseus**
- C1 9 (judgement): Colyseus state is its own schema. Running Rapier inside a room tick is possible, but the state would need mapping to the shared sim.
- C2 10: MIT (R08).
- C3 11: would need rewriting the room and state layers. Not started.
- C4 9: `allowReconnection(client, seconds)` and reconnection tokens (S11, S12).
- C5 8: binary schema patches (S11/S13 describe state patches; binary encoding is judgement).
- C6 7: matchmaking and auth hooks (judgement).
- C7 8: plain Node server (judgement).
- C8 8: room test utilities (judgement).
- C9 9: 7,369 stars, pushed 2026-10-15 (R08); schema repo pushed 2026-10-14 (R09).

**C. Nakama**
- C1 5: server logic runs in Lua, TypeScript, or Go (S26, S28). Running Rapier there is not a natural fit (judgement).
- C2 9: Apache-2.0 (R11).
- C3 6: a new backend and runtime to learn; not started.
- C4 8: match join, leave, and presence handling (S26, S27).
- C5 7: authoritative match with a tick rate (S27).
- C6 9: built-in accounts and auth (judgement).
- C7 5: needs a database and a Nakama server process (judgement). Heavier than one Node process.
- C8 6: local Nakama instance needed for tests (judgement).
- C9 8: 13,515 stars, pushed 2026-10-14 (R11).

**D. geckos.io**
- C1 10: Node server can run the sim (judgement).
- C2 9: BSD-3-Clause (R12).
- C3 7: WebRTC setup and new transport to learn.
- C4 5: needs a custom reconnect scheme (judgement).
- C5 10: unordered, unreliable data channels avoid head-of-line blocking (S35, S36, S37).
- C6 6: a UDP-like path exposes more surface (judgement).
- C7 5: WebRTC needs ICE and STUN/TURN (S37 says this is complex); tunnels and free hosts usually do not carry UDP (judgement; localhost.run and Cloudflare tunnels are HTTP/S only, per F15 and S38).
- C8 5: harder to test in headless browsers (judgement).
- C9 6: last push 2026-03-27 (R12). Older than the others.

**E. Socket.IO + custom room loop**
- C1 13: same sim fit as A; transport is different.
- C2 10: MIT (R13).
- C3 9: a rewrite of the transport layer; the sim is reused.
- C4 8: connection state recovery (judgement).
- C5 6: extra framing per message (judgement).
- C6 6: same as A (judgement).
- C7 8: plain Node server (judgement).
- C8 7: needs a Socket.IO client in tests (judgement).
- C9 9: 63,220 stars, pushed 2026-09-29 (R13).

**F. Peer-to-peer WebRTC, client authoritative**
- C1 6: no single authority, so the same sim cannot decide results (judgement; S16 notes the security cost).
- C2 10: no server-side licence (judgement).
- C3 6: signalling, ICE, and peer mesh needed (S37).
- C4 3: host migration and reconnection are hard (judgement).
- C5 9: unreliable data channels (S35, S36).
- C6 2: clients can cheat (S16 says this directly).
- C7 10: no game server, but still needs signalling and TURN for some networks (judgement).
- C8 4: multi-peer tests are hard to automate (judgement).
- C9 6: depends on the library chosen (judgement).

## Result and interpretation

- **Colyseus (79) edges out the shipped custom `ws` design (77) on the base weights.** The gap is inside the ±5 uncertainty. Socket.IO (76) is close too. This matrix does not prove the earlier decision was best.
- **Why A stays for now:** A already passes its tests (21/21 multiplayer, 8/8 sim except the disclosed Canyon lap), and switching to B would mean redoing rooms and state sync. The 2-point lead for B is inside the uncertainty, and switching now means rewriting rooms and state sync (already counted in C3). This is a judgement call, not a score-driven one.
- **Options D and F lose** on hosting (C7) and reconnect or security (C4, C6). Both need UDP or WebRTC, which the free tunnels in `HOSTING_SURVEY.md` cannot carry.

## Sensitivity check (judgement, computed)

Two re-weightings were computed from the scores above. Each option's score on a criterion is rescaled by (new weight ÷ original weight). "No C3" removes build effort and rescales the rest to 100.

| Variant | A ws | B Colyseus | C Nakama | D geckos | E Socket.IO | F P2P |
|---|---:|---:|---:|---:|---:|---:|
| Base (table above) | 77.0 | 79.0 | 63.0 | 63.0 | 76.0 | 56.0 |
| Remove C3 (build effort), rescale to 100 | 76.5 | 80.0 | 67.1 | 65.9 | 78.8 | 58.8 |
| C1 sim fit 25, C3 build effort 5 | 78.3 | 77.7 | 62.3 | 65.0 | 78.7 | 56.0 |

Reading: Colyseus, custom `ws`, and Socket.IO are within about 3.5 points of each other in every variant. Nakama, geckos, and P2P are consistently lower. The top three are too close to call on these estimates. The shipped option stays as is because of its tested state, not because the matrix picks it outright.
