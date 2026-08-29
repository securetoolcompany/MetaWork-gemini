import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getToken(request) {
  const authorization = request.headers.get('authorization');

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  return bearerToken || request.cookies.get('auth_token')?.value || null;
}

async function getAuthenticatedAdmin(request) {
  const token = getToken(request);

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return null;
    }

    if (decoded.role === 'admin' || decoded.isAdmin === true) {
      return decoded;
    }

    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({
      $or: [
        { id: decoded.userId },
        ...(ObjectId.isValid(String(decoded.userId))
          ? [{ _id: new ObjectId(String(decoded.userId)) }]
          : []),
      ],
    });

    return user?.isAdmin === true || user?.role === 'admin'
      ? decoded
      : null;
  } catch (error) {
    console.error(
      '[admin/revenue-settlement/eligible] authentication error:',
      error,
    );

    return null;
  }
}

function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      return nestedValue;
    }),
  );
}

function toEligibleRow(row) {
  return {
    ledgerRowId: String(row._id),

    orderId: row.orderId || null,
    orderNumber: row.orderNumber || null,
    orderItemId: row.orderItemId || null,

    poolKey: row.poolKey || null,
    revenuePoolAppId: row.revenuePoolAppId || null,
    revenueTokenAssetId: row.revenueTokenAssetId || null,

    allocationCents: Number(row.allocationCents || 0),
    usdcAtomicUnits: Number(row.usdcAtomicUnits || 0),

    eligibleAt: row.eligibleAt || null,
    createdAt: row.createdAt || null,
  };
}

export async function GET(request) {
  const admin = await getAuthenticatedAdmin(request);

  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error: 'Administrator authorization is required.',
      },
      { status: 403 },
    );
  }

  const poolKey = String(
    request.nextUrl.searchParams.get('poolKey') || '',
  ).trim();

  const filter = {
    status: 'release_eligible',
    settlementBatchId: null,
  };

  if (poolKey) {
    filter.poolKey = poolKey;
  }

  try {
    const { db } = await connectToDatabase();

    const rows = await db
      .collection('revenue_ledger')
      .find(
        filter,
        {
          projection: {
            orderId: 1,
            orderNumber: 1,
            orderItemId: 1,

            poolKey: 1,
            revenuePoolAppId: 1,
            revenueTokenAssetId: 1,

            allocationCents: 1,
            usdcAtomicUnits: 1,

            eligibleAt: 1,
            createdAt: 1,
          },
        },
      )
      .sort({
        eligibleAt: 1,
        createdAt: 1,
        _id: 1,
      })
      .limit(250)
      .toArray();

    const eligibleRows = rows.map(toEligibleRow);

    const totals = eligibleRows.reduce(
      (result, row) => ({
        rowCount: result.rowCount + 1,
        allocationCents:
          result.allocationCents +
          Number(row.allocationCents || 0),
        usdcAtomicUnits:
          result.usdcAtomicUnits +
          Number(row.usdcAtomicUnits || 0),
      }),
      {
        rowCount: 0,
        allocationCents: 0,
        usdcAtomicUnits: 0,
      },
    );

    return NextResponse.json(
      serialize({
        success: true,
        rows: eligibleRows,
        totals,
      }),
    );
  } catch (error) {
    console.error(
      '[admin/revenue-settlement/eligible] failed to load rows:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to load eligible revenue ledger rows.',
      },
      { status: 500 },
    );
  }
}