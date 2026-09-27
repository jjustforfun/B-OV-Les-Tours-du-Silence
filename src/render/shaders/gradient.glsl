// gradient.glsl — fragment de dégradé vertical réutilisable (ciel, brume, UI).
// Importé via `?raw` puis injecté dans un ShaderMaterial.
// uniforms attendus : uTop (vec3), uBottom (vec3), uPower (float)

vec3 bovGradient(vec2 uv, vec3 bottom, vec3 top, float power) {
  float t = pow(clamp(uv.y, 0.0, 1.0), power);
  return mix(bottom, top, t);
}
