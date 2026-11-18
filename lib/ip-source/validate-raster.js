import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

export const RASTER_POLICY = Object.freeze({
  policyVersion: 'raster-staging-v1',
  validatorVersion: 'raster-source-v1',
  maxBytes: 50 * 1024 * 1024,
  maxPixels: 16_000_000,
  processingTimeoutSeconds: 10,
});

export class RasterValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RasterValidationError';
    this.code = code;
  }
}

export async function validateRasterImage(input, { format } = {}) {
  if (!['png', 'jpeg'].includes(format)) {
    throw new TypeError('An explicit PNG or JPEG format is required');
  }

  if (!(input instanceof Uint8Array)) {
    throw new TypeError('Expected source bytes as Uint8Array');
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    input.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError('Shared input buffers are not supported');
  }

  if (input.byteLength === 0) {
    throw new RasterValidationError('EMPTY', 'The image source is empty');
  }

  if (input.byteLength > RASTER_POLICY.maxBytes) {
    throw new RasterValidationError(
      'BYTE_LIMIT',
      'The image source exceeds the byte limit',
    );
  }

  // Own the exact bytes across asynchronous decoding and hashing.
  const bytes = Buffer.from(input);

  const options = {
    failOn: 'warning',
    limitInputPixels: RASTER_POLICY.maxPixels,
    sequentialRead: true,
  };

  let width;
  let height;

  try {
    const probe = sharp(bytes, options)
      .timeout({ seconds: RASTER_POLICY.processingTimeoutSeconds });

    let metadata;

    try {
      metadata = await probe.metadata();
    } finally {
      probe.destroy();
    }

    if (metadata.format !== format) {
      throw new RasterValidationError(
        'FORMAT_MISMATCH',
        'The image bytes do not match the declared format',
      );
    }

    width = metadata.width;
    height = metadata.height;

    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > RASTER_POLICY.maxPixels
    ) {
      throw new RasterValidationError(
        'PIXEL_LIMIT',
        'The image dimensions exceed the supported limit',
      );
    }

    if ((metadata.pages ?? 1) !== 1) {
      throw new RasterValidationError(
        'MULTIPAGE',
        'Animated or multipage image sources are not supported',
      );
    }

    let decodedBytes = 0;
    const expectedBytes = width * height * 4;

    const sink = new Writable({
      write(chunk, encoding, callback) {
        decodedBytes += chunk.length;

        if (decodedBytes > expectedBytes) {
          callback(new Error('Decoded image exceeds expected dimensions'));
          return;
        }

        callback();
      },
    });

    await pipeline(
      sharp(bytes, options)
        .timeout({ seconds: RASTER_POLICY.processingTimeoutSeconds })
        .toColourspace('srgb')
        .ensureAlpha()
        .raw({ depth: 'uchar' }),
      sink,
    );

    if (decodedBytes !== expectedBytes) {
      throw new Error('Decoded image is incomplete');
    }
  } catch (error) {
    if (error instanceof RasterValidationError) throw error;

    throw new RasterValidationError(
      'DECODE_FAILED',
      'The image could not be fully decoded within validation limits',
    );
  }

  return {
    format,
    byteLength: bytes.byteLength,
    width,
    height,
    sourceHash: {
      algorithm: 'sha256',
      hex: createHash('sha256').update(bytes).digest('hex'),
    },
    validation: {
      status: 'valid',
      policyVersion: RASTER_POLICY.policyVersion,
      validatorVersion: RASTER_POLICY.validatorVersion,
    },
  };
}
