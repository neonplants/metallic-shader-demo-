#ifdef GL_ES
precision mediump float;
#endif

// Inputs from p5.js
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAngle;
uniform float uShadowMode;  // 0 = normal metallic, 1 = shadow (black with alpha)
uniform float uShadowAlpha;
uniform float uShadowPadding;  // Padding ratio for larger shadow planes

varying vec2 vTexCoord;

// S-curve for smooth gradient transitions
float sCurve(float t, float contrast) {
  if (t < 0.5) {
    return 0.5 * pow(2.0 * t, contrast);
  } else {
    return 1.0 - 0.5 * pow(2.0 * (1.0 - t), contrast);
  }
}

// Gaussian for specular bands
float gaussian(float x, float center, float width) {
  float d = (x - center) * width;
  return exp(-d * d);
}

void main() {
  // Sample the logo texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Get brightness from texture
  float brightness = max(texColor.r, max(texColor.g, texColor.b));
  float alpha = texColor.a;

  // Only process visible pixels
  if (brightness < 0.1 || alpha < 0.1) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // === GRADIENT DIRECTION ===
  vec2 pos = (vTexCoord - 0.5) * 2.0;

  float cosA = cos(uAngle);
  float sinA = sin(uAngle);
  float proj = pos.x * cosA + pos.y * sinA;

  // Normalize by the maximum possible projection (diagonal = sqrt(2))
  // This prevents clipping when gradient is rotated to corners
  float maxProj = abs(cosA) + abs(sinA);  // Max projection for unit square
  proj = proj / maxProj;  // Now always in -1 to 1 range

  float t = (proj + 1.0) / 2.0;

  // === 1. BASE METALLIC GRADIENT ===
  float curved = sCurve(t, 1.8);
  float baseBrightness = curved * 0.55;

  // === 2. SPECULAR HIGHLIGHT BANDS ===
  float specular = 0.0;
  specular += gaussian(t, 0.72, 10.0) * 0.20;
  specular += gaussian(t, 0.35, 6.0) * 0.10;
  specular *= (1.0 - curved * 0.4);

  // === 3. ENVIRONMENT REFLECTION ===
  float envReflect = 0.0;
  envReflect += gaussian(t, 0.65, 12.0) * 0.12;
  envReflect += gaussian(t, 0.40, 8.0) * 0.06;
  envReflect += gaussian(t, 0.85, 15.0) * 0.08;
  envReflect -= gaussian(t, 0.20, 10.0) * 0.16;
  envReflect -= gaussian(t, 0.52, 14.0) * 0.14;
  envReflect -= gaussian(t, 0.75, 12.0) * 0.12;
  envReflect -= gaussian(t, 0.90, 10.0) * 0.18;

  // === COMBINE ===
  float finalBrightness = baseBrightness + specular + envReflect;
  finalBrightness = clamp(finalBrightness, 0.0, 1.0);

  // Shadow mode: simple black shape with alpha
  if (uShadowMode > 0.5) {
    float finalAlpha = alpha * brightness;
    if (finalAlpha < 0.5) {
      discard;
    }
    // Output black with alpha for shadow
    gl_FragColor = vec4(0.0, 0.0, 0.0, uShadowAlpha);
  } else {
    // Normal metallic mode - use alpha cutoff for crisp edges
    float finalAlpha = alpha * brightness;
    if (finalAlpha < 0.5) {
      discard;
    }
    gl_FragColor = vec4(vec3(finalBrightness), 1.0);
  }
}
