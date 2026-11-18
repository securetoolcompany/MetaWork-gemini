import { validateRasterImage } from './validate-raster.js';
import { validateStl } from './validate-stl.js';

export class IpSourceValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IpSourceValidationError';
    this.code = code;
  }
}

// Internal server boundary: sourceDeclaration must come from the stored
// operation, and bytes must come from the receipt-bound retrieval layer.
// This function alone does not establish either provenance.
export async function validateIpSourceBytes({
  bytes,
  sourceDeclaration,
}) {
  if (
    !sourceDeclaration ||
    typeof sourceDeclaration !== 'object' ||
    Array.isArray(sourceDeclaration)
  ) {
    throw new TypeError('A stored source declaration is required');
  }

  const { format, byteLength } = sourceDeclaration;

  if (!['png', 'jpeg', 'svg', 'stl'].includes(format)) {
    throw new TypeError('Unsupported declared source format');
  }

  const maxBytes = format === 'stl'
    ? 104857600
    : 50 * 1024 * 1024;

  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength <= 0 ||
    byteLength > maxBytes
  ) {
    throw new TypeError('Invalid declared source byte length');
  }

  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Source bytes must be Uint8Array');
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    bytes.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError('Shared source buffers are not supported');
  }

  if (bytes.byteLength !== byteLength) {
    throw new IpSourceValidationError(
      'DECLARED_SIZE_MISMATCH',
      'Retrieved bytes do not match the stored source declaration',
    );
  }

  if (format === 'svg') {
    throw new IpSourceValidationError(
      'SVG_VALIDATION_UNAVAILABLE',
      'Authoritative SVG validation is not connected',
    );
  }

  const result = format === 'stl'
    ? validateStl(bytes)
    : await validateRasterImage(bytes, { format });

  if (
    result.format !== format ||
    result.byteLength !== byteLength ||
    result.validation?.status !== 'valid' ||
    result.sourceHash?.algorithm !== 'sha256' ||
    !/^[a-f0-9]{64}$/.test(result.sourceHash?.hex ?? '') ||
    typeof result.validation.policyVersion !== 'string' ||
    typeof result.validation.validatorVersion !== 'string'
  ) {
    throw new IpSourceValidationError(
      'INVALID_VALIDATOR_RESULT',
      'Source validation did not produce a usable result',
    );
  }

  return result;
}
