const RECOVERY_MESSAGE =
  'Upload outcome requires recovery. Preserve this operation; do not upload again.';

function requireIdentifier(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(value)
  ) {
    throw new Error('Invalid upload response identifier');
  }

  return value;
}

function requireUploadUrl(value) {
  const url = new URL(value);

  if (
    url.origin !== 'https://uploads.pinata.cloud' ||
    url.pathname !== '/v3/files' ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error('Invalid upload destination');
  }

  return url.href;
}

export function createIpUploadClient({
  file,
  authorizationRequest,
  getAuthHeaders,
  isCurrent,
  fetchImpl = globalThis.fetch,
}) {
  // Freeze declared inputs before any asynchronous continuation.
  const request = JSON.parse(JSON.stringify(authorizationRequest));

  if (
    request.action !== 'authorize' ||
    request.purpose !== 'source' ||
    request.confirmTokenization !== true ||
    typeof getAuthHeaders !== 'function' ||
    typeof isCurrent !== 'function'
  ) {
    throw new TypeError('A confirmed source-upload snapshot is required');
  }

  let phase = 'ready';
  let authorizationId = null;
  let providerFileId = null;
  let received = null;
  let active = false;

  function assertCurrent() {
    if (!isCurrent()) {
      throw new Error(
        'Upload inputs changed. This operation cannot continue.',
      );
    }
  }

  async function route(payload) {
    const response = await fetchImpl('/api/ipfs/key', {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'x-metawork-upload-version': '2',
      },
      body: JSON.stringify(payload),
    });

    assertCurrent();

    const body = await response.json();

    assertCurrent();

    return { response, body };
  }

  async function validateReceived() {
    const { response, body } = await route({
      action: 'validate',
      operationKey: request.operationKey,
      revision: request.revision,
      purpose: 'source',
      authorizationId,
      providerFileId,
    });

    if (
      !response.ok ||
      body.step !== 'source_validated' ||
      body.operationKey !== request.operationKey ||
      body.revision !== request.revision ||
      body.authorizationId !== authorizationId ||
      body.providerFileId !== providerFileId ||
      body.validationStatus !== 'valid'
    ) {
      throw new Error(
        'Source validation is incomplete. Preserve this operation and retry validation.',
      );
    }

    received = {
      step: 'source_validated',
      operationKey: request.operationKey,
      revision: request.revision,
      purpose: 'source',
      authorizationId,
      providerFileId,
      network: 'public',
      validationStatus: 'valid',
    };
    phase = 'validated';

    return { ...received };
  }

  async function run() {
    if (active) {
      throw new Error('An upload request is already active');
    }

    assertCurrent();

    if (phase === 'validated') return { ...received };

    if (phase === 'recovery_required') {
      throw new Error(RECOVERY_MESSAGE);
    }

    active = true;

    try {
      if (phase === 'received') {
        return await validateReceived();
      }

      if (phase === 'ready') {
        // Issuance is uncertain until a usable response is known.
        phase = 'recovery_required';

        const { response, body } = await route(request);

        if (!response.ok || body.step !== 'upload_authorized') {
          throw new Error(RECOVERY_MESSAGE);
        }

        authorizationId = requireIdentifier(
          body.authorization?.authorizationId,
        );

        if (
          body.authorization?.purpose !== 'source' ||
          body.authorization?.network !== 'public' ||
          body.upload?.method !== 'POST' ||
          body.upload?.network !== 'public'
        ) {
          throw new Error('Invalid upload authorization response');
        }

        const uploadUrl = requireUploadUrl(body.upload.url);

        assertCurrent();

        const multipart = new FormData();
        multipart.append('file', file);
        multipart.append('network', 'public');

        // Never forward platform authentication to the signed URL.
        const uploadResponse = await fetchImpl(uploadUrl, {
          method: 'POST',
          redirect: 'error',
          credentials: 'omit',
          body: multipart,
        });

        assertCurrent();

        const uploadBody = await uploadResponse.json();

        assertCurrent();

        if (!uploadResponse.ok) {
          throw new Error(RECOVERY_MESSAGE);
        }

        providerFileId = requireIdentifier(uploadBody?.data?.id);
        phase = 'receipt_pending';
      }

      assertCurrent();

      const { response, body } = await route({
        action: 'confirm',
        operationKey: request.operationKey,
        revision: request.revision,
        purpose: 'source',
        authorizationId,
        providerFileId,
      });

      if (
        !response.ok ||
        body.step !== 'upload_received' ||
        body.operationKey !== request.operationKey ||
        body.revision !== request.revision ||
        body.purpose !== 'source' ||
        body.authorizationId !== authorizationId ||
        body.providerFileId !== providerFileId ||
        body.network !== 'public' ||
        !['pending', 'valid'].includes(body.validationStatus)
      ) {
        throw new Error(
          'Receipt confirmation is incomplete. Retry confirmation for this operation.',
        );
      }

      received = {
        step: 'upload_received',
        operationKey: request.operationKey,
        revision: request.revision,
        purpose: 'source',
        authorizationId,
        providerFileId,
        network: 'public',
        validationStatus: 'pending',
      };

      phase = 'received';

      return await validateReceived();
    } finally {
      active = false;
    }
  }

  return {
    run,
    snapshot() {
      return {
        phase,
        operationKey: request.operationKey,
        revision: request.revision,
        authorizationId,
        providerFileId,
      };
    },
  };
}
