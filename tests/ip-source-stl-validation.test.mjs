import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  validateStl,
  StlValidationError,
} from '../lib/ip-source/validate-stl.js';
import { STL_POLICY } from '../lib/ip-source/stl-policy.js';

const facet = [
  'facet normal 0 0 1',
  'outer loop',
  'vertex 0 0 0',
  'vertex 1 0 0',
  'vertex 0 1 0',
  'endloop',
  'endfacet',
].join('\n');

function ascii(count = 1) {
  return Buffer.from(`solid x\n${`${facet}\n`.repeat(count)}endsolid x\n`);
}

function binary(count = 1) {
  const bytes = Buffer.alloc(84 + count * 50);
  bytes.writeUInt32LE(count, 80);

  for (let index = 0; index < count; index++) {
    const start = 84 + index * 50;
    bytes.writeFloatLE(1, start + 8);
    bytes.writeFloatLE(1, start + 24);
    bytes.writeFloatLE(1, start + 40);
  }

  return bytes;
}

function reject(bytes, code, options) {
  let caught;

  try {
    validateStl(bytes, options);
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof StlValidationError);
  assert.equal(caught.code, code);
  return caught;
}

test('approved provisional ceilings remain unchanged', () => {
  assert.equal(STL_POLICY.maxBytes, 104857600);
  assert.equal(STL_POLICY.maxTriangles, 2000000);
});

for (const [encoding, make] of [
  ['binary', binary],
  ['ascii', ascii],
]) {
  test(`${encoding}: exact-byte hash, bounds, no source mutation`, () => {
    const bytes = make(2);
    const before = Buffer.from(bytes);
    const result = validateStl(bytes);

    assert.equal(result.encoding, encoding);
    assert.equal(result.triangleCount, 2);
    assert.equal(result.byteLength, bytes.length);
    assert.deepEqual(result.extents, { x: 1, y: 1, z: 0 });
    assert.equal(
      result.sourceHash.hex,
      createHash('sha256').update(bytes).digest('hex'),
    );
    assert.deepEqual(bytes, before);
  });

  test(`${encoding}: triangle ceiling rejects early`, () => {
    const error = reject(make(2), 'TRIANGLE_LIMIT', {
      policy: { maxTriangles: 1 },
    });

    assert.ok(error.progress.triangles <= 1);
    assert.equal(error.progress.hashedBytes, 0);
  });

  test(`${encoding}: malformed geometry rejected before hashing`, () => {
    let bytes = make();

    if (encoding === 'binary') {
      bytes.writeFloatLE(0, 84 + 24);
    } else {
      bytes = Buffer.from(
        bytes.toString().replace('vertex 1 0 0', 'vertex 0 0 0'),
      );
    }

    assert.equal(reject(bytes, 'DEGENERATE').progress.hashedBytes, 0);
  });
}

test('byte limit rejects before scan, hash or clock access', () => {
  const bytes = ascii();

  const error = reject(bytes, 'BYTE_LIMIT', {
    policy: { maxBytes: bytes.length - 1 },
    now() {
      throw new Error('Clock must not be called');
    },
  });

  assert.equal(error.progress.workUnits, 0);
  assert.equal(error.progress.scannedBytes, 0);
});

test('ASCII line limit rejects without scanning the whole source', () => {
  const bytes = Buffer.from(`solid ${'x'.repeat(10000)}\nendsolid\n`);
  const error = reject(bytes, 'LINE_LIMIT', {
    policy: { maxLineBytes: 128 },
  });

  assert.ok(error.progress.scannedBytes < bytes.length);
  assert.equal(error.progress.hashedBytes, 0);
});

test('deterministic work counter stops synchronous processing', () => {
  const error = reject(binary(20), 'WORK_LIMIT', {
    policy: { maxWorkUnits: 120 },
  });

  assert.ok(error.progress.triangles < 20);
  assert.equal(error.progress.hashedBytes, 0);
});

test('cooperative clock checks stop processing without a timer', () => {
  let time = 0;
  const error = reject(binary(20), 'TIME_LIMIT', {
    policy: { maxElapsedMs: 2 },
    now: () => time++,
  });

  assert.ok(error.progress.triangles < 20);
});

test('hashing is included in the work budget', () => {
  const error = reject(binary(), 'WORK_LIMIT', {
    policy: { maxWorkUnits: 150 },
  });

  assert.equal(error.progress.triangles, 1);
  assert.equal(error.progress.hashedBytes, 0);
});

test('hash preserves ASCII whitespace differences', () => {
  const first = ascii();
  const second = Buffer.concat([first, Buffer.from('\n')]);

  assert.notEqual(
    validateStl(first).sourceHash.hex,
    validateStl(second).sourceHash.hex,
  );
});

test('Buffer subarray hashes only its own bytes', () => {
  const source = binary();
  const wrapped = Buffer.concat([
    Buffer.from('prefix'),
    source,
    Buffer.from('suffix'),
  ]);
  const slice = wrapped.subarray(6, 6 + source.length);

  assert.equal(
    validateStl(slice).sourceHash.hex,
    createHash('sha256').update(source).digest('hex'),
  );
});

test('ASCII multiple solids and CRLF accepted', () => {
  const bytes = Buffer.from(
    (ascii().toString() + ascii().toString()).replace(/\n/g, '\r\n'),
  );

  assert.equal(validateStl(bytes).triangleCount, 2);
});

test('truncated binary and incomplete ASCII rejected', () => {
  assert.throws(
    () => validateStl(binary().subarray(0, 100)),
    StlValidationError,
  );
  reject(Buffer.from(`solid x\n${facet}\n`), 'STRUCTURE');
});

test('nonfinite binary normal rejected', () => {
  const bytes = binary();
  bytes.writeFloatLE(Infinity, 84);
  reject(bytes, 'NUMERIC');
});

test('float32 ASCII overflow rejected', () => {
  const bytes = Buffer.from(
    ascii().toString().replace('vertex 1 0 0', 'vertex 1e100 0 0'),
  );
  reject(bytes, 'NUMERIC');
});

test('empty input, invalid UTF-8 and zero triangles rejected', () => {
  reject(Buffer.alloc(0), 'EMPTY');
  reject(Buffer.from([255]), 'ENCODING');
  reject(Buffer.from('solid x\nendsolid x\n'), 'NO_TRIANGLES');
  reject(binary(0), 'NO_TRIANGLES');
});
