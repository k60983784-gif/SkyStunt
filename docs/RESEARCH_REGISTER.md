# SkyStunt.io — Research register

Each row is a source I can name with a URL and the claim I used it for. Counts below are for this register only, not for anything I have not written here.

**Evidence types**
- **R** = GitHub REST API metadata (stars, license, last push, archived flag). Code was NOT read for these, except the four repos listed in the "read" column of the table in `RESEARCH_REPORT.md`.
- **F** = page fetched with the fetch tool and read.
- **S** = search result snippet read (the page itself was not opened).

**Counts**
- Repositories: 26 (R01–R26), all returned metadata.
- Fetched pages: 17 (F01–F17).
- Search-result pages: 45 (S01–S45).
- Total distinct sources: 87.

Sources that were visited but returned no usable data are NOT counted: the Northflank docs path `/docs/v1/application/getting-started/pricing-plans` (HTTP 404), `bore.pub` (unreachable), and `oracle.com` (HTTP 403). Earlier search results from before the current context window are not counted either, because I no longer have their URLs.

## Repositories (R)

| ID | Repository | Stars | License | Last push | Archived | Note used for |
|---|---|---|---|---|---|---|
| R01 | manuelhintermayr/three-js-car-example | 0 | MIT | 2026-09-07 | no | Three.js + Rapier car demo; tuning reference (read) |
| R02 | yassinsolim/nordschleife-racer | 3 | MIT | 2026-06-27 | no | TypeScript + Three.js, custom physics, Supabase realtime (read) |
| R03 | phoenix-cgv/neon-rush | 0 | none | 2026-10-14 | no | Vite + Rapier racer, no license: layout reference only (read) |
| R04 | MumenOsman/vimvim-racing | 1 | none | 2026-09-29 | no | 2D racer, Node WebSocket room pattern; no license (read) |
| R05 | dimforge/rapier.js | 698 | Apache-2.0 | 2026-07-12 | **yes** | Repo archived; development moved into dimforge/rapier `typescript/` |
| R06 | dimforge/rapier | 5873 | Apache-2.0 | 2026-10-10 | no | Physics engine used by the game |
| R07 | mrdoob/three.js | 116477 | MIT | 2026-10-16 | no | Renderer used by the game |
| R08 | colyseus/colyseus | 7369 | MIT | 2026-10-15 | no | Alternative server framework (matrix option B) |
| R09 | colyseus/schema | 172 | MIT | 2026-10-14 | no | State-sync library used by Colyseus |
| R10 | websockets/ws | 22808 | MIT | 2026-10-13 | no | WebSocket library used by the game |
| R11 | heroiclabs/nakama | 13515 | Apache-2.0 | 2026-10-14 | no | Game backend, authoritative match model (matrix option C) |
| R12 | geckosio/geckos.io | 1488 | BSD-3-Clause | 2026-03-27 | no | UDP-like transport over WebRTC (matrix option D) |
| R13 | socketio/socket.io | 63220 | MIT | 2026-09-29 | no | Alternative transport (matrix option E) |
| R14 | pmndrs/cannon-es | 2064 | MIT | 2024-01-06 | no | Alternative JS physics engine; stale since 2024 |
| R15 | schteppe/cannon.js | 5007 | MIT | 2023-08-04 | no | Original cannon.js; stale since 2023 |
| R16 | BabylonJS/Babylon.js | 26168 | Apache-2.0 | 2026-10-15 | no | Alternative 3D engine (not chosen) |
| R17 | playcanvas/engine | 17059 | MIT | 2026-10-16 | no | Alternative 3D engine (not chosen) |
| R18 | pmndrs/react-three-rapier | 1454 | MIT | 2026-10-12 | no | React binding for Rapier (not used; no React here) |
| R19 | pmndrs/react-three-fiber | 33004 | MIT | 2026-10-16 | no | React renderer for Three.js (not used) |
| R20 | vitejs/vite | 83341 | MIT | 2026-10-15 | no | Build tool used by the game |
| R21 | uNetworking/uWebSockets.js | 9175 | Apache-2.0 | 2026-10-11 | no | Faster WebSocket server for Node (not used; native build) |
| R22 | godotengine/godot | 118482 | MIT | 2026-10-15 | no | Alternative game engine (not chosen) |
| R23 | enable3d/enable3d | 1180 | LGPL-3.0 | 2026-08-31 | no | Three.js framework with ammo.js (not chosen; LGPL) |
| R24 | lance-gg/lance | 1720 | Apache-2.0 | 2024-05-11 | no | Node multiplayer framework; stale since 2024 |
| R25 | pmndrs/drei | 9967 | MIT | 2026-10-05 | no | React helpers (not used) |
| R26 | microsoft/playwright | 97823 | Apache-2.0 | 2026-10-16 | no | Browser test framework used by `tests/browser/` |

Caveat for R03/R04: no license is set, so no code was copied from them. Reading the layout was allowed; reusing code was not.

## Fetched pages (F)

| ID | URL | Date / basis | Claim used |
|---|---|---|---|
| F01 | https://render.com/docs/free | official docs | Free web services sleep after 15 minutes without traffic and may restart at any time |
| F02 | https://www.koyeb.com/docs/reference/instances | official docs | Free instance scales to zero after 1 hour; one free instance per organisation |
| F03 | https://huggingface.co/docs/hub/spaces-overview | official docs | Free CPU Spaces sleep after 48 h of inactivity; Docker Spaces need a paid plan (per project notes) |
| F04 | https://docs.railway.com/pricing/plans | official docs | Railway plan structure and credit model |
| F05 | https://snapdeploy.dev/koyeb-alternative | vendor page (a competitor's marketing) | Comparison claims; treated as opinion, not fact |
| F06 | https://docs.fly.io/about/pricing (via fly.io/docs/about/pricing) | official docs | No free tier for new orgs; smallest always-on Machine $2.19/mo; Managed Postgres from $38/mo |
| F07 | https://zeabur.com/pricing | official pricing | Free $0 plan: 1 self-managed server, build CI 2C4G, 48 h log retention; hosted-runtime limits not stated |
| F08 | https://northflank.com/pricing | official pricing | Sandbox tier: "Always-on compute – no sleeping", 2 free services, 1 free database, 2 free cron jobs. CPU/memory of free services not stated |
| F09 | https://replit.com/pricing | official pricing | Core $20/mo, Pro $100/mo; no free always-on hosting |
| F10 | https://blog.glitch.com/post/goodbye-glitch | official announcement (July 23, 2025) | Glitch ended project hosting; dashboards available until start of 2026 |
| F11 | https://blog.glitch.com/ | official blog index | Confirms the shutdown post is current |
| F12 | https://sevalla.com/pricing | official pricing | Static sites free (1 GB per site, 100 GB bandwidth); app hosting from $5/mo |
| F13 | https://ngrok.com/pricing | official pricing | Free: $5 one-time credit, 3 endpoints, 1 GB, interstitial page on HTTP/S endpoints; account required |
| F14 | https://developers.cloudflare.com/workers/platform/limits/ | official docs | Workers Free: 10 ms CPU per request, 128 MB memory, 50 subrequests |
| F15 | https://localhost.run/docs/ | official docs | `ssh -R 80:localhost:8080 localhost.run` gives a public URL; no account needed for free domains. No session length stated |
| F16 | https://ship.page/ | official pricing and FAQ | Anonymous static drops, no account; Free drops live 30 days (90 with a free account); Pro $4/mo, drops never expire, API keys; static files only, no Node |
| F17 | https://tree-nail-g4qi9.ship.place/ | user-supplied example site, fetched | A static site already live on ship.place (used to identify the host; its content is not used) |

## Search-result pages (S)

| ID | URL | Claim used |
|---|---|---|
| S01 | https://northflank.com/blog/best-persistent-sandbox-platforms | Sandbox: always-on, no sleeping, 2 services, 1 database, 2 cron jobs; no fixed session limit on sandboxes |
| S02 | https://outmano.com/tools/northflank/pricing | Same Sandbox limits as F08 (secondary) |
| S03 | https://northflank.com/blog/render-alternatives | Smallest paid Northflank compute: $2.70/mo (0.1 shared vCPU, 256 MB) |
| S04 | https://northflank.com/blog/top-daytona-io-alternatives-for-running-ai-code-in-secure-sandboxed-environments | Northflank pricing: $0.01667/vCPU-hr, $0.00833/GB-hr |
| S05 | https://aiidelist.com/ide/northflank | Sandbox $0/mo: always-on, 2 services, 1 database, 2 cron jobs (secondary) |
| S06 | https://aicredits.dev/submissions/170-northflank-free-developer-sandbox-2-services-database | Third-party, AI-generated listing: says Sandbox compute is "limited" and suggests 0.1–1 vCPU, ~512 MB. UNVERIFIED |
| S07 | https://www.budgetforge.dev/tools/northflank-pricing-2026 | Northflank bills the requested resources, not usage (secondary) |
| S08 | https://dev.to/instatunnel/zero-install-tunneling-in-2026-the-developers-complete-guide-to-agentless-localhost-proxies-321o | SSH -R tunnels; claims a 60-minute cap on some free tiers (secondary, vendor-adjacent) |
| S09 | https://instatunnel.my/blog/the-zero-install-ssh-rebellion-bypassing-corporate-firewalls-with-localhost-tunnels | Says localhost.run free has no session time limit and rotating domains; Pinggy free 60-minute cap. Third-party, UNVERIFIED against localhost.run's own terms |
| S10 | https://github.com/anderspitman/awesome-tunneling | Lists tunl.gg (free, 24 h, no account) and tuns.sh (free 60-minute sessions, key-based) |
| S11 | https://docs.colyseus.io/room/reconnection | Colyseus reconnection: allowReconnection(), automatic retry, manual reconnection token |
| S12 | https://0-14-x.docs.colyseus.io/colyseus/server/room/ | Colyseus 0.14 room API: allowReconnection(client, seconds) |
| S13 | https://docs.colyseus.io/faq | Colyseus: rooms are ephemeral by default; persist state yourself |
| S14 | https://gafferongames.com/post/snapshot_interpolation/ | Snapshot interpolation: buffer snapshots, interpolate; more send rate lowers the delay |
| S15 | https://www.reddit.com/r/gamedev/comments/1l51yqs/is_this_level_of_jitter_acceptable_with_just/ | Community note: snapshot interpolation is not a substitute for prediction on predicted objects (opinion) |
| S16 | https://gafferongames.com/post/networked_physics_in_virtual_reality/ | Network models: lockstep, client/server with prediction, distributed; jitter buffer |
| S17 | https://developer.valvesoftware.com/wiki/Net_graph | Source: ~20 snapshots/s; entity interpolation delay 100 ms; lag compensation keeps a 1 s history |
| S18 | https://gist.github.com/CoolOppo/fe0586836de3fb2f90f9 | Copy of the Valve networking notes (secondary) |
| S19 | https://www.reddit.com/r/truetf2/comments/14t5c3/hl2source_networking_cvars_explained_and_detailed/ | cl_interp default 0.1 s (secondary) |
| S20 | https://kuberns.com/blogs/deploy-nodejs-on-render/ | Render free: sleeps after 15 min; sleeping closes WebSocket connections (secondary, blog) |
| S21 | https://servercompass.app/blog/render-pricing-is-it-worth-it | Render free: 750 h/mo, spin-down after 15 min, 512 MB RAM (secondary) |
| S22 | https://kuberns.com/blogs/websocket-hosting-platforms/ | Table: Render free services can spin down; paid services stay active (secondary) |
| S23 | https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html | Rapier raycast vehicle: addWheel, suspension stiffness, wheel contact getters |
| S24 | https://rapier.rs/docs/user_guides/javascript/vehicle_controller/ | Rapier vehicle is one rigid body with ray-cast wheels; exclude the chassis from the rays |
| S25 | https://www.gamedevpensieve.com/physics/physics_controllers/physics_controllers_vehicle | Suspension force formula and wheel settings (secondary) |
| S26 | https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/ | Nakama authoritative match: match_init, match_join, match_loop, tick rate |
| S27 | https://heroiclabs.com/docs/nakama/concepts/multiplayer/ | Nakama: relayed vs authoritative multiplayer; authoritative needs custom server code |
| S28 | https://github.com/heroiclabs/nakama-docs/blob/master/docs/nakama/concepts/server-authoritative-multiplayer.md | Match handler API and dispatcher (secondary) |
| S29 | https://huggingface.co/docs/huggingface_hub/en/package_reference/space_runtime | Free CPU Spaces sleep after 48 h without requests; upgraded hardware never sleeps by default |
| S30 | https://discuss.huggingface.co/t/my-space-was-paused-and-503-when-i-restart/171477 | Forum report: a Docker Space that fails to start returns 503 on restart (user report, not official) |
| S31 | https://www.eesel.ai/blog/hugging-face-pricing | Spaces sleep after 48 h on the free CPU tier (secondary) |
| S32 | https://temps.sh/blog/railway-pricing-2026 | Railway Free: $1/mo usage credit; $20 per vCPU-mo, $10 per GB-mo; 1 vCPU / 0.5 GB per service (secondary, blog) |
| S33 | https://comparedge.com/tools/railway/cost-guide | Railway Free after trial: $1/mo; 1 project, 3 services, 1 vCPU, 0.5 GB (secondary) |
| S34 | https://comparedge.com/tools/railway/pricing | Railway: 30-day trial with $5 credit, then $1/mo (secondary) |
| S35 | https://tech-insider.org/websocket-vs-webrtc-multiplayer-games-2026/ | WebRTC data channels can be unordered and unreliable; default to WebSocket for authoritative state (secondary) |
| S36 | https://daily.dev/posts/webrtc-data-channels-vs-websockets-for-real-time-browser-games-gvbtcjx4k | WebSockets use TCP (ordered, reliable); data channels use SCTP over DTLS over UDP (secondary) |
| S37 | https://gafferongames.com/post/why_cant_i_send_udp_packets_from_a_browser/ | WebRTC is complex for browser-to-dedicated-server; most browser games use WebSockets (article from 2017, older) |
| S38 | https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ | Quick Tunnels: no account; URL stops when cloudflared stops; "for testing and development" |
| S39 | https://try.cloudflare.com/ | Quick Tunnel: one command, no account (vendor marketing) |
| S40 | https://developers.cloudflare.com/sandbox/api/tunnels/ | Quick tunnel URLs change on every container restart (Sandbox SDK docs) |
| S41 | https://ship.page/temporary-website-hosting | Temporary hosting: 30 days, no account; claim for 90 days; static only (search snippet) |
| S42 | https://ship.page/free-website-hosting | Free plan limits: 10 MB HTML, 25 MB ZIP, 100 files; static only, no Node or database (search snippet) |
| S43 | https://www.shipstatic.com/cli | ShipStatic: free deploy, no account; claim URL keeps it permanently (search snippet; separate service) |
| S44 | https://www.shipstatic.com/tour | ShipStatic: publish without an account stays up 3 days; claim link makes it permanent (search snippet) |
| S45 | https://glama.ai/mcp/connectors/com.shipstatic/mcp | ship.page MCP: anonymous deploys, free tier needs no account (search snippet) |

## Counts check

- R01–R26: 26
- F01–F17: 17
- S01–S45: 45
- **Total: 87** (target: at least 80)

Limitations of this count: the "read" depth varies. Four repos were read in code. The other 22 repos are metadata only. Search-result pages are snippets, not full reads. Snippets from earlier in the session are not counted, since their URLs were not saved.


## Session 2026-10-16 additions (not counted in the 87 total)

These were checked in this turn. They are listed separately so the 87-source total stays as it was.

- K1. Kenney Car Kit 3.1, https://kenney.nl/assets/car-kit. Fetched. Stated licence: Creative Commons CC0. Used in game (4 body models). Licence file copied to `public/models/kenney-car-kit/License.txt`.
- K2. Kenney Car Kit on itch.io, https://kenney-assets.itch.io/car-kit. Search result only. CC0 1.0. Not used.
- K3. Forza Horizon logo colours, https://whatthelogo.com/logo/forza-horizon/49792. Fetched. Third-party logo colours #EA0C80, #231F20, #FBD5E9, #871254, #817E7F. Used as the stylesheet palette. These are not an official FH5 UI palette.
- K4. @gltf-transform/cli 4.5.1 (npm). Installed from the npm registry. Used by the LOD tool. Documentation not fetched in this turn; its CLI help output was read.
