import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const configuredRevenuePoolAppId = Number(
    process.env.REVENUE_POOL_APP_ID ||
        process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID
);

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
            id: decoded.userId,
        });

        if (user?.isAdmin === true || user?.role === 'admin') {
            return decoded;
        }

        return null;
    } catch (error) {
        console.error(
            '[admin/revenue-pool/ip-assets] authentication error:',
            error
        );

        return null;
    }
}

function resolvePoolIpId(asset) {
    const value =
        asset?.ipId ||
        asset?.tokenizedIpId ||
        asset?.assetId ||
        asset?.id ||
        asset?._id ||
        '';

    return String(value).trim();
}

export async function GET(request) {
    const admin = await getAuthenticatedAdmin(request);

    if (!admin) {
        return NextResponse.json(
            {
                success: false,
                error: 'Administrator authorization is required.',
            },
            { status: 403 }
        );
    }

    if (
        !Number.isSafeInteger(configuredRevenuePoolAppId) ||
        configuredRevenuePoolAppId < 1
    ) {
        return NextResponse.json(
            {
                success: false,
                error: 'Revenue-pool application ID is not configured.',
            },
            { status: 500 }
        );
    }

    try {
        const { db } = await connectToDatabase();

        const ipAssets = await db
            .collection('ip_assets')
            .find({
                revenuePoolAppId: {
                    $in: [
                        configuredRevenuePoolAppId,
                        String(configuredRevenuePoolAppId),
                    ],
                },
                status: {
                    $in: [
                        'unminted',
                        'active',
                        'pending_pool_create',
                        'minted',
                    ],
                },
            })
            .sort({ createdAt: -1 })
            .toArray();

        const eligibleIpAssets = ipAssets
            .map((asset) => {
                const id = asset._id.toString();
                const normalizedAsset = {
                    mongoId: asset._id.toString(),
                    id: asset.id || null,
                    name: asset.name || 'Untitled IP asset',
                    ipId: asset.ipId || null,
                    tokenizedIpId: asset.tokenizedIpId || null,
                    assetId: asset.assetId || null,
                    revenuePoolAppId: Number(asset.revenuePoolAppId),
                    revenueTokenAssetId: asset.revenueTokenAssetId || null,
                };

                return {
                    ...normalizedAsset,
                    resolvedPoolIpId: resolvePoolIpId(normalizedAsset),
                };
            })
            .filter((asset) => asset.resolvedPoolIpId);

        return NextResponse.json({
            success: true,
            revenuePoolAppId: configuredRevenuePoolAppId,
            ipAssets: eligibleIpAssets,
        });
    } catch (error) {
        console.error(
            '[admin/revenue-pool/ip-assets] failed to load IP assets:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'Unable to load IP assets for revenue-pool administration.',
            },
            { status: 500 }
        );
    }
}