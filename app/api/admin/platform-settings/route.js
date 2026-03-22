import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';

// Default platform wallet from env
const DEFAULT_PLATFORM_WALLET = process.env.METAWORK_PLATFORM_WALLET || 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

/**
 * GET /api/admin/platform-settings
 * Get platform settings including wallet address
 */
export async function GET(request) {
  try {
    const { db } = await connectToDatabase();

    // Get settings from database
    const settings = await db.collection('platform_settings').findOne({ key: 'platform_wallet' });

    return NextResponse.json({
      success: true,
      platformWallet: settings?.value || DEFAULT_PLATFORM_WALLET,
      platformPercentage: settings?.percentage || 20,
      isDefault: !settings,
      lastUpdated: settings?.updatedAt || null
    });

  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch platform settings'
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/platform-settings
 * Update platform wallet address
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { platformWallet, platformPercentage } = body;

    // Validate wallet address if provided
    if (platformWallet && !algosdk.isValidAddress(platformWallet)) {
      return NextResponse.json({ error: 'Invalid Algorand wallet address' }, { status: 400 });
    }

    // Validate percentage if provided
    if (platformPercentage !== undefined) {
      if (platformPercentage < 0 || platformPercentage > 100) {
        return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
      }
    }

    const { db } = await connectToDatabase();

    const updateData = {
      updatedAt: new Date()
    };

    if (platformWallet) {
      updateData.value = platformWallet;
    }

    if (platformPercentage !== undefined) {
      updateData.percentage = platformPercentage;
    }

    await db.collection('platform_settings').updateOne(
      { key: 'platform_wallet' },
      { 
        $set: updateData,
        $setOnInsert: { key: 'platform_wallet', createdAt: new Date() }
      },
      { upsert: true }
    );

    // Fetch updated settings
    const settings = await db.collection('platform_settings').findOne({ key: 'platform_wallet' });

    return NextResponse.json({
      success: true,
      platformWallet: settings?.value || DEFAULT_PLATFORM_WALLET,
      platformPercentage: settings?.percentage || 20,
      message: 'Platform settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating platform settings:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update platform settings'
    }, { status: 500 });
  }
}
