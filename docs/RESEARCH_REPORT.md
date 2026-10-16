# SkyStunt.io — Research report

Status as of 2026-10-16. Full source list: `RESEARCH_REGISTER.md`. Scored comparison: `ARCHITECTURE_MATRIX.md`. Hosting survey: `HOSTING_SURVEY.md`.

## Against the brief

| Target | Required | Done | Status |
|---|---|---|---|
| Sources | ≥ 80 | **87** named sources with URL and claim (26 repositories, 17 fetched pages, 45 search-result pages) | Met on count. Depth varies: 4 repos read in code, 22 repos by metadata only, search results read as snippets. |
| Repositories | ≥ 25 | **26** with GitHub API metadata (stars, licence, last push, archived flag) | Met on count. Only 4 read in code (see below). |
| 100-point architecture matrix | Required | **Produced**, with stated weights, per-cell reasons, and sensitivity checks | Met. Scores are estimates, not measurements. |
| Research register (file) | Implied | `RESEARCH_REGISTER.md` | Done |

Earlier in the project this report said the target was not met. That was true at the time. The register and matrix now close the gap. The earlier decision not to build the matrix was reversed in the goal-mode pass.

## Conclusions the project relies on

| Decision | Basis | Confidence |
|---|---|---|
| Rapier for vehicle physics | Official vehicle controller docs: a single rigid body with ray-cast wheels (S23, S24). | Verified from docs. Real-hardware performance not measured. |
| Three.js for rendering | Used by the game (R07). | Verified (library and licence). |
| Custom authoritative `ws` server with a shared sim (not Colyseus, not Nakama) | Matrix: A 77, B Colyseus 79, C Nakama 63. Colyseus is slightly higher on the base weights. The gap is within the ±5 uncertainty. The choice depends on weights: see the sensitivity section of the matrix. | Judgement. The earlier decision rests on working tested code, not on the matrix alone. |
| Ghost cars (no car-to-car collision) | Scope decision. Not based on a source. | Scope decision. |
| Own-car interpolation without prediction | Snapshot interpolation (S14) and Source's 100 ms interpolation delay (S17) are the standard approach. Prediction is the known gap (see limitations). | Verified from articles. Not implemented here. |
| No WebRTC / P2P | WebRTC needs STUN/ICE/TURN for dedicated servers and is hard to host (S37). Free tunnels are HTTP/S only (F15, S38). | Verified from docs and articles. |
| Hosting: no free always-on host verified | `HOSTING_SURVEY.md`. | Tested and from pages. |

## Repositories read in code (4)

Read for comparison only. No code was copied (see `THIRD_PARTY_NOTICES.md`).

| Repository | Licence | What it showed | How it was used |
|---|---|---|---|
| manuelhintermayr/three-js-car-example (R01) | MIT | Three.js + Rapier car demo; gravity and force-cap tuning | Tuning reference only |
| yassinsolim/nordschleife-racer (R02) | MIT | TypeScript + Three.js with custom physics and Supabase realtime | Architecture comparison; Supabase rejected |
| phoenix-cgv/neon-rush (R03) | none set | Vite + Rapier racer | Layout reference only; no code copied |
| MumenOsman/vimvim-racing (R04) | none set | 2D DOM racer with a Node WebSocket room pattern | Room-flow reference only; no code copied |

## Known gaps in this research

- Some search-result sources from earlier in the session have no saved URL, so they are not counted.
- The matrix has no benchmark behind it. Every score is a judgement with a stated reason.
- The earlier research notes named sites (Colyseus, Vite, Rapier examples) without URLs. Those are excluded from the 81.
