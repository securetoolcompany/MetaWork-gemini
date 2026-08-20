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
import {
  getRevenuePoolClaimHistory,
  upsertRevenuePoolClaimReceipt,
} from '@/lib/revenue-pool-claim-receipts.js';

function formatUsdDynamicFromMicro(microUsdc) {
  const raw = microUsdc / 1_000_000;

  // Start with up to 6 decimals.
  let s = raw.toFixed(6);

  // Trim trailing zeros after the last non-zero decimal.
  s = s.replace(/(\.\d*?[1-9])0+$/, '$1');

  // Ensure at least two decimals for whole numbers.
  if (s.endsWith('.0')) {
    s = s + '0';
  } else if (!s.includes('.')) {
    s = s + '.00';
  }

  return s;
}

function getUsdcAssetId() {
  const id = Number(process.env.USDC_ASSET_ID);
  if (!id) {
    throw new Error('USDC_ASSET_ID is not configured');
  }
  return id;
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
    const poolKey = String(
      searchParams.get('poolKey') ||
        searchParams.get('ipId') ||
        ''
    ).trim();

    if (!appId || !userAddress || !poolKey) {
      return NextResponse.json(
        { error: 'appId, poolKey, and userAddress are required' },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const appIndex = parseInt(appId, 10);
    const normalizedUser = String(userAddress).trim().toUpperCase();
    const poolBoxName = encodePoolBoxName(poolKey);

    let pool;
    try {
      const poolBox = await getCachedPoolBox(
        algodClient,
        appIndex,
        poolBoxName,
        `usdc:${poolKey}`
      );
      pool = readPoolBox(poolBox && poolBox.value ? poolBox.value : poolBox);
    } catch (e) {
      console.warn(`Box not found for pool ${poolKey}:`, e && e.message ? e.message : e);
      return NextResponse.json({ pool: null, error: 'Pool not initialized' });
    }

    let userTokenBalance = 0;
      let accountInfo = null;

      if (pool.revenueTokenId > 0) {
        try {
          accountInfo = await getCachedAccountInfo(algodClient, normalizedUser);

          const targetAssetId = BigInt(pool.revenueTokenId);
          const assets = Array.isArray(accountInfo?.assets) ? accountInfo.assets : [];

          const asset = assets.find((a) => {
            try {
              return BigInt(a?.['asset-id'] ?? a?.assetId ?? 0) === targetAssetId;
            } catch {
              return false;
            }
          });

          userTokenBalance = asset ? Number(asset?.amount ?? 0) : 0;
        } catch (err) {
          console.log(
            'Could not get user token balance:',
            err && err.message ? err.message : err
          );
        }
      }

      console.log('[POOL REV HELD]', {
        poolKey,
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
          encodeRoundBoxName(poolKey, roundId)
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

    const claimHistory = await getRevenuePoolClaimHistory({
      appId: appIndex,
      poolKey,
      claimerAddress: normalizedUser,
    });

    const lifetimeClaimedAmount = claimHistory.reduce(
      (sum, receipt) =>
        sum + Number(receipt.amountUsdcAtomicUnits || 0),
      0,
    );

    const totalDeposited =
      pool.heldUsdc + pool.totalClaimed + pool.unallocatedUsdc;

    return NextResponse.json({
      success: true,
      appId: appIndex,
      poolKey,
      ipId: poolKey,
      revenueTokenId: pool.revenueTokenId,
      pool: {
        unallocatedUsdc: pool.unallocatedUsdc,
        totalClaimed: pool.totalClaimed,
        heldUsdc: pool.heldUsdc,
        currentRoundId: pool.currentRoundId,
        unallocatedUsdcFormatted: formatUsdDynamicFromMicro(pool.unallocatedUsdc),
        totalClaimedFormatted: formatUsdDynamicFromMicro(pool.totalClaimed),
        heldUsdcFormatted: formatUsdDynamicFromMicro(pool.heldUsdc),
        balance: pool.heldUsdc,
        balanceFormatted: formatUsdDynamicFromMicro(pool.heldUsdc),
        totalDeposited,
        totalDepositedFormatted: formatUsdDynamicFromMicro(totalDeposited),
      },
      user: {
        address: normalizedUser,
        tokenBalance: userTokenBalance,
        claimableAmount,
        claimableFormatted: formatUsdDynamicFromMicro(claimableAmount),
        lifetimeClaimedAmount,
        lifetimeClaimedFormatted: formatUsdDynamicFromMicro(
          lifetimeClaimedAmount,
        ),
      },
      rounds,
      claimHistory,
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
    const { claimerAddress, appId } = body;
    const poolKey = String(body.poolKey || body.ipId || '').trim();

    if (!claimerAddress || !appId || !poolKey) {
      return NextResponse.json(
        { error: 'Missing required fields (claimerAddress, appId, poolKey)' },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const suggestedParams = await getCachedTxParams(algodClient);
    const appIndex = parseInt(appId, 10);

    const poolBoxName = encodePoolBoxName(poolKey);
    const poolBox = await getCachedPoolBox(
      algodClient,
      appIndex,
      poolBoxName,
      `usdc:${poolKey}`
    );

    const pool = readPoolBox(
      poolBox && poolBox.value ? poolBox.value : poolBox
    );

    const normalizedClaimer = String(claimerAddress).trim().toUpperCase();

    // Find the first active, unclaimed V10 round for this exact wallet.
    let roundIdToClaim = null;

    for (let roundId = 1; roundId <= pool.currentRoundId; roundId += 1) {
      const roundBoxName = encodeRoundBoxName(poolKey, roundId);

      let roundBoxValue;

      try {
        roundBoxValue = await getApplicationBox(
          algodClient,
          appIndex,
          roundBoxName,
        );
      } catch (error) {
        if (Number(error?.status) === 404) {
          continue;
        }

        throw error;
      }

      if (!roundBoxValue) {
        continue;
      }

      const round = readRoundBox(roundBoxValue);

      const recipientEntry = round.holders.find(
        (holder) => holder.address === normalizedClaimer,
      );

      if (
        recipientEntry &&
        recipientEntry.amount > 0 &&
        !recipientEntry.claimed
      ) {
        roundIdToClaim = roundId;
        break;
      }
    }

    if (!roundIdToClaim) {
      return NextResponse.json(
        {
          error:
            'No unclaimed payout round was found for this wallet and pool.',
        },
        { status: 409 }
      );
    }

    const roundBoxName = encodeRoundBoxName(poolKey, roundIdToClaim);

    const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: normalizedClaimer,
      suggestedParams: {
        ...suggestedParams,
        // 1,000 µALGO for this app call + 1,000 µALGO for the inner USDC transfer.
        fee: 2000,
        flatFee: true,
      },
      appIndex,
      appArgs: [
        new Uint8Array(Buffer.from('claim_revenue_round', 'utf8')),
        new Uint8Array(Buffer.from(poolKey, 'utf8')),
        algosdk.encodeUint64(roundIdToClaim),
      ],
      foreignAssets: [getUsdcAssetId()],
      boxes: [
        { appIndex: 0, name: poolBoxName },
        { appIndex: 0, name: roundBoxName },
      ],
    });

    const txnBytes = algosdk.encodeUnsignedTransaction(claimTxn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    console.log('[REVENUE CLAIM] built V10 round claim', {
      appIndex,
      claimer: normalizedClaimer,
      poolKey,
      roundId: roundIdToClaim,
      action: 'claim_revenue_round',
      boxes: [
        Buffer.from(poolBoxName).toString('hex'),
        Buffer.from(roundBoxName).toString('hex'),
      ],
      txnId: claimTxn.txID(),
    });

    return NextResponse.json({
      success: true,
      transaction: txnBase64,
      txnId: claimTxn.txID(),
      roundId: roundIdToClaim,
      message: `Sign this transaction to claim USDC from round ${roundIdToClaim}`,
    });
  } catch (error) {
    console.error('Error creating claim transaction:', error);
    return NextResponse.json(
      {
        error:
          error && error.message
            ? error.message
            : 'Failed to create claim transaction',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  let claimerAddress = '';

  try {
    const body = await request.json();
    const { signedTxn, signedTxns, userAddress, appId } = body;
    const poolKey = String(body.poolKey || body.ipId || '').trim();
    const appIndex = Number(appId);

    claimerAddress = String(userAddress || '').trim().toUpperCase();

    if (
      !poolKey ||
      !Number.isSafeInteger(appIndex) ||
      appIndex < 1 ||
      !claimerAddress
    ) {
      return NextResponse.json(
        { error: 'userAddress, poolKey, and appId are required' },
        { status: 400 },
      );
    }

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

      if (signedTxnBytes.length !== 1) {
        throw new Error(
          'Revenue pool claims must contain exactly one signed transaction',
        );
      }

      const decodedSignedTransaction = algosdk.decodeSignedTransaction(
        signedTxnBytes[0],
      );

      const claimTransaction = decodedSignedTransaction.txn;

      if (claimTransaction.type !== 'appl') {
        throw new Error(
          'Signed transaction must be an application call',
        );
      }

      if (Number(claimTransaction.applicationCall.appIndex) !== appIndex) {
        throw new Error(
          'Signed transaction app ID does not match the requested pool',
        );
      }

      if (
        algosdk.encodeAddress(claimTransaction.sender.publicKey) !==
        claimerAddress
      ) {
        throw new Error(
          'Signed transaction sender does not match userAddress',
        );
      }

      const claimAppArgs = claimTransaction.applicationCall.appArgs || [];

      if (
        Buffer.from(claimAppArgs[0] || []).toString('utf8') !==
        'claim_revenue_round'
      ) {
        throw new Error(
          'Signed transaction is not a claim_revenue_round call',
        );
      }

      if (
        Buffer.from(claimAppArgs[1] || []).toString('utf8') !== poolKey
      ) {
        throw new Error(
          'Signed transaction pool key does not match the requested pool',
        );
      }

      const roundIdBytes = Buffer.from(claimAppArgs[2] || []);

      if (roundIdBytes.length !== 8) {
        throw new Error(
          'Signed claim transaction must contain an eight-byte round ID',
        );
      }

      const preparedRoundId = Number(
        roundIdBytes.readBigUInt64BE(),
      );

      if (
        !Number.isSafeInteger(preparedRoundId) ||
        preparedRoundId < 1
      ) {
        throw new Error(
          'Signed claim transaction contains an invalid round ID',
        );
      }

      const roundBoxValue = await getApplicationBox(
        algodClient,
        appIndex,
        encodeRoundBoxName(poolKey, preparedRoundId),
      );

      if (!roundBoxValue) {
        throw new Error(
          `Payout round ${preparedRoundId} was not found for receipt recording`,
        );
      }

      const round = readRoundBox(roundBoxValue);

      const recipientEntry = round.holders.find(
        (holder) => holder.address === claimerAddress,
      );

      if (
        !recipientEntry ||
        recipientEntry.amount < 1 ||
        recipientEntry.claimed
      ) {
        throw new Error(
          'The selected payout round is not claimable by this wallet',
        );
      }

      const result = await algodClient
        .sendRawTransaction(signedTxnBytes)
        .do();

      const txid = result.txid || result.txId;

      console.log('Claim transaction submitted:', txid, {
        groupSize: signedTxnBytes.length,
        ipId: poolKey,
        appId: appIndex,
        roundId: preparedRoundId,
        claimerAddress,
      });

      invalidateAccountCache(claimerAddress);
      invalidatePoolBoxCache(
        appIndex,
        `usdc:${poolKey}`,
      );

      await algosdk.waitForConfirmation(algodClient, txid, 10);

      await upsertRevenuePoolClaimReceipt({
        appId: appIndex,
        poolKey,
        roundId: preparedRoundId,
        claimerAddress,
        amountUsdcAtomicUnits: recipientEntry.amount,
        roundCreated: round.roundCreated,
        claimTransactionId: txid,
      });

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