// mist.glsl — brume de vallée en couches horizontales lentes.
// Utilisé par fx/Mist.ts. La brume est un personnage du jeu : elle respire,
// elle ne défile jamais vite. uniforms : uTime (float), uDensity (float)

float bovMistLayer(vec2 uv, float time, float density) {
  float drift = sin(uv.x * 2.7 + time * 0.06) * 0.5 + 0.5;
  float band = smoothstep(0.0, 0.45, uv.y) * (1.0 - smoothstep(0.55, 1.0, uv.y));
  return band * drift * density;
}
