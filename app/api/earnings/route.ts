import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();                          // ← await added
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token) as { userId?: string } | null;
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = decoded.userId;

  const { db } = await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') ?? '6', 10);

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const paidOrders = await db
    .collection('orders')
    .find({ sellerId: userId, status: 'paid' })
    .sort({ paidAt: -1 })
    .toArray();

  const orderTotal = (order: any) =>
    (order.items ?? []).reduce(
      (sum: number, item: any) => sum + (item.price ?? 0) * (item.quantity ?? 1),
      0
    );

  const allTimeRevenue   = paidOrders.reduce((s, o) => s + orderTotal(o), 0);
  const thisMonthRevenue = paidOrders
    .filter(o => new Date(o.paidAt) >= startOfThisMonth)
    .reduce((s, o) => s + orderTotal(o), 0);
  const lastMonthRevenue = paidOrders
    .filter(o => new Date(o.paidAt) >= startOfLastMonth && new Date(o.paidAt) < startOfThisMonth)
    .reduce((s, o) => s + orderTotal(o), 0);

  const ipAssets = await db
    .collection('ip_assets')
    .find({ ownerId: userId })
    .toArray();

  const totalRoyalties = ipAssets.reduce(
    (s: number, ip: any) => s + (ip.totalRoyaltiesEarned ?? 0),
    0
  );

  // ── Monthly buckets ───────────────────────────────────────────────────────
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ← type now includes adRevenue and tips
  const buckets: Record<string, {
    month: string;
    productSales: number;
    ipRoyalties: number;
    adRevenue: number;
    tips: number;
  }> = {};

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets[key] = { month: MONTH_LABELS[d.getMonth()], productSales: 0, ipRoyalties: 0, adRevenue: 0, tips: 0 };
  }

  for (const order of paidOrders) {
    const d = new Date(order.paidAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (buckets[key]) buckets[key].productSales += orderTotal(order);
  }

  for (const ip of ipAssets) {
    for (const event of ip.royaltyEvents ?? []) {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets[key]) buckets[key].ipRoyalties += event.amount ?? 0;
    }
  }

  const productMap: Record<string, { name: string; image: string; sales: number; revenue: number }> = {};

  for (const order of paidOrders) {
    for (const item of order.items ?? []) {
      const pid = String(item.productId ?? item._id ?? 'unknown');
      if (!productMap[pid]) {
        productMap[pid] = {
          name:  item.name ?? item.title ?? 'Product',
          image: item.image ?? item.thumbnail ?? '',
          sales: 0,
          revenue: 0,
        };
      }
      productMap[pid].sales   += item.quantity ?? 1;
      productMap[pid].revenue += (item.price ?? 0) * (item.quantity ?? 1);
    }
  }

  const topProducts = Object.entries(productMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topIpAssets = ipAssets
    .map((ip: any) => ({
      id:        String(ip._id),
      name:      ip.name ?? ip.title ?? 'IP Asset',
      type:      ip.tokenized ? 'tokenized' : 'authenticated',
      royalties: ip.totalRoyaltiesEarned ?? 0,
      uses:      ip.useCount ?? (ip.royaltyEvents ?? []).length,
    }))
    .sort((a: any, b: any) => b.royalties - a.royalties)
    .slice(0, 10);

  const transactions = paidOrders.slice(0, 50).map((order: any) => ({
    id:          String(order._id),
    date:        order.paidAt ? new Date(order.paidAt).toISOString().slice(0, 10) : '',
    type:        'Product Sale',
    description: (order.items ?? []).map((i: any) => i.name ?? i.title ?? 'Item').join(', '),
    amount:      orderTotal(order),
    status:      order.status === 'paid' ? 'completed' : order.status,
  }));

  const pendingOrders = await db
    .collection('orders')
    .find({ sellerId: userId, status: 'pending' })
    .toArray();
  const pendingPayout = pendingOrders.reduce((s, o) => s + orderTotal(o), 0);

  return NextResponse.json({
    success: true,
    overview: {
      totalEarnings:  allTimeRevenue + totalRoyalties,
      productRevenue: allTimeRevenue,
      ipRoyalties:    totalRoyalties,
      thisMonth:      thisMonthRevenue,
      lastMonth:      lastMonthRevenue,
      pendingPayout,
    },
    revenueBreakdown: {
      productSales: allTimeRevenue,
      ipRoyalties:  totalRoyalties,
      adRevenue:    0,
      tips:         0,
    },
    monthlyData:  Object.values(buckets),
    topProducts,
    topIpAssets,
    transactions,
  });
}