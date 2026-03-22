import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
    try {
        const { db } = await connectToDatabase();

        // --- THE BIG RED BUTTON ---
        // Deletes EVERYTHING in the 'ip_assets' collection
        const result = await db.collection('ip_assets').deleteMany({});

        return NextResponse.json({ 
            success: true, 
            message: "☢️ DATABASE NUKED. All IP Assets have been deleted.", 
            deleted_count: result.deletedCount 
        });

    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}