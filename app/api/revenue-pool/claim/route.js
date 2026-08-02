import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';
import {
  getCachedAccountInfo,
  getCachedPoolBox,
  getCachedTxParams,
  withUserClaimLock,
  sleep,
  invalidatePoolBoxCache,
  invalidateAccountCache,
} from '@/lib/algorand-rate-limit';

const USDC_ASSET_ID = Number(process.env.USDC_ASSET_ID);
  if (!USDC_ASSET_ID) {
    throw new Error('USDC_ASSET_ID is not configured');
}

function encodePoolBoxName(ipId) {
  return new Uint8Array(Buffer.concat([Buffer.from('p_'), Buffer.from(ipId)]));
}

function encodeRoundBoxName(ipId, roundId) {
  const prefix = Buffer.from(`rnd_${ipId}`);
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(roundId));
  return new Uint8Array(Buffer.concat([prefix, roundBytes]));
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new Uint8Array(Buffer.from(value, 'base64'));
  return new Uint8Array(value);
}

function readPoolBox(value) {
  const rawValue = toUint8Array(value);
  const view = new DataView(rawValue.buffer, rawValue.byteOffset, rawValue.byteLength);
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
      address: algosdk.encodeAddress(rawValue.slice(73 + i * 35, 73 + i * 35 + 32)),
      bps: rawValue[73 + i * 35 + 32] * 256 + rawValue[73 + i * 35 + 33],
      claimed: rawValue[73 + i * 35 + 34] === 1,
    })),
  };
}

function readRoundBox(value) {
  const rawValue = toUint8Array(value);
  const view = new DataView(rawValue.buffer, rawValue.byteOffset, rawValue.byteLength);
  const holderCount = view.getUint16(16, false);
  const entryOffset = 18;
  const entrySize = 41;

  return {
    roundAmount: Number(view.getBigUint64(0, false)),
    roundCreated: Number(view.getBigUint64(8, false)),
    holderCount,
    holders: Array.from({ length: holderCount }, (_, i) => {
      const off = entryOffset + i * entrySize;
      return {
        address: algosdk.encodeAddress(rawValue.slice(off, off + 32)),
        amount: Number(view.getBigUint64(off + 32, false)),
        claimed: rawValue[off + 40] === 1,
      };
    }),
  };
}

async function getApplicationBox(algodClient, appIndex, boxName) {
  const box = await algodClient.getApplicationBoxByName(appIndex, boxName).do();
  return box && box.value ? box.value : null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const userAddress = searchParams.get('userAddress');
    const ipId = searchParams.get('ipId');

    if (!appId || !userAddress || !ipId) {
      return NextResponse.json(
        { error: 'appId, ipId, and userAddress are required' },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const appIndex = parseInt(appId, 10);
    const normalizedUser = String(userAddress).trim().toUpperCase();
    const poolBoxName = encodePoolBoxName(ipId);

    let pool;
    try {
      const poolBox = await getCachedPoolBox(
        algodClient,
        appIndex,
        poolBoxName,
        `usdc:${ipId}`
      );
      pool = readPoolBox(poolBox && poolBox.value ? poolBox.value : poolBox);
    } catch (e) {
      console.warn(`Box not found for IP ${ipId}:`, e && e.message ? e.message : e);
      return NextResponse.json({ pool: null, error: 'Pool not initialized' });
    }

    let userTokenBalance = 0;
      let accountInfo = null;

      if (pool.revenueTokenId > 0) {
        try {
          accountInfo = await getCachedAccountInfo(algodClient, normalizedUser);

          const asset = (accountInfo.assets || []).find(
            (a) => Number(a['asset-id']) === pool.revenueTokenId
          );

          if (asset) {
            userTokenBalance = Number(asset.amount || 0);
          }
        } catch (err) {
          console.log(
            'Could not get user token balance:',
            err && err.message ? err.message : err
          );
        }
      }

      console.log('[POOL REV HELD]', {
        ipId,
        appId: appIndex,
        revenueTokenId: pool.revenueTokenId,
        user: normalizedUser,
        userTokenBalance,
        userAssetsSample: (accountInfo?.assets || []).slice(0, 10).map((a) => ({
          assetId: a['asset-id'],
          amount: a.amount,
        })),
      });
    const rounds = [];
    let claimableAmount = 0;

    for (let roundId = 1; roundId <= pool.currentRoundId; roundId += 1) {
      try {
        const roundBoxValue = await getApplicationBox(
          algodClient,
          appIndex,
          encodeRoundBoxName(ipId, roundId)
        );
        if (!roundBoxValue) continue;

        const round = readRoundBox(roundBoxValue);
        const holder = round.holders.find((entry) => entry.address === normalizedUser);
        if (!holder) continue;

        rounds.push({
          roundId,
          roundAmount: round.roundAmount,
          roundCreated: round.roundCreated,
          amount: holder.amount,
          claimed: holder.claimed,
        });

        if (!holder.claimed) {
          claimableAmount += holder.amount;
        }
      } catch (_err) {
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      appId: appIndex,
      ipId,
      revenueTokenId: pool.revenueTokenId,
      pool: {
        unallocatedUsdc: pool.unallocatedUsdc,
        totalClaimed: pool.totalClaimed,
        heldUsdc: pool.heldUsdc,
        currentRoundId: pool.currentRoundId,
        unallocatedUsdcFormatted: (pool.unallocatedUsdc / 1000000).toFixed(2),
        totalClaimedFormatted: (pool.totalClaimed / 1000000).toFixed(2),
        heldUsdcFormatted: (pool.heldUsdc / 1000000).toFixed(2),
        balance: claimableAmount,
        balanceFormatted: (claimableAmount / 1000000).toFixed(2),
        totalDeposited: pool.unallocatedUsdc,
        totalDepositedFormatted: (pool.unallocatedUsdc / 1000000).toFixed(2),
      },
      user: {
        address: normalizedUser,
        tokenBalance: userTokenBalance,
        claimableAmount,
        claimableFormatted: (claimableAmount / 1000000).toFixed(2),
      },
      rounds,
    });
  } catch (error) {
    console.error('Error getting claim info:', error);
    return NextResponse.json(
      { error: error && error.message ? error.message : 'Failed to get claim info' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { claimerAddress, appId, ipId } = body;

    if (!claimerAddress || !appId || !ipId) {
      return NextResponse.json(
        { error: 'Missing required fields (claimerAddress, appId, ipId)' },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const suggestedParams = await getCachedTxParams(algodClient);
    const appIndex = parseInt(appId, 10);

    const poolBoxName = encodePoolBoxName(ipId);
    const poolBox = await getCachedPoolBox(
      algodClient,
      appIndex,
      poolBoxName,
      `usdc:${ipId}`
    );
    const pool = readPoolBox(poolBox && poolBox.value ? poolBox.value : poolBox);

    const boxes = [{ appIndex, name: poolBoxName }];
    for (let roundId = 1; roundId <= pool.currentRoundId; roundId += 1) {
      boxes.push({ appIndex, name: encodeRoundBoxName(ipId, roundId) });
    }

    const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: claimerAddress,
      suggestedParams: {
        ...suggestedParams,
        fee: BigInt(1000 + 1000 * pool.currentRoundId),
        flatFee: true,
      },
      appIndex,
      appArgs: [
        new Uint8Array(Buffer.from('claim_revenue_all')),
        new Uint8Array(Buffer.from(ipId)),
      ],
      foreignAssets: [USDC_ASSET_ID, pool.revenueTokenId],
      boxes,
    });

    const txnBytes = algosdk.encodeUnsignedTransaction(claimTxn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return NextResponse.json({
      success: true,
      transaction: txnBase64,
      txnId: claimTxn.txID(),
      message: 'Sign this transaction to claim your USDC',
    });
  } catch (error) {
    console.error('Error creating claim transaction:', error);
    return NextResponse.json(
      { error: error && error.message ? error.message : 'Failed to create claim transaction' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  let claimerAddress = '';

  try {
    const body = await request.json();
    const { signedTxn, signedTxns, userAddress, ipId, appId } = body;
    claimerAddress = String(userAddress || '').trim().toUpperCase();

    const hasSingle = typeof signedTxn === 'string' && signedTxn.length > 0;
    const hasGroup = Array.isArray(signedTxns) && signedTxns.length > 0;

    if (!hasSingle && !hasGroup) {
      return NextResponse.json(
        { error: 'signedTxn or signedTxns is required' },
        { status: 400 }
      );
    }

    const runSubmit = async () => {
      await sleep(500);

      const algodClient = getAlgodClient();

      const signedTxnBytes = hasGroup
        ? signedTxns.map((tx) => new Uint8Array(Buffer.from(tx, 'base64')))
        : [new Uint8Array(Buffer.from(signedTxn, 'base64'))];

      const result = await algodClient.sendRawTransaction(signedTxnBytes).do();
      const txid = result.txid || result.txId;

      console.log('Claim transaction submitted:', txid, {
        groupSize: signedTxnBytes.length,
        ipId,
        appId,
        claimerAddress,
      });

      if (claimerAddress) {
        invalidateAccountCache(claimerAddress);
      }
      if (ipId && appId) {
        invalidatePoolBoxCache(appId, `usdc:${ipId}`);
      }

      await algosdk.waitForConfirmation(algodClient, txid, 10);

      return NextResponse.json({
        success: true,
        txId: txid,
        groupSize: signedTxnBytes.length,
        message: 'USDC claimed successfully!',
      });
    };

    if (claimerAddress) {
      return await withUserClaimLock(claimerAddress, runSubmit);
    }

    return await runSubmit();
  } catch (error) {
    const message = error && error.message ? error.message : '';

    if (error && error.retryable) {
      return NextResponse.json(
        { error: message, retryable: true },
        { status: 429 }
      );
    }

    if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
      return NextResponse.json(
        {
          error: 'Node throttled; please retry in a few seconds.',
          retryable: true,
        },
        { status: 429 }
      );
    }

    console.error('Error claiming from Revenue Pool:', error);
    return NextResponse.json(
      { error: message || 'Failed to claim from Revenue Pool' },
      { status: 500 }
    );
  }
}