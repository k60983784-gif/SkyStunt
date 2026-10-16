# Third-party notices

SkyStunt.io uses the following packages. Versions are pinned in package.json and package-lock.json. Licenses are the ones declared by each package; re-check against node_modules/<pkg>/LICENSE before redistribution.

| Package | Version | Use | License (declared) |
|---|---|---|---|
| three | 0.186.1 | 3D rendering | MIT |
| @dimforge/rapier3d-compat | 0.21.0 | 3D physics (raycast vehicles, trimesh colliders) | Apache-2.0 |
| ws | 8.22.0 | WebSocket server/client transport | MIT |
| vite (dev) | 8.3.4 | Client bundler | MIT |
| playwright (dev) | 1.64.1 | Browser tests only, not shipped | Apache-2.0 |

No third-party models, textures, sound files or music are included. All visuals are procedural Three.js geometry and all audio is synthesized with the Web Audio API. Car designs, track layouts and names are original to this project. No code was copied from the reference repositories listed in `docs/RESEARCH_REPORT.md`; they were read only for comparison.
