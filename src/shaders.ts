export const vertexShaderSource = `#version 300 es
in vec2 a_position;
uniform mat3 u_matrix;

void main() {
  vec3 transformed = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  gl_PointSize = 10.0;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;
