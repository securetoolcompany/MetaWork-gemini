/** Local-only disposable TestNet operator route. No wallet implementation here.
 * Never enable on a hosted instance or use an ephemeral/shared execution disk.
 * Verification and reconciliation cannot sign or submit.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TXID = 'HAQMKRU6ZAO3AI2AGFLPIHSOUIIC7RRSMC5J76SWQAJJYVQ5DEYA';
const HASH = '4cee0b8eef2197a564c62cce8885a83c60508e74f5f5186f3ccbe2f8c16e5f5d';
const CREATOR = 'BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y';
const ORIGIN = 'http://127.0.0.1:3107';
const ALGOD = 'https://testnet-api.algonode.cloud';
const GENESIS = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';
const WORKER = "import base64, hashlib, json, sys\nfrom pathlib import Path\n\nroot = Path(sys.argv[1]).resolve()\nsys.path.insert(0, str(root / \"contracts\" / \"algo_staking\"))\nimport prepare_tokenizer_creation_testnet as prep\nfrom tokenizer_creation_signature import verify_creation_signature\nfrom algosdk import encoding, logic\nfrom algosdk.transaction import ApplicationCreateTxn, OnComplete, SignedTransaction, StateSchema, SuggestedParams\nfrom algosdk.v2client.algod import AlgodClient\nfrom algosdk.v2client.models import SimulateRequest, SimulateRequestTransactionGroup\n\nTXID = \"HAQMKRU6ZAO3AI2AGFLPIHSOUIIC7RRSMC5J76SWQAJJYVQ5DEYA\"\nDIGEST = \"4cee0b8eef2197a564c62cce8885a83c60508e74f5f5186f3ccbe2f8c16e5f5d\"\nCREATOR = \"BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y\"\n\ndef require(ok, message):\n    if not ok:\n        raise RuntimeError(message)\n\ndef run():\n    payload = json.load(sys.stdin)\n    mode = payload[\"mode\"]\n    require(mode in (\"verify\", \"signed\", \"confirmed\"), \"Unsupported validation operation\")\n    require(prep.CREATOR_INITIALIZER == CREATOR, \"Configured creator differs from pinned creator\")\n    require(prep.COMPILE == \"compile-testnet-4ed0b7d0e5024620b807cdf1cb48bf8f\", \"Compilation selection changed\")\n    require(prep.EXPECTED == {\n        \"approval\": (1186, \"647becfb6530849c0335bea8a31af2a7e6d6f24b58be093a32b584c3b4383878\"),\n        \"clear\": (4, \"baa698f7e6728cd2257d20588deaae7ff497fb535bd35e1dd745988d380c66c5\")}, \"Pinned programs changed\")\n    directory = root / \"contracts\" / \"algo_staking\" / \"artifacts\" / \"tokenizer-testnet\" / \"creation-testnet-day1-replacement-1\"\n    raw = prep.read_regular(directory / \"creation.unsigned.msgpack\")\n    require(hashlib.sha256(raw).hexdigest() == DIGEST, \"Saved candidate hash mismatch\")\n    record = json.loads(prep.read_regular(directory / \"creation-preparation.json\"))\n    previous = json.loads(prep.read_regular(directory / \"creation-simulation.json\"))\n    txn = encoding.msgpack_decode(base64.b64encode(raw).decode())\n    require(txn.get_txid() == TXID and base64.b64decode(encoding.msgpack_encode(txn)) == raw, \"Saved transaction ID/serialization mismatch\")\n    for item in (record, previous):\n        require(item[\"unsigned_txid\"] == TXID and item[\"unsigned_msgpack_sha256\"] == DIGEST, \"Saved evidence association mismatch\")\n    prep.validate_network(network=record[\"network\"], genesis_id=record[\"genesis_id\"], genesis_hash_base64=record[\"genesis_hash_base64\"])\n    prep.validate_endpoint(record[\"algod_url\"])\n    prep.validate_roles(record[\"approved_roles\"])\n    metadata, programs = prep.load_compilation()\n    require(record[\"compile_directory\"] == prep.COMPILE and record[\"programs\"] == metadata[\"programs\"] and record[\"compiled_source_sha256\"] == metadata[\"source_sha256\"], \"Compilation bindings changed\")\n    expected = ApplicationCreateTxn(sender=CREATOR,\n        sp=SuggestedParams(fee=1000, first=68924333, last=68925333, gh=prep.GENESIS_HASH_BASE64, gen=prep.GENESIS_ID, flat_fee=True),\n        on_complete=OnComplete.NoOpOC, approval_program=programs[\"approval\"], clear_program=programs[\"clear\"],\n        global_schema=StateSchema(8, 3), local_schema=StateSchema(0, 0), extra_pages=0)\n    require(encoding.msgpack_encode(txn) == encoding.msgpack_encode(expected), \"Candidate differs from exact creation template\")\n    client = AlgodClient(\"\", prep.ALGOD_URL)\n    versions = client.versions()\n    params = client.suggested_params()\n    prep.validate_network(network=\"testnet\", genesis_id=versions[\"genesis_id\"], genesis_hash_base64=versions[\"genesis_hash_b64\"])\n    prep.validate_network(network=\"testnet\", genesis_id=params.gen, genesis_hash_base64=params.gh)\n    if mode == \"confirmed\":\n        confirmation = client.pending_transaction_info(TXID)\n        require(type(confirmation.get(\"confirmed-round\")) is int and confirmation[\"confirmed-round\"] > 0, \"Creation not confirmed\")\n        app_id = confirmation.get(\"application-index\")\n        require(type(app_id) is int and app_id > 0 and not confirmation.get(\"pool-error\"), \"Invalid creation confirmation\")\n        app = client.application_info(app_id)[\"params\"]\n        require(app[\"creator\"] == CREATOR, \"Confirmed creator mismatch\")\n        for name, field in ((\"approval\", \"approval-program\"), (\"clear\", \"clear-state-program\")):\n            require(base64.b64decode(app[field], validate=True) == programs[name], \"Confirmed program mismatch\")\n        zero = {\"num-uint\": 0, \"num-byte-slice\": 0}\n        require(app[\"global-state-schema\"] == {\"num-uint\": 8, \"num-byte-slice\": 3} and app.get(\"local-state-schema\", zero) == zero and app.get(\"extra-program-pages\", 0) == 0, \"Confirmed schema/pages mismatch\")\n        observed = {}\n        for entry in app.get(\"global-state\", []):\n            key = base64.b64decode(entry[\"key\"], validate=True).decode()\n            require(key not in observed, \"Duplicate confirmed state key\")\n            value = entry[\"value\"]\n            require(value.get(\"type\") in (1, 2), \"Invalid confirmed state type\")\n            observed[key] = (value[\"type\"], base64.b64decode(value.get(\"bytes\", \"\"), validate=True) if value[\"type\"] == 1 else value.get(\"uint\", 0))\n        initial = {key: (2, 0) for key in prep.UINT_KEYS}\n        roles = prep.approved_role_public_keys()\n        initial.update({\"initializer\": (1, roles[\"creator_initializer\"]), \"staking\": (1, roles[\"staking\"]), \"seed_recipient\": (1, roles[\"seed_recipient\"])})\n        require(observed == initial, \"Confirmed initial state mismatch\")\n        return {\"ok\": True, \"txid\": TXID, \"rawHash\": DIGEST, \"applicationId\": app_id,\n                \"applicationAddress\": logic.get_application_address(app_id), \"confirmedRound\": confirmation[\"confirmed-round\"]}\n    params, before = prep.live(client)\n    require(txn.first_valid_round <= params.first <= txn.last_valid_round and params.first + 1 <= txn.last_valid_round, \"Saved candidate expired or outside next-round validity; preserve it\")\n    signed = SignedTransaction(txn, None)\n    unsigned = mode == \"verify\"\n    if not unsigned:\n        require(isinstance(payload.get(\"signed\"), str) and len(payload[\"signed\"]) <= 16384, \"Invalid signed payload\")\n        signed = encoding.msgpack_decode(payload[\"signed\"])\n        require(verify_creation_signature(signed, txn) == TXID, \"Signed transaction/signature mismatch\")\n    request = SimulateRequest(txn_groups=[SimulateRequestTransactionGroup(txns=[signed])],\n        allow_empty_signatures=unsigned, allow_unnamed_resources=False,\n        allow_more_logs=False, extra_opcode_budget=0)\n    response = client.simulate_transactions(request)\n    if not unsigned:\n        require(response.get(\"eval-overrides\", {}) == {}, \"Signed simulation has evaluation overrides\")\n        # Reuse the strict existing validator after checking the actual signed\n        # request/response has NO relaxations. Only its unsigned-only metadata\n        # expectation is normalized in a copy; no evaluator input is changed.\n        checked = dict(response)\n        checked[\"eval-overrides\"] = {\"allow-empty-signatures\": True}\n    else:\n        checked = response\n    prep.validate_simulation(checked, txn)\n    params_after, after = prep.live(client)\n    require(txn.first_valid_round <= params_after.first and params_after.first + 1 <= txn.last_valid_round, \"Candidate expired during validation\")\n    require(all(before[k] == after[k] for k in (\"amount\", \"min-balance\", \"auth-addr\")), \"Creator balance/authority changed during validation\")\n    require(params.first <= response[\"last-round\"] <= params_after.first and params_after.first - response[\"last-round\"] <= 1, \"Simulation no longer fresh; stop, no automatic retry\")\n    prep.load_compilation()\n    require(prep.read_regular(directory / \"creation.unsigned.msgpack\") == raw, \"Candidate changed during validation\")\n    return {\"ok\": True, \"txid\": TXID, \"rawHash\": DIGEST, \"fee\": 1000, \"creator\": CREATOR,\n            \"firstValid\": 68924333, \"lastValid\": 68925333, \"simulationRound\": response[\"last-round\"],\n            \"creatorSnapshot\": after, \"unsigned\": base64.b64encode(raw).decode() if unsigned else None,\n            \"conditionalAdditionalMinimum\": 478000,\n            \"conditionalHeadroom\": after[\"amount\"] - 1000 - after[\"min-balance\"] - 478000}\ntry:\n    print(json.dumps(run()))\nexcept Exception as error:\n    print(json.dumps({\"ok\": False, \"error\": str(error) if isinstance(error, RuntimeError) else type(error).__name__}))\n    raise SystemExit(2)\n";
const BINDING = Object.freeze({"network": "testnet", "algod": "https://testnet-api.algonode.cloud", "genesisId": "testnet-v1.0", "genesisHash": "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", "txid": "HAQMKRU6ZAO3AI2AGFLPIHSOUIIC7RRSMC5J76SWQAJJYVQ5DEYA", "unsignedSha256": "4cee0b8eef2197a564c62cce8885a83c60508e74f5f5186f3ccbe2f8c16e5f5d", "creator": "BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y", "staking": "7IWKOOY22UXFIWDRPAONF7HJC2TPICOPHHG3TUIPPZLJWDKDXQ3K6SOFAM", "seedRecipient": "COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE", "approvalProgramSha256": "647becfb6530849c0335bea8a31af2a7e6d6f24b58be093a32b584c3b4383878", "clearProgramSha256": "baa698f7e6728cd2257d20588deaae7ff497fb535bd35e1dd745988d380c66c5", "feeMicroalgo": 1000, "firstValidRound": 68924333, "lastValidRound": 68925333, "globalSchema": {"uints": 8, "byteSlices": 3}, "localSchema": {"uints": 0, "byteSlices": 0}, "extraPages": 0, "effects": "Create one immutable disposable application only; no application funding, ASA, opt-in, rekey, seed initialization, recovery or redemption."});
const challenges = new Map();

function requireValue(ok, message) { if (!ok) throw new Error(message); }
function json(value, status = 200) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'", 'Referrer-Policy': 'no-referrer',
  }});
}
function localOperator(request) {
  requireValue(process.env.TOKENIZER_OPERATOR_MODE === 'local' &&
    process.env.NODE_ENV === 'development' && !process.env.VERCEL && !process.env.NETLIFY &&
    !process.env.AWS_LAMBDA_FUNCTION_NAME, 'Local development operator mode only');
  const url = new URL(request.url);
  const internalOriginAllowed =
    url.origin === ORIGIN ||
    url.origin === 'http://localhost:3107';

  requireValue(
    internalOriginAllowed &&
      request.headers.get('host') === '127.0.0.1:3107',
    'Loopback origin/host required'
  );
  requireValue(!request.headers.get('origin') || request.headers.get('origin') === ORIGIN, 'Cross-origin request refused');
  if (request.method === 'POST') requireValue(request.headers.get('origin') === ORIGIN, 'Same-origin POST required');
  const site = request.headers.get('sec-fetch-site');
  requireValue(!site || site === 'same-origin' || site === 'none', 'Cross-site request refused');
  const forwarded = request.headers.get('x-forwarded-for');
  requireValue(!forwarded || forwarded === '127.0.0.1' || forwarded === '::1' || forwarded === '::ffff:127.0.0.1', 'Proxy/remote request refused');
  const secret = process.env.TOKENIZER_OPERATOR_TOKEN;
  requireValue(typeof secret === 'string' && secret.length >= 32, 'Operator credential not configured');
  const supplied = request.headers.get('authorization') || '';
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update('Bearer ' + secret).digest();
  requireValue(timingSafeEqual(a, b), 'Operator authentication failed');
  const root = process.env.TOKENIZER_REPO_ROOT;
  requireValue(root && path.isAbsolute(root), 'Explicit absolute repository root required');
  return path.resolve(root);
}
async function safeParents(directory) {
  let cursor = path.resolve(directory);
  for (;;) {
    const info = await fs.lstat(cursor);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'Non-directory or symlinked operator path');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}
function guardPath(root) { return path.join(root, '.tokenizer-operator', 'testnet-' + TXID); }
async function guardPresent(root) {
  try { await fs.lstat(guardPath(root)); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
async function append(root, state, details = {}) {
  const directory = guardPath(root);
  await safeParents(directory);
  const file = await fs.open(path.join(directory, 'events.jsonl'), 'a', 0o600);
  try { await file.writeFile(JSON.stringify({ state, txid: TXID, at: new Date().toISOString(), ...details }) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function validate(root, mode, signed) {
  await safeParents(root);
  const python = process.env.TOKENIZER_PYTHON || 'python';
  return await new Promise((resolve, reject) => {
    const child = spawn(python, ['-B', '-c', WORKER, root], { cwd: root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Validation timeout; no automatic retry')); }, 60000);
    child.stdout.on('data', data => { output += data.toString(); if (output.length > 65536) { child.kill(); finish(new Error('Validator output limit')); } });
    child.stderr.on('data', () => {}); // Never log validator input or SDK exception bodies.
    child.on('error', () => finish(new Error('Python validator could not start')));
    child.on('close', code => {
      try {
        const data = JSON.parse(output);
        requireValue(code === 0 && data.ok === true, data.error || 'Candidate validation failed');
        requireValue(data.txid === TXID && data.rawHash === HASH, 'Validator returned a different candidate');
        if (mode !== 'confirmed') requireValue(data.creator === CREATOR && data.fee === 1000 && data.firstValid === 68924333 && data.lastValid === 68925333, 'Validator returned different effects');
        finish(null, data);
      } catch (error) { finish(error); }
    });
    child.stdin.on('error', () => finish(new Error('Validator input failed')));
    child.stdin.end(JSON.stringify({ mode, ...(signed ? { signed } : {}) }));
  });
}
async function publicNode(endpoint, options) {
  const response = await fetch(ALGOD + endpoint, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  requireValue(response.ok, 'TestNet node request failed: HTTP ' + response.status);
  return await response.json();
}
async function checkNetwork() {
  const params = await publicNode('/v2/transactions/params');
  requireValue(params['genesis-id'] === 'testnet-v1.0' && params['genesis-hash'] === GENESIS, 'TestNet genesis mismatch');
}
function phrase(nonce) { return 'AUTHORIZE TESTNET CREATION ' + TXID + ' ' + HASH + ' ' + nonce; }
async function reconcile(root) {
  requireValue(await guardPresent(root), 'No guard exists for this candidate');
  await safeParents(guardPath(root));
  let pending;
  try { await checkNetwork(); pending = await publicNode('/v2/transactions/pending/' + TXID); }
  catch { return json({ status: 'outcome_unknown_do_not_retry', txid: TXID, guardPreserved: true }, 409); }
  if (!(pending['confirmed-round'] > 0)) return json({ status: 'not_confirmed_outcome_unresolved_do_not_retry', txid: TXID, guardPreserved: true }, 409);
  try {
    const data = await validate(root, 'confirmed');
    return json({ status: 'creation_confirmed_verified_not_initialized', ...data, guardPreserved: true });
  } catch (error) {
    return json({ status: 'creation_confirmed_verification_failed', txid: TXID, applicationId: pending['application-index'], error: error.message, guardPreserved: true }, 409);
  }
}

export async function GET(request) {
  try {
    const root = localOperator(request);
    const action = new URL(request.url).searchParams.get('action') || 'verify';
    if (action === 'reconcile') return await reconcile(root);
    requireValue(action === 'verify', 'Unsupported read operation');
    requireValue(!(await guardPresent(root)), 'Execution guard exists; reconciliation only');
    const data = await validate(root, 'verify');
    const nonce = randomBytes(24).toString('hex');
    challenges.clear(); // One operator/challenge; never restore a nonce after restart.
    challenges.set(nonce, { root, expires: Date.now() + 120000 });
    return json({ status: 'verified_unsigned_not_authorized', ...data, binding: BINDING, nonce,
      approvalPhrase: phrase(nonce),
      executionEnabled: process.env.TOKENIZER_EXECUTION_BINDING === TXID + ':' + HASH,
      effects: 'One immutable disposable TestNet application creation; fee 1000 microALGO. No funding, ASA, opt-in, rekey or initialization. 478000 MBR increase is a conditional projection.' });
  } catch (error) { return json({ status: 'blocked', error: error.message }, 403); }
}

export async function POST(request) {
  let root; let claimed = false; let confirmed = false; let pending;
  try {
    root = localOperator(request);
    requireValue(process.env.TOKENIZER_EXECUTION_BINDING === TXID + ':' + HASH, 'Execution disabled; separate exact-candidate approval required');
    requireValue(request.headers.get('content-type')?.split(';')[0] === 'application/json', 'JSON request required');
    const text = await request.text();
    requireValue(Buffer.byteLength(text) <= 20000, 'Request too large');
    const body = JSON.parse(text);
    if (body.action === 'authorize') {
      requireValue(!(await guardPresent(root)), 'Execution guard exists; reconciliation only');
      const challenge = challenges.get(body.nonce);
      requireValue(challenge && challenge.root === root && challenge.expires >= Date.now(), 'Missing/expired verification challenge');
      requireValue(body.approval === phrase(body.nonce), 'Exact transaction approval not granted');
      challenges.delete(body.nonce);
      const data = await validate(root, 'verify'); // Recheck after the explicit decision.
      const parent = path.join(root, '.tokenizer-operator');
      await fs.mkdir(parent, { mode: 0o700, recursive: true });
      await safeParents(parent);
      await fs.mkdir(guardPath(root), { mode: 0o700 }); // Atomic exclusive persistent guard; EEXIST is fatal.
      claimed = true;
      await append(root, 'authorized_guard_acquired_signing_may_follow_do_not_retry', { rawHash: HASH, approval: body.approval });
      return json({ status: 'authorized_once_guard_preserved', txid: TXID, rawHash: HASH, unsigned: data.unsigned, creator: CREATOR });
    }
    requireValue(body.action === 'submit' && typeof body.signed === 'string' && body.signed.length <= 16384, 'Unsupported execution request');
    requireValue(await guardPresent(root), 'Signing authorization/guard missing');
    await safeParents(guardPath(root));
    const events = (await fs.readFile(path.join(guardPath(root), 'events.jsonl'), 'utf8')).trim().split('\n');
    requireValue(events.length === 1, 'Attempt already started or interrupted; reconciliation only');
    const authorization = JSON.parse(events[0]);
    requireValue(authorization.state === 'authorized_guard_acquired_signing_may_follow_do_not_retry' && authorization.txid === TXID && authorization.rawHash === HASH, 'Persisted authorization missing or mismatched');
    const claim = await fs.open(path.join(guardPath(root), 'submission.claim'), 'wx', 0o600);
    claimed = true;
    try { await claim.writeFile(TXID + '\n'); await claim.sync(); } finally { await claim.close(); }
    await append(root, 'signed_candidate_received_validation_pending_do_not_retry');
    await validate(root, 'signed', body.signed); // Existing real signature verification + strict signed simulation.
    requireValue(/^[A-Za-z0-9+/]+={0,2}$/.test(body.signed), 'Invalid signed encoding');
    const signed = Buffer.from(body.signed, 'base64');
    requireValue(signed.toString('base64') === body.signed, 'Noncanonical signed encoding');
    await checkNetwork();
    await append(root, 'submission_intent_do_not_retry', { rawHash: HASH });
    const submitted = await publicNode('/v2/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-binary' }, body: signed });
    requireValue(submitted.txId === TXID, 'Submission response ID mismatch; reconcile exact candidate');
    await append(root, 'submitted_confirmation_pending');
    for (let i = 0; i < 10; i++) {
      pending = await publicNode('/v2/transactions/pending/' + TXID);
      if (pending['confirmed-round'] > 0) { confirmed = true; break; }
      requireValue(!pending['pool-error'], 'Node rejected candidate; preserve guard');
      if (i < 9) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    requireValue(confirmed, 'Confirmation timeout; reconcile, never automatically resubmit');
    await append(root, 'creation_confirmed_verification_pending', { applicationId: pending['application-index'], confirmedRound: pending['confirmed-round'] });
    const data = await validate(root, 'confirmed');
    await append(root, 'creation_confirmed_verified_not_initialized', { applicationId: data.applicationId, applicationAddress: data.applicationAddress });
    return json({ status: 'creation_confirmed_verified_not_initialized', ...data });
  } catch (error) {
    const status = confirmed ? 'creation_confirmed_verification_failed' : claimed ? 'stopped_outcome_requires_reconciliation_do_not_retry' : 'blocked_no_retry';
    if (claimed && root) { try { await append(root, status, { error: error.message }); } catch {} }
    return json({ status, error: error.message, ...(confirmed ? { applicationId: pending?.['application-index'] } : {}), guardPreserved: Boolean(root) }, 409);
  }
}
