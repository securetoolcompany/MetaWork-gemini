import { mkdirSync, writeFileSync } from 'node:fs';
import { parseStl } from '../lib/model-viewer/parse-stl.js';

const segments = 96;
const profile = [
  [0.42, -0.28],
  [1.8, -0.28],
  [1.8, 0.05],
  [0.95, 0.05],
  [0.95, 0.55],
  [0.42, 0.55],
];
const triangles = [];

function point(profileIndex, segment) {
  const [baseRadius, height] = profile[profileIndex];
  const wrapped = segment % segments;
  const angle = wrapped * Math.PI * 2 / segments;
  const tooth = Math.floor(wrapped / 2) % 2 === 0 ? 1 : 0.88;
  const radius = baseRadius > 1.5 ? baseRadius * tooth : baseRadius;
  return [radius * Math.cos(angle), height, radius * Math.sin(angle)];
}

for (let ring = 0; ring < profile.length; ring++) {
  const next = (ring + 1) % profile.length;
  for (let segment = 0; segment < segments; segment++) {
    const a = point(ring, segment);
    const b = point(ring, segment + 1);
    const c = point(next, segment + 1);
    const d = point(next, segment);
    triangles.push([a, b, c], [a, c, d]);
  }
}

const buffer = new ArrayBuffer(84 + triangles.length * 50);
const bytes = new Uint8Array(buffer);
bytes.set(new TextEncoder().encode('MetaWork original mechanical demo - local viewing sample'));
const view = new DataView(buffer);
view.setUint32(80, triangles.length, true);

triangles.forEach(([a, b, c], index) => {
  const u = b.map((value, axis) => value - a[axis]);
  const v = c.map((value, axis) => value - a[axis]);
  const normal = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...normal);
  const values = [...normal.map(value => value / length), ...a, ...b, ...c];
  values.forEach((value, component) => {
    view.setFloat32(84 + index * 50 + component * 4, value, true);
  });
});

const result = parseStl(buffer);
try {
  const directory = new URL('../public/models/', import.meta.url);
  const target = new URL('metawork-demo.stl', directory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(target, bytes, { flag: 'wx' });
  console.log(JSON.stringify({
    asset: 'public/models/metawork-demo.stl',
    ...result.stats,
  }, null, 2));
} finally {
  result.geometry.dispose();
}
