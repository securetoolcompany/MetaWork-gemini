// lib/tokenized-funds/nillion/distribution-approval-handler.js

import { NillionApprovalError } from './distribution-approval-service.js';

const ID = /^[0-9a-f]{64}$/;
const MAX_BODY_BYTES = 2048;

function json(body, status) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Cookie, Authorization',
    },
  });
}

// Cookie-authenticated writes need protection from cross-site requests.
function sameOrigin(request) {
  const origin = request.headers.get('origin');

  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function createNillionApprovalHandlers({
  authenticate,
  isEnabled,
  service,
}) {
  async function authorize(request) {
    const admin = await authenticate(request);

    if (!admin) {
      return {
        response: json(
          {
            success: false,
            error: 'Administrator authorization is required.',
          },
          403,
        ),
      };
    }

    if (!isEnabled()) {
      return {
        response: json(
          {
            success: false,
            error: 'Distribution proposal storage is not enabled.',
          },
          503,
        ),
      };
    }

    return { admin };
  }

  function failure(error) {
    if (error instanceof NillionApprovalError) {
      return json({ success: false, error: error.message }, error.status);
    }

    // Never return tokens, database errors, RPC URLs, or file paths.
    return json(
      {
        success: false,
        error:
          'The distribution proposal request could not be completed. ' +
          'No payment was performed.',
      },
      503,
    );
  }

  async function GET(request) {
    try {
      const { response } = await authorize(request);
      if (response) return response;

      if (new URL(request.url).searchParams.size !== 0) {
        return json(
          {
            success: false,
            error: 'This endpoint does not accept query parameters.',
          },
          400,
        );
      }

      return json(
        {
          success: true,
          executionEnabled: false,
          proposal: await service.getActive(),
        },
        200,
      );
    } catch (error) {
      return failure(error);
    }
  }

  async function POST(request) {
    try {
      const { admin, response } = await authorize(request);
      if (response) return response;

      if (!sameOrigin(request)) {
        return json(
          { success: false, error: 'Cross-origin requests are not allowed.' },
          403,
        );
      }

      if (
        !request.headers
          .get('content-type')
          ?.toLowerCase()
          .startsWith('application/json')
      ) {
        return json(
          { success: false, error: 'Request body must be JSON.' },
          415,
        );
      }

      const text = await request.text();

      if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
        return json(
          { success: false, error: 'Request body is too large.' },
          413,
        );
      }

      let body;

      try {
        body = JSON.parse(text);
      } catch {
        return json(
          { success: false, error: 'Request body must be valid JSON.' },
          400,
        );
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ success: false, error: 'Invalid request.' }, 400);
      }

      const keys = Object.keys(body).sort().join(',');
      const actorId = admin.userId;
      let result;

      if (body.action === 'prepare' && keys === 'action') {
        result = await service.prepare({ actorId });
      } else if (
        (body.action === 'approve' || body.action === 'reject') &&
        keys === 'action,id' &&
        typeof body.id === 'string' &&
        ID.test(body.id)
      ) {
        result = await service[body.action]({ id: body.id, actorId });
      } else {
        return json({ success: false, error: 'Invalid request.' }, 400);
      }

      return json(
        { success: true, executionEnabled: false, ...result },
        200,
      );
    } catch (error) {
      return failure(error);
    }
  }

  return { GET, POST };
}