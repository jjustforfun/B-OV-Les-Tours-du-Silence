// stone.glsl — grain de pierre procédural (aucune texture chargée).
// Injecté dans ToonStoneMaterial pour casser l'uniformité des grandes faces.
// uniforms attendus : uGrainScale (float), uGrainStrength (float)

float bovHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float bovStoneGrain(vec3 worldPos, float scale) {
  vec3 p = worldPos * scale;
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = bovHash(i);
  float n100 = bovHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = bovHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = bovHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = bovHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = bovHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = bovHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = bovHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}
