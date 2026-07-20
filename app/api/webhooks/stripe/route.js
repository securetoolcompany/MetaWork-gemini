import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
//import { ObjectId } from 'mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');
  const { ObjectId } = await import('mongodb');
  
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // ─── Credits purchase (Stripe Checkout) ─────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, creditsToAdd } = session.metadata || {};

    if (!userId || !creditsToAdd) {
      console.error('[webhook] checkout.session.completed missing metadata', session.id);
      return NextResponse.json({ received: true });
    }

    const { db } = await connectToDatabase();

    // Idempotency gate (reuses same processed_webhooks collection)
    try {
      const check = await db.collection('processed_webhooks').updateOne(
        { _id: event.id },
        { $setOnInsert: { processedAt: new Date(), type: event.type, userId } },
        { upsert: true }
      );
      if (!check.upsertedId) {
        console.log(`Webhook ${event.id} already processed. Skipping.`);
        return NextResponse.json({ received: true });
      }
    } catch (e) {
      if (e?.code === 11000) return NextResponse.json({ received: true });
      throw e;
    }

    const { addCredits } = await import('@/lib/credits');
    const newBalance = await addCredits(userId, Number(creditsToAdd));
    console.log(`[credits] +${creditsToAdd} credits → user ${userId} (balance: ${newBalance})`);

    return NextResponse.json({ received: true });
  }

  // ─── Product order fulfillment (PaymentIntent) ───────────────────────────────
  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const paymentIntent = event.data.object;
  const { order_id, userId, creditsToAdd } = paymentIntent.metadata || {};

  // ── Credits purchase (PaymentIntent flow) ──────────────────────────────────
  if (userId && creditsToAdd) {
    const { db } = await connectToDatabase();

    try {
      const check = await db.collection('processed_webhooks').updateOne(
        { _id: event.id },
        { $setOnInsert: { processedAt: new Date(), type: event.type, userId } },
        { upsert: true }
      );
      if (!check.upsertedId) {
        console.log(`Webhook ${event.id} already processed. Skipping.`);
        return NextResponse.json({ received: true });
      }
    } catch (e) {
      if (e?.code === 11000) return NextResponse.json({ received: true });
      throw e;
    }

    const { addCredits } = await import('@/lib/credits');
    const newBalance = await addCredits(userId, Number(creditsToAdd));
    console.log(`[credits] +${creditsToAdd} credits → user ${userId} (balance: ${newBalance})`);
    return NextResponse.json({ received: true });
  }
  // ───────────────────────────────────────────────────────────────────────────

  try {
    const { db } = await connectToDatabase();

    // 1. Strict idempotency gate: one Stripe event processed once
    try {
      const webhookCheck = await db.collection('processed_webhooks').updateOne(
        { _id: event.id },
        {
          $setOnInsert: {
            processedAt: new Date(),
            type: event.type,
            orderId: order_id || null,
            paymentIntentId: paymentIntent.id,
          },
        },
        { upsert: true }
      );

      if (!webhookCheck.upsertedId) {
        console.log(`Webhook ${event.id} already processed. Skipping.`);
        return NextResponse.json({ received: true });
      }
    } catch (e) {
      if (e?.code === 11000) {
        console.log(`Webhook ${event.id} duplicate-key race. Skipping.`);
        return NextResponse.json({ received: true });
      }
      throw e;
    }

    if (!order_id) {
      throw new Error('No order_id found in Stripe metadata');
    }

    const orderData = await db.collection('orders').findOne({
      _id: new ObjectId(order_id),
    });

    if (!orderData) {
      throw new Error('Order not found in database');
    }

    // Secondary guard in case order was already finalized by another path
    if (orderData.status === 'paid') {
      console.log(`Order ${order_id} already marked paid. Skipping.`);
      return NextResponse.json({ received: true });
    }

    const resolvedItems = await Promise.all(
      (orderData.items || []).map(async (item) => {
        if (!item.productId || !ObjectId.isValid(item.productId)) {
          console.error(`[Order ${order_id}] Invalid productId on item:`, item.productId);
          return null;
        }

        const product = await db.collection('products').findOne({
          _id: new ObjectId(item.productId),
        });

        if (!product) {
          console.error(`[Order ${order_id}] Product not found: ${item.productId}`);
          return null;
        }

        const variantCandidates = [
          ...(product.variants || []),
          ...(product.variations || []),
          ...(product.baseProduct?.variants || []),
        ];

        const matchedVariant =
          variantCandidates.find((v) => String(v?.id ?? '') === String(item.variationId ?? '')) ||
          variantCandidates.find((v) => String(v?.variantId ?? '') === String(item.variationId ?? '')) ||
          variantCandidates.find((v) => String(v?.printfulId ?? '') === String(item.variationId ?? '')) ||
          variantCandidates.find((v) => String(v?.printful_id ?? '') === String(item.variationId ?? ''));

        const variantId =
          matchedVariant?.printfulId ??
          matchedVariant?.printful_id ??
          matchedVariant?.variantId ??
          matchedVariant?.id ??
          item.printfulVariantId ??
          item.sync_variant_id ??
          null;

        if (!variantId) {
          console.error(
            `[Order ${order_id}] Could not resolve Printful variant for product ${item.productId} variation ${item.variationId}`
          );
          return null;
        }

        return {
          variant_id: Number(variantId),
          quantity: Number(item.quantity || 1),
        };
      })
    );

    const printfulItems = resolvedItems.filter(Boolean);

    let printfulOrderId = null;
    let fulfillmentStatus = 'failed';
    let printfulError = null;

    // 3. Send to Printful
    if (printfulItems.length === 0) {
      printfulError = 'Order paid, but no valid Printful variant_id values were found.';
      console.error(`[Order ${order_id}] ${printfulError}`);
    } else {
      const printfulPayload = {
        //confirm: true, 
        recipient: {
          name: orderData.shippingInfo?.name,
          email: orderData.email,
          address1: orderData.shippingInfo?.address1,
          city: orderData.shippingInfo?.city,
          state_code: orderData.shippingInfo?.state_code,
          country_code: orderData.shippingInfo?.country_code,
          zip: orderData.shippingInfo?.zip,
        },
        items: printfulItems,
      };

      try {
        const headers = {
          Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        };

        if (process.env.PRINTFUL_STORE_ID) {
          headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
        }

        console.log('[Printful DEBUG] Payload:', JSON.stringify({
          payload: printfulPayload,
          headers: {
            'Content-Type': headers['Content-Type'],
            'X-PF-Store-Id': headers['X-PF-Store-Id'] || null,
            // Do NOT log Authorization value
          },
        }, null, 2));

        const pfRes = await fetch('https://api.printful.com/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(printfulPayload),
        });

        if (pfRes.ok) {
          const pfData = await pfRes.json();
          printfulOrderId = pfData?.result?.id ?? null;
          fulfillmentStatus = 'awaiting_approval';
        } else {
          fulfillmentStatus = 'failed';
          printfulError = await pfRes.text();
          console.error(`[Order ${order_id}] Printful API Error: ${printfulError}`);
        }
      } catch (networkErr) {
        fulfillmentStatus = 'failed';
        printfulError = `Network error connecting to Printful: ${networkErr.message}`;
        console.error(`[Order ${order_id}] ${printfulError}`);
      }
    }

    // 4. Update MongoDB with payment and fulfillment status
    await db.collection('orders').updateOne(
      { _id: new ObjectId(order_id) },
      {
        $set: {
          status: 'paid',
          fulfillmentStatus,
          printfulError,
          stripePaymentId: paymentIntent.id,
          stripeTaxCalculationId: paymentIntent.metadata?.stripe_tax_calculation_id || null,
          printfulOrderId,
          paidAt: new Date(),
        },
      }
    );

    // 5. Explicitly record the Stripe Tax Transaction
    if (paymentIntent.metadata?.stripe_tax_calculation_id) {
      try {
        const taxTx = await stripe.tax.transactions.createFromCalculation({
          calculation: paymentIntent.metadata.stripe_tax_calculation_id,
          reference: order_id, 
        });
        
        await db.collection('orders').updateOne(
          { _id: new ObjectId(order_id) },
          {
            $set: {
              stripeTaxTransactionId: taxTx.id,
              stripeTaxTransactionRecorded: true,
              stripeTaxTransactionError: null,
            },
          }
        );
        console.log(`[Order ${order_id}] Stripe Tax transaction recorded.`);
      } catch (taxErr) {
        await db.collection('orders').updateOne(
          { _id: new ObjectId(order_id) },
          {
            $set: {
              stripeTaxTransactionRecorded: false,
              stripeTaxTransactionError: taxErr.message,
            },
          }
        );
        console.error(`[Order ${order_id}] Failed to record tax transaction:`, taxErr.message);
      }
    }

  } catch (error) {
    console.error('WEBHOOK FULFILLMENT ERROR:', error);
  }

  return NextResponse.json({ received: true });
}