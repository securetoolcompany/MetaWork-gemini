import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ── Auth helper (mirrors the pattern in app/api/admin/categories/route.js) ──
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ') ? authHeader.substring(7)
    : request.cookies.get('auth_token')?.value;

  if (!token) return null;

  const decoded = verifyToken(token) as { userId?: string } | null;
  if (!decoded?.userId) return null;

  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne({ id: decoded.userId });
  return user ?? null;
}

export interface SaleRecord {
  id: string;
  orderNumber: string;
  product: string;
  type: 'Physical' | 'Digital' | 'Tokenized IP';
  customer: string;
  date: string;
  amount: string;
  status: 'Completed' | 'Processing' | 'Shipped' | 'Pending' | 'Refunded';
}

export interface SalesSummary {
  totalOrders: number;
  grossSales: number;
  pendingFulfillment: number;
}

export async function GET(request: NextRequest) {
  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const isAdmin: boolean = user.isAdmin === true;

    // ── 2. Parse query params ──────────────────────────────────────────────
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const page  = parseInt(searchParams.get('page')  || '1',  10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip  = (page - 1) * limit;

    const status = searchParams.get('status');
    const q      = searchParams.get('q');

    // ── 3. Build query ─────────────────────────────────────────────────────
    const query: Record<string, unknown> = {};

    // Non-admins are hard-scoped to their own orders only.
    // Orders link back to a seller via items.creatorId OR the seller's userId
    // stored on the order itself (depending on how your checkout writes it).
    if (!isAdmin) {
      query.$or = [
        { 'items.creatorId': user.id },
        { 'items.userId':    user.id },
        { sellerId:          user.id },
      ];
    }

    if (status) query.status = status;

    if (q) {
      const textFilter = [
        { orderNumber:         { $regex: q, $options: 'i' } },
        { email:               { $regex: q, $options: 'i' } },
        { 'shippingInfo.name': { $regex: q, $options: 'i' } },
        { 'items.title':       { $regex: q, $options: 'i' } },
      ];
      // Merge with existing $or (seller scope) using $and
      if (query.$or) {
        query.$and = [{ $or: query.$or as unknown[] }, { $or: textFilter }];
        delete query.$or;
      } else {
        query.$or = textFilter;
      }
    }

    const type = searchParams.get('type');
    if (type && type !== 'all') {
    const typeMap: Record<string, unknown> = {
        physical:  { $or: [{ 'items.type': 'physical' }, { 'items.isPhysical': true }] },
        digital:   { 'items.type': 'digital' },
        tokenized: { 'items.type': { $nin: ['physical', 'digital'] } },
    };
    if (typeMap[type]) Object.assign(query, typeMap[type]);
    }

    // ── 4. Fetch data ──────────────────────────────────────────────────────
    const [rawOrders, total, allOrders] = await Promise.all([
      db.collection('orders')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('orders').countDocuments(query),
      // KPI stats use the same scope as the query (minus pagination/search)
      db.collection('orders')
        .find(
          isAdmin
            ? {}
            : { $or: [
                { 'items.creatorId': user.id },
                { 'items.userId':    user.id },
                { sellerId:          user.id },
              ]}
        )
        .project({ status: 1, total: 1 })
        .toArray(),
    ]);

    // ── 5. KPI summary ─────────────────────────────────────────────────────
    const grossSales = allOrders.reduce(
      (acc: number, o: { total?: number }) => acc + (o.total ?? 0), 0
    );
    const pendingFulfillment = allOrders.filter(
      (o: { status?: string }) =>
        ['processing', 'pending'].includes((o.status ?? '').toLowerCase())
    ).length;

    // ── 6. Shape records ───────────────────────────────────────────────────
    const now = new Date();

    const sales: SaleRecord[] = rawOrders.map((order) => {
      const titles: string[] = (order.items ?? []).map(
        (i: { title?: string; name?: string }) => i.title || i.name || 'Product'
      );
      const product =
        titles.length > 1 ? `${titles[0]} (+${titles.length - 1} more)` : (titles[0] ?? 'Order');

      const hasPhysical = (order.items ?? []).some(
        (i: { type?: string; isPhysical?: boolean }) => i.type === 'physical' || i.isPhysical
      );
      const hasDigital = (order.items ?? []).some(
        (i: { type?: string }) => i.type === 'digital'
      );
      const type: SaleRecord['type'] = hasPhysical ? 'Physical' : hasDigital ? 'Digital' : 'Tokenized IP';

      const customer: string =
        order.shippingInfo?.name || order.email || order.buyerAddress || 'Anonymous';

      let dateLabel = 'Unknown';
      if (order.createdAt) {
        const d = new Date(order.createdAt);
        const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
        if (diffDays === 0) {
          dateLabel = `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
          dateLabel = 'Yesterday';
        } else {
          dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      const statusMap: Record<string, SaleRecord['status']> = {
        completed: 'Completed', paid: 'Completed',
        processing: 'Processing', pending: 'Processing',
        shipped: 'Shipped',
        refunded: 'Refunded', cancelled: 'Refunded',
      };
      const status: SaleRecord['status'] =
        statusMap[(order.status ?? '').toLowerCase()] ?? 'Processing';

      return {
        id:          order._id.toString(),
        orderNumber: `ORD-${order.orderNumber ?? order._id.toString().slice(-4).toUpperCase()}`,
        product,
        type,
        customer,
        date:   dateLabel,
        amount: `$${(order.total ?? 0).toFixed(2)}`,
        status,
      };
    });

    return NextResponse.json({
      success: true,
      isAdmin,   // handy for the frontend to conditionally show extra columns
      sales,
      summary: { totalOrders: total, grossSales: Math.round(grossSales * 100) / 100, pendingFulfillment } satisfies SalesSummary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });

  } catch (error) {
    console.error('[/api/sales] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}