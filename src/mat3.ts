// | a  b  c |
// | d  e  f |
// | g  h  i |
//
// row-major: [a, b, c, d, e, f, g, h, i]
// column-major: [a, d, g, b, e, h, c, f, i]
// We have to use column-major for webgl

export type Mat3 = Float32Array;

export function identity(): Mat3 {
  return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
}
export function translation(tx: number, ty: number): Mat3 {
  return new Float32Array([1, 0, 0, 0, 1, 0, tx, ty, 1]);
}
export function scale(sx: number, sy: number): Mat3 {
  return new Float32Array([sx, 0, 0, 0, sy, 0, 0, 0, 1]);
}

//     | a(0)  b(3)  c(6) |        | j(0)  k(3)  l(6) |
// A = | d(1)  e(4)  f(7) |    B = | m(1)  n(4)  o(7) |
//     | g(2)  h(5)  i(8) |        | p(2)  q(5)  r(8) |

//     | aj + bm + cp  ak + bn + cq  al + bo + cr |
// C = | dj + em + fp  dk + en + fq  dl + eo + fr |
//     | gj + hm + ip  gk + hn + iq  gl + ho + ir |
//
//     | A0B0 + A3B1 + A6B2  A0B3 + A3B4 + A6B5  A0B6 + A3B7 + A6B8 |
// C = | A1B0 + A4B1 + A7B2  A1B3 + A4B4 + A7B5  A1B6 + A4B7 + A7B8 |
//     | A2B0 + A5B1 + A8B2  A2B3 + A5B4 + A8B5  A2B6 + A5B7 + A8B8 |
export function multiply(a: Mat3, b: Mat3): Mat3 {
  return new Float32Array([
    a[0] * b[0] + a[3] * b[1] + a[6] * b[2],
    a[1] * b[0] + a[4] * b[1] + a[7] * b[2],
    a[2] * b[0] + a[5] * b[1] + a[8] * b[2],
    a[0] * b[3] + a[3] * b[4] + a[6] * b[5],
    a[1] * b[3] + a[4] * b[4] + a[7] * b[5],
    a[2] * b[3] + a[5] * b[4] + a[8] * b[5],
    a[0] * b[6] + a[3] * b[7] + a[6] * b[8],
    a[1] * b[6] + a[4] * b[7] + a[7] * b[8],
    a[2] * b[6] + a[5] * b[7] + a[8] * b[8],
  ]);
}
