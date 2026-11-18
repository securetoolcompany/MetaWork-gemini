import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import {
  IpSourceValidationError,
  validateIpSourceBytes,
} from '../lib/ip-source/validate-source.js';

const stl = Buffer.from([
  'solid fixture',
  'facet normal 0 0 1',
  'outer loop',
  'vertex 0 0 0',
  'vertex 1 0 0',
  'vertex 0 1 0',
  'endloop',
  'endfacet',
  'endsolid fixture',
  '',
].join('\n'));

function declaration(format, bytes) {
  return {
    format,
    filename: `fixture.${format === 'jpeg' ? 'jpg' : format}`,
    byteLength: bytes.byteLength,
  };
}

for (const format of ['png', 'jpeg', 'stl']) {
  test(`${format}: dispatches actual bytes and preserves exact hash`, async () => {
    const bytes = format === 'stl'
      ? Buffer.from(stl)
      : await sharp({
          create: {
            width: 2,
            height: 3,
            channels: 3,
            background: { r: 10, g: 20, b: 30 },
          },
        }).toFormat(format).toBuffer();

    const before = Buffer.from(bytes);
    const result = await validateIpSourceBytes({
      bytes,
      sourceDeclaration: declaration(format, bytes),
    });

    assert.equal(result.format, format);
    assert.equal(result.byteLength, bytes.length);
    assert.equal(result.validation.status, 'valid');
    assert.equal(
      result.sourceHash.hex,
      createHash('sha256').update(before).digest('hex'),
    );
    assert.deepEqual(bytes, before);
  });
}

test('exact declared size is required, not merely the format ceiling', async () => {
  for (const delta of [-1, 1]) {
    await assert.rejects(
      validateIpSourceBytes({
        bytes: stl,
        sourceDeclaration: {
          ...declaration('stl', stl),
          byteLength: stl.length + delta,
        },
      }),
      error =>
        error instanceof IpSourceValidationError &&
        error.code === 'DECLARED_SIZE_MISMATCH',
    );
  }
});

test('SVG fails closed even when its declaration and byte length match', async () => {
  const bytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  );

  await assert.rejects(
    validateIpSourceBytes({
      bytes,
      sourceDeclaration: declaration('svg', bytes),
    }),
    error =>
      error instanceof IpSourceValidationError &&
      error.code === 'SVG_VALIDATION_UNAVAILABLE',
  );
});

test('missing or malformed source declarations are rejected', async () => {
  for (const sourceDeclaration of [
    undefined,
    null,
    [],
    {},
    { ...declaration('stl', stl), format: 'gif' },
    { ...declaration('stl', stl), byteLength: 0 },
    { ...declaration('stl', stl), byteLength: 1.5 },
    { ...declaration('stl', stl), byteLength: 104857601 },
  ]) {
    await assert.rejects(
      validateIpSourceBytes({ bytes: stl, sourceDeclaration }),
      TypeError,
    );
  }
});

test('non-byte and shared-buffer inputs are rejected', async () => {
  for (const bytes of [
    null,
    'not bytes',
    new ArrayBuffer(stl.length),
    new Uint8Array(new SharedArrayBuffer(stl.length)),
  ]) {
    await assert.rejects(
      validateIpSourceBytes({
        bytes,
        sourceDeclaration: declaration('stl', stl),
      }),
      TypeError,
    );
  }
});

test('a matching byte count cannot disguise malformed STL as valid', async () => {
  const bytes = Buffer.from('not an STL');

  await assert.rejects(
    validateIpSourceBytes({
      bytes,
      sourceDeclaration: declaration('stl', bytes),
    }),
    error => error.name === 'StlValidationError',
  );
});

test('raster format mismatch remains rejected through the dispatcher', async () => {
  const bytes = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).png().toBuffer();

  await assert.rejects(
    validateIpSourceBytes({
      bytes,
      sourceDeclaration: declaration('jpeg', bytes),
    }),
    error => error.code === 'FORMAT_MISMATCH',
  );
});
