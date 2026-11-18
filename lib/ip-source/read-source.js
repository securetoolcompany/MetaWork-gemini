const SOURCE_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const READ_TIMEOUT_MS = 15_000;

export class IpSourceReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IpSourceReadError';
    this.code = code;
  }
}

function rejectBinding() {
  throw new IpSourceReadError(
    'SOURCE_BINDING_REQUIRED',
    'An associated source receipt and matching declaration are required',
  );
}

// Internal only: operation must be loaded using authenticated owner context.
// The provider gateway is a trust boundary; this is not trustless CID checking.
export async function readIpSourceBytes({
  operation,
  fetchImpl = globalThis.fetch,
}) {
  const source = operation?.sourceDeclaration;
  const authorization = operation?.authorizations?.source;
  const receipt = operation?.receipts?.source;

  if (
    operation?.schemaVersion !== 1 ||
    operation?.status !== 'confirmed' ||
    typeof operation?.revision !== 'string' ||
    !operation.revision ||
    typeof operation?.inputHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(operation.inputHash) ||
    !source ||
    !['png', 'jpeg', 'stl'].includes(source.format) ||
    !authorization ||
    !receipt ||
    authorization.status !== 'associated' ||
    authorization.purpose !== 'source' ||
    authorization.network !== 'public' ||
    authorization.operationRevision !== operation.revision ||
    typeof authorization.authorizationId !== 'string' ||
    !authorization.authorizationId ||
    receipt.authorizationId !== authorization.authorizationId ||
    receipt.operationRevision !== operation.revision ||
    receipt.purpose !== 'source' ||
    receipt.network !== 'public' ||
    receipt.provider !== 'pinata' ||
    receipt.verificationMethod !== 'pinata_authenticated_file_lookup' ||
    receipt.providerNumberOfFiles !== 1 ||
    !['pending', 'valid'].includes(receipt.sourceValidationStatus) ||
    typeof receipt.providerFileId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(receipt.providerFileId) ||
    authorization.associatedProviderFileId !== receipt.providerFileId ||
    !Number.isSafeInteger(source.byteLength) ||
    source.byteLength <= 0 ||
    !Number.isSafeInteger(authorization.maxBytes) ||
    authorization.maxBytes <= 0 ||
    source.byteLength > authorization.maxBytes ||
    receipt.providerSize !== source.byteLength
  ) {
    rejectBinding();
  }

  const formatLimit = source.format === 'stl'
    ? 104857600
    : 50 * 1024 * 1024;

  if (source.byteLength > formatLimit) rejectBinding();

  // URL-safe CID-shaped identifiers only. This does not prove CID validity.
  if (
    typeof receipt.cid !== 'string' ||
    !/^[a-zA-Z0-9]{20,200}$/.test(receipt.cid)
  ) {
    rejectBinding();
  }

  // Capture primitive bindings before awaiting network operations.
  const expectedBytes = source.byteLength;
  const url = SOURCE_GATEWAY + receipt.cid;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    READ_TIMEOUT_MS,
  );

  let reader;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'application/octet-stream',
        'Accept-Encoding': 'identity',
      },
    });

    if (controller.signal.aborted || response.status !== 200 || !response.body) {
      throw new Error('Source unavailable');
    }

    const declaredLength = response.headers.get('content-length');

    if (
      declaredLength !== null &&
      (
        !/^\d+$/.test(declaredLength) ||
        Number(declaredLength) !== expectedBytes
      )
    ) {
      throw new Error('Source length mismatch');
    }

    // Fixed-size allocation bounds retained payload storage.
    const bytes = new Uint8Array(expectedBytes);
    let offset = 0;
    reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (controller.signal.aborted) {
        throw new Error('Source read deadline exceeded');
      }

      if (done) break;

      if (
        !(value instanceof Uint8Array) ||
        offset + value.byteLength > expectedBytes
      ) {
        throw new Error('Source exceeds expected length');
      }

      bytes.set(value, offset);
      offset += value.byteLength;
    }

    if (offset !== expectedBytes) {
      throw new Error('Source is incomplete');
    }

    return bytes;
  } catch {
    throw new IpSourceReadError(
      'SOURCE_READ_FAILED',
      'Source bytes could not be retrieved within verification limits',
    );
  } finally {
    clearTimeout(timeout);
    controller.abort();

    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Cleanup must not replace the sanitized error.
      }
    }
  }
}
