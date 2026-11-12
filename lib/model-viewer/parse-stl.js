import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export const MAX_STL_BYTES = 100 * 1024 * 1024;
export const MAX_STL_TRIANGLES = 2_000_000;

export function checkStlSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('The STL file is empty or has an invalid size.');
  }

  if (size > MAX_STL_BYTES) {
    throw new Error('This preview supports STL files up to 100 MiB.');
  }
}

function checkTriangleCount(count) {
  if (!count) {
    throw new Error('The STL contains no triangles.');
  }

  if (count > MAX_STL_TRIANGLES) {
    throw new Error('This preview supports up to 2,000,000 triangles.');
  }
}

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const VECTOR = `(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})`;
const NORMAL_LINE = new RegExp(`^facet\\s+normal\\s+${VECTOR}$`);
const VERTEX_LINE = new RegExp(`^vertex\\s+${VECTOR}$`);

function checkVectorLine(line, pattern) {
  const match = pattern.exec(line ?? '');

  if (!match || !match.slice(1).every(value => Number.isFinite(Number(value)))) {
    throw new Error('The ASCII STL has malformed or nonfinite numeric data.');
  }
}

function preflightAscii(buffer) {
  let text;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('The file is not a supported ASCII or binary STL.');
  }

  const lines = text.split(/\r\n|\n|\r/).map(line => line.trim()).filter(Boolean);
  let index = 0;
  let triangles = 0;

  while (index < lines.length) {
    if (!/^solid(?:\s.*)?$/.test(lines[index++])) {
      throw new Error('The ASCII STL must begin with a solid declaration.');
    }

    while (index < lines.length && !/^endsolid(?:\s.*)?$/.test(lines[index])) {
      checkVectorLine(lines[index++], NORMAL_LINE);

      if (lines[index++] !== 'outer loop') {
        throw new Error('The ASCII STL has an incomplete triangle.');
      }

      for (let vertex = 0; vertex < 3; vertex++) {
        checkVectorLine(lines[index++], VERTEX_LINE);
      }

      if (lines[index++] !== 'endloop' || lines[index++] !== 'endfacet') {
        throw new Error('The ASCII STL has an incomplete triangle.');
      }

      triangles++;
      checkTriangleCount(triangles);
    }

    if (index >= lines.length) {
      throw new Error('The ASCII STL is missing its endsolid declaration.');
    }

    index++;
  }

  checkTriangleCount(triangles);
  return triangles;
}

function preflight(buffer) {
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer);
    const triangles = view.getUint32(80, true);
    const expectedBytes = 84 + triangles * 50;

    if (expectedBytes === buffer.byteLength) {
      checkTriangleCount(triangles);

      for (let triangle = 0; triangle < triangles; triangle++) {
        const start = 84 + triangle * 50;

        for (let component = 0; component < 12; component++) {
          if (!Number.isFinite(view.getFloat32(start + component * 4, true))) {
            throw new Error('The binary STL contains nonfinite numeric data.');
          }
        }
      }

      return { encoding: 'binary', triangles };
    }
  }

  return {
    encoding: 'ASCII',
    triangles: preflightAscii(buffer),
  };
}

export function parseStl(buffer) {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error('The STL preview requires an ArrayBuffer.');
  }

  checkStlSize(buffer.byteLength);
  const expected = preflight(buffer);
  let geometry;

  try {
    geometry = new STLLoader().parse(buffer);
    const position = geometry.getAttribute('position');

    if (!position || position.count !== expected.triangles * 3) {
      throw new Error('The STL triangle data could not be decoded consistently.');
    }

    for (const value of position.array) {
      if (!Number.isFinite(value)) {
        throw new Error('The model coordinates exceed the preview numeric range.');
      }
    }

    for (let vertex = 0; vertex < position.count; vertex += 3) {
      const ax = position.getX(vertex);
      const ay = position.getY(vertex);
      const az = position.getZ(vertex);

      const ux = position.getX(vertex + 1) - ax;
      const uy = position.getY(vertex + 1) - ay;
      const uz = position.getZ(vertex + 1) - az;

      const vx = position.getX(vertex + 2) - ax;
      const vy = position.getY(vertex + 2) - ay;
      const vz = position.getZ(vertex + 2) - az;

      const area = Math.hypot(
        uy * vz - uz * vy,
        uz * vx - ux * vz,
        ux * vy - uy * vx,
      );

      if (!Number.isFinite(area) || area === 0) {
        throw new Error(
          'The model contains degenerate or numerically unusable triangles. No repairs were applied.',
        );
      }
    }

    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;

    const extents = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    };

    if (!Object.values(extents).every(Number.isFinite)) {
      throw new Error('The model bounds exceed the preview numeric range.');
    }

    return {
      geometry,
      stats: {
        format: 'STL',
        encoding: expected.encoding,
        byteLength: buffer.byteLength,
        triangleCount: expected.triangles,
        extents,
      },
    };
  } catch (error) {
    geometry?.dispose();

    throw new Error(
      error instanceof Error ? error.message : 'The STL could not be previewed.',
    );
  }
}