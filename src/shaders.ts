export const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 outColor;

void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;
