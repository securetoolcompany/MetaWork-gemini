import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(
  new URL('../app/upload-ip/page.js', import.meta.url),
  'utf8',
);

const page = ts.createSourceFile(
  'page.jsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JSX,
);

function findAll(predicate, root = page) {
  const found = [];

  function visit(node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  }

  visit(root);
  return found;
}

function exactlyOne(nodes, description) {
  assert.equal(nodes.length, 1, description);
  return nodes[0];
}

function declaration(name) {
  return exactlyOne(
    findAll(node =>
      ts.isVariableDeclaration(node) &&
      node.name.getText(page) === name
    ),
    `Expected one declaration of ${name}`,
  );
}

function stagedBranch() {
  return exactlyOne(
    findAll(node =>
      ts.isIfStatement(node) &&
      node.expression.getText(page) ===
        'IP_UPLOAD_V2_ENABLED || v2UploadRef.current'
    ),
    'Expected one sticky V2 branch',
  );
}

test('upload page parses as JSX without syntax errors', () => {
  const diagnostics = page.parseDiagnostics.map(diagnostic =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  );

  assert.deepEqual(diagnostics, []);
});

test('V2 defaults off and imports the shared client helper', () => {
  assert.equal(
    declaration('IP_UPLOAD_V2_ENABLED').initializer.kind,
    ts.SyntaxKind.FalseKeyword,
  );

  const importNode = exactlyOne(
    findAll(node =>
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier.text === '@/lib/ip-upload-client'
    ),
    'Expected shared V2 helper import',
  );

  assert.match(importNode.getText(page), /\bcreateIpUploadClient\b/);
});

test('validated V2 bypasses legacy upload and feeds shared tokenization', () => {
  const branch = stagedBranch();
  const block = branch.thenStatement;
  assert.ok(ts.isBlock(block));
  assert.ok(!ts.isReturnStatement(block.statements.at(-1)));

  const body = block.getText(page);

  assert.match(body, /await operation\.client\.run\(\)/);
  assert.match(body, /validated\.step !== 'source_validated'/);
  assert.match(body, /validated\.validationStatus !== 'valid'/);
  assert.match(body, /validated\.operationKey !== operation\.operationKey/);
  assert.match(body, /validated\.revision !== operation\.revision/);
  assert.doesNotMatch(body, /validation is pending/);

  const assignment = exactlyOne(
    findAll(node =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(page) === 'v2TokenizationRequest',
      block,
    ),
    'Expected bound V2 tokenization request',
  );

  assert.ok(
    declaration('validated').getStart(page) < assignment.getStart(page),
    'Validation must finish before constructing the tokenization request',
  );

  const payload = assignment.right.getText(page);
  assert.match(payload, /operationKey: operation\.operationKey/);
  assert.match(payload, /revision: operation\.revision/);
  assert.match(payload, /authorizationId: validated\.authorizationId/);
  assert.match(payload, /providerFileId: validated\.providerFileId/);
  assert.match(payload, /draft: structuredClone\(operation\.draft\)/);
  assert.doesNotMatch(payload, /\bimage\s*:|\bcid\s*:/);

  const submit = declaration('handleSubmit').initializer;
  const legacyGuard = exactlyOne(
    findAll(node =>
      ts.isIfStatement(node) &&
      node.expression.getText(page) === '!v2TokenizationRequest',
      submit,
    ),
    'Expected legacy upload only when no V2 request exists',
  );

  assert.ok(legacyGuard.getStart(page) > branch.end);

  const legacyFetch = exactlyOne(
    findAll(node =>
      ts.isCallExpression(node) &&
      node.expression.getText(page) === 'fetch' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text ===
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
      submit,
    ),
    'Expected exactly one preserved legacy image upload',
  );

  assert.ok(
    legacyFetch.getStart(page) > legacyGuard.thenStatement.getStart(page) &&
    legacyFetch.end < legacyGuard.thenStatement.end,
    'Legacy upload must be inside its fallback guard',
  );

  const mintPayload = declaration('mintPayload').initializer;
  assert.ok(ts.isBinaryExpression(mintPayload));
  assert.equal(mintPayload.operatorToken.kind, ts.SyntaxKind.BarBarToken);
  assert.equal(mintPayload.left.getText(page), 'v2TokenizationRequest');
  assert.ok(ts.isObjectLiteralExpression(mintPayload.right));

  const tokenizationFetch = exactlyOne(
    findAll(node =>
      ts.isCallExpression(node) &&
      node.expression.getText(page) === 'fetch' &&
      node.arguments[0]?.getText(page) === 'tokenizationEndpoint' &&
      node.arguments[1]?.getText(page).includes("method: 'POST'"),
      submit,
    ),
    'Expected one shared tokenization preparation POST',
  );

  const request = tokenizationFetch.arguments[1].getText(page);
  assert.match(request, /body: JSON\.stringify\(mintPayload\)/);
  assert.match(
    request,
    /v2TokenizationRequest\s*\?\s*\{\s*'x-metawork-upload-version': '2'\s*\}\s*:\s*\{\}/,
  );
});

test('V2 preserves its client across retries and rejects changed inputs', () => {
  const body = stagedBranch().thenStatement.getText(page);

  assert.match(body, /let operation = v2UploadRef\.current/);
  assert.match(body, /operation\.inputSnapshot !== inputSnapshot/);
  assert.match(body, /operation\.media !== currentMedia/);
  assert.match(body, /if \(!operation\)/);
  assert.match(body, /v2UploadRef\.current = operation/);

  assert.equal(
    findAll(node =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(page) === 'v2UploadRef.current'
    ).length,
    1,
    'No other page code may reset or replace the V2 operation',
  );

  assert.match(
    body,
    /currentInputSnapshotRef\.current === inputSnapshot/,
  );
  assert.match(body, /mediaGenerationRef\.current === generation/);
  assert.match(body, /selectedMediaRef\.current === currentMedia/);
});

test('STL admission requires V2 and cannot fall back to legacy upload', async () => {
  const { readFile } = await import('node:fs/promises');
  const assert = (await import('node:assert/strict')).default;
  const source = await readFile(new URL('../app/upload-ip/page.js', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleSubmit ='));
  const guard = 'if (!isImage && !(isStl && IP_UPLOAD_V2_ENABLED))';
  const v2 = 'if (IP_UPLOAD_V2_ENABLED || v2UploadRef.current)';
  const noFallback = 'if (isStl && !v2TokenizationRequest)';
  const legacy = 'let ipfsHash;';
  for (const marker of [guard, v2, noFallback, legacy]) {
    assert.ok(handler.includes(marker), `Missing ${marker}`);
  }
  assert.match(source, /const IP_UPLOAD_V2_ENABLED = false;/);
  assert.ok(handler.indexOf(guard) < handler.indexOf(v2));
  assert.ok(handler.indexOf(v2) < handler.indexOf(noFallback));
  assert.ok(handler.indexOf(noFallback) < handler.indexOf(legacy));

  // Execute the actual page's eligibility expression with test-only inputs.
  const expression = handler.match(/if \((!isImage && !\(isStl && IP_UPLOAD_V2_ENABLED\))\)/)?.[1];
  assert.ok(expression);
  const blocked = new Function('isImage', 'isStl', 'IP_UPLOAD_V2_ENABLED', `return ${expression};`);
  assert.equal(blocked(false, true, false), true);
  assert.equal(blocked(false, true, true), false);
  assert.equal(blocked(true, false, false), false);
});

test('confirmation checks the current snapshot and central credit price', () => {
  assert.equal(
    declaration('IP_TOKENIZATION_CREDITS').initializer.getText(page),
    'CREDIT_COSTS.MINT_IP',
  );

  assert.match(
    declaration('IP_TOKENIZATION_USD').initializer.getText(page),
    /IP_TOKENIZATION_CREDITS \/ CREDITS_PER_DOLLAR/,
  );

  const submit = declaration('handleSubmit').initializer.getText(page);
  assert.match(
    submit,
    /confirmationSnapshotRef\.current !== inputSnapshot/,
  );
  assert.match(
    submit,
    /currentInputSnapshotRef\.current !== inputSnapshot/,
  );

  assert.match(
    declaration('canConfirm').initializer.getText(page),
    /confirmedSnapshot === currentInputSnapshotRef\.current/,
  );

  assert.doesNotMatch(source, /creditBalance\s*[<-]\s*25\b/);
  assert.doesNotMatch(source, /Use 25 Credits|requires 25 credits/);
});
