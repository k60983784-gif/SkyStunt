# Content/ (placeholder)

This folder mirrors the Unreal-style layout from the pipeline specification (`Content/Cars`, `Content/Tracks`).

It is intentionally empty of binary assets. Unreal `.uasset` and `.umap` files are produced by the Unreal Editor and cannot be
hand-written as text, so none are checked in.

The live web game loads its assets from `public/models/` (glTF/GLB, see `public/models/kenney-car-kit/License.txt`).
Source-of-truth lists for any future Unreal project would go in `Content/Cars/README.md` and `Content/Tracks/README.md`.
