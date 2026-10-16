// REFERENCE ONLY - not compiled. Dual-layer car paint model.
// Layer 1 (base): coloured metallic flake. Layer 2 (clear coat): smooth dielectric on top.
// The web build approximates this with MeshPhysicalMaterial (clearcoat=1.0, clearcoatRoughness=0.05).
//
// vec3 shadePaint(vec3 N, vec3 V, vec3 L, vec3 baseColor, float metallic, float baseRough,
//                 float coatWeight, float coatRough, vec3 flakeN) {
//   vec3 Nb = normalize(mix(N, flakeN, 0.18));          // flake perturbs the base layer only
//   vec3 base = BRDF_GGX(Nb, V, L, baseColor, metallic, baseRough);
//   vec3 coat = BRDF_GGX(N,  V, L, vec3(0.04), 0.0, coatRough) * coatWeight;   // F0 = 0.04 dielectric
//   float Fcoat = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);           // Schlick Fresnel
//   return base * (1.0 - Fcoat) + coat;                 // coat attenuates the base layer
// }
