import algosdk from 'algosdk';
import { createHash } from 'node:crypto';

import { snapshotV10RevenueTokenHolders } from './revenue-pool-v10-holder-snapshot.js';

const TOTAL_REV_UNITS = 10_000n;
const POOL_STAKEHOLDER_COUNT_OFFSET = 40;
const POOL_ENTRIES_OFFSET = 73;
const STAKEHOLDER_ENTRY_BYTES = 35;
const FLAG_UNCLAIMED = 0;
const FLAG_CLAIMED = 1;

export class V10EffectiveHolderSnapshotError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10EffectiveHolderSnapshotError';
    this.code = code ?? 'V10_EFFECTIVE_HOLDER_SNAPSHOT_ERROR';
  }
}

function assert(condition, message, code) {
  if (!condition) {
    throw new V10EffectiveHolderSnapshotError(message, { code });
  }
}

function encodePoolBoxName(poolKey) {
  return new Uint8Array(
    Buffer.concat([Buffer.from('p_', 'utf8'), Buffer.from(poolKey, 'utf8')]),
  );
}

function toBytes(value) {
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'base64');
  return Buffer.from(value);
}

function addressFromBytes(bytes) {
  return algosdk.encodeAddress(new Uint8Array(bytes));
}

function compareAddresses(left, right) {
  const leftBytes = Buffer.from(algosdk.decodeAddress(left).publicKey);
  const rightBytes = Buffer.from(algosdk.decodeAddress(right).publicKey);
  return Buffer.compare(leftBytes, rightBytes);
}

function hashBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function addUnits(map, address, units) {
  assert(
    algosdk.isValidAddress(address),
    `Invalid Algorand address: ${String(address)}`,
    'INVALID_ADDRESS',
  );
  assert(units > 0n, `REV units must be positive for ${address}`, 'INVALID_REV_UNITS');

  map.set(address, (map.get(address) ?? 0n) + units);
}

function decodeStakeholders(poolBoxBytes) {
  assert(
    poolBoxBytes.length >= POOL_ENTRIES_OFFSET,
    `Pool box is too short: ${poolBoxBytes.length} bytes`,
    'INVALID_POOL_BOX',
  );

  const stakeholderCount = poolBoxBytes.readUInt8(POOL_STAKEHOLDER_COUNT_OFFSET);
  const requiredBytes =
    POOL_ENTRIES_OFFSET + stakeholderCount * STAKEHOLDER_ENTRY_BYTES;

  assert(
    poolBoxBytes.length >= requiredBytes,
    `Pool box is truncated for ${stakeholderCount} stakeholder entries`,
    'TRUNCATED_POOL_BOX',
  );

  const stakeholders = [];
  let offset = POOL_ENTRIES_OFFSET;

  for (let index = 0; index < stakeholderCount; index += 1) {
    const address = addressFromBytes(poolBoxBytes.subarray(offset, offset + 32));
    const revUnits = BigInt(poolBoxBytes.readUInt16BE(offset + 32));
    const claimFlag = poolBoxBytes.readUInt8(offset + 34);

    assert(revUnits > 0n, `Stakeholder ${index} has zero REV units`, 'INVALID_REGISTRY_UNITS');
    assert(
      claimFlag === FLAG_UNCLAIMED || claimFlag === FLAG_CLAIMED,
      `Stakeholder ${index} has invalid REV claim flag ${claimFlag}`,
      'INVALID_CLAIM_FLAG',
    );

    stakeholders.push({
      address,
      revUnits,
      claimFlag,
      claimed: claimFlag === FLAG_CLAIMED,
    });

    offset += STAKEHOLDER_ENTRY_BYTES;
  }

  const registryUnits = stakeholders.reduce(
    (sum, stakeholder) => sum + stakeholder.revUnits,
    0n,
  );

  assert(
    registryUnits === TOTAL_REV_UNITS,
    `Pool registry totals ${registryUnits} REV units; expected ${TOTAL_REV_UNITS}`,
    'REGISTRY_SUPPLY_MISMATCH',
  );

  return stakeholders;
}

async function readPoolBox(algodClient, appId, poolKey) {
  let response;

  try {
    response = await algodClient
      .getApplicationBoxByName(appId, encodePoolBoxName(poolKey))
      .do();
  } catch (cause) {
    throw new V10EffectiveHolderSnapshotError(
      `Unable to read V10 pool box for app ${appId} / pool ${poolKey}`,
      { code: 'POOL_BOX_READ_FAILED', cause },
    );
  }

  const value = response?.value ?? response;

  assert(value, 'V10 pool box does not exist', 'POOL_BOX_NOT_FOUND');

  return toBytes(value);
}

/**
 * Effective revenue ownership:
 *
 * - Real external REV ASA holders count normally.
 * - The V10 app address is excluded as a raw holder.
 * - Its temporary custody balance is attributed to each configured stakeholder
 *   whose claim_tokens flag is still unclaimed.
 *
 * This makes USDC eligibility independent of whether an initial stakeholder
 * has opted in and claimed REV yet, while actual post-claim token transfers
 * control entitlement for later rounds.
 */
export async function snapshotV10EffectiveRevenueOwners({
  indexerClient,
  algodClient,
  appId,
  poolKey,
  revenueTokenAssetId,
  snapshotRevenueTokenHolders = snapshotV10RevenueTokenHolders,
}) {
  assert(indexerClient, 'indexerClient is required', 'MISSING_INDEXER_CLIENT');
  assert(algodClient, 'algodClient is required', 'MISSING_ALGOD_CLIENT');
  assert(Number.isSafeInteger(appId) && appId > 0, 'appId must be positive', 'INVALID_APP_ID');
  assert(
    Number.isSafeInteger(revenueTokenAssetId) && revenueTokenAssetId > 0,
    'revenueTokenAssetId must be positive',
    'INVALID_REVENUE_TOKEN_ASSET_ID',
  );
  assert(
    typeof poolKey === 'string' && poolKey.trim().length > 0,
    'poolKey is required',
    'INVALID_POOL_KEY',
  );

  const appAddress = algosdk.getApplicationAddress(appId).toString();

  const [rawHolderSnapshot, poolBoxBytes] = await Promise.all([
    snapshotRevenueTokenHolders({
      indexerClient,
      algodClient,
      revenueTokenAssetId,
    }),
    readPoolBox(algodClient, appId, poolKey),
  ]);

  assert(
    Array.isArray(rawHolderSnapshot?.entries),
    'Raw holder snapshot entries are required',
    'INVALID_RAW_HOLDER_SNAPSHOT',
  );

  const registry = decodeStakeholders(poolBoxBytes);
  const effective = new Map();
  const externalHolderEntries = [];
  let appHeldRevUnits = 0n;

  for (const entry of rawHolderSnapshot.entries) {
    const address = String(entry.address ?? '').trim();
    const revUnits = BigInt(entry.revUnits);

    assert(
      algosdk.isValidAddress(address),
      `Raw holder snapshot contains an invalid address: ${address}`,
      'INVALID_RAW_HOLDER_ADDRESS',
    );
    assert(revUnits > 0n, `Raw holder ${address} has non-positive REV`, 'INVALID_RAW_HOLDER_UNITS');

    if (address === appAddress) {
      appHeldRevUnits += revUnits;
      continue;
    }

    addUnits(effective, address, revUnits);
    externalHolderEntries.push({
      address,
      revUnits: revUnits.toString(),
    });
  }

  const unclaimedStakeholderEntries = [];
  let virtualUnclaimedRevUnits = 0n;

  for (const stakeholder of registry) {
    if (stakeholder.claimed) continue;

    addUnits(effective, stakeholder.address, stakeholder.revUnits);
    virtualUnclaimedRevUnits += stakeholder.revUnits;

    unclaimedStakeholderEntries.push({
      address: stakeholder.address,
      revUnits: stakeholder.revUnits.toString(),
    });
  }

  assert(
    appHeldRevUnits === virtualUnclaimedRevUnits,
    `App-held REV (${appHeldRevUnits}) does not equal unclaimed registry REV (${virtualUnclaimedRevUnits})`,
    'APP_CUSTODY_RECONCILIATION_MISMATCH',
  );

  const entries = [...effective.entries()]
    .filter(([, revUnits]) => revUnits > 0n)
    .map(([address, revUnits]) => ({
      address,
      revUnits: revUnits.toString(),
    }))
    .sort((left, right) => compareAddresses(left.address, right.address));

  assert(entries.length > 0, 'No effective REV holders were derived', 'NO_EFFECTIVE_HOLDERS');
  assert(
    !entries.some((entry) => entry.address === appAddress),
    'Application address cannot be a payout recipient',
    'APPLICATION_ADDRESS_AS_PAYEE',
  );

  const effectiveTotal = entries.reduce(
    (sum, entry) => sum + BigInt(entry.revUnits),
    0n,
  );

  assert(
    effectiveTotal === TOTAL_REV_UNITS,
    `Effective REV ownership totals ${effectiveTotal}; expected ${TOTAL_REV_UNITS}`,
    'EFFECTIVE_REV_SUPPLY_MISMATCH',
  );

  return {
    source: 'v10_effective_revenue_owners_v1',
    snapshotVersion: 'v2',
    assetId: revenueTokenAssetId,
    totalRevUnits: TOTAL_REV_UNITS.toString(),
    entries,
    capturedAt: new Date(),
    indexerRound: rawHolderSnapshot.indexerRound ?? null,
    algodStatusRound: rawHolderSnapshot.algodStatusRound ?? null,
    indexerLagRounds: rawHolderSnapshot.indexerLagRounds ?? null,

    appAddress,
    appHeldRevUnits: appHeldRevUnits.toString(),
    virtualUnclaimedRevUnits: virtualUnclaimedRevUnits.toString(),
    externalHolderEntries: externalHolderEntries.sort((left, right) =>
      compareAddresses(left.address, right.address),
    ),
    unclaimedStakeholderEntries: unclaimedStakeholderEntries.sort((left, right) =>
      compareAddresses(left.address, right.address),
    ),
    poolBoxHash: hashBytes(poolBoxBytes),
  };
}