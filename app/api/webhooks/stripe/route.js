import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { validateShippingCodes } from '@/lib/addressCodes';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function uniqueHttpUrls(values = []) {
  const seen = new Set();
  const out = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

function buildFallbackPrintFiles(product) {
  const placements = ['front', 'back', 'sleeve_right', 'sleeve_left'];

  const candidateUrls = uniqueHttpUrls([
    ...(Array.isArray(product?.mockups) ? product.mockups : []),
    product?.mockupUrl,
    product?.thumbnailUrl,
    product?.baseProduct?.thumbnailUrl,
  ]);

  if (candidateUrls.length === 0) {
    return [];
  }

  return placements
    .map((type, index) => {
      const url = candidateUrls[index] || candidateUrls[0];
      if (!url) return null;
      return { type, url };
    })
    .filter(Boolean);
}

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
      console.error(
        '[webhook] checkout.session.completed missing metadata',
        session.id
      );
      return NextResponse.json({ received: true });
    }

    const { db } = await connectToDatabase();

    // Idempotency gate
    try {
      const check = await db.collection('processed_webhooks').updateOne(
        { _id: event.id },
        {
          $setOnInsert: {
            processedAt: new Date(),
            type: event.type,
            userId,
          },
        },
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
    console.log(
      `[credits] +${creditsToAdd} credits → user ${userId} (balance: ${newBalance})`
    );

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
        {
          $setOnInsert: {
            processedAt: new Date(),
            type: event.type,
            userId,
          },
        },
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
    console.log(
      `[credits] +${creditsToAdd} credits → user ${userId} (balance: ${newBalance})`
    );
    return NextResponse.json({ received: true });
  }

  try {
    const { db } = await connectToDatabase();

    // 1. Strict idempotency gate
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

    if (orderData.printfulOrderId) {
      console.log(
        `[Order ${order_id}] Already sent to Printful as ${orderData.printfulOrderId}`
      );
      return NextResponse.json({ received: true });
    }

    // 2. Mark paid + preparing fulfillment
    await db.collection('orders').updateOne(
      { _id: new ObjectId(order_id) },
      {
        $set: {
          status: 'paid',
          fulfillmentStatus: 'submitting_to_printful',
          stripePaymentId: paymentIntent.id,
          stripeTaxCalculationId:
            paymentIntent.metadata?.stripe_tax_calculation_id || null,
          paidAt: new Date(),
        },
        $unset: {
          printfulError: '',
        },
      }
    );

    // 3. Resolve Printful items
    const resolvedItems = await Promise.all(
      (orderData.items || []).map(async (item) => {
        const productId = String(item.productId || '');
        if (
          !ObjectId.isValid(productId) ||
          String(new ObjectId(productId)) !== productId
        ) {
          console.error(
            `[Order ${order_id}] Invalid productId on item:`,
            item.productId
          );
          return null;
        }

        const product = await db.collection('products').findOne({
          _id: new ObjectId(productId),
        });

        if (!product) {
          console.error(
            `[Order ${order_id}] Product not found: ${item.productId}`
          );
          return null;
        }

        const variantCandidates = [
          ...(product.variants || []),
          ...(product.variations || []),
          ...(product.baseProduct?.variants || []),
        ];

        const hasUsableVariationId =
          item.variationId &&
          item.variationId !== 'undefined' &&
          item.variationId !== 'null';

        const matchedVariant = hasUsableVariationId
          ? (
              variantCandidates.find(
                (v) => String(v?.id ?? '') === String(item.variationId)
              ) ||
              variantCandidates.find(
                (v) => String(v?.variantId ?? '') === String(item.variationId)
              ) ||
              variantCandidates.find(
                (v) => String(v?.printfulId ?? '') === String(item.variationId)
              ) ||
              variantCandidates.find(
                (v) => String(v?.printful_id ?? '') === String(item.variationId)
              )
            )
          : null;

        const singleCandidate =
          variantCandidates.length === 1 ? variantCandidates[0] : null;

        const variantId =
          matchedVariant?.printfulId ??
          matchedVariant?.printful_id ??
          matchedVariant?.variantId ??
          matchedVariant?.id ??
          singleCandidate?.printfulId ??
          singleCandidate?.printful_id ??
          singleCandidate?.variantId ??
          singleCandidate?.id ??
          product.printfulVariantId ??
          product.printful_variant_id ??
          item.printfulVariantId ??
          item.sync_variant_id ??
          null;

        console.log('[Resolver] Order', order_id, 'item', item);
        console.log(
          '[Resolver] product',
          product?._id,
          'variantCandidates length',
          variantCandidates.length
        );
        console.log('[Resolver] matchedVariant', matchedVariant);
        console.log('[Resolver] singleCandidate', singleCandidate);
        console.log('[Resolver] chosen variantId', variantId);

        if (!variantId) {
          console.error(
            `[Order ${order_id}] Could not resolve Printful variant for product ${item.productId} variation ${item.variationId}`
          );
          return null;
        }

        const placementConfigs = Array.isArray(product.printfulPlacementConfigs)
        ? product.printfulPlacementConfigs
        : [];

      let files = placementConfigs.flatMap((placement) => {
        if (!placement?.placement || !Array.isArray(placement.layers)) {
          return [];
        }

        return placement.layers
          .map((layer) => {
            if (!layer?.url) return null;

            return {
              type: placement.placement,
              url: layer.url,
            };
          })
          .filter(Boolean);
      });

      console.log('[Resolver] placementConfigs', placementConfigs);
      console.log('[Resolver] files', files);

      if ((!files || files.length === 0) && product) {
        const fallbackFiles = buildFallbackPrintFiles(product);

        if (fallbackFiles.length > 0) {
          console.log('[Resolver] using fallback files', fallbackFiles);
          files = fallbackFiles;
        }
      }

      if (!files || files.length === 0) {
        console.log(`[Order ${order_id}] No print files found for product ${item.productId}`);
        return null;
      }

      return {
        variant_id: Number(variantId),
        quantity: Number(item.quantity || 1),
        retail_price: Number(
          item.priceSnapshot || item.unitPrice || 0
        ).toFixed(2),
        name: item.title || matchedVariant?.name || product?.title || 'Item',
        external_id: String(item.productId),
        files,
      };
      })
    );

    const printfulItems = resolvedItems.filter(Boolean);

    if (
      !orderData.shippingInfo?.name ||
      !orderData.shippingInfo?.address1 ||
      !orderData.shippingInfo?.phone ||
      !orderData.shippingInfo?.city ||
      !orderData.shippingInfo?.state_code ||
      !orderData.shippingInfo?.zip ||
      !orderData.shippingInfo?.country_code
    ) {
      throw new Error(`Order ${order_id} is missing required shipping info`);
    }

    const { country, state } = validateShippingCodes(orderData.shippingInfo);

    console.log(`[Order ${order_id}] Resolved items:`, resolvedItems);
    console.log(`[Order ${order_id}] Printful items:`, printfulItems);
    console.log(
      `[Order ${order_id}] Sending ${printfulItems.length} items to Printful`
    );

    let printfulOrderId = null;
    let fulfillmentStatus = 'failed';
    let printfulError = null;

    // 4. Send to Printful
    if (printfulItems.length === 0) {
      printfulError =
        'Order paid, but no fulfillable Printful items could be built.';
      console.error(`[Order ${order_id}] ${printfulError}`);
    } else {
      const printfulPayload = {
        external_id: String(orderData.orderNumber || orderData._id),
        recipient: {
          name: orderData.shippingInfo?.name,
          email: orderData.shippingInfo?.email || orderData.email,
          address1: orderData.shippingInfo?.address1,
          address2: orderData.shippingInfo?.address2 || undefined,
          city: orderData.shippingInfo?.city,
          state_code: state || undefined,
          country_code: country,
          zip: orderData.shippingInfo?.zip,
          phone: orderData.shippingInfo?.phone || undefined,
        },
        items: printfulItems,
        confirm: false,
      };

      try {
        const headers = {
          Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        };

        if (process.env.PRINTFUL_STORE_ID) {
          headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
        }

        console.log(
          '[Printful DEBUG] Payload:',
          JSON.stringify(
            {
              payload: printfulPayload,
              headers: {
                'Content-Type': headers['Content-Type'],
                'X-PF-Store-Id': headers['X-PF-Store-Id'] || null,
              },
            },
            null,
            2
          )
        );

        const pfRes = await fetch('https://api.printful.com/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(printfulPayload),
        });

        console.log(
          `[Order ${order_id}] Printful HTTP status:`,
          pfRes.status,
          pfRes.statusText
        );

        if (pfRes.ok) {
          const pfData = await pfRes.json();
          printfulOrderId = pfData?.result?.id ?? null;
          fulfillmentStatus = 'awaiting_approval';
        } else {
          fulfillmentStatus = 'failed';
          printfulError = await pfRes.text();
          console.error(
            `[Order ${order_id}] Printful API Error: ${printfulError}`
          );
        }
      } catch (networkErr) {
        fulfillmentStatus = 'failed';
        printfulError = `Network error connecting to Printful: ${networkErr.message}`;
        console.error(`[Order ${order_id}] ${printfulError}`);
      }
    }

    await db.collection('orders').updateOne(
      { _id: new ObjectId(order_id) },
      {
        $set: {
          fulfillmentStatus,
          printfulOrderId,
          printfulError,
        },
      }
    );

    // 5. Stripe Tax Transaction
    if (paymentIntent.metadata?.stripe_tax_calculation_id) {
      try {
        const taxTx = await stripe.tax.transactions.createFromCalculation({
          calculation: paymentIntent.metadata.stripe_tax_calculation_id,
          reference: order_id,
        });

        console.log(`[Order ${order_id}] Final fulfillment result`, {
          fulfillmentStatus,
          printfulOrderId,
          printfulError,
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
        console.error(
          `[Order ${order_id}] Failed to record tax transaction:`,
          taxErr.message
        );
      }
    }
  } catch (error) {
    console.error(`[Order ${order_id}] WEBHOOK FULFILLMENT ERROR:`, error);

    try {
      if (order_id) {
        const { db } = await connectToDatabase();
        await db.collection('orders').updateOne(
          { _id: new ObjectId(order_id) },
          {
            $set: {
              fulfillmentStatus: 'failed',
              printfulError: error?.message || 'Unknown fulfillment error',
            },
          }
        );
      }
    } catch (persistErr) {
      console.error(
        `[Order ${order_id}] Failed to persist fulfillment error:`,
        persistErr
      );
    }
  }

  return NextResponse.json({ received: true });
}