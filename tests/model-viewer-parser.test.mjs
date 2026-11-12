import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_STL_BYTES,
  MAX_STL_TRIANGLES,
  checkStlSize,
  parseStl,
} from '../lib/model-viewer/parse-stl.js';

const ascii = `solid test
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 2 0 0
vertex 0 3 0
endloop
endfacet
endsolid test
`;

const encode = text => new TextEncoder().encode(text).buffer;

function binary() {
  const buffer = new ArrayBuffer(134);
  const view = new DataView(buffer);
  view.setUint32(80, 1, true);

  const values = [
    0, 0, 1,
    0, 0, 0,
    2, 0, 0,
    0, 3, 0,
  ];

  values.forEach((value, index) => {
    view.setFloat32(84 + index * 4, value, true);
  });

  return buffer;
}

for (const [encoding, makeBuffer] of [
  ['ASCII', () => encode(ascii)],
  ['binary', binary],
]) {
  test(`parses ${encoding} STL and reports actual statistics`, () => {
    const buffer = makeBuffer();
    const before = new Uint8Array(buffer).slice();
    const { geometry, stats } = parseStl(buffer);

    try {
      assert.equal(stats.format, 'STL');
      assert.equal(stats.encoding, encoding);
      assert.equal(stats.byteLength, buffer.byteLength);
      assert.equal(stats.triangleCount, 1);
      assert.deepEqual(stats.extents, { x: 2, y: 3, z: 0 });
      assert.deepEqual(new Uint8Array(buffer), before);
      assert.equal(geometry.getAttribute('position').getX(1), 2);
    } finally {
      geometry.dispose();
    }
  });
}

test('accepts binary STL whose header starts with solid', () => {
  const buffer = binary();
  new Uint8Array(buffer).set(new TextEncoder().encode('solid misleading'));
  const result = parseStl(buffer);

  try {
    assert.equal(result.stats.encoding, 'binary');
  } finally {
    result.geometry.dispose();
  }
});

test('enforces byte safeguards without allocating oversized files', () => {
  assert.throws(() => checkStlSize(0), /empty/i);
  assert.throws(() => checkStlSize(MAX_STL_BYTES + 1), /100 MiB/);
  assert.doesNotThrow(() => checkStlSize(MAX_STL_BYTES));
  assert.throws(() => parseStl(new ArrayBuffer(0)), /empty/i);
});

test('rejects binary triangle counts above the preview limit', () => {
  const count = MAX_STL_TRIANGLES + 1;
  const buffer = new ArrayBuffer(84 + count * 50);
  new DataView(buffer).setUint32(80, count, true);

  assert.throws(() => parseStl(buffer), /2,000,000/);
});

test('rejects malformed, empty, and incomplete ASCII STL', () => {
  for (const text of [
    'not an STL',
    'solid empty\nendsolid empty',
    ascii.replace('endfacet', ''),
    ascii.replace('endsolid test', ''),
    ascii.replace('vertex 0 3 0', 'vertex broken'),
    `${ascii}\nunexpected trailing content`,
  ]) {
    assert.throws(() => parseStl(encode(text)));
  }
});

test('rejects nonfinite ASCII numbers', () => {
  for (const value of ['NaN', 'Infinity', '1e999']) {
    const text = ascii.replace('vertex 2 0 0', `vertex ${value} 0 0`);
    assert.throws(() => parseStl(encode(text)), /nonfinite/i);
  }
});

test('rejects nonfinite binary coordinates', () => {
  const buffer = binary();
  new DataView(buffer).setFloat32(96, NaN, true);
  assert.throws(() => parseStl(buffer), /nonfinite/i);
});

test('rejects truncated binary STL', () => {
  assert.throws(() => parseStl(binary().slice(0, 120)));
});

test('rejects degenerate triangles instead of repairing them', () => {
  const text = ascii.replace('vertex 0 3 0', 'vertex 4 0 0');
  assert.throws(() => parseStl(encode(text)), /degenerate/i);
});

test('rejects coordinates that overflow rendering precision', () => {
  const text = ascii.replace('vertex 2 0 0', 'vertex 1e100 0 0');
  assert.throws(() => parseStl(encode(text)), /numeric range/i);
});