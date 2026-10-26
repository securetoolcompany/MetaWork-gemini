// lib/tokenized-funds/nillion/distribution-review-service.js

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function createNillionReviewStateLoader({
  rootDirectory = process.cwd(),
  readText = readFile,
} = {}) {
  const directory = path.join(
    rootDirectory,
    'data',
    'tokenized-funds',
    'nillion',
  );

  const allocationPath = path.join(directory, 'stakers.json');
  const ledgerPath = path.join(directory, 'payout-ledger.json');

  return async function loadState() {
    // Read again on every invocation. The reviewer invokes this twice.
    const [allocationText, ledgerText] = await Promise.all([
      readText(allocationPath, 'utf8'),
      readText(ledgerPath, 'utf8'),
    ]);

    return {
      allocationConfig: JSON.parse(allocationText),
      ledger: JSON.parse(ledgerText),
      drafts: [],
    };
  };
}

export async function getNillionReviewAdmin(
  request,
  { verifyToken, findUser },
) {
  const authorization = request.headers.get('authorization');

  let token;

  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);

    // Do not silently fall back to a cookie after a malformed header.
    if (!match) return null;

    token = match[1];
  } else {
    token = request.cookies?.get('auth_token')?.value;
  }

  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > 8192
  ) {
    return null;
  }

  let decoded;

  try {
    decoded = await verifyToken(token);
  } catch {
    return null;
  }

  if (
    typeof decoded?.userId !== 'string' ||
    decoded.userId.length === 0
  ) {
    return null;
  }

  // Database failures propagate so the handler fails closed.
  const user = await findUser(decoded.userId);

  if (!user || !(user.role === 'admin' || user.isAdmin === true)) {
    return null;
  }

  return { userId: decoded.userId };
}

function response(body, status) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Cookie, Authorization',
    },
  });
}

export function createNillionReviewHandler({
  authenticate,
  runReview,
}) {
  return async function GET(request) {
    try {
      const admin = await authenticate(request);

      if (!admin) {
        return response(
          {
            success: false,
            error: 'Administrator authorization is required.',
          },
          403,
        );
      }

      if (new URL(request.url).searchParams.size !== 0) {
        return response(
          {
            success: false,
            error: 'This endpoint does not accept query parameters.',
          },
          400,
        );
      }

      const review = await runReview();

      return response(
        {
          success: true,
          approvalPersisted: false,
          executionEnabled: false,
          review,
        },
        200,
      );
    } catch {
      // Do not return tokens, database errors, RPC URLs, or file paths.
      return response(
        {
          success: false,
          error:
            'Distribution review could not be completed. ' +
            'No approval or payment was performed.',
        },
        503,
      );
    }
  };
}