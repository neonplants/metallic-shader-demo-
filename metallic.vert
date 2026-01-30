// Vertex Shader - use p5.js built-in uniforms

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;

void main() {
  // Pass through texture coordinates
  vTexCoord = aTexCoord;

  // Use p5's transformation matrices
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
