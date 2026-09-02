// lib/revenue-ledger-service.js

import {
  calculateIpLicenseAllocation,
  calculateProductRevenueAllocation,
} from './revenue-allocation.js';
import { createHeldRevenueLedgerRow } from './revenue-ledger.js';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getOrderId(order) {
  const orderId = order?._id ?? order?.id;

  if (orderId === null || orderId === undefined || orderId === '') {
    throw new TypeError('order._id or order.id is required');
  }

  return String(orderId);
}

function buildOrderItemFinancialSnapshot(item) {
  return {
    orderItemId: item.orderItemId,
    productId: item.productId,
    productVariantId: item.productVariantId,
    quantityOrdered: item.quantityOrdered,
    unitMerchandisePriceCents: item.unitMerchandisePriceCents,
    merchandiseSubtotalCents: item.merchandiseSubtotalCents,
    canonicalPricing: cloneJson(item.canonicalPricing ?? {}),
  };
}

function assertMatchingImmutableLedgerRow(existingRow, expectedRow) {
  const immutableFields = [
    'idempotencyKey',
    'orderId',
    'orderNumber',
    'orderItemId',
    'productId',
    'productVariantId',
    'quantity',
    'revenueType',
    'ipAssetId',
    'revenuePoolAppId',
    'revenueTokenAssetId',
    'currency',
    'grossLicenseFeeCents',
    'platformFeeCents',
    'allocationCents',
    'usdcAtomicUnits',
    'calculationVersion',
    'roundingPolicy',
    'status',
    'eligibilityEvent',
  ];

  for (const fieldName of immutableFields) {
    if (existingRow[fieldName] !== expectedRow[fieldName]) {
      throw new Error(
        `[revenue-ledger-service] Existing row immutable field mismatch: ${fieldName}`
      );
    }
  }

  if (
    JSON.stringify(existingRow.licenseSnapshot) !==
      JSON.stringify(expectedRow.licenseSnapshot) ||
    JSON.stringify(existingRow.productRevenuePoolSnapshot) !==
      JSON.stringify(expectedRow.productRevenuePoolSnapshot) ||
    JSON.stringify(existingRow.orderItemFinancialSnapshot) !==
      JSON.stringify(expectedRow.orderItemFinancialSnapshot)
  ) {
    throw new Error(
      '[revenue-ledger-service] Existing row immutable snapshot mismatch'
    );
  }
}

export async function createHeldRevenueLedgerEntriesForOrder({
  db,
  order,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (!order || order.status !== 'paid') {
    throw new Error(
      '[revenue-ledger-service] Order must be persisted with status "paid"'
    );
  }

  const orderId = getOrderId(order);
  const orderNumber = assertNonEmptyString(
    String(order.orderNumber),
    'order.orderNumber'
  );

  if (!Array.isArray(order.items)) {
    throw new TypeError('order.items must be an array');
  }

  const revenueLedger = db.collection('revenue_ledger');
  const results = [];

  for (const item of order.items) {
    const orderItemId = assertNonEmptyString(
      String(item?.orderItemId),
      'item.orderItemId'
    );

    const productId = assertNonEmptyString(
      String(item?.productId),
      'item.productId'
    );

    const productVariantId = assertNonEmptyString(
      String(item?.productVariantId),
      'item.productVariantId'
    );

    const quantity = Number(item?.quantityOrdered);

    if (!Array.isArray(item?.lockedLicensedRevenueTerms)) {
      throw new TypeError(
        `[revenue-ledger-service] item ${orderItemId} is missing lockedLicensedRevenueTerms`
      );
    }

    const orderItemFinancialSnapshot = buildOrderItemFinancialSnapshot(item);

    for (const licenseSnapshot of item.lockedLicensedRevenueTerms) {
      if (!licenseSnapshot?.requiresSettlement) {
        continue;
      }

      const allocation = calculateIpLicenseAllocation({
        quantity,
        licensingFeeCents: Number(licenseSnapshot.licensingFeeCents),
        platformFeeBps: Number(licenseSnapshot.platformFeeBps),
      });

      if (allocation.allocationCents === 0) {
        continue;
      }

      const row = createHeldRevenueLedgerRow({
        orderId,
        orderNumber,
        orderItemId,
        productId,
        productVariantId,
        quantity,

        revenueType: 'ip_license',
        sourceSnapshot: licenseSnapshot,

        ipAssetId: String(licenseSnapshot.ipAssetId),
        poolKey: assertNonEmptyString(
          String(licenseSnapshot.poolKey),
          'licenseSnapshot.poolKey'
        ),
        revenuePoolAppId: Number(licenseSnapshot.revenuePoolAppId),
        revenueTokenAssetId: Number(licenseSnapshot.revenueTokenAssetId),

        currency: order?.financialSnapshot?.currency ?? 'USD',
        grossLicenseFeeCents: allocation.licenseGrossCents,
        platformFeeCents: allocation.platformFeeCents,
        allocationCents: allocation.allocationCents,
        usdcAtomicUnits: allocation.usdcAtomicUnits,
        calculationVersion: allocation.calculationVersion,
        roundingPolicy: allocation.roundingPolicy,

        licenseSnapshot,
        orderItemFinancialSnapshot,

        eligibilityEvent:
          order?.settlementPolicySnapshot?.eligibilityEvent ?? 'delivered',
        now,
      });

      const upsertResult = await revenueLedger.updateOne(
        { idempotencyKey: row.idempotencyKey },
        { $setOnInsert: row },
        { upsert: true }
      );

      if (upsertResult.upsertedCount === 1) {
        results.push({
          idempotencyKey: row.idempotencyKey,
          created: true,
          allocationCents: row.allocationCents,
          usdcAtomicUnits: row.usdcAtomicUnits,
        });
        continue;
      }

      const existingRow = await revenueLedger.findOne({
        idempotencyKey: row.idempotencyKey,
      });

      if (!existingRow) {
        throw new Error(
          `[revenue-ledger-service] Ledger upsert did not create or return row: ${row.idempotencyKey}`
        );
      }

      assertMatchingImmutableLedgerRow(existingRow, row);

      results.push({
        idempotencyKey: row.idempotencyKey,
        created: false,
        allocationCents: existingRow.allocationCents,
        usdcAtomicUnits: existingRow.usdcAtomicUnits,
      });
    }

    const lockedProductRevenuePool = item?.lockedProductRevenuePool;

    if (lockedProductRevenuePool) {
    const canonicalPricing = item?.canonicalPricing;

    if (!canonicalPricing || typeof canonicalPricing !== 'object') {
      throw new TypeError(
        `[revenue-ledger-service] item ${orderItemId} is missing canonicalPricing`
      );
    }

    const productAllocation = calculateProductRevenueAllocation({
      quantity,
      unitMerchandisePriceCents: Number(item?.unitMerchandisePriceCents),
      unitBaseCostCents: Number(canonicalPricing.costCents),
      unitGrossIpLicenseCostCents: Number(
        canonicalPricing.lockedIpFeesCents
      ),
    });

      if (productAllocation.allocationCents > 0) {
        const productRow = createHeldRevenueLedgerRow({
          orderId,
          orderNumber,
          orderItemId,
          productId,
          productVariantId,
          quantity,

          revenueType: 'product_revenue',
          sourceSnapshot: lockedProductRevenuePool,

          ipAssetId: null,
          poolKey: assertNonEmptyString(
            String(lockedProductRevenuePool.poolKey),
            'item.lockedProductRevenuePool.poolKey'
          ),
          revenuePoolAppId: Number(
            lockedProductRevenuePool.revenuePoolAppId
          ),
          revenueTokenAssetId: Number(
            lockedProductRevenuePool.revenueTokenAssetId
          ),

          currency: order?.financialSnapshot?.currency ?? 'USD',
          grossLicenseFeeCents: productAllocation.allocationCents,
          platformFeeCents: productAllocation.platformFeeCents,
          allocationCents: productAllocation.allocationCents,
          usdcAtomicUnits: productAllocation.usdcAtomicUnits,
          calculationVersion: productAllocation.calculationVersion,
          roundingPolicy: productAllocation.roundingPolicy,

          licenseSnapshot: undefined,
          orderItemFinancialSnapshot,
          eligibilityEvent:
            order?.settlementPolicySnapshot?.eligibilityEvent ?? 'delivered',
          now,
        });

        const productUpsertResult = await revenueLedger.updateOne(
          { idempotencyKey: productRow.idempotencyKey },
          { $setOnInsert: productRow },
          { upsert: true }
        );

        if (productUpsertResult.upsertedCount === 1) {
          results.push({
            idempotencyKey: productRow.idempotencyKey,
            created: true,
            allocationCents: productRow.allocationCents,
            usdcAtomicUnits: productRow.usdcAtomicUnits,
          });
        } else {
          const existingProductRow = await revenueLedger.findOne({
            idempotencyKey: productRow.idempotencyKey,
          });

          if (!existingProductRow) {
            throw new Error(
              `[revenue-ledger-service] Ledger upsert did not create or return row: ${productRow.idempotencyKey}`
            );
          }

          assertMatchingImmutableLedgerRow(existingProductRow, productRow);

          results.push({
            idempotencyKey: productRow.idempotencyKey,
            created: false,
            allocationCents: existingProductRow.allocationCents,
            usdcAtomicUnits: existingProductRow.usdcAtomicUnits,
          });
        }
      }
    }
  }

  return {
    orderId,
    rows: results,
    createdCount: results.filter((result) => result.created).length,
    existingCount: results.filter((result) => !result.created).length,
  };
}