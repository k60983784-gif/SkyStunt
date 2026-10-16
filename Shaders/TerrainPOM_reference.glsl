// REFERENCE ONLY - not compiled, not used by the game. Parallax occlusion mapping for terrain.
// Intended steps: transform view direction to tangent space, march N steps through the height field,
// refine with binary search, offset UVs by the hit point.
//
// vec2 pom(vec2 uv, vec3 viewTS, sampler2D heightMap, float scale, int steps) {
//   float layer = 1.0 / float(steps);
//   vec2 deltaUV = viewTS.xy / max(viewTS.z, 0.001) * scale * layer;
//   vec2 cur = uv; float curH = 1.0 - texture(heightMap, cur).r; float surf = 0.0;
//   for (int i = 0; i < steps && surf < curH; i++) { surf += layer; cur -= deltaUV; curH = 1.0 - texture(heightMap, cur).r; }
//   return cur;   // (binary refinement omitted in this reference)
// }
