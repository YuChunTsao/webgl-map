import { describe, expect, it } from 'vitest';
import { identity, multiply, scale, translation } from '../src/mat3';
import type { Mat3 } from '../src/mat3';

function expectMat3ToEqual(actual: Mat3, expected: number[]) {
  expect(Array.from(actual)).toEqual(expected);
}

// Applies m * (x, y, 1) using the same column-major layout as mat3.ts,
// so tests can assert on "where does the point end up" instead of raw indices.
function applyToPoint(m: Mat3, x: number, y: number): [number, number] {
  return [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
}

describe('identity', () => {
  it('returns the identity matrix', () => {
    expectMat3ToEqual(identity(), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('returns a length-9 Float32Array', () => {
    expect(identity().length).toBe(9);
  });

  it('returns a fresh array reference on each call', () => {
    expect(identity()).not.toBe(identity());
  });

  it('leaves any point unchanged', () => {
    expect(applyToPoint(identity(), 7, -3)).toEqual([7, -3]);
  });
});

describe('translation', () => {
  it('places tx, ty at indices 6 and 7', () => {
    expectMat3ToEqual(translation(5, 3), [1, 0, 0, 0, 1, 0, 5, 3, 1]);
  });

  it('translation(0, 0) equals identity()', () => {
    expectMat3ToEqual(translation(0, 0), Array.from(identity()));
  });

  it('supports negative offsets', () => {
    expectMat3ToEqual(translation(-2, -4), [1, 0, 0, 0, 1, 0, -2, -4, 1]);
  });

  it('moves a point by (tx, ty)', () => {
    expect(applyToPoint(translation(5, 3), 1, 1)).toEqual([6, 4]);
  });
});

describe('scale', () => {
  it('places sx, sy on the diagonal', () => {
    expectMat3ToEqual(scale(2, 3), [2, 0, 0, 0, 3, 0, 0, 0, 1]);
  });

  it('scale(1, 1) equals identity()', () => {
    expectMat3ToEqual(scale(1, 1), Array.from(identity()));
  });

  it('supports negative (mirroring) factors', () => {
    expectMat3ToEqual(scale(-1, 1), [-1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('scales a point around the origin', () => {
    expect(applyToPoint(scale(2, 3), 2, 3)).toEqual([4, 9]);
  });
});

describe('multiply', () => {
  it('multiply(identity(), M) equals M', () => {
    expectMat3ToEqual(
      multiply(identity(), translation(5, 3)),
      Array.from(translation(5, 3)),
    );
    expectMat3ToEqual(
      multiply(identity(), scale(2, 3)),
      Array.from(scale(2, 3)),
    );
  });

  it('multiply(M, identity()) equals M', () => {
    expectMat3ToEqual(
      multiply(translation(5, 3), identity()),
      Array.from(translation(5, 3)),
    );
    expectMat3ToEqual(
      multiply(scale(2, 3), identity()),
      Array.from(scale(2, 3)),
    );
  });

  it('computes the correct product for a fully general matrix pair', () => {
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = new Float32Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expectMat3ToEqual(
      multiply(a, b),
      [90, 114, 138, 54, 69, 84, 18, 24, 30],
    );
  });

  it('is not commutative: order changes whether translation gets scaled', () => {
    expectMat3ToEqual(
      multiply(translation(5, 0), scale(2, 1)),
      [2, 0, 0, 0, 1, 0, 5, 0, 1],
    );
    expectMat3ToEqual(
      multiply(scale(2, 1), translation(5, 0)),
      [2, 0, 0, 0, 1, 0, 10, 0, 1],
    );
  });

  it('is associative', () => {
    const a = translation(2, 3);
    const b = scale(4, 5);
    const c = translation(-1, 6);

    expectMat3ToEqual(
      multiply(multiply(a, b), c),
      Array.from(multiply(a, multiply(b, c))),
    );
  });

  it('does not mutate its inputs', () => {
    const a = translation(5, 3);
    const b = scale(2, 4);
    const aSnapshot = Array.from(a);
    const bSnapshot = Array.from(b);

    multiply(a, b);

    expect(Array.from(a)).toEqual(aSnapshot);
    expect(Array.from(b)).toEqual(bSnapshot);
  });

  it('returns a new array, not a or b', () => {
    const a = translation(5, 3);
    const b = scale(2, 4);
    const result = multiply(a, b);

    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });
});
