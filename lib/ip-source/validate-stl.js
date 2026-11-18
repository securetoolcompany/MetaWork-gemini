import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { STL_POLICY } from './stl-policy.js';

export class StlValidationError extends Error {
  constructor(code, message, progress) {
    super(message);
    this.name = 'StlValidationError';
    this.code = code;
    this.progress = progress;
  }
}

export function validateStl(input, options = {}) {
  const policy = { ...STL_POLICY, ...options.policy };
  const now = options.now || (() => performance.now());

  for (const key of [
    'maxBytes',
    'maxTriangles',
    'maxLineBytes',
    'maxWorkUnits',
    'maxElapsedMs',
  ]) {
    if (!Number.isSafeInteger(policy[key]) || policy[key] <= 0) {
      throw new TypeError(`${key} must be a positive safe integer`);
    }
  }

  const progress = {
    scannedBytes: 0,
    hashedBytes: 0,
    triangles: 0,
    workUnits: 0,
  };

  function fail(code, message) {
    throw new StlValidationError(code, message, { ...progress });
  }

  let bytes;

  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new TypeError('Expected Uint8Array or ArrayBuffer');
  }

  if (bytes.buffer instanceof SharedArrayBuffer) {
    throw new TypeError('Shared input buffers are not supported');
  }

  if (bytes.byteLength === 0) {
    fail('EMPTY', 'The STL source is empty');
  }

  if (bytes.byteLength > policy.maxBytes) {
    fail('BYTE_LIMIT', 'The STL source exceeds the byte limit');
  }

  const started = now();

  function spend(units) {
    if (progress.workUnits + units > policy.maxWorkUnits) {
      fail('WORK_LIMIT', 'The STL validation work budget was exceeded');
    }

    progress.workUnits += units;

    if (now() - started > policy.maxElapsedMs) {
      fail('TIME_LIMIT', 'The STL validation elapsed budget was exceeded');
    }
  }

  function checkTriangleLimit(count) {
    if (count > policy.maxTriangles) {
      fail('TRIANGLE_LIMIT', 'The STL source exceeds the triangle limit');
    }
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  function triangle(vertices) {
    spend(64);

    for (let index = 0; index < 9; index++) {
      const value = vertices[index];

      if (!Number.isFinite(value)) {
        fail('NUMERIC', 'Coordinates exceed the supported numeric range');
      }

      const axis = index % 3;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }

    const ux = vertices[3] - vertices[0];
    const uy = vertices[4] - vertices[1];
    const uz = vertices[5] - vertices[2];
    const vx = vertices[6] - vertices[0];
    const vy = vertices[7] - vertices[1];
    const vz = vertices[8] - vertices[2];

    const area = Math.hypot(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
    );

    if (!Number.isFinite(area) || area === 0) {
      fail('DEGENERATE', 'Degenerate or numerically unusable triangle');
    }

    progress.triangles++;
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const declared = bytes.byteLength >= 84
    ? view.getUint32(80, true)
    : null;

  const binary = declared !== null &&
    84 + declared * 50 === bytes.byteLength;

  const vertices = new Float64Array(9);

  if (binary) {
    checkTriangleLimit(declared);

    if (declared === 0) {
      fail('NO_TRIANGLES', 'The STL source contains no triangles');
    }

    for (let index = 0; index < declared; index++) {
      const offset = 84 + index * 50;
      spend(50);

      for (let component = 0; component < 12; component++) {
        const value = view.getFloat32(offset + component * 4, true);

        if (!Number.isFinite(value)) {
          fail('NUMERIC', 'Binary STL contains nonfinite numeric data');
        }

        if (component >= 3) {
          vertices[component - 3] = value;
        }
      }

      progress.scannedBytes = offset + 50;
      triangle(vertices);
    }
  } else {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const number = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
    const vector = `(${number})\\s+(${number})\\s+(${number})`;
    const normal = new RegExp(`^facet\\s+normal\\s+${vector}$`);
    const vertex = new RegExp(`^vertex\\s+${vector}$`);

    let state = 'solid';
    let vertexIndex = 0;

    function readVector(line, pattern, store) {
      const match = pattern.exec(line);

      if (!match) {
        fail('STRUCTURE', 'Malformed ASCII STL vector');
      }

      for (let axis = 0; axis < 3; axis++) {
        const value = Number(match[axis + 1]);

        if (!Number.isFinite(value)) {
          fail('NUMERIC', 'ASCII STL contains nonfinite numeric data');
        }

        if (store) {
          vertices[vertexIndex * 3 + axis] = Math.fround(value);
        }
      }
    }

    function consume(start, end) {
      spend(end - start + 1);
      let line;

      try {
        line = decoder.decode(bytes.subarray(start, end)).trim();
      } catch {
        fail('ENCODING', 'ASCII STL is not valid UTF-8');
      }

      if (!line) return;

      if (state === 'solid') {
        if (!/^solid(?:\s.*)?$/.test(line)) {
          fail('STRUCTURE', 'Expected solid declaration');
        }
        state = 'facet';
      } else if (state === 'facet') {
        if (/^endsolid(?:\s.*)?$/.test(line)) {
          state = 'solid';
        } else {
          checkTriangleLimit(progress.triangles + 1);
          readVector(line, normal, false);
          state = 'loop';
        }
      } else if (state === 'loop') {
        if (line !== 'outer loop') {
          fail('STRUCTURE', 'Expected outer loop');
        }
        vertexIndex = 0;
        state = 'vertex';
      } else if (state === 'vertex') {
        readVector(line, vertex, true);
        vertexIndex++;

        if (vertexIndex === 3) state = 'endloop';
      } else if (state === 'endloop') {
        if (line !== 'endloop') {
          fail('STRUCTURE', 'Expected endloop');
        }
        state = 'endfacet';
      } else {
        if (line !== 'endfacet') {
          fail('STRUCTURE', 'Expected endfacet');
        }
        triangle(vertices);
        state = 'facet';
      }
    }

    let start = 0;

    for (let index = 0; index < bytes.byteLength; index++) {
      if (index % 4096 === 0) {
        spend(Math.min(4096, bytes.byteLength - index));
      }

      progress.scannedBytes = index + 1;
      const value = bytes[index];

      if (value === 10 || value === 13) {
        consume(start, index);
        start = index + 1;
      } else if (index - start + 1 > policy.maxLineBytes) {
        fail('LINE_LIMIT', 'ASCII STL line exceeds the line-work limit');
      }
    }

    if (start < bytes.byteLength) consume(start, bytes.byteLength);

    if (state !== 'solid') {
      fail('STRUCTURE', 'ASCII STL is incomplete');
    }

    if (progress.triangles === 0) {
      fail('NO_TRIANGLES', 'The STL source contains no triangles');
    }
  }

  const hash = createHash('sha256');

  for (let offset = 0; offset < bytes.byteLength; offset += 65536) {
    const end = Math.min(offset + 65536, bytes.byteLength);
    spend(end - offset);
    hash.update(bytes.subarray(offset, end));
    progress.hashedBytes = end;
  }

  spend(1);

  const xyz = values => ({
    x: values[0],
    y: values[1],
    z: values[2],
  });

  return {
    format: 'stl',
    encoding: binary ? 'binary' : 'ascii',
    byteLength: bytes.byteLength,
    triangleCount: progress.triangles,
    bounds: { min: xyz(min), max: xyz(max) },
    extents: xyz(max.map((value, axis) => value - min[axis])),
    sourceHash: {
      algorithm: 'sha256',
      hex: hash.digest('hex'),
    },
    validation: {
      status: 'valid',
      policyVersion: policy.policyVersion,
      validatorVersion: policy.validatorVersion,
    },
    processing: {
      ...progress,
      elapsedMs: now() - started,
    },
  };
}
