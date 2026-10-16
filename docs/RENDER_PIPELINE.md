# Render and asset pipeline (web build)

This documents what the pipeline specification's sections map to in this Three.js / WebGL build, and what is not implemented.
The specification was written for Unreal Engine. Unreal `.uasset` and `.umap` binaries are produced by the Unreal Editor and
cannot be written by hand, so none are in this repository. Where a concept applies to the web stack, it is implemented as
described below. Where it does not apply, it is listed under "Not implemented".

## Repository layout

| Path | Purpose | Status |
|---|---|---|
| `public/models/kenney-car-kit/` | Car body GLBs + `Textures/colormap.png` + `License.txt` (CC0) | In game |
| `Tools/LOD_Pipeline/automate_lod.py` | `--check` (GLB validation + licence presence), `--build` (weld + simplify via gltf-transform), `--report` | Working. `--check` runs in CI |
| `.github/workflows/asset-validate.yml` | Python 3.11 asset check, Node 20 `npm ci`, `vite build`, sim tests (non-blocking) | Written. Not yet run on GitHub Actions |
| `Shaders/` | Reference GLSL notes (`CarPaint_DualLayer.glsl`, `TerrainPOM_reference.glsl`) | Not compiled. Reference only |
| `Content/` | Unreal-style placeholder folders with README files | Placeholders only (no `.uasset`) |
| `src/style.css` | Palette tokens (`--fh-magenta`, `--fh-ink`, `--fh-blush`, `--fh-plum`, `--fh-grey`) | In game |

## Car paint (dual layer)

- In game: `MeshPhysicalMaterial` on the car body. Base: `metalness 0.85`, `roughness 0.42`, colour map from the model.
  Clear coat: `clearcoat 1.0`, `clearcoatRoughness 0.05`. Flake detail: a generated normal map (`getFlakeTexture` in `src/render.js`), `normalScale 0.18`, with mipmaps.
- Environment: `RoomEnvironment` through PMREM at `environmentIntensity 0.55`. Used only for reflections.
- Model: `Shaders/CarPaint_DualLayer.glsl` describes the layer maths. It is not compiled.
- Measured (headless, SwiftShader, not a real GPU): the body loads and renders in chase and front views with zero console errors (`tests/browser/car-models.mjs`).

## Terrain

- Not implemented. Tracks are procedural (`shared/tracks.js`). `Shaders/TerrainPOM_reference.glsl` documents the parallax occlusion technique but is not wired in.

## Palette and frontend

- Palette: the colours in `src/style.css` are the Forza Horizon logo colours from third-party logo listings (see `docs/ASSET_SOURCES.md`, `docs/RESEARCH_REGISTER.md` K3).
  They are **not** an official Forza Horizon 5 UI palette. No official FH5 UI palette was found in the sources checked.
- Buttons and controls: not matched to Asphalt 9. No Asphalt 9 source was fetched, so the control scheme is not claimed to match.

## Level of detail

- `automate_lod.py --build` writes `*_lod1.glb` and `*_lod2.glb` next to each source model. Measured on this session's Kenney models (triangles, from the output files):

| Model | LOD0 (source) | LOD1 (ratio 0.5) | LOD2 (ratio 0.2) |
|---|---|---|---|
| race.glb | 1952 | 1400 | 1366 |
| race-future.glb | 2068 | 1500 | 1500 |
| sedan-sports.glb | 2088 | 1494 | 1442 |
| hatchback-sports.glb | 2088 | 1470 | 1429 |

- The simplifier stops early at `--error 0.05`, so LOD2 is barely lower than LOD1. Not tuned further.
- The game does not load LOD files. Generated LOD files were removed from the repository after measurement.

## Telemetry-to-VFX

- Not implemented. The sim already emits per-car events (boost, stunt, crash). No particle systems are wired to them in this build.

## CI

- `asset-validate.yml` runs the asset check, a client build, and the sim tests. The sim step is non-blocking because the Canyon Skyway lone-bot lap test is a known failure (see `docs/TEST_REPORT.md`).

## Not implemented (summary)

- Unreal `.uasset` / `.umap` content and the Unreal shader compile path.
- Terrain POM in the running game.
- Telemetry-driven particle VFX.
- Asphalt 9 control matching (no source).
- Official FH5 palette (no public source).
