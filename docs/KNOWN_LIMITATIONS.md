# SkyStunt.io — Known limitations

Ordered by how much they affect play. "Observed" means seen in a test or run in this session. "Assumed" means not measured.

## Gameplay

1. **AI bots do not complete laps on any of the four real tracks.** Observed: 0 laps in 200 s of sim time on all four tracks. Bots complete a gap-free road lap in about 76–83 s. They fail at the ramp and gap sections, where they either launch outside the road or stall on the approach hump. The failing sim check is "AI bot completes one lap on Canyon Skyway". Consequence: in Grand Prix, bots fill the grid but do not finish. A human can still win. Stunt Challenge and Survival Rush are not affected by lap completion.
2. **Ghost cars.** Cars do not collide with each other. Players pass through one another. Done by design to keep the physics stable and the scope small.
3. **No input prediction.** The player's own car is interpolated from server snapshots, not predicted. Assumed effect: the car responds about one network round-trip late. Not measured on a real connection.
4. **Hazards are sensors.** Bars and spinners stun the car and cost boost, but do not physically push it.
5. **Wind has no visual effect.** Wind zones apply force only.
6. **Single-route tracks.** No loops or alternative routes.
7. **Stunt and Survival rules are not covered by automated tests.**

## Platform and performance

8. **Touch controls are untested on a real device.** Implemented in `src/controls.js` but not exercised on a phone or tablet.
9. **No real GPU performance numbers.** Headless runs use SwiftShader software rendering at a few fps. Frame time on a real device is unknown.
10. **Large client bundle.** Rapier WASM makes one chunk over 2 MB. Load time on slow connections is not measured.

## Multiplayer and hosting

11. **No multiplayer on the multi-day link.** The public ship.place link (`modest-shirt-zza26.ship.place`) is static: it runs offline solo only. It expires 2026-11-15 unless claimed. The full game with multiplayer is only at temporary links. **No durable public deployment with a server.** The only playable multiplayer links are temporary (Cloudflare Quick Tunnel, localhost.run). They last as long as this sandbox and its processes run. Tested and not playable: Serveo, localtunnel, Pinggy free, tunl.gg (see `HOSTING_SURVEY.md`). Northflank Sandbox is the recommended several-day option, but it needs an account and its free-service limits are unpublished.
12. **Docker and Render not verified.** The Dockerfile and `render.yaml` are written but have not been built or deployed. Docker is not installed in this sandbox.
13. **Tested at 2 humans per room only.** Rooms of up to 8 humans are supported by design (`MAX_HUMANS_PER_ROOM = 8`) but were not tested.
14. **No load or soak testing.** Concurrency limits (`MAX_ROOMS`, `MAX_CONNECTIONS`) are set but not stress-tested.
15. **Reconnect tested within the grace window only.** Reconnect after a server restart is not supported: room state lives in memory.

## Research

16. **Research depth varies.** 87 named sources and 26 repositories are listed (`RESEARCH_REGISTER.md`), but only 4 repositories were read in code and most search results were read as snippets. The 100-point matrix is judgement, not measurement (`ARCHITECTURE_MATRIX.md`).
