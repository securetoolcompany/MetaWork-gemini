import { NextResponse } from 'next/server';
import { canonicalIpDraft } from '@/lib/ip-upload-draft';
import { validateIpUploadSource } from '@/lib/ip-source/validate-upload';
import { verifyToken } from '@/lib/auth';
import { createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import {
  authorizeIpUpload,
  confirmIpUpload,
} from '@/lib/ip-upload-service';


const IP_UPLOAD_V2_HEADERS = {
  'Cache-Control': 'no-store',
};

const IP_SOURCE_RULES = Object.freeze({
  png: {
    extension: /\.png$/i,
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['image/png', 'application/octet-stream'],
  },
  jpeg: {
    extension: /\.jpe?g$/i,
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'application/octet-stream'],
  },
  svg: {
    extension: /\.svg$/i,
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['image/svg+xml', 'application/octet-stream'],
  },
  stl: {
    extension: /\.stl$/i,
    maxBytes: 104857600,
    mimeTypes: [
      'model/stl',
      'model/x.stl',
      'application/sla',
      'application/octet-stream',
      'text/plain',
    ],
  },
});

async function readIpUploadBody(request) {
  if (!request.body) {
    throw new TypeError('A JSON request body is required');
  }

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      length += value.byteLength;

      if (length > 32768) {
        throw new TypeError('Upload request exceeds 32 KiB');
      }

      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Preserve the original request error.
    }
  }

  const bytes = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body;

  try {
    body = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    );
  } catch {
    throw new TypeError('A valid JSON request body is required');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Request body must be an object');
  }

  return body;
}

function boundedIpString(value, name, maxLength) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    throw new TypeError(`${name} is invalid`);
  }

  return value;
}

// Deterministic serialization of the complete declared draft.
// This freezes inputs; it does not replace financial or media validation.

async function handleIpUploadV2(request, ownerId) {
  const IP_UPLOAD_V2_SERVER_ENABLED = false;
  if (!IP_UPLOAD_V2_SERVER_ENABLED || process.env.METAWORK_IP_UPLOAD_V2_ENABLED !== 'true') {
    return NextResponse.json({
      code: 'IP_UPLOAD_V2_DISABLED', error: 'V2 uploads are disabled.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const body = await readIpUploadBody(request);

    boundedIpString(body.operationKey, 'operationKey', 36);
    boundedIpString(body.revision, 'revision', 128);

    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        body.operationKey,
      )
    ) {
      throw new TypeError('operationKey is invalid');
    }

    if (body.purpose !== 'source') {
      throw new TypeError('This upload contract currently supports source only');
    }

    if (!['authorize', 'confirm', 'validate'].includes(body.action)) {
      throw new TypeError('Unsupported upload action');
    }

    let normalized;

    if (body.action === 'authorize') {
      if (body.confirmTokenization !== true) {
        throw new TypeError('Explicit tokenization confirmation is required');
      }

      if (
        !body.draft ||
        typeof body.draft !== 'object' ||
        Array.isArray(body.draft)
      ) {
        throw new TypeError('An IP draft is required');
      }

      const source = body.source;

      if (
        !source ||
        typeof source !== 'object' ||
        Array.isArray(source) ||
        !Object.prototype.hasOwnProperty.call(IP_SOURCE_RULES, source.format)
      ) {
        throw new TypeError('Unsupported IP source declaration');
      }

      const rule = IP_SOURCE_RULES[source.format];
      const filename = boundedIpString(source.filename, 'filename', 255);

      if (
        /[/\\\u0000-\u001f\u007f]/.test(filename) ||
        !rule.extension.test(filename) ||
        !Number.isSafeInteger(source.byteLength) ||
        source.byteLength <= 0 ||
        source.byteLength > rule.maxBytes
      ) {
        throw new TypeError('Invalid IP source filename or byte length');
      }

      normalized = {
        rule,
        snapshot: {
          draft: canonicalIpDraft(body.draft),
          source: {
            format: source.format,
            filename,
            byteLength: source.byteLength,
          },
        },
      };
    } else {
      boundedIpString(body.authorizationId, 'authorizationId', 128);
      boundedIpString(body.providerFileId, 'providerFileId', 128);

      if (!/^[a-zA-Z0-9_-]+$/.test(body.providerFileId)) {
        throw new TypeError('providerFileId is invalid');
      }
    }

    const { db } = await connectToDatabase();
    let result;

    if (body.action === 'authorize') {
      const inputHash = createHash('sha256')
        .update(JSON.stringify(normalized.snapshot))
        .digest('hex');

      result = await authorizeIpUpload({
        db,
        ownerId,
        operationKey: body.operationKey,
        revision: body.revision,
        inputHash,
        sourceDeclaration: normalized.snapshot.source,
        purpose: 'source',
        maxBytes: normalized.rule.maxBytes,
        allowedMimeTypes: normalized.rule.mimeTypes,
      });
    } else if (body.action === 'validate') {
      result = await validateIpUploadSource({
        db,
        ownerId,
        operationKey: body.operationKey,
        revision: body.revision,
        authorizationId: body.authorizationId,
        providerFileId: body.providerFileId,
      });
    } else {
      result = await confirmIpUpload({
        db,
        ownerId,
        operationKey: body.operationKey,
        revision: body.revision,
        purpose: 'source',
        authorizationId: body.authorizationId,
        providerFileId: body.providerFileId,
      });
    }

    return NextResponse.json(
      { success: true, ...result },
      {
        status: result.step === 'upload_recovery_required' ? 409 : 200,
        headers: IP_UPLOAD_V2_HEADERS,
      },
    );
  } catch (error) {
    const conflict = error?.code === 'IP_UPLOAD_OPERATION_CONFLICT';
    const invalid = error instanceof TypeError;

    return NextResponse.json(
      {
        success: false,
        error: conflict
          ? 'The existing IP upload operation must be resumed.'
          : invalid
            ? error.message
            : 'IP upload could not be completed safely. Preserve the existing operation and retry status recovery.',
        code: conflict
          ? 'IP_UPLOAD_OPERATION_CONFLICT'
          : invalid
            ? 'INVALID_IP_UPLOAD_REQUEST'
            : 'IP_UPLOAD_RECOVERY_REQUIRED',
      },
      {
        status: conflict ? 409 : invalid ? 400 : 503,
        headers: IP_UPLOAD_V2_HEADERS,
      },
    );
  }
}

export async function POST(request) {
  try {
    const authorization = request.headers.get('authorization');
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : null;
    const token = bearerToken || request.cookies?.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication is required.' },
        { status: 401 },
      );
    }

    let ownerId;

    try {
      const decoded = verifyToken(token);

      if (!decoded?.userId || typeof decoded.userId !== 'string') {
        throw new Error('Invalid authentication');
      }

      ownerId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication.' },
        { status: 401 },
      );
    }

    const uploadVersion = request.headers.get('x-metawork-upload-version');

    if (uploadVersion === '2') {
      return handleIpUploadV2(request, ownerId);
    }

    if (uploadVersion !== null && uploadVersion !== undefined) {
      return NextResponse.json(
        { error: 'Unsupported upload contract version.' },
        { status: 400, headers: IP_UPLOAD_V2_HEADERS },
      );
    }

    // Transitional compatibility for the current authenticated image caller.
    // Remove when /upload-ip completes the V2 cutover.
    const res = await fetch('https://api.pinata.cloud/v3/pinata/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        keyName: `upload-${Date.now()}`,
        permissions: { endpoints: { pinning: { pinFileToIPFS: true } } },
        maxUses: 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.details || 'Key generation failed');
    return NextResponse.json({ JWT: data.JWT });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}