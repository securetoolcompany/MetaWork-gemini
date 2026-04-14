import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(req) {
  try {
    const { identifier, orderNumber, isLoggedIn, userEmail, userWallet } = await req.json();

    const { db } = await connectToDatabase();

    // 1. DYNAMIC IDENTITY QUERY: Support both Web2 (Email) and Web3 (Wallet)
    let identityQuery = [];

    if (isLoggedIn) {
      if (userEmail) identityQuery.push({ email: userEmail.toLowerCase().trim() });
      if (userWallet) identityQuery.push({ walletAddress: userWallet.trim() });
      // Also check the shipping info, just in case a wallet user provided an email at checkout
      if (userEmail) identityQuery.push({ 'shippingInfo.email': userEmail.toLowerCase().trim() });
    } else {
      if (!identifier) {
        return NextResponse.json({ error: "Email or Wallet Address is required." }, { status: 400 });
      }
      const cleanId = identifier.trim();
      identityQuery.push({ email: cleanId.toLowerCase() });
      identityQuery.push({ walletAddress: cleanId });
      identityQuery.push({ 'shippingInfo.email': cleanId.toLowerCase() });
    }

    if (identityQuery.length === 0) {
      return NextResponse.json({ error: "Valid user identification required." }, { status: 400 });
    }

    const matchCondition = { $or: identityQuery };

    // 2. GUEST SECURITY CHECK
    if (!isLoggedIn) {
      if (!orderNumber) {
        return NextResponse.json({ error: "Order Number is required for guest tracking." }, { status: 400 });
      }
      
      const cleanOrderNumber = orderNumber.replace('#', '').trim();
      const verifyOrder = await db.collection('orders').findOne({
        ...matchCondition,
        orderNumber: cleanOrderNumber
      });

      if (!verifyOrder) {
        return NextResponse.json({ error: "We couldn't find an order matching those details." }, { status: 404 });
      }
    }

    // 3. FETCH ALL ORDERS MATCHING THIS IDENTITY
    const allOrders = await db.collection('orders')
      .find(matchCondition)
      .sort({ createdAt: -1 })
      .toArray();

    // 4. ENRICH WITH LIVE PRINTFUL DATA
    const enrichedOrders = await Promise.all(allOrders.map(async (order) => {
      if (!order.printfulOrderId) {
        return {
          orderNumber: order.orderNumber,
          date: order.createdAt,
          status: order.status || 'pending',
          tracking: [],
          items: order.items || []
        };
      }

      try {
        const pfRes = await fetch(`https://api.printful.com/orders/${order.printfulOrderId}`, {
          headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_ACCESS_TOKEN}` },
        });

        if (!pfRes.ok) throw new Error("Printful fetch failed");
        
        const pfData = await pfRes.json();
        const pfOrder = pfData.result;

        const trackingInfo = pfOrder.shipments && pfOrder.shipments.length > 0
          ? pfOrder.shipments.map(s => ({
              carrier: s.carrier,
              trackingNumber: s.tracking_number,
              trackingUrl: s.tracking_url,
            }))
          : [];

        return {
          orderNumber: order.orderNumber,
          date: order.createdAt || pfOrder.created,
          status: pfOrder.status, 
          tracking: trackingInfo,
          items: order.items || [] 
        };
      } catch (err) {
        return {
          orderNumber: order.orderNumber,
          date: order.createdAt,
          status: order.status || 'processing',
          tracking: [],
          items: order.items || []
        };
      }
    }));

    return NextResponse.json(enrichedOrders);

  } catch (error) {
    console.error("TRACKING API ERROR:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}