import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { validateShippingCodes } from '@/lib/addressCodes';
import { createHeldRevenueLedgerEntriesForOrder } from '@/lib/revenue-ledger-service';

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

function getAllowedPlacementTypes(product) {
  const printFiles =
    product?.baseProduct?.printFiles ||
    product?.printFiles ||
    [];

  const excludedTypes = new Set(['mockup', 'label_inside', 'label_outside']);

  const allowed = printFiles
    .map((pf) => pf.type)
    .filter((type) => type && !excludedTypes.has(type));

  return allowed.length > 0 ? allowed : ['front'];
}

function buildFallbackPrintFiles(product) {
  const placements = getAllowedPlacementTypes(product);

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

function buildDefaultProductOptions(product) {
  const savedOptions = Array.isArray(product?.printfulProductOptions)
    ? product.printfulProductOptions
    : [];

  if (savedOptions.length > 0) {
    return savedOptions
      .map((opt) => ({
        id: opt?.id || opt?.name,
        value: opt?.value,
      }))
      .filter((opt) => opt.id && opt.value !== undefined && opt.value !== null);
  }

  // Fallback only for products saved before printfulProductOptions existed
  const optionDefs =
    product?.baseProduct?.options ||
    product?.options ||
    [];

  return optionDefs
    .filter((opt) => opt?.type === 'radio' && opt?.values)
    .map((opt) => {
      const firstValue = Object.keys(opt.values)[0];
      if (!firstValue) return null;
      return { id: opt.id, value: firstValue };
    })
    .filter(Boolean);
}

function normalizeVariantValue(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getOrderItemRetailPrice(item) {
  const cents = Number(
    item?.unitMerchandisePriceCents ??
      item?.canonicalPricing?.retailPriceCents
  );

  if (Number.isInteger(cents) && cents >= 0) {
    return (cents / 100).toFixed(2);
  }

  // Legacy-order fallback only. New checkout orders must use the cents snapshot.
  const legacyDollars = Number(
    item?.priceSnapshot ??
      item?.unitPrice ??
      item?.retail_price ??
      0
  );

  return Number.isFinite(legacyDollars) && legacyDollars >= 0
    ? legacyDollars.toFixed(2)
    : '0.00';
}

async function resolveLegacyTemplateVariantId({
  availableVariantIds,
  legacyVariation,
}) {
  const ids = (availableVariantIds || []).map(Number).filter(Number.isFinite);

  const selectedSize = normalizeVariantValue(
    legacyVariation?.attributes?.pa_size ??
      legacyVariation?.attributes?.size ??
      legacyVariation?.size
  );

  const selectedColor = normalizeVariantValue(
    legacyVariation?.attributes?.pa_color ??
      legacyVariation?.attributes?.color ??
      legacyVariation?.color
  );

  if (ids.length === 0 || (!selectedSize && !selectedColor)) {
    return null;
  }

  const candidates = await Promise.all(
    ids.map(async (candidateId) => {
      try {
        const response = await fetch(
          `https://api.printful.com/products/variant/${candidateId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
            },
            cache: 'no-store',
          }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const variant = data?.result?.variant || data?.result || {};

        return {
          id: candidateId,
          size: normalizeVariantValue(variant?.size),
          color: normalizeVariantValue(variant?.color),
        };
      } catch (error) {
        console.error(
          `[Legacy variant mapper] Failed to fetch catalog variant ${candidateId}:`,
          error.message
        );
        return null;
      }
    })
  );

  const matches = candidates.filter((candidate) => {
    if (!candidate) return false;

    const sizeMatches = !selectedSize || candidate.size === selectedSize;
    const colorMatches = !selectedColor || candidate.color === selectedColor;

    return sizeMatches && colorMatches;
  });

    console.log('[Template variant mapper]', {
    selectedSize,
    selectedColor,
    availableVariantIds: ids,
    candidates,
    matches,
  });

  return matches.length === 1 ? matches[0].id : null;
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

    // 2. Mark paid, create immutable held ledger rows, then prepare fulfillment.
    const paidAt = new Date();

    await db.collection('orders').updateOne(
      { _id: new ObjectId(order_id) },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'paid',
          fulfillmentStatus: 'submitting_to_printful',
          stripePaymentId: paymentIntent.id,
          stripeTaxCalculationId:
            paymentIntent.metadata?.stripe_tax_calculation_id || null,
          paidAt,
        },
        $unset: {
          printfulError: '',
        },
      }
    );

    const paidOrder = await db.collection('orders').findOne({
      _id: new ObjectId(order_id),
    });

    if (!paidOrder) {
      throw new Error(
        `[Order ${order_id}] Paid order could not be reloaded for ledger creation`
      );
    }

    try {
      const ledgerResult = await createHeldRevenueLedgerEntriesForOrder({
        db,
        order: paidOrder,
        now: paidAt,
      });

      await db.collection('orders').updateOne(
        { _id: new ObjectId(order_id) },
        {
          $set: {
            revenueLedgerStatus: 'created',
            revenueLedgerCreatedAt: paidAt,
            revenueLedgerRowCount: ledgerResult.rows.length,
            revenueLedgerLastError: null,
          },
        }
      );

      console.log(`[Order ${order_id}] Revenue ledger rows ensured`, {
        createdCount: ledgerResult.createdCount,
        existingCount: ledgerResult.existingCount,
        rowCount: ledgerResult.rows.length,
      });
    } catch (ledgerError) {
      await db.collection('orders').updateOne(
        { _id: new ObjectId(order_id) },
        {
          $set: {
            revenueLedgerStatus: 'failed',
            revenueLedgerFailedAt: new Date(),
            revenueLedgerLastError: ledgerError.message,
          },
        }
      );

      throw ledgerError;
    }

    // 3. Resolve Printful items
    const resolvedItems = await Promise.all(
      (orderData.items || []).map(async (item, index) => {
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

        const directCartVariantId = Number(
          item.catalogVariantId ??
            item.printful_id ??
            item.productVariantId ??
            item.variationId
        );

        const matchedVariantCatalogId = Number(
          matchedVariant?.catalogVariantId ??
            matchedVariant?.printfulId ??
            matchedVariant?.printful_id ??
            matchedVariant?.variantId ??
            matchedVariant?.id
        );

        const legacyFallbackVariantId = Number(
          singleCandidate?.catalogVariantId ??
            singleCandidate?.printfulId ??
            singleCandidate?.printful_id ??
            singleCandidate?.variantId ??
            singleCandidate?.id ??
            product.printfulVariantId ??
            product.printful_variant_id ??
            item.printfulVariantId
        );

        const variantId =
          Number.isInteger(directCartVariantId) && directCartVariantId > 0
            ? directCartVariantId
            : Number.isInteger(matchedVariantCatalogId) && matchedVariantCatalogId > 0
              ? matchedVariantCatalogId
              : Number.isInteger(legacyFallbackVariantId) && legacyFallbackVariantId > 0
                ? legacyFallbackVariantId
                : null;

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

        const syncVariantId =
          item.sync_variant_id ??
          item.syncVariantId ??
          matchedVariant?.sync_variant_id ??
          matchedVariant?.syncVariantId ??
          product?.sync_variant_id ??
          product?.syncVariantId ??
          null;

        if (syncVariantId && !product?.legacyMetadata) {
            console.log('[Resolver] using sync_variant_id', {
              order_id,
              productId: item.productId,
              syncVariantId,
            });
          return {
            sync_variant_id: Number(syncVariantId),
            quantity: Number(item.quantity || 1),
            retail_price: getOrderItemRetailPrice(item),
            name: item.title || matchedVariant?.name || product?.title || 'Item',
            external_id: String(item.orderItemId || item.productId),
          };
        }

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

      const canUseTemplateReference =
        (!files || files.length === 0) && Boolean(product?.printfulTemplateId);

      if ((!files || files.length === 0) && product && !canUseTemplateReference) {
        const fallbackFiles = buildFallbackPrintFiles(product);

        if (fallbackFiles.length > 0) {
          console.log('[Resolver] using fallback files', fallbackFiles);
          files = fallbackFiles;
        }
      }

      if ((!files || files.length === 0) && !canUseTemplateReference) {
        console.log(`[Order ${order_id}] No print files found for product ${item.productId}`);
        return null;
      }

            const options = buildDefaultProductOptions(product);

      const baseItem = {
        variant_id: Number(variantId),
        quantity: Number(item.quantity || 1),
        retail_price: getOrderItemRetailPrice(item),
        name: item.title || matchedVariant?.name || product?.title || 'Item',
        external_id: String(item.orderItemId || item.productId),
      };

      if (canUseTemplateReference) {
        console.log(
          `[Order ${order_id}] No placementConfigs for product ${item.productId}; ordering by product_template_id`,
          product.printfulTemplateId
        );

        let templateVariantId = Number(
          item.catalogVariantId ?? item.printful_id ?? variantId
        );

        if (!Number.isInteger(templateVariantId)) {
          throw new Error(
            `FULFILLMENT_REVIEW_REQUIRED: missing or invalid catalog variant ID for product ${productId}`
          );
        }

        if (product?.legacyMetadata) {
          const cachedCatalogVariantId = Number(
            matchedVariant?.printfulCatalogVariantId
          );

          const templateResponse = await fetch(
            `https://api.printful.com/product-templates/${product.printfulTemplateId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
              },
              cache: 'no-store',
            }
          );

          if (!templateResponse.ok) {
            throw new Error(
              `FULFILLMENT_REVIEW_REQUIRED: could not load Printful template ${product.printfulTemplateId}`
            );
          }

          const templateData = await templateResponse.json();
          const availableVariantIds =
            templateData?.result?.available_variant_ids || [];

          const allowedVariantIds = new Set(
            availableVariantIds.map(Number)
          );

          if (!allowedVariantIds.size) {
            throw new Error(
              `FULFILLMENT_REVIEW_REQUIRED: Printful template ${product.printfulTemplateId} has no available catalog variant IDs`
            );
          }
          
          // Fast path: this legacy variation has already been mapped and saved.
          if (
            Number.isFinite(cachedCatalogVariantId) &&
            cachedCatalogVariantId > 0
          ) {
            templateVariantId = cachedCatalogVariantId;

            if (!allowedVariantIds.has(templateVariantId)) {
              throw new Error(
                `FULFILLMENT_REJECTED: cached catalog variant ${templateVariantId} is not allowed by Printful template ${product.printfulTemplateId}`
              );
            }

            console.log(`[Order ${order_id}] Using cached legacy variant map`, {
              productId: item.productId,
              templateId: product.printfulTemplateId,
              legacyVariationId: variantId,
              printfulCatalogVariantId: templateVariantId,
            });
          } else {
            try {
              const currentVariantIsAllowed =
                Number.isInteger(templateVariantId) &&
                allowedVariantIds.has(templateVariantId);

              // Keep an already-approved template catalog variant. Otherwise, resolve
              // only when the saved shopper-facing size and color identify one exact
              // Printful catalog variant.
              if (!currentVariantIsAllowed) {
                const mappedVariantId = await resolveLegacyTemplateVariantId({
                  availableVariantIds,
                  legacyVariation: matchedVariant || {
                    id: item.variationId,
                    attributes: item.attributes || {},
                  },
                });

                if (!mappedVariantId) {
                  throw new Error(
                    `FULFILLMENT_REVIEW_REQUIRED: unable to map cart item ${
                      index + 1
                    } to a catalog variant allowed by Printful template ${
                      product.printfulTemplateId
                    }`
                  );
                }

                templateVariantId = Number(mappedVariantId);

                if (!allowedVariantIds.has(templateVariantId)) {
                  throw new Error(
                    `FULFILLMENT_REJECTED: remapped catalog variant ${templateVariantId} is not allowed by Printful template ${product.printfulTemplateId}`
                  );
                }

                console.log(`[Order ${order_id}] Legacy template variant remap`, {
                  productId: item.productId,
                  templateId: product.printfulTemplateId,
                  legacyVariationId: variantId,
                  legacyAttributes:
                    matchedVariant?.attributes || item.attributes || {},
                  printfulCatalogVariantId: templateVariantId,
                });

                // Save the resolved Printful catalog ID directly on this one
                // legacy WooCommerce variation. Future orders skip all catalog
                // variant lookup requests and use this value immediately.
                if (matchedVariant?.id) {
                  const persistResult = await db.collection('products').updateOne(
                    {
                      _id: product._id,
                      'variations.id': String(matchedVariant.id),
                    },
                    {
                      $set: {
                        'variations.$[variation].printfulCatalogVariantId':
                          templateVariantId,
                      },
                    },
                    {
                      arrayFilters: [
                        { 'variation.id': String(matchedVariant.id) },
                      ],
                    }
                  );

                  console.log(`[Order ${order_id}] Cached legacy variant map`, {
                    productId: item.productId,
                    legacyVariationId: matchedVariant.id,
                    printfulCatalogVariantId: templateVariantId,
                    modifiedCount: persistResult.modifiedCount,
                  });
                }
              } else {
                throw new Error(
                  `FULFILLMENT_REVIEW_REQUIRED: could not resolve legacy variation ${variantId} to an allowed catalog variant for Printful template ${product.printfulTemplateId}`
                );
              }
            } catch (templateError) {
              console.error(
                `[Order ${order_id}] Failed to resolve template variant for ${product.printfulTemplateId}:`,
                templateError.message
              );
              throw templateError;
            }
          }
        }

        else {
          const templateResponse = await fetch(
            `https://api.printful.com/product-templates/${product.printfulTemplateId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
              },
              cache: 'no-store',
            }
          );

          if (!templateResponse.ok) {
            throw new Error(
              `FULFILLMENT_REVIEW_REQUIRED: could not load Printful template ${product.printfulTemplateId}`
            );
          }

          const templateData = await templateResponse.json();
          const availableVariantIds =
            templateData?.result?.available_variant_ids || [];

          const allowedVariantIds = new Set(
            availableVariantIds.map(Number)
          );

          if (!allowedVariantIds.size) {
            throw new Error(
              `FULFILLMENT_REVIEW_REQUIRED: Printful template ${product.printfulTemplateId} has no available catalog variant IDs`
            );
          }

          const directCatalogVariantId = Number(
            item.catalogVariantId ??
              item.printful_id ??
              item.productVariantId ??
              item.variationId
          );

          const directCatalogVariantIsAllowed =
            Number.isInteger(directCatalogVariantId) &&
            allowedVariantIds.has(directCatalogVariantId);

          if (directCatalogVariantIsAllowed) {
            templateVariantId = directCatalogVariantId;

            console.log(`[Order ${order_id}] Using exact paid catalog variant`, {
              productId: item.productId,
              templateId: product.printfulTemplateId,
              variationId: item.variationId,
              selectedOptions: item.selectedOptions || {},
              printfulCatalogVariantId: templateVariantId,
            });
          } else {
            const mappedVariantId = await resolveLegacyTemplateVariantId({
              availableVariantIds,
              legacyVariation: {
                ...(matchedVariant || {}),
                id: item.variationId,
                attributes: {
                  ...(matchedVariant?.attributes || {}),
                  ...(item.attributes || {}),
                  pa_size:
                    item.selectedOptions?.size ??
                    matchedVariant?.attributes?.pa_size ??
                    matchedVariant?.size ??
                    null,
                  pa_color:
                    item.selectedOptions?.color ??
                    matchedVariant?.attributes?.pa_color ??
                    matchedVariant?.color ??
                    null,
                },
                size:
                  item.selectedOptions?.size ??
                  matchedVariant?.size ??
                  null,
                color:
                  item.selectedOptions?.color ??
                  matchedVariant?.color ??
                  null,
              },
            });

            if (!mappedVariantId) {
              throw new Error(
                `FULFILLMENT_REVIEW_REQUIRED: unable to map cart item ${
                  index + 1
                } to a catalog variant allowed by Printful template ${
                  product.printfulTemplateId
                }`
              );
            }

            templateVariantId = Number(mappedVariantId);

            if (!allowedVariantIds.has(templateVariantId)) {
              throw new Error(
                `FULFILLMENT_REJECTED: remapped catalog variant ${templateVariantId} is not allowed by Printful template ${product.printfulTemplateId}`
              );
            }

            console.log(`[Order ${order_id}] Template variant remap`, {
              productId: item.productId,
              templateId: product.printfulTemplateId,
              variationId: item.variationId,
              selectedOptions: item.selectedOptions || {},
              printfulCatalogVariantId: templateVariantId,
            });
          }
        }

        return {
          ...baseItem,
          variant_id: templateVariantId,
          product_template_id: Number(product.printfulTemplateId),
        };
      }

      return {
        ...baseItem,
        files,
        ...(options.length > 0 && { options }),
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