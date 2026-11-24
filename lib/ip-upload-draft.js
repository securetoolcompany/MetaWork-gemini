export function canonicalIpDraft(value, depth = 0) {
  if (depth > 8) {
    throw new TypeError('IP draft nesting exceeds the supported limit');
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => canonicalIpDraft(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const result = Object.create(null);

    for (const key of Object.keys(value).sort()) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        throw new TypeError('IP draft contains an unsupported key');
      }

      result[key] = canonicalIpDraft(value[key], depth + 1);
    }

    return result;
  }

  throw new TypeError('IP draft contains an unsupported value');
}
