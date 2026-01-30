#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform float uAlpha;

varying vec2 vTexCoord;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Get the shape from texture (white = visible)
  float brightness = max(texColor.r, max(texColor.g, texColor.b));
  float alpha = texColor.a;

  // Only render where the logo exists
  if (brightness < 0.1 || alpha < 0.1) {
    discard;
  }

  // Output black with controlled alpha for shadow
  gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
}
