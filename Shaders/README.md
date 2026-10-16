# Shaders/ (reference copies, NOT compiled)

These files are reference descriptions of the shader math from the pipeline specification, written in GLSL-style pseudocode.
They are NOT compiled or loaded by the game. The web game uses three.js built-in materials:

- Car paint: `MeshPhysicalMaterial` with clear-coat (weight 1.0, roughness 0.05), base roughness 0.42, metalness 0.85,
  and a generated flake normal map (`src/render.js`, `paintMaterialFrom`). See `CarPaint_DualLayer.glsl` for the layer model.
- Terrain POM: NOT implemented. `TerrainPOM_reference.glsl` documents the intended parallax occlusion sampling only.
