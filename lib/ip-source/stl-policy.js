export const STL_POLICY = Object.freeze({
  policyVersion: 'stl-ingestion-benchmark-v1',
  validatorVersion: 'stl-source-v1',
  maxBytes: 104_857_600,
  maxTriangles: 2_000_000,
  maxLineBytes: 4096,
  maxWorkUnits: 3 * 104_857_600 + 128 * 2_000_000,
  maxElapsedMs: 30_000,
});
