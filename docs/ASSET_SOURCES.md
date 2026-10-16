# Public assets: what was checked (2026-10-17)

Only sources that were actually opened or returned in search results during this work are listed. A model is "in game" only if the game loads it. Models in `public/models/library/` are for the library viewer (`/library.html`). The subset used as track scenery is listed under "Track scenery" below.

## Car models (in game)

| Source | Licence (as stated in the pack's `License.txt`) | Format | Status |
|---|---|---|---|
| Kenney Car Kit 3.1, https://kenney.nl/assets/car-kit | CC0 1.0 ("Car Kit (3.1)", "Creative Commons Zero, CC0") | glTF/GLB (race, race-future, sedan-sports, hatchback-sports) | **In game.** Files in `public/models/kenney-car-kit/` with `License.txt` and `Textures/colormap.png`. |
| Kenney Car Kit on itch.io, https://kenney-assets.itch.io/car-kit | CC0 1.0, "no attribution required" (search result only) | OBJ, FBX, glTF | Not used. The kenney.nl download is the one in game. |

## Model library (not yet in game)

The library holds 491 GLBs, 12 MB in total. Every model has a per-pack `License.txt` and a `manifest.json` entry with `licence`, `licenceFile`, `source`, `triangles`, and `bytes`. `Tools/LOD_Pipeline/automate_lod.py --manifest` builds the manifest. `--check` refuses any pack that has no `PACKS` entry or whose `License.txt` lacks the expected licence text.

| Pack (folder) | Count | Source page | Version and licence text in the zip |
|---|---|---|---|
| `kenney-car-kit/` | 50 | https://kenney.nl/assets/car-kit | Car Kit (3.1), CC0 1.0. Includes `Textures/`. |
| `kenney-racing-kit/` | 112 | https://kenney.nl/assets/racing-kit | Racing Kit (2.0), created 07-11-2018, CC0 (http://creativecommons.org/publicdomain/zero/1.0/) |
| `kenney-nature-kit/` | 329 | https://kenney.nl/assets/nature-kit | Nature Kit (2.1), created 29-04-2020, CC0 (http://creativecommons.org/publicdomain/zero/1.0/) |

All three packs are CC0 by their own licence files. Credit to Kenney is requested but not required. The packs were downloaded as zips from the kenney.nl pages. Only `Models/GLTF format/` (Racing, Nature) and `Models/GLB format/` (Car) were copied.

## Track scenery (in game)

`src/props.js` loads these models and places them as visual-only instanced props. They have no colliders, so physics and netcode are unchanged.

| Track | Pack | Models | Placement |
|---|---|---|---|
| Neon Skyline | Racing Kit (CC0) | `barrierRed`, `barrierWhite` | Walls along both road edges, every 6 m, skipped near gaps |
| Canyon Skyway | Nature Kit (CC0) | `rock_largeA`, `rock_largeC`, `rock_tallB`, `plant_bushLarge` | Off-road, 18–70 m out |
| Volcanic Ruins | Nature Kit (CC0) | `rock_largeD`, `rock_tallE`, `rock_smallE` | Off-road, 16–60 m out |
| Glacier Overpass | Nature Kit (CC0) | `tree_pineRoundA`, `tree_pineRoundC`, `tree_pineSmallA`, `tree_pineTallB` | Off-road, 18–70 m out |

Model materials are replaced with matte copies that keep the kit colour, because the kit materials are fully metallic and render near-black without an environment map.

## Palette reference

- No official Forza Horizon 5 UI colour palette was found in the sources checked.
- Forza Horizon logo colours (third-party, whatthelogo.com): #EA0C80, #231F20, #FBD5E9, #871254, #817E7F. These are logo colours, not UI colours. Using them is an approximation, not a copy of FH5.

## Used tools

- `@gltf-transform/cli` 4.5.1 (npm, MIT). Used by `Tools/LOD_Pipeline/automate_lod.py` for weld and simplify. Not shipped to players.

## Not yet done

- Checking the props on a device GPU. The canyon props were not clearly visible in the one screenshot taken (`tests/browser/track-props.mjs`), so their placement is unconfirmed.
