# Public assets: what was checked (2026-10-16)

Only sources that were actually opened or returned in search results during this session are listed. Nothing is in the game yet unless marked "in game".

## Car models

| Source | Licence (as stated on the page) | Format (as stated) | Status |
|---|---|---|---|
| Kenney Car Kit 3.1, https://kenney.nl/assets/car-kit | CC0 1.0 (kenney.nl page: "Creative Commons CC0"; `License.txt` in the zip says CC0, "Car Kit (3.1)") | glTF/GLB (copied: race, race-future, sedan-sports, hatchback-sports) | **In game** since this turn. Files in `public/models/kenney-car-kit/` with `License.txt` and `Textures/colormap.png` (copied from the zip's `Models/GLB format/Textures/`). |
| Kenney Car Kit on itch.io, https://kenney-assets.itch.io/car-kit | CC0 1.0, "no attribution required" (search result only) | OBJ, FBX, glTF | Not used. The kenney.nl download is the one in game. |

## Palette reference

- No official Forza Horizon 5 UI colour palette was found in the sources checked.
- Forza Horizon logo colours (third-party, whatthelogo.com): #EA0C80, #231F20, #FBD5E9, #871254, #817E7F. These are logo colours, not UI colours. Using them is an approximation, not a copy of FH5.

## Used tools

- `@gltf-transform/cli` 4.5.1 (npm, MIT). Used by `Tools/LOD_Pipeline/automate_lod.py` for weld/simplify. Not shipped to players.

## Not yet researched

- Environment kits (city, nature, track pieces) beyond the Kenney car kit.
- The research register total is unchanged (87). Sources from this turn are in the section "Session 2026-10-16 additions" of docs/RESEARCH_REGISTER.md.
