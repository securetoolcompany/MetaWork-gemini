import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';
import {
  getCachedAccountInfo,
  getCachedPoolBox,
} from '@/lib/algorand-rate-limit';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const CURRENT_REVENUE_POOL_APP_ID = Number(
  process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || 768287773
);

function normalizeAddress(addr) {
  return String(addr || '').trim().toUpperCase();
}

function normalizeIpId(value) {
  return String(value || '').trim();
}

function encodePoolBoxName(ipId) {
  return new Uint8Array(
    Buffer.concat([Buffer.from('p_'), Buffer.from(ipId)])
  );
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new Uint8Array(Buffer.from(value, 'base64'));
  return new Uint8Array(value);
}

function readPoolBox(value) {
  const rawValue = toUint8Array(value);
  const view = new DataView(
    rawValue.buffer,
    rawValue.byteOffset,
    rawValue.byteLength
  );

  const shCount = rawValue[40];

  return {
    revenueTokenId: Number(view.getBigUint64(0, false)),
    unallocatedUsdc: Number(view.getBigUint64(8, false)),
    totalClaimed: Number(view.getBigUint64(16, false)),
    heldUsdc: Number(view.getBigUint64(24, false)),
    currentRoundId: Number(view.getBigUint64(32, false)),
    shCount,
    proxyAddress: algosdk.encodeAddress(rawValue.slice(41, 73)),
    stakeholders: Array.from({ length: shCount }, (_, i) => ({
      address: algosdk.encodeAddress(
        rawValue.slice(73 + i * 35, 73 + i * 35 + 32)
      ),
      bps:
        rawValue[73 + i * 35 + 32] * 256 +
        rawValue[73 + i * 35 + 33],
      claimed: rawValue[73 + i * 35 + 34] === 1,
    })),
  };
}

async function getApplicationPoolBox(algodClient, appIndex, ipId) {
  const boxName = encodePoolBoxName(ipId);
  const box = await getCachedPoolBox(
    algodClient,
    appIndex,
    boxName,
    `usdc:${ipId}`
  );
  return box && box.value ? box.value : box;
}

function findAssetHolding(userAssets, assetId) {
  if (!Array.isArray(userAssets) || !Number.isFinite(assetId) || assetId <= 0) {
    return null;
  }

  const target = BigInt(assetId);

  for (const asset of userAssets) {
    const candidate =
      asset?.['asset-id'] ?? asset?.assetId ?? 0;

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

/**
 * GET – discover pools for which the wallet holds the REV ASA, regardless of creator/IP ownership.
 *
 * Query params:
 *   - userAddress: Algorand address of the stakeholder wallet
 *
 * Response:
 *   {
 *     success: true,
 *     userAddress: "...",
 *     pools: [
 *       {
 *         ipId,
 *         name,
 *         imageUrl,
 *         revenuePoolAppId,
 *         revenueTokenId,
 *         userTokenBalance,
 *         pool: { ...summary fields... }
 *       },
 *       ...
 *     ]
 *   }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserAddress = searchParams.get('userAddress');

    const userAddress = normalizeAddress(rawUserAddress);

    if (!userAddress || !algosdk.isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: `Invalid userAddress: "${userAddress}"` },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const { db } = await connectToDatabase();

    // 1) Load wallet assets (on-chain)
    const accountInfo = await getCachedAccountInfo(algodClient, userAddress);
    const userAssets = Array.isArray(accountInfo?.assets)
      ? accountInfo.assets
      : [];

    // 2) Load IP assets that have a revenue pool configured
    const ipAssetsCursor = db
      .collection('ip_assets')
      .find({
        revenuePoolAppId: { $exists: true },
      });

    const candidateIps = await ipAssetsCursor.toArray();

    const pools = [];

    for (const ip of candidateIps) {
      const revenuePoolAppId = Number(
        ip.revenuePoolAppId || ip.appId || 0
      );
      const revenueTokenId = Number(
        ip.revenueTokenAssetId || ip.revenueTokenId || 0
      );

      if (
        !Number.isFinite(revenuePoolAppId) ||
        revenuePoolAppId <= 0 ||
        revenuePoolAppId !== CURRENT_REVENUE_POOL_APP_ID
      ) {
        continue;
      }

      if (!Number.isFinite(revenueTokenId) || revenueTokenId <= 0) {
        continue;
      }

      // 3) Does this wallet actually hold the REV ASA for this IP?
      const holding = findAssetHolding(userAssets, revenueTokenId);
      const userTokenBalance = holding
        ? Number(holding.amount ?? 0)
        : 0;

      if (userTokenBalance <= 0) {
        // Stakeholder does not hold this IP's REV; skip.
        continue;
      }

      const resolvedIpId = normalizeIpId(
        ip.ipId ||
          ip.tokenizedIpId ||
          ip.assetId ||
          ip.id ||
          ip._id ||
          ''
      );

      if (!resolvedIpId) {
        continue;
      }

      // 4) Load pool box for summary metrics (unallocated USDC, held USDC, etc.)
      let poolSummary = null;

      try {
        const poolBoxValue = await getApplicationPoolBox(
          algodClient,
          revenuePoolAppId,
          resolvedIpId
        );
        if (poolBoxValue) {
          const poolBox = readPoolBox(poolBoxValue);
          poolSummary = {
            unallocatedUsdc: poolBox.unallocatedUsdc,
            totalClaimed: poolBox.totalClaimed,
            heldUsdc: poolBox.heldUsdc,
            currentRoundId: poolBox.currentRoundId,
            unallocatedUsdcFormatted: (
              poolBox.unallocatedUsdc / 1000000
            ).toFixed(2),
            totalClaimedFormatted: (
              poolBox.totalClaimed / 1000000
            ).toFixed(2),
            heldUsdcFormatted: (
              poolBox.heldUsdc / 1000000
            ).toFixed(2),
            balance: poolBox.heldUsdc,
            balanceFormatted: (
              poolBox.heldUsdc / 1000000
            ).toFixed(2),
            totalDeposited:
              poolBox.heldUsdc +
              poolBox.totalClaimed +
              poolBox.unallocatedUsdc,
            totalDepositedFormatted: (
              (poolBox.heldUsdc +
                poolBox.totalClaimed +
                poolBox.unallocatedUsdc) /
              1000000
            ).toFixed(2),
          };
        }
      } catch (err) {
        console.warn('[STAKEHOLDER-POOLS] Pool box not found', {
          ipId: resolvedIpId,
          appId: revenuePoolAppId,
          err: err?.message || err,
        });
      }

      pools.push({
        ipId: resolvedIpId,
        name: ip.name || ip.title || ip.displayName || resolvedIpId,
        imageUrl:
          ip.imageUrl ||
          ip.image ||
          ip.thumbnailUrl ||
          ip.thumbnail ||
          ip.previewImage ||
          ip.coverImage ||
          ip.fileUrl ||
          ip.mediaUrl ||
          null,
        revenuePoolAppId,
        revenueTokenId,
        userTokenBalance,
        pool: poolSummary,
      });
    }

    console.log('[STAKEHOLDER-POOLS][GET] discovered pools', {
      user: userAddress,
      count: pools.length,
    });

    return NextResponse.json({
      success: true,
      userAddress,
      pools,
    });
  } catch (error) {
    console.error('[STAKEHOLDER-POOLS][GET] ERROR:', error?.message || error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to discover stakeholder pools for this wallet',
      },
      { status: 500 }
    );
  }
}