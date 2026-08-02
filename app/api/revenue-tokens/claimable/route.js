import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';
import {
  getCachedAccountInfo,
  getCachedPoolBox,
} from '@/lib/algorand-rate-limit';

export const dynamic = 'force-dynamic';

const POOL_PREFIX = 'p_';
const REV_ASA_OFFSET = 0;
const NUM_SH_OFFSET = 40;
const POOL_ENTRIES_OFFSET = 73;
const SH_ENTRY_SIZE = 35;
const FLAG_OFFSET_IN_ENTRY = 34;

const FLAG_UNCLAIMED = 0x00;
const FLAG_CLAIMED = 0x01;

function getAlgodClient() {
  return new algosdk.Algodv2(
    process.env.ALGOD_TOKEN || '',
    process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
    process.env.ALGOD_PORT || ''
  );
}

function normalizeAddress(addr) {
  return String(addr || '').trim().toUpperCase();
}

function resolveIpId(ip) {
  return String(
    ip?.ipId ||
      ip?.tokenizedIpId ||
      ip?.assetId ||
      ip?.id ||
      ip?._id ||
      ''
  ).trim();
}

function decodeBoxValue(boxResponse) {
  if (!boxResponse) return null;

  if (boxResponse.value instanceof Uint8Array) return boxResponse.value;
  if (Buffer.isBuffer(boxResponse.value)) return new Uint8Array(boxResponse.value);
  if (typeof boxResponse.value === 'string') {
    return new Uint8Array(Buffer.from(boxResponse.value, 'base64'));
  }

  return null;
}

function encodePoolBoxName(ipId) {
  return new Uint8Array(Buffer.from(`${POOL_PREFIX}${ipId}`));
}

function readUint64BE(bytes, offset) {
  if (!bytes || bytes.length < offset + 8) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Number(view.getBigUint64(offset, false));
}

function findStakeholderEntry(poolBytes, userAddress) {
  if (!poolBytes || poolBytes.length < POOL_ENTRIES_OFFSET) return null;

  const targetPk = algosdk.decodeAddress(userAddress).publicKey;
  const numStakeholders = Number(poolBytes[NUM_SH_OFFSET] || 0);

  for (let i = 0; i < numStakeholders; i++) {
    const offset = POOL_ENTRIES_OFFSET + i * SH_ENTRY_SIZE;
    if (poolBytes.length < offset + SH_ENTRY_SIZE) break;

    const addrBytes = poolBytes.slice(offset, offset + 32);
    const bpsBytes = poolBytes.slice(offset + 32, offset + 34);
    const flagByte = poolBytes[offset + FLAG_OFFSET_IN_ENTRY];

    const sameAddress = Buffer.from(addrBytes).equals(Buffer.from(targetPk));
    if (!sameAddress) continue;

    const stakeholderBps = (bpsBytes[0] << 8) | bpsBytes[1];

    return {
      offset,
      stakeholderBps,
      flagByte,
      flagHex: `0x${flagByte.toString(16).padStart(2, '0')}`,
      claimedOnChain: flagByte === FLAG_CLAIMED,
      unclaimedOnChain: flagByte === FLAG_UNCLAIMED,
    };
  }

  return null;
}

function findUserAssetHolding(userAssets, assetId) {
  if (!Array.isArray(userAssets) || !Number.isFinite(assetId) || assetId <= 0) {
    return null;
  }

  const target = BigInt(assetId);

  for (const asset of userAssets) {
    const candidate = asset?.['asset-id'] ?? asset?.assetId ?? 0;

    try {
      if (BigInt(candidate) === target) {
        return asset;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function resolveImageUrl(ip) {
  return (
    ip?.imageUrl ||
    ip?.image ||
    ip?.thumbnailUrl ||
    ip?.thumbnail ||
    ip?.previewImage ||
    ip?.coverImage ||
    ip?.fileUrl ||
    ip?.mediaUrl ||
    null
  );
}

function toSafeNumber(value, fallback = 0) {
  try {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function findStakeholder(ip, userAddress) {
  if (!Array.isArray(ip?.stakeholders)) return null;

  return (
    ip.stakeholders.find((s) => {
      const addr = normalizeAddress(
        s?.address || s?.walletAddress || s?.wallet || s?.ownerWallet
      );
      return addr === userAddress;
    }) || null
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = normalizeAddress(searchParams.get('userAddress'));

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    if (!algosdk.isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid userAddress' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const userRegex = new RegExp(`^${userAddress}$`, 'i');

    const ips = await db
      .collection('ip_assets')
      .find({
        revenuePoolAppId: { $exists: true, $ne: null },
        $or: [
          { 'stakeholders.address': { $regex: userRegex } },
          { 'stakeholders.walletAddress': { $regex: userRegex } },
          { 'stakeholders.wallet': { $regex: userRegex } },
          { ownerWallet: { $regex: userRegex } },
        ],
      })
      .toArray();

    const algodClient = getAlgodClient();

    let userAssets = [];
    try {
      const accountInfo = await getCachedAccountInfo(algodClient, userAddress);
      userAssets = Array.isArray(accountInfo?.assets) ? accountInfo.assets : [];
    } catch (err) {
      console.error('[CLAIMABLE] Failed to fetch account info:', err?.message || err);
    }

    const items = [];

    for (const ip of ips) {
      const ipId = resolveIpId(ip);
      const revenuePoolAppId = toSafeNumber(ip?.revenuePoolAppId);
      let revenueTokenId = toSafeNumber(ip?.revenueTokenAssetId || ip?.revenueTokenId);

      if (!ipId) continue;
      if (!Number.isFinite(revenuePoolAppId) || revenuePoolAppId <= 0) continue;

      const stakeholder = findStakeholder(ip, userAddress);
      if (!stakeholder) continue;

      const fallbackStakeholderBps = toSafeNumber(
        stakeholder?.bps ?? Math.round(toSafeNumber(stakeholder?.percentage, 0) * 100)
      );

      if (!Number.isFinite(fallbackStakeholderBps) || fallbackStakeholderBps <= 0) {
        continue;
      }

      let poolFound = false;
      let onChainEntry = null;
      let onChainFlag = null;
      let stakeholderBps = fallbackStakeholderBps;

      try {
        const boxName = encodePoolBoxName(ipId);
        const boxResponse = await getCachedPoolBox(
          algodClient,
          revenuePoolAppId,
          boxName,
          `rev:${ipId}`
        );

        const poolBytes = decodeBoxValue(boxResponse);

        if (!poolBytes || poolBytes.length < POOL_ENTRIES_OFFSET) {
          throw new Error(`Invalid or empty pool box for ip=${ipId}`);
        }

        poolFound = true;

        const onChainRevenueTokenId = readUint64BE(poolBytes, REV_ASA_OFFSET);
        if (Number.isFinite(onChainRevenueTokenId) && onChainRevenueTokenId > 0) {
          revenueTokenId = onChainRevenueTokenId;
        }

        onChainEntry = findStakeholderEntry(poolBytes, userAddress);

        if (onChainEntry) {
          stakeholderBps = toSafeNumber(
            onChainEntry.stakeholderBps,
            fallbackStakeholderBps
          );
          onChainFlag = onChainEntry.flagByte;
        } else {
          console.warn(
            `[CLAIMABLE] No stakeholder entry found in box for ip=${ipId} user=${userAddress}`
          );
        }
      } catch (err) {
        console.error(
          `[CLAIMABLE] Failed to read pool box for ip=${ipId} appId=${revenuePoolAppId}:`,
          err?.message || err
        );
      }

      if (!Number.isFinite(revenueTokenId) || revenueTokenId <= 0) {
        console.warn(`[CLAIMABLE] Missing revenueTokenId for ip=${ipId}`);
        continue;
      }

      const userAsset = findUserAssetHolding(userAssets, revenueTokenId);
      const hasOptedIn = Boolean(userAsset);
      const existingBalance = toSafeNumber(userAsset?.amount, 0);

      let claimableAmount = 0;
      let status = 'empty';

      if (!poolFound) {
        status = 'unavailable';
      } else if (!onChainEntry) {
        status = 'legacy';
      } else if (onChainFlag === FLAG_CLAIMED) {
        status = 'claimed';
      } else if (onChainFlag === FLAG_UNCLAIMED) {
        claimableAmount = Math.max(0, stakeholderBps - existingBalance);
        status = claimableAmount > 0 ? 'available' : 'empty';
      } else {
        status = 'unavailable';
      }

      const claimedAmount =
        status === 'claimed'
          ? stakeholderBps
          : Math.min(existingBalance, stakeholderBps);

      console.log(
        `[CLAIMABLE] ip=${ipId} tokenId=${revenueTokenId} bps=${stakeholderBps} existing=${existingBalance} claimable=${claimableAmount} flag=${onChainEntry?.flagHex || 'n/a'} status=${status} optedIn=${hasOptedIn}`
      );

      items.push({
        ipId,
        ipName: ip?.name || 'Untitled IP',
        imageUrl: resolveImageUrl(ip),
        revenueTokenId,
        revenuePoolAppId,
        status,
        stakeholderBps,
        stakeholderPercentage: stakeholderBps / 100,
        allocatedTokens: stakeholderBps,
        existingBalance,
        claimableAmount,
        claimedAmount,
        allocatedTokensDisplay: stakeholderBps.toLocaleString(),
        existingBalanceDisplay: existingBalance.toLocaleString(),
        claimableAmountDisplay: claimableAmount.toLocaleString(),
        claimedAmountDisplay: claimedAmount.toLocaleString(),
        hasOptedIn,
        needsOptIn: !hasOptedIn,
        onChainClaimed: onChainFlag === FLAG_CLAIMED,
        poolFound,
        stakeholderFoundOnChain: Boolean(onChainEntry),
      });
    }

    items.sort((a, b) => a.ipName.localeCompare(b.ipName));

    return NextResponse.json(
      safeJson({
        success: true,
        items,
      })
    );
  } catch (error) {
    console.error('[CLAIMABLE GET ERROR]', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load claimable tokens' },
      { status: 500 }
    );
  }
}