import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  IpSourceReadError,
  readIpSourceBytes,
} from '../lib/ip-source/read-source.js';

const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';

function operation() {
  return {
    schemaVersion: 1,
    status: 'confirmed',
    revision: 'revision-1',
    inputHash: 'ab'.repeat(32),
    sourceDeclaration: {
      format: 'png',
      filename: 'fixture.png',
      byteLength: 3,
    },
    authorizations: {
      source: {
        authorizationId: 'authorization-1',
        operationRevision: 'revision-1',
        purpose: 'source',
        status: 'associated',
        network: 'public',
        maxBytes: 50 * 1024 * 1024,
        associatedProviderFileId: 'file-1',
      },
    },
    receipts: {
      source: {
        authorizationId: 'authorization-1',
        operationRevision: 'revision-1',
        purpose: 'source',
        network: 'public',
        provider: 'pinata',
        providerFileId: 'file-1',
        verificationMethod: 'pinata_authenticated_file_lookup',
        providerNumberOfFiles: 1,
        sourceValidationStatus: 'pending',
        providerSize: 3,
        cid,
      },
    },
  };
}

function isReadFailure(error) {
  return error instanceof IpSourceReadError &&
    error.code === 'SOURCE_READ_FAILED';
}

async function withFixture(handler, check) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const origin = `http://127.0.0.1:${server.address().port}`;

  try {
    await check(async (url, init) => {
      assert.equal(url, `https://gateway.pinata.cloud/ipfs/${cid}`);
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.headers['Accept-Encoding'], 'identity');
      assert.equal(
        new Headers(init.headers).has('authorization'),
        false,
      );

      return fetch(`${origin}/ipfs/${cid}`, init);
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}

test('HTTP: exact declared body is returned unchanged', async () => {
  await withFixture((request, response) => {
    assert.equal(request.url, `/ipfs/${cid}`);
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(200, { 'Content-Length': '3' });
    response.end(Buffer.from([1, 2, 3]));
  }, async fetchImpl => {
    const result = await readIpSourceBytes({
      operation: operation(),
      fetchImpl,
    });
    assert.deepEqual(result, new Uint8Array([1, 2, 3]));
  });
});

test('HTTP: exact chunked body succeeds without content-length', async () => {
  await withFixture((request, response) => {
    response.writeHead(200, { 'Transfer-Encoding': 'chunked' });
    response.write(Buffer.from([1]));
    response.end(Buffer.from([2, 3]));
  }, async fetchImpl => {
    const result = await readIpSourceBytes({
      operation: operation(),
      fetchImpl,
    });
    assert.deepEqual(result, new Uint8Array([1, 2, 3]));
  });
});

test('HTTP: short and oversized chunked bodies are rejected', async (t) => {
  for (const body of [[1, 2], [1, 2, 3, 4]]) {
    await t.test(`${body.length} bytes`, async () => {
      await withFixture((request, response) => {
        response.writeHead(200, { 'Transfer-Encoding': 'chunked' });
        response.end(Buffer.from(body));
      }, async fetchImpl => {
        await assert.rejects(
          readIpSourceBytes({ operation: operation(), fetchImpl }),
          isReadFailure,
        );
      });
    });
  }
});

test('HTTP: mismatched declared length is rejected', async () => {
  await withFixture((request, response) => {
    response.writeHead(200, { 'Content-Length': '4' });
    response.end(Buffer.from([1, 2, 3, 4]));
  }, async fetchImpl => {
    await assert.rejects(
      readIpSourceBytes({ operation: operation(), fetchImpl }),
      isReadFailure,
    );
  });
});

test('HTTP: upstream failure is sanitized', async () => {
  await withFixture((request, response) => {
    response.writeHead(503);
    response.end('private upstream diagnostic');
  }, async fetchImpl => {
    await assert.rejects(
      readIpSourceBytes({ operation: operation(), fetchImpl }),
      error => {
        assert.ok(isReadFailure(error));
        assert.equal(
          error.message.includes('private upstream diagnostic'),
          false,
        );
        return true;
      },
    );
  });
});

test('HTTP: redirects are rejected without following their target', async () => {
  let requests = 0;

  await withFixture((request, response) => {
    requests++;
    response.writeHead(302, { Location: '/redirect-target' });
    response.end();
  }, async fetchImpl => {
    await assert.rejects(
      readIpSourceBytes({ operation: operation(), fetchImpl }),
      isReadFailure,
    );
    assert.equal(requests, 1);
  });
});

test('HTTP: interrupted body is rejected and sanitized', async () => {
  await withFixture((request, response) => {
    response.writeHead(200, { 'Content-Length': '3' });
    response.flushHeaders();
    response.write(Buffer.from([1]));
    setImmediate(() => response.destroy());
  }, async fetchImpl => {
    await assert.rejects(
      readIpSourceBytes({ operation: operation(), fetchImpl }),
      error => {
        assert.ok(isReadFailure(error));
        assert.equal(
          error.message,
          'Source bytes could not be retrieved within verification limits',
        );
        return true;
      },
    );
  });
});

test('HTTP: stalled body is stopped by the reader deadline', {
  timeout: 25000,
}, async () => {
  let requestSignal;
  let receivedHeaders = false;

  await withFixture((request, response) => {
    response.writeHead(200, { 'Content-Length': '3' });
    response.flushHeaders();
    response.write(Buffer.from([1]));
    // Deliberately leave the remaining bytes unsent.
  }, async fetchImpl => {
    await assert.rejects(
      readIpSourceBytes({
        operation: operation(),
        async fetchImpl(url, init) {
          requestSignal = init.signal;
          const response = await fetchImpl(url, init);
          receivedHeaders = true;
          return response;
        },
      }),
      isReadFailure,
    );

    assert.equal(receivedHeaders, true);
    assert.equal(requestSignal.aborted, true);
  });
});
