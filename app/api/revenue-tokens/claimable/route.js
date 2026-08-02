import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';
import {
  getCachedAccountInfo,
  getCachedPoolBox
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

function getLocalClient() {
  return new algosdk.Algodv2(
    process.env.ALGOD_TOKEN || '',
    process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
    process.env.ALGOD_PORT || ''
  );
}

function normalizeAddress(addr) {
  return String(addr || '').trim().toUpperCase();
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
  const numStakeholders = poolBytes[NUM_SH_OFFSET];

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
      unclaimedOnChain: flagByte === FLAG_UNCLAIMED
    };
  }

  return null;
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

    const { db } = await connectToDatabase();
    const userRegex = new RegExp(`^${userAddress}$`, 'i');

    const ips = await db.collection('ip_assets').find({
      $and: [
        { revenuePoolAppId: { $exists: true, $ne: null } },
        {
          $or: [
            { 'stakeholders.address': { $regex: userRegex } },
            { ownerWallet: { $regex: userRegex } }
          ]
        }
      ]
    }).toArray();

    const algodClient = getLocalClient();

    let userAssets = [];
    try {
      const accountInfo = await getCachedAccountInfo(algodClient, userAddress);
      userAssets = Array.isArray(accountInfo?.assets) ? accountInfo.assets : [];
    } catch (err) {
      console.error('[CLAIMABLE] Failed to fetch account info:', err.message);
    }

    const claimableTokens = [];

    for (const ip of ips) {
      let revenueTokenId = Number(ip.revenueTokenAssetId || ip.revenueTokenId);
      const revenuePoolAppId = Number(ip.revenuePoolAppId);

      if (!Number.isFinite(revenuePoolAppId) || revenuePoolAppId <= 0) continue;

      const stakeholder = ip.stakeholders?.find(
        (s) => normalizeAddress(s.address) === userAddress
      );

      if (!stakeholder) continue;

      const fallbackStakeholderBps = Number(
        stakeholder.bps ?? Math.round(Number(stakeholder.percentage || 0) * 100)
      );

      if (!Number.isFinite(fallbackStakeholderBps) || fallbackStakeholderBps <= 0) {
        continue;
      }

      let onChainEntry = null;
      let onChainFlag = null;
      let stakeholderBps = fallbackStakeholderBps;
      let poolFound = false;

      try {
        const boxName = encodePoolBoxName(ip.id);
        const boxResponse = await getCachedPoolBox(
          algodClient,
          revenuePoolAppId,
          boxName,
          `usdc:${ip.id}`
        );

        const poolBytes = decodeBoxValue(boxResponse);
        if (!poolBytes || poolBytes.length < POOL_ENTRIES_OFFSET) {
          throw new Error(`Invalid or empty pool box for ip=${ip.id}`);
        }

        poolFound = true;

        const onChainRevenueTokenId = readUint64BE(poolBytes, REV_ASA_OFFSET);
        if (Number.isFinite(onChainRevenueTokenId) && onChainRevenueTokenId > 0) {
          revenueTokenId = onChainRevenueTokenId;
        }

        onChainEntry = findStakeholderEntry(poolBytes, userAddress);

        if (onChainEntry) {
          stakeholderBps = onChainEntry.stakeholderBps;
          onChainFlag = onChainEntry.flagByte;
        } else {
          console.warn(
            `[CLAIMABLE] No stakeholder entry found in box for ip=${ip.id} user=${userAddress}`
          );
        }
      } catch (err) {
        console.error(
          `[CLAIMABLE] Failed to read pool box for ip=${ip.id} appId=${revenuePoolAppId}:`,
          err.message
        );
      }

      if (!Number.isFinite(revenueTokenId) || revenueTokenId <= 0) {
        console.warn(`[CLAIMABLE] Missing revenueTokenId for ip=${ip.id}`);
        continue;
      }

      const userAsset = userAssets.find(
        (a) => Number(a['asset-id']) === revenueTokenId
      );

      const hasOptedIn = !!userAsset;
      const existingBalance = userAsset ? Number(userAsset.amount || 0) : 0;

      let claimableAmount = 0;
      let status = 'empty';

      if (!poolFound) {
        status = 'unavailable';
        claimableAmount = 0;
      } else if (!onChainEntry) {
        status = 'legacy';
        claimableAmount = 0;
      } else if (onChainFlag === FLAG_CLAIMED) {
        status = 'claimed';
        claimableAmount = 0;
      } else if (onChainFlag === FLAG_UNCLAIMED) {
        claimableAmount = Math.max(0, stakeholderBps - existingBalance);
        status = claimableAmount > 0 ? 'available' : 'empty';
      } else {
        status = 'unavailable';
        claimableAmount = 0;
      }

      const claimedAmount =
        status === 'claimed'
            ? stakeholderBps
            : Math.min(existingBalance, stakeholderBps);

        const claimedAmountDisplay = claimedAmount.toLocaleString();
        const allocatedTokensDisplay = stakeholderBps.toLocaleString();

      console.log(
        `[CLAIMABLE] ip=${ip.id} tokenId=${revenueTokenId} bps=${stakeholderBps} existing=${existingBalance} claimable=${claimableAmount} flag=${onChainEntry?.flagHex || 'n/a'} status=${status} optedIn=${hasOptedIn}`
      );

      claimableTokens.push({
        ipId: ip.id,
        ipName: ip.name,
        imageUrl: ip.imageUrl || ip.image,
        revenueTokenId,
        revenuePoolAppId,
        status,
        stakeholderBps,
        stakeholderPercentage: stakeholderBps / 100,
        allocatedTokens: stakeholderBps,
        existingBalance,
        claimableAmount,
        claimedAmount,
        allocatedTokensDisplay,
        existingBalanceDisplay: existingBalance.toLocaleString(),
        claimableAmountDisplay: claimableAmount.toLocaleString(),
        claimedAmountDisplay,
        hasOptedIn,
        needsOptIn: !hasOptedIn,
        onChainClaimed: onChainFlag === FLAG_CLAIMED,
        poolFound,
        stakeholderFoundOnChain: !!onChainEntry
        });
    }

    return NextResponse.json(
      safeJson({
        success: true,
        items: claimableTokens
      })
    );
  } catch (error) {
    console.error('[CLAIMABLE GET ERROR]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}