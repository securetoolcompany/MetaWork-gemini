import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import {
  RASTER_POLICY,
  RasterValidationError,
  validateRasterImage,
} from '../lib/ip-source/validate-raster.js';

const hash = bytes =>
  createHash('sha256').update(bytes).digest('hex');

async function image(format) {
  return sharp({
    create: {
      width: 3,
      height: 2,
      channels: 4,
      background: { r: 120, g: 60, b: 30, alpha: 1 },
    },
  }).toFormat(format).toBuffer();
}

test('staging policy is explicit and versioned', () => {
  assert.ok(Object.isFrozen(RASTER_POLICY));
  assert.equal(RASTER_POLICY.maxBytes, 50 * 1024 * 1024);
  assert.equal(RASTER_POLICY.maxPixels, 16_000_000);
  assert.equal(RASTER_POLICY.processingTimeoutSeconds, 10);
  assert.equal(RASTER_POLICY.policyVersion, 'raster-staging-v1');
  assert.equal(RASTER_POLICY.validatorVersion, 'raster-source-v1');
});

for (const format of ['png', 'jpeg']) {
  test(`${format}: full decode returns dimensions and exact source hash`, async () => {
    const bytes = await image(format);
    const before = Buffer.from(bytes);
    const result = await validateRasterImage(bytes, { format });

    assert.equal(result.format, format);
    assert.equal(result.width, 3);
    assert.equal(result.height, 2);
    assert.equal(result.byteLength, bytes.length);
    assert.equal(result.sourceHash.algorithm, 'sha256');
    assert.equal(result.sourceHash.hex, hash(before));
    assert.deepEqual(bytes, before);
    assert.deepEqual(result.validation, {
      status: 'valid',
      policyVersion: RASTER_POLICY.policyVersion,
      validatorVersion: RASTER_POLICY.validatorVersion,
    });
  });

  test(`${format}: a contradictory declaration is rejected`, async () => {
    const bytes = await image(format);
    const declared = format === 'png' ? 'jpeg' : 'png';

    await assert.rejects(
      validateRasterImage(bytes, { format: declared }),
      error =>
        error instanceof RasterValidationError &&
        error.code === 'FORMAT_MISMATCH',
    );
  });

  test(`${format}: truncated bytes are rejected`, async () => {
    const bytes = await image(format);
    const truncated = bytes.subarray(
      0,
      Math.floor(bytes.length / 2),
    );

    await assert.rejects(
      validateRasterImage(truncated, { format }),
      error =>
        error instanceof RasterValidationError &&
        error.code === 'DECODE_FAILED',
    );
  });
}

test('caller mutation after invocation cannot change validated bytes', async () => {
  const bytes = await image('png');
  const expectedHash = hash(bytes);

  const pending = validateRasterImage(bytes, { format: 'png' });
  bytes.fill(0);

  const result = await pending;
  assert.equal(result.sourceHash.hex, expectedHash);
});

test('Buffer subarray validates and hashes only the selected bytes', async () => {
  const bytes = await image('png');
  const wrapped = Buffer.concat([
    Buffer.from('prefix'),
    bytes,
    Buffer.from('suffix'),
  ]);
  const slice = wrapped.subarray(6, 6 + bytes.length);

  const result = await validateRasterImage(slice, { format: 'png' });

  assert.equal(result.byteLength, bytes.length);
  assert.equal(result.sourceHash.hex, hash(bytes));
});

test('empty source is rejected before decoding', async () => {
  await assert.rejects(
    validateRasterImage(Buffer.alloc(0), { format: 'png' }),
    error =>
      error instanceof RasterValidationError &&
      error.code === 'EMPTY',
  );
});

test('non-image bytes produce a sanitized validation error', async () => {
  await assert.rejects(
    validateRasterImage(
      Buffer.from('not an image: sensitive-fixture-value'),
      { format: 'png' },
    ),
    error =>
      error instanceof RasterValidationError &&
      error.code === 'DECODE_FAILED' &&
      !error.message.includes('sensitive-fixture-value'),
  );
});

test('SVG and unsupported declarations cannot enter the raster path', async () => {
  const bytes = await image('png');

  for (const format of [undefined, 'svg', 'gif', 'stl']) {
    await assert.rejects(
      validateRasterImage(bytes, { format }),
      TypeError,
    );
  }
});

test('non-byte input is rejected', async () => {
  for (const input of [null, 'image', {}, new ArrayBuffer(8)]) {
    await assert.rejects(
      validateRasterImage(input, { format: 'png' }),
      TypeError,
    );
  }
});

test('shared input buffers are rejected', async () => {
  await assert.rejects(
    validateRasterImage(
      new Uint8Array(new SharedArrayBuffer(8)),
      { format: 'png' },
    ),
    TypeError,
  );
});
