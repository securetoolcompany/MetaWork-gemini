import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateStl } from '../lib/ip-source/validate-stl.js';
import { STL_POLICY } from '../lib/ip-source/stl-policy.js';

const facet = Buffer.from([
  'facet normal 0 0 1',
  'outer loop',
  'vertex 0 0 0',
  'vertex 1 0 0',
  'vertex 0 1 0',
  'endloop',
  'endfacet',
  '',
].join('\n'));

const header = Buffer.from('solid benchmark\n');
const footer = Buffer.from('endsolid benchmark\n');

function makeFixture(encoding, scenario) {
  let count = scenario === 'small' ? 1 : 100000;

  if (scenario === 'near-limit') {
    count = encoding === 'binary'
      ? STL_POLICY.maxTriangles
      : Math.floor(
          (STL_POLICY.maxBytes - header.length - footer.length) / facet.length,
        );
  }

  if (scenario === 'over-triangles') {
    count = STL_POLICY.maxTriangles + 1;
  }

  if (scenario === 'over-bytes') {
    return Buffer.alloc(STL_POLICY.maxBytes + 1, 32);
  }

  if (encoding === 'binary') {
    const bytes = Buffer.alloc(84 + count * 50);
    bytes.writeUInt32LE(count, 80);

    for (let index = 0; index < count; index++) {
      const start = 84 + index * 50;
      bytes.writeFloatLE(1, start + 8);
      bytes.writeFloatLE(1, start + 24);
      bytes.writeFloatLE(1, start + 40);
    }

    if (scenario === 'malformed') {
      bytes.writeFloatLE(Infinity, 84);
    }

    return bytes;
  }

  const naturalSize = header.length + count * facet.length + footer.length;
  const size = scenario === 'near-limit'
    ? STL_POLICY.maxBytes
    : naturalSize;

  const bytes = Buffer.alloc(size, 32);
  header.copy(bytes);
  let offset = header.length;

  for (let index = 0; index < count; index++) {
    facet.copy(bytes, offset);
    offset += facet.length;
  }

  footer.copy(bytes, offset);
  offset += footer.length;

  // Padding uses short blank lines, not a single oversized line.
  for (let index = offset; index < bytes.length; index += 80) {
    bytes[index] = 10;
  }

  if (scenario === 'malformed') {
    bytes[header.length] = 63;
  }

  return bytes;
}

function peakRss() {
  try {
    const bytes = process.resourceUsage().maxRSS * 1024;

    return {
      peakProcessRssBytes:
        Number.isFinite(bytes) && bytes > 0 ? bytes : null,
      peakRssMeasurement:
        Number.isFinite(bytes) && bytes > 0
          ? 'process.resourceUsage().maxRSS'
          : 'unavailable',
    };
  } catch {
    return {
      peakProcessRssBytes: null,
      peakRssMeasurement: 'unavailable',
    };
  }
}

const cases = [];

for (const encoding of ['binary', 'ascii']) {
  for (const scenario of [
    'small',
    'typical',
    'near-limit',
    'over-bytes',
    'malformed',
  ]) {
    cases.push({ encoding, scenario });
  }
}

cases.push({ encoding: 'binary', scenario: 'over-triangles' });

const childIndex = process.argv.indexOf('--case');

if (childIndex !== -1) {
  const specification = JSON.parse(process.argv[childIndex + 1]);
  const fixtureStarted = performance.now();
  const bytes = makeFixture(specification.encoding, specification.scenario);
  const fixtureElapsedMs = performance.now() - fixtureStarted;
  const memoryBefore = process.memoryUsage();
  const started = performance.now();

  let result;
  let error;

  try {
    result = validateStl(bytes);
  } catch (caught) {
    error = {
      name: caught.name,
      code: caught.code || null,
      message: caught.message,
      progress: caught.progress || null,
    };
  }

  const elapsedMs = performance.now() - started;

  console.log(JSON.stringify({
    ...specification,
    byteLength: bytes.length,
    fixtureElapsedMs,
    elapsedMs,
    ...peakRss(),
    memoryBefore,
    memoryAfter: process.memoryUsage(),
    accepted: Boolean(result),
    triangleCount: result?.triangleCount ?? null,
    processing: result?.processing ?? null,
    error: error || null,
  }));
} else {
  const repetitions = 3;
  const rows = [];
  const script = fileURLToPath(import.meta.url);

  for (const specification of cases) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const child = spawnSync(
        process.execPath,
        [script, '--case', JSON.stringify(specification)],
        {
          encoding: 'utf8',
          timeout: 180000,
          maxBuffer: 1024 * 1024,
        },
      );

      let row;

      try {
        if (child.error || child.status !== 0 || child.signal) {
          throw new Error('Benchmark child did not complete successfully');
        }

        row = JSON.parse(child.stdout);
      } catch {
        row = {
          ...specification,
          accepted: false,
          processFailure: {
            status: child.status,
            signal: child.signal,
            message: child.error?.message || child.stderr,
          },
        };
      }

      rows.push({ ...row, repetition });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }

  const report = {
    recordedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      versions: process.versions,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model || null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytesAtReport: os.freemem(),
      execArgv: process.execArgv,
      nodeOptions: process.env.NODE_OPTIONS || null,
    },
    policy: STL_POLICY,
    methodology: {
      repetitions,
      freshProcessPerCase: true,
      elapsedExcludesFixtureGeneration: true,
      peakRssIncludesFixtureGeneration: true,
      syntheticTypicalTriangles: 100000,
      asciiTriangleLimitNote:
        'At this fixture encoding size the byte limit binds before two million triangles. Triangle-limit behavior is tested with reduced policies in unit tests.',
      overByteNote:
        'Over-byte fixtures reject before encoding detection; encoding identifies the benchmark lane only.',
      memoryNote:
        'Null peakProcessRssBytes means unavailable, not zero memory use. Before/after memory snapshots are not peak measurements.',
      productionCertification: false,
    },
    rows,
  };

  mkdirSync('output', { recursive: true });

  writeFileSync(
    'output/stl-validation-benchmark.json',
    JSON.stringify(report, null, 2) + '\n',
  );

  const columns = [
    'encoding', 'scenario', 'repetition', 'byteLength',
    'accepted', 'triangleCount', 'elapsedMs', 'peakProcessRssBytes',
    'errorCode',
  ];

  const csv = [
    columns.join(','),
    ...rows.map(row => [
      row.encoding,
      row.scenario,
      row.repetition,
      row.byteLength ?? '',
      row.accepted,
      row.triangleCount ?? '',
      row.elapsedMs ?? '',
      row.peakProcessRssBytes ?? '',
      row.error?.code ?? (row.processFailure ? 'PROCESS_FAILURE' : ''),
    ].join(',')),
  ].join('\n') + '\n';

  writeFileSync('output/stl-validation-benchmark.csv', csv);

  const unexpected = rows.filter(row =>
    row.processFailure ||
    (
      ['small', 'typical', 'near-limit'].includes(row.scenario)
        ? !row.accepted
        : row.accepted
    )
  );

  const missingPeak = rows.filter(row =>
    !row.processFailure && row.peakProcessRssBytes === null
  );

  console.log(JSON.stringify({
    summary: {
      casesRun: rows.length,
      unexpectedOutcomes: unexpected.length,
      missingPeakMemoryMeasurements: missingPeak.length,
      jsonReport: 'output/stl-validation-benchmark.json',
      csvReport: 'output/stl-validation-benchmark.csv',
      productionCertification: false,
    },
  }));

  if (unexpected.length > 0 || missingPeak.length > 0) {
    process.exitCode = 1;
  }
}
