import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { config } from 'dotenv';
import {
  createPublicClient, http, parseAbi, getAddress,
  keccak256, decodeFunctionData, decodeFunctionResult,
} from 'viem';

config({ path: '.env.local', quiet: true });

const rpc = process.env.ARC_SIMULATION_RPC_URL?.trim();
assert.ok(rpc, 'ARC_SIMULATION_RPC_URL missing.');

const PLAN_PATH =
  'output/galaxy-arc-plans/galaxy-eurc-arc.0x624fcccc862a71932f61e32e22eee3ac64252809.review.json';
const PLAN_HASH =
  'fa44183d72d11bbbd274f73beed2f3ca8d8934384c4777071095602fa23b02ae';
const OPERATOR = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const FACTORY = '0x3b0eefabfa22ec7cf2c73877ac16e78d76749f12';
const VAULT = '0x624fcccc862a71932f61e32e22eee3ac64252809';
const ADAPTER = '0x848238081d2fb92274fc0e0838ab00e0bd3b2ee4';
const EURC = '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1';
const CALLDATA_HASH =
  '0xf26bb628468172a4cc1cc189ddea163e6eaf8cc72d2f39648cb4a8a8d9e0770a';
const FACTORY_CODE_HASH =
  '0xba55eb73d42937607d7e3c77f68353c2517c4fad4df02f0c9bbd2e4248475503';
const ANCHOR_BLOCK = 29073000n;
const ANCHOR_HASH =
  '0x5537de370a81daded6b27ce3338ebc03a0402f9583d0cc6f434934741fab7f50';

const GAS = 8_000_000n;
const MAX_FEE = 42_000_000_000n;
const TIP = 1_000_000_000n;
const NONCE = 5;
const COMBINED_RESERVE = 17_200_000n * MAX_FEE;

const same = (a, b) => getAddress(a) === getAddress(b);
const digest = raw => createHash('sha256').update(raw).digest('hex');

const raw = readFileSync(PLAN_PATH);
assert.equal(digest(raw), PLAN_HASH, 'Approved plan changed.');
const approvedPlan = JSON.parse(raw.toString());

const PAYLOAD = Object.freeze({
  from: OPERATOR,
  to: FACTORY,
  chainId: '0x13b2',
  nonce: '0x5',
  data: approvedPlan.transactions[0].data,
  value: '0x0',
  gas: '0x7a1200',
  maxFeePerGas: '0x9c7652400',
  maxPriorityFeePerGas: '0x3b9aca00',
});

assert.equal(keccak256(PAYLOAD.data), CALLDATA_HASH);
assert.equal(BigInt(PAYLOAD.gas), GAS);
assert.equal(BigInt(PAYLOAD.maxFeePerGas), MAX_FEE);
assert.equal(BigInt(PAYLOAD.maxPriorityFeePerGas), TIP);

const factoryAbi = parseAbi([
  'function createVaultV2(address,address,bytes32) returns (address)',
]);
const vaultAbi = parseAbi([
  'function owner() view returns (address)',
  'function asset() view returns (address)',
]);

const client = createPublicClient({
  transport: http(rpc, { timeout: 90_000, retryCount: 0 }),
});
const port = 8787;
const origin = 'http://127.0.0.1:' + port;
const secret = randomBytes(24).toString('hex');
const root = '/' + secret + '/';
let verifying = false;

function safeMessage(error) {
  return String(error?.shortMessage || error?.message || error)
    .split(rpc).join('[REDACTED_RPC_URL]')
    .replace(/https?:\/\/[^\s"'<>]+/g, '[REDACTED_URL]')
    .slice(0, 1800);
}

function readPlan() {
  const current = readFileSync(PLAN_PATH);
  assert.equal(digest(current), PLAN_HASH, 'Approved plan changed.');
  const plan = JSON.parse(current.toString());

  assert.equal(plan.productId, 'galaxy-eurc-arc');
  assert.equal(plan.chainId, 5042);
  assert.equal(plan.status, 'review-only-not-authorized');
  assert.equal(plan.deploymentAuthorized, false);
  assert.equal(plan.customerDepositsEnabled, false);
  assert.equal(plan.transactionsSent, 0);
  assert.equal(plan.transactions.length, 4);
  assert.ok(same(plan.administrator, OPERATOR));
  assert.ok(same(plan.feeRecipient, OPERATOR));
  assert.ok(same(plan.sentinel, OPERATOR));
  assert.equal(plan.sentinelPolicyConfirmed, true);
  assert.ok(same(plan.asset, EURC));
  assert.ok(same(plan.vaultFactory, FACTORY));
  assert.ok(same(plan.predictedTokenizerAddress, VAULT));
  assert.ok(same(plan.predictedAdapterAddress, ADAPTER));

  for (const transaction of plan.transactions) {
    assert.equal(keccak256(transaction.data), transaction.calldataHash);
  }

  const tx = plan.transactions[0];
  assert.equal(tx.sequence, 1);
  assert.equal(tx.chainId, 5042);
  assert.ok(same(tx.from, OPERATOR));
  assert.ok(same(tx.to, FACTORY));
  assert.equal(BigInt(tx.value), 0n);
  assert.equal(tx.data, PAYLOAD.data);
  assert.equal(tx.calldataHash, CALLDATA_HASH);

  const decoded = decodeFunctionData({
    abi: factoryAbi, data: tx.data,
  });
  assert.equal(decoded.functionName, 'createVaultV2');
  assert.ok(same(decoded.args[0], OPERATOR));
  assert.ok(same(decoded.args[1], EURC));
  assert.equal(decoded.args[2], plan.salt);
  return plan;
}

async function checkNonce() {
  assert.equal(await client.getTransactionCount({
    address: OPERATOR, blockTag: 'latest',
  }), NONCE, 'Confirmed nonce changed. Stop and inspect wallet history.');
  assert.equal(await client.getTransactionCount({
    address: OPERATOR, blockTag: 'pending',
  }), NONCE, 'Pending transaction or nonce change. Stop.');
}

async function prepare() {
  readPlan();
  assert.equal(await client.getChainId(), 5042, 'Wrong RPC chain.');

  const canonical = await client.getBlock({ blockNumber: ANCHOR_BLOCK });
  assert.equal(canonical.hash, ANCHOR_HASH, 'Reviewed anchor changed.');

  const block = await client.getBlock({ blockTag: 'latest' });
  assert.ok(block.number != null && block.number >= ANCHOR_BLOCK);
  assert.equal(typeof block.baseFeePerGas, 'bigint');

  const code = await client.getCode({
    address: FACTORY, blockNumber: block.number,
  });
  assert.ok(code && code !== '0x', 'Factory code missing.');
  assert.equal(keccak256(code), FACTORY_CODE_HASH, 'Factory code changed.');

  for (const address of [VAULT, ADAPTER]) {
    assert.equal(
      (await client.getCode({
        address, blockNumber: block.number,
      })) ?? '0x',
      '0x',
      'A planned address already has code. Stop; do not retry.',
    );
  }

  await checkNonce();

  assert.ok(
    block.baseFeePerGas + TIP <= MAX_FEE,
    'Approved cap no longer covers base fee plus tip. Stop.',
  );
  assert.ok(
    await client.getBalance({
      address: OPERATOR, blockNumber: block.number,
    }) >= COMBINED_RESERVE,
    'Native USDC below the EURC-plan gas reserve.',
  );

  const eurcBalance = await client.readContract({
    address: EURC,
    abi: parseAbi([
      'function balanceOf(address) view returns (uint256)',
    ]),
    functionName: 'balanceOf',
    args: [OPERATOR],
    blockNumber: block.number,
  });
  assert.ok(
    eurcBalance >= 1_000_000n,
    'Need at least 1 EURC reserved for the later protection mint.',
  );

  const request = {
    account: OPERATOR,
    to: FACTORY,
    data: PAYLOAD.data,
    value: 0n,
    gas: GAS,
    nonce: NONCE,
    maxFeePerGas: MAX_FEE,
    maxPriorityFeePerGas: TIP,
  };

  const result = await client.call({
    ...request, blockNumber: block.number,
  });
  const predicted = decodeFunctionResult({
    abi: factoryAbi,
    functionName: 'createVaultV2',
    data: result.data,
  });
  assert.ok(same(predicted, VAULT), 'Factory prediction mismatch.');

  const estimate = await client.estimateGas({
    ...request, blockNumber: block.number,
  });
  assert.ok(
    estimate * 125n <= GAS * 100n,
    'Less than 25% gas headroom. Stop.',
  );

  await checkNonce();
  readPlan();

  return {
    checkedAt: new Date().toISOString(),
    checkedAtMs: Date.now(),
    blockNumber: String(block.number),
    estimatedGas: String(estimate),
    expectedVault: VAULT,
    payload: PAYLOAD,
    tx1ApprovalOnly: true,
    transactionsSentByServer: 0,
  };
}

async function verify(hash) {
  assert.match(hash, /^0x[0-9a-fA-F]{64}$/);
  const receipt = await client.waitForTransactionReceipt({
    hash, confirmations: 2, timeout: 180000,
  });
  const tx = await client.getTransaction({ hash });

  assert.ok(same(tx.from, OPERATOR), 'Mined sender mismatch.');
  assert.ok(same(tx.to, FACTORY), 'Mined destination mismatch.');
  assert.equal(tx.chainId, 5042, 'Mined chain mismatch.');
  assert.equal(tx.nonce, NONCE, 'Mined nonce mismatch.');
  assert.equal(tx.input.toLowerCase(), PAYLOAD.data.toLowerCase(),
    'Mined calldata mismatch.');
  assert.equal(tx.value, 0n, 'Mined value mismatch.');
  assert.equal(tx.gas, GAS, 'Wallet changed approved gas limit.');
  assert.equal(tx.maxFeePerGas, MAX_FEE, 'Wallet changed approved max fee.');
  assert.equal(tx.maxPriorityFeePerGas, TIP, 'Wallet changed approved tip.');
  assert.equal(receipt.status, 'success',
    'TX1 reverted. Stop; no further transaction is authorized.');

  const code = await client.getCode({
    address: VAULT, blockNumber: receipt.blockNumber,
  });
  assert.ok(code && code !== '0x', 'Predicted vault has no code.');

  const owner = await client.readContract({
    address: VAULT, abi: vaultAbi, functionName: 'owner',
    blockNumber: receipt.blockNumber,
  });
  const asset = await client.readContract({
    address: VAULT, abi: vaultAbi, functionName: 'asset',
    blockNumber: receipt.blockNumber,
  });
  assert.ok(same(owner, OPERATOR), 'Vault owner mismatch.');
  assert.ok(same(asset, EURC), 'Vault asset mismatch.');

  const report = {
    status: 'EURC ARC TX1 VERIFIED — STOP BEFORE TX2',
    hash,
    chainId: 5042,
    blockNumber: String(receipt.blockNumber),
    gasUsed: String(receipt.gasUsed),
    vault: VAULT,
    vaultCodeHash: keccak256(code),
    owner,
    asset,
    transactionsSent: 1,
    remainingDeploymentTransactionsAuthorized: false,
    customerDepositsEnabled: false,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv.includes('--check-only')) {
  try {
    console.log(JSON.stringify(await prepare(), null, 2));
  } catch (error) {
    console.error(safeMessage(error));
    process.exit(1);
  }
  process.exit(0);
}

function browser() {
  const status = document.getElementById("status");
  const details = document.getElementById("details");
  const connect = document.getElementById("connect");
  const send = document.getElementById("send");
  const phrase = document.getElementById("phrase");
  const storageKey = "mw-galaxy-arc-eurc-tx1-" + payload.data;
  let provider;
  let version = 0;
  let locked = Boolean(localStorage.getItem(storageKey));

  details.textContent = JSON.stringify(payload, null, 2);
  status.textContent = locked
    ? "An attempt is already recorded: " + localStorage.getItem(storageKey) +
      ". Do not send again; inspect it first."
    : "No transaction sent. Connect MetaMask to review tx1.";

  function update() {
    send.disabled = locked || !provider || phrase.value !== "SEND TX1";
  }

  async function session() {
    const accounts = await provider.request({ method: "eth_accounts" });
    const chain = await provider.request({ method: "eth_chainId" });
    if (!accounts[0] ||
        accounts[0].toLowerCase() !== payload.from.toLowerCase()) {
      throw new Error("Select the approved operator account in MetaMask.");
    }
    if (Number(chain) !== 5042) throw new Error("Select Arc chain 5042.");
  }

  async function api(path) {
    const response = await fetch(path, {
      cache: "no-store", credentials: "omit", redirect: "error",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Local check failed");
    return result;
  }

  connect.onclick = async () => {
    connect.disabled = true;
    try {
      const injected = window.ethereum;
      const candidates = injected && injected.providers
        ? injected.providers : [injected];
      provider = candidates.find((p) => p && p.isMetaMask && !p.isRabby);
      if (!provider) throw new Error("MetaMask provider not detected.");

      await provider.request({ method: "eth_requestAccounts" });
      await session();

      const changed = () => {
        version++;
        locked = true;
        status.textContent = "Wallet session changed. Stop and reload to review.";
        update();
      };
      provider.on?.("accountsChanged", changed);
      provider.on?.("chainChanged", changed);

      const checked = await api("prepare");
      if (JSON.stringify(checked.payload) !== JSON.stringify(payload)) {
        throw new Error("Prepared payload differs from approved payload");
      }
      status.textContent = "Checks passed at block " + checked.blockNumber +
        ". Type SEND TX1, then review the exact fields in MetaMask.";
      update();
    } catch (error) {
      provider = null;
      status.textContent = error.message;
      connect.disabled = false;
      update();
    }
  };

  phrase.oninput = update;

  send.onclick = async () => {
    if (locked || !provider || phrase.value !== "SEND TX1") return;
    locked = true;
    update();
    const startVersion = version;
    let attempted = false;
    try {
      await session();
      const checked = await api("prepare");
      if (version !== startVersion) throw new Error("Wallet session changed");
      if (JSON.stringify(checked.payload) !== JSON.stringify(payload)) {
        throw new Error("Payload changed");
      }
      if (Date.now() - checked.checkedAtMs > 30000) {
        throw new Error("Local checks expired; stop and reload");
      }
      await session();

      localStorage.setItem(storageKey, "ATTEMPT STARTED — inspect MetaMask/history");
      attempted = true;
      status.textContent =
        "Review tx1 in MetaMask. Do not edit gas, fees, destination or value.";

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [payload],
      });
      localStorage.setItem(storageKey, hash);
      status.textContent = "Submitted tx1: " + hash +
        ". Waiting for receipt verification; do not retry.";

      const report = await api("verify?hash=" + encodeURIComponent(hash));
      status.textContent = JSON.stringify(report, null, 2);
    } catch (error) {
      status.textContent = error.message +
        (attempted
          ? "\nSTOP. An attempt was recorded. Inspect MetaMask/history before any retry."
          : "\nNo wallet send request was made. Stop and paste this error.");
    }
  };

  update();
}

function page() {
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>MetaWork — approved tx1 only</title>' +
    '</head><body><h1>Galaxy EURC on Arc — tx1 only</h1>' +
    '<p>Arc chain 5042. Create vault only. Transactions 2–4 are not authorized.</p>' +
    '<p>Do not edit the approved payload in MetaMask.</p>' +
    '<button id="connect">Connect MetaMask and check</button>' +
    '<pre id="details"></pre>' +
    '<label>Type SEND TX1: <input id="phrase" autocomplete="off"></label> ' +
    '<button id="send" disabled>Review approved tx1 in MetaMask</button>' +
    '<pre id="status"></pre><script>const payload=' +
    JSON.stringify(PAYLOAD).replace(/</g, "\\u003c") +
    ";(" + browser.toString() + ")();</script></body></html>";
}

const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

  try {
    assert.equal(req.headers.host, "127.0.0.1:" + port, "Invalid Host");
    assert.equal(req.method, "GET", "Only GET is allowed");
    if (req.headers.origin) assert.equal(req.headers.origin, origin);
    if (req.headers["sec-fetch-site"]) {
      assert.ok(["same-origin", "none"].includes(req.headers["sec-fetch-site"]),
        "Cross-site request blocked");
    }

    const url = new URL(req.url, origin);
    if (url.pathname === root) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(page());
      return;
    }

    res.setHeader("Content-Type", "application/json");
    if (url.pathname === root + "prepare") {
      res.end(JSON.stringify(await prepare()));
      return;
    }
    if (url.pathname === root + "verify") {
      assert.equal(verifying, false, "Verification already running");
      verifying = true;
      try {
        res.end(JSON.stringify(await verify(url.searchParams.get("hash") || "")));
      } finally {
        verifying = false;
      }
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    const message = safeMessage(error);
    console.error(message);
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
});

server.on("error", (error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

readPlan();
server.listen(port, "127.0.0.1", () => {
  console.log("Open this local URL in the browser with MetaMask:");
  console.log(origin + root);
  console.log("Only tx1 is approved. Starting this server sends nothing.");
  console.log("Keep this terminal open. Ctrl+C stops the tool.");
});
