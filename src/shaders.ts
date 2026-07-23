export const POSITION_ATTRIB_LOCATION = 0;
export const EXTRUDE_ATTRIB_LOCATION = 1;

export const vertexShaderSource = `#version 300 es
layout(location = ${POSITION_ATTRIB_LOCATION}) in vec2 a_position;
uniform mat3 u_matrix;

void main() {
  vec3 transformed = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  gl_PointSize = 10.0; // For drawGeoJSON
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

export const lineVertexShaderSource = `#version 300 es
layout(location = ${POSITION_ATTRIB_LOCATION}) in vec2 a_position;
layout(location = ${EXTRUDE_ATTRIB_LOCATION}) in vec2 a_extrude;
uniform mat3 u_matrix;
uniform float u_width;
uniform vec2 u_resolution;

void main() {
  vec3 transformed = u_matrix * vec3(a_position, 1.0);
  // The extrude normal is perpendicular to the line in Mercator space, where +Y
  // points down. Clip space flips Y (see Camera's clipFromScreen), so flip the
  // offset's Y too, otherwise the offset is no longer perpendicular to the line
  // as drawn and diagonal segments render too thin.
  vec2 offset = a_extrude * u_width / u_resolution;
  offset.y = -offset.y;
  gl_Position = vec4(transformed.xy + offset, 0.0, 1.0);
}
`;

export const lineFragmentShaderSource = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;

export const circleVertexShaderSource = `#version 300 es
layout(location = ${POSITION_ATTRIB_LOCATION}) in vec2 a_position;
uniform mat3 u_matrix;
uniform float u_size;

void main() {
  vec3 transformed = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  gl_PointSize = u_size;
}
`;

export const circleFragmentShaderSource = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;
  outColor = u_color;
}
`;
