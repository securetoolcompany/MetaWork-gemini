import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb'; // Correct import found from your file!

export async function GET() {
    try {
        const NEW_POOL_ID = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;

        if (!NEW_POOL_ID) {
            return NextResponse.json({ error: "No New Pool ID found in .env" }, { status: 500 });
        }

        console.log(`[Fix-DB] Connecting to MongoDB...`);
        const { db } = await connectToDatabase();

        console.log(`[Fix-DB] Updating IPs to target pool: ${NEW_POOL_ID}`);

        // 1. Update ALL IPs that have a pool ID but it's NOT the new one
        // (This moves everything from the old pool to the new one)
        const result = await db.collection('ip_assets').updateMany(
            { 
                revenuePoolAppId: { $ne: NEW_POOL_ID },
                // Optional: Ensure we only touch records that actually have a pool ID
                revenuePoolAppId: { $exists: true } 
            },
            { 
                $set: { revenuePoolAppId: NEW_POOL_ID } 
            }
        );

        return NextResponse.json({ 
            success: true, 
            message: "Database Migration Complete", 
            matched_documents: result.matchedCount,
            modified_documents: result.modifiedCount,
            target_pool_id: NEW_POOL_ID
        });

    } catch (e) {
        console.error("Fix ID Error:", e);
        return NextResponse.json({ 
            error: e.message, 
            stack: e.stack 
        }, { status: 500 });
    }
}