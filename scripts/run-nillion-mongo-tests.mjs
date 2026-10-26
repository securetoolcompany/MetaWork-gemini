// scripts/run-nillion-mongo-tests.mjs

import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { MongoMemoryServer } from 'mongodb-memory-server';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

const testFile = fileURLToPath(
  new URL(
    '../tests/integration/nillion-proposal-store.mongo.test.mjs',
    import.meta.url,
  ),
);

async function main() {
  // Fail before starting MongoDB if the integration test is missing.
  await access(testFile);

  let server;

  try {
    console.log('Starting disposable MongoDB on localhost...');

    server = await MongoMemoryServer.create({
      instance: {
        ip: '127.0.0.1',
      },
    });

    const localUri = server.getUri();
    const parsed = new URL(localUri);

    if (
      parsed.protocol !== 'mongodb:' ||
      parsed.hostname !== '127.0.0.1'
    ) {
      throw new Error('Refusing a non-local MongoDB test connection.');
    }

    console.log('Local MongoDB ready. Running integration tests...');

    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--test', testFile],
        {
          cwd: repositoryRoot,
          stdio: 'inherit',
          env: {
            ...process.env,

            // Always override any previously exported test URI.
            NILLION_TEST_MONGO_URL: localUri,

            // These are not needed by the integration test.
            MONGO_URL: '',
            MONGODB_URI: '',
          },
        },
      );

      child.once('error', reject);
      child.once('close', (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } finally {
    if (server) {
      await server.stop();
      console.log('Disposable local MongoDB stopped.');
    }
  }
}

main().catch((error) => {
  const message = String(error?.message || 'Local MongoDB test failed.')
    .split('\n')[0]
    .replace(/(?:https?|wss?|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/g, '[REDACTED URL]');

  console.error(message);
  process.exitCode = 1;
});