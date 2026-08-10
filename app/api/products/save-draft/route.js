import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

function normalizePrintFileUrl(input) {
  if (!input) return input;
  const value = String(input).trim();

  if (/^https?:\/\//i.test(value)) {
    return value.replace("/ipfs/ipfs/", "/ipfs/");
  }

  const cleaned = value
    .replace(/^ipfs:\/\//i, "")
    .replace(/^ipfs\//i, "");

  return `https://gateway.pinata.cloud/ipfs/${cleaned}`;
}

// Refactored to fire-and-forget or execute rapidly without polling bottlenecks
async function generatePrintfulMockup(productId, templateId) {
  const token = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID || 18472468;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-PF-Store-Id": String(storeId),
  };

  const { db } = await connectToDatabase();

  // 1. Get template FIRST (Fast GET request)
  const templateRes = await fetch(
    `https://api.printful.com/product-templates/${templateId}`,
    { headers }
  );
  const templateData = await templateRes.json();
  if (!templateRes.ok) {
    throw new Error(`Template fetch failed: ${JSON.stringify(templateData)}`);
  }
  const template = templateData.result;

  console.log(
    "PRINTFUL TEMPLATE DEBUG",
    JSON.stringify(
      {
        templateId,
        product_id: template.product_id,
        available_variant_ids: template.available_variant_ids,
        placements: template.placements,
        templates: template.templates,
        product_options: template.product_options,
        option_data: template.option_data,
      },
      null,
      2
    )
  );

  const realProductId = template.product_id || template.productid || null;
  const availableVariants = template.available_variant_ids || [];
  if (!realProductId) throw new Error("Template missing productid");
  if (!availableVariants.length)
    throw new Error("Template has no available_variant_ids");
  const catalogId = realProductId;
  const variantId = availableVariants[0];

  // 2. Get product from DB
  const product = await db
    .collection("products")
    .findOne({ externalProductId: productId });

  const designAssets = Array.isArray(product?.designAssets)
    ? product.designAssets
    : [];

  const templatePlacements = Array.isArray(template.placements)
    ? template.placements
    : (template.templates || []).flatMap((t) => t.placements || []);

  const placementConfigs = templatePlacements
    .map((p) => {
      let rawLayers = p.layers || [];

      if (!rawLayers.length && p.options) {
        const fileOption = p.options.find(
          (o) =>
            o.value &&
            (String(o.value).includes("http") || o.id === "item_url")
        );
        if (fileOption) {
          rawLayers = [{ image_url: fileOption.value }];
        }
      }

      const validLayers = rawLayers
        .filter((l) => l && (l.image_url || l.url || l.item_url))
        .map((l) => ({
          type: "file",
          url: normalizePrintFileUrl(
            l.image_url || l.url || l.item_url
          ),
        }))
        .filter((l) => l.url);

      let determinedTechnique = p.technique_key || p.technique;

      if (!determinedTechnique) {
        const displayName = String(p.display_name || "").toLowerCase();
        const techniqueDisplay = String(
          p.technique_display_name || ""
        ).toLowerCase();

        if (
          displayName.includes("embroidery") ||
          techniqueDisplay.includes("embroider")
        ) {
          determinedTechnique = "EMBROIDERY";
        } else if (
          techniqueDisplay.includes("all-over") ||
          techniqueDisplay.includes("sublimation")
        ) {
          determinedTechnique = "CUT-SEW";
        }
      }

      const placementConfig = {
        placement: p.placement,
        layers: validLayers,
      };

      if (determinedTechnique) {
        placementConfig.technique = determinedTechnique;
      }

      return placementConfig;
    })
    .filter((p) => p.layers.length > 0);

  // Decide if we should ignore template placements and fall back to selectedIPs
  const uniquePlacementUrls = new Set(
    placementConfigs
      .flatMap((p) => (p.layers || []).map((l) => l.url))
      .filter(Boolean)
  );

  const shouldUseSelectedIPsFallback =
    placementConfigs.length === 0 || uniquePlacementUrls.size <= 1;

  // Fallback when EDM template has zero useful image layers OR all placements share the same image
  if (shouldUseSelectedIPsFallback && product?.selectedIPs?.[0]) {
    // clear any same-image template configs before rebuilding from selectedIPs
    placementConfigs.length = 0;

    let baseTemplateTechnique =
      templatePlacements[0]?.technique_key ||
      templatePlacements[0]?.technique;
    if (!baseTemplateTechnique && templatePlacements[0]) {
      const techniqueDisplay = String(
        templatePlacements[0].technique_display_name || ""
      ).toLowerCase();
      if (
        techniqueDisplay.includes("all-over") ||
        techniqueDisplay.includes("sublimation")
      ) {
        baseTemplateTechnique = "CUT-SEW";
      } else if (techniqueDisplay.includes("embroider")) {
        baseTemplateTechnique = "EMBROIDERY";
      }
    }

    const placementTargets =
      templatePlacements.length > 0
        ? templatePlacements.map((tp) => tp.placement)
        : ["front", "back"];

    placementTargets.forEach((placementName, index) => {
      const ip =
        product.selectedIPs[index] || product.selectedIPs[0];
      const fallbackUrl = normalizePrintFileUrl(
        ip?.publicUrl ||
          ip?.thumbnailUrl ||
          ip?.url ||
          ip?.imageUrl ||
          null
      );

      if (!fallbackUrl) return;

      const placementConfig = {
        placement: placementName,
        layers: [
          {
            type: "file",
            url: fallbackUrl,
          },
        ],
      };

      if (baseTemplateTechnique) {
        placementConfig.technique = baseTemplateTechnique;
      }

      placementConfigs.push(placementConfig);
    });
  }

  // Fallback 2: use designAssets when template + selectedIPs provide no usable images
  if (placementConfigs.length === 0 && designAssets.length > 0) {
    const byPlacement = designAssets.reduce((map, asset) => {
      const key =
        asset.placementName || asset.placement || "front";
      if (!map[key]) map[key] = [];
      map[key].push(asset);
      return map;
    }, {});

    const placementTargets =
      templatePlacements.length > 0
        ? templatePlacements.map((tp) => tp.placement)
        : Object.keys(byPlacement);

    placementTargets.forEach((placementName) => {
      const placementAssets =
        byPlacement[placementName] || byPlacement["front"] || [];
      if (!placementAssets.length) return;

      const layers = placementAssets
        .map((asset) => {
          const url = normalizePrintFileUrl(
            asset.normalizedUrl ||
              asset.originalUrl ||
              asset.url ||
              asset.imageUrl ||
              null
          );
          if (!url) return null;
          return { type: "file", url };
        })
        .filter(Boolean);

      if (!layers.length) return;

      const anyAsset = placementAssets[0];
      let technique =
        templatePlacements.find(
          (tp) => tp.placement === placementName
        )?.technique_key ||
        templatePlacements.find(
          (tp) => tp.placement === placementName
        )?.technique ||
        anyAsset?.technique ||
        null;

      const placementConfig = {
        placement: placementName,
        layers,
      };

      if (technique) {
        placementConfig.technique = technique;
      }

      placementConfigs.push(placementConfig);
    });
  }

  if (placementConfigs.length === 0) {
    console.warn(
      "❌ No placements with images found in template OR selectedIPs OR designAssets"
    );
    return { mockupUrl: null, placementConfigs: [] };
  }

  // Build options blueprint
  const allowedProductOptions = Array.isArray(template.product?.options)
    ? template.product.options.map((o) =>
        String(o.id || o.name).toLowerCase()
      )
    : [];

  const rawOptions = [
    ...(template.product_options || []).map((opt) => ({
      id: opt.id || opt.name,
      value: opt.value,
    })),
    ...(Array.isArray(template.option_data?.[0])
      ? template.option_data[0]
      : template.option_data || []),
  ];

  const productOptions = rawOptions
    .map((opt) => ({
      name: opt?.id || opt?.name,
      value: opt?.value,
    }))
        .filter((opt) => {
      if (
        !opt.name ||
        opt.value === undefined ||
        opt.value === null ||
        opt.value === ""
      )
        return false;
      if (allowedProductOptions.length === 0) {
        const isEmbroideryTech = placementConfigs.some(
          (p) => p.technique === "EMBROIDERY"
        );
        const isEmbroideryThreadOption =
          opt.name.includes("thread_color") ||
          opt.name.includes("thread_colors") ||
          opt.name === "thread";
        if (!isEmbroideryTech && isEmbroideryThreadOption) return false;
        return true;
      }
      return allowedProductOptions.includes(
        String(opt.name).toLowerCase()
      );
    });

  const body = {
    format: "png",
    products: [
      {
        source: "catalog",
        catalog_product_id: catalogId,
        catalog_variant_ids: [variantId],
        product_options: productOptions,
        placements: placementConfigs,
      },
    ],
  };

  // Dispatch the generation task asynchronously, but DO NOT poll it synchronously
  try {
    fetch("https://api.printful.com/v2/mockup-tasks", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }).catch((err) =>
      console.error("Background mockup task error:", err)
    );
  } catch (err) {
    console.error("Failed to dispatch async mockup task:", err);
  }

  return {
    mockupUrl: template.mockup_file_url || null,
    placementConfigs,
    productOptions,
  };
}

const ENSURE_SYNC_PATH = "/api/products/ensure-sync";

const PLATFORM_LICENSE_FEE_BPS = 2000;

const PLATFORM_BASE_MARKUP_BPS = 2000; // 20%
const PLATFORM_BASE_FIXED_FEE_CENTS = 200; // $2.00

const toCents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => Number((value / 100).toFixed(2));

const EDM_TO_PRINTFUL_PLACEMENT = {
  front: ["front", "default", "dtg_front", "embroidery_front"],
  back: ["back", "dtg_back", "embroidery_back"],
  sleeve_right: [
    "sleeve_right",
    "right_sleeve",
    "embroidery_right",
    "front_sleeve_right",
  ],
  sleeve_left: [
    "sleeve_left",
    "left_sleeve",
    "embroidery_left",
    "front_sleeve_left",
  ],
};

function getCanonicalPlacementCostCents(blankProduct, baseProduct) {
  const placementConfigs = Array.isArray(baseProduct?.printfulPlacementConfigs)
    ? baseProduct.printfulPlacementConfigs
    : [];

  const usedPrintfulPlacementTypes = new Set();

  placementConfigs
    .map((config) => config?.placement)
    .filter(Boolean)
    .forEach((placement) => {
      (EDM_TO_PRINTFUL_PLACEMENT[placement] || []).forEach((type) =>
        usedPrintfulPlacementTypes.add(type)
      );
    });

  if (usedPrintfulPlacementTypes.size === 0) {
    return 0;
  }

  return (Array.isArray(blankProduct?.printFiles)
    ? blankProduct.printFiles
    : []
  ).reduce((total, printFile) => {
    if (
      !printFile ||
      printFile.type === "mockup" ||
      !usedPrintfulPlacementTypes.has(printFile.type)
    ) {
      return total;
    }

    return total + Math.max(0, toCents(printFile.additional_price));
  }, 0);
}

function buildPricedVariants({
  blankProduct,
  baseProduct,
  licensedRevenueTerms,
}) {
  const sourceVariants = Array.isArray(blankProduct?.variants)
    ? blankProduct.variants.filter((variant) => variant?.inStock !== false)
    : [];

  if (sourceVariants.length === 0) {
    throw new Error("Selected blank product has no sellable variants.");
  }

  const placementCostCents = getCanonicalPlacementCostCents(
    blankProduct,
    baseProduct
  );

  const lockedIpFeeCents = (Array.isArray(licensedRevenueTerms)
    ? licensedRevenueTerms
    : []
  ).reduce(
    (total, term) => total + Math.max(0, Number(term?.licensingFeeCents || 0)),
    0
  );

  return sourceVariants.map((sourceVariant) => {
    const rawPrintfulPrice = sourceVariant.price;

    if (
      rawPrintfulPrice === undefined ||
      rawPrintfulPrice === null ||
      rawPrintfulPrice === ""
    ) {
      throw new Error(
        `Blank product variant ${sourceVariant.variantId || sourceVariant.id || ""} is missing a Printful price.`
      );
    }

    const printfulCostCents = toCents(rawPrintfulPrice);

    if (!Number.isSafeInteger(printfulCostCents) || printfulCostCents < 0) {
      throw new Error(
        `Blank product variant ${sourceVariant.variantId || sourceVariant.id || ""} has an invalid Printful price.`
      );
    }

    const metaWorkMarkupCents = Math.round(
      (printfulCostCents * PLATFORM_BASE_MARKUP_BPS) / 10000
    );

    const costCents =
      printfulCostCents +
      metaWorkMarkupCents +
      PLATFORM_BASE_FIXED_FEE_CENTS +
      placementCostCents;

    const retailPriceCents = costCents + lockedIpFeeCents;
    const printfulVariantId =
      sourceVariant.variantId ?? sourceVariant.printful_id ?? sourceVariant.id;

    return {
      ...sourceVariant,
      id: printfulVariantId,
      variantId: printfulVariantId,
      variant_id: printfulVariantId,
      printful_id: printfulVariantId,
      printfulCost: fromCents(printfulCostCents),
      placementCost: fromCents(placementCostCents),
      metaWorkMarkup: fromCents(
        metaWorkMarkupCents + PLATFORM_BASE_FIXED_FEE_CENTS
      ),
      lockedIpFees: fromCents(lockedIpFeeCents),
      cost: fromCents(costCents),
      retail_price: fromCents(retailPriceCents),
    };
  });
}

async function buildLockedRevenueTerms({
  db,
  selectedIPs,
  existingLockedTerms,
  productOwnerId,
  lockedAt,
}) {
  const requestedIpAssetIds = [
    ...new Set(
      (Array.isArray(selectedIPs) ? selectedIPs : [])
        .map((ip) => String(ip?.ipId || ip?.id || "").trim())
        .filter(Boolean)
    ),
  ];

  if (requestedIpAssetIds.length === 0) {
    return [];
  }

  const ipAssets = await db
    .collection("ip_assets")
    .find(
      { id: { $in: requestedIpAssetIds } },
      {
        projection: {
          id: 1,
          ownerId: 1,
          isPublic: 1,
          licensable: 1,
          licensingFeeCents: 1,
          status: 1,
          revenuePoolAppId: 1,
          revenueTokenAssetId: 1,
        },
      }
    )
    .toArray();

  const ipAssetById = new Map(ipAssets.map((ipAsset) => [ipAsset.id, ipAsset]));

  const existingTermByIpAssetId = new Map(
    (Array.isArray(existingLockedTerms) ? existingLockedTerms : [])
      .filter((term) => term?.ipAssetId)
      .map((term) => [String(term.ipAssetId), term])
  );

  return requestedIpAssetIds.map((ipAssetId) => {
    const ipAsset = ipAssetById.get(ipAssetId);

    if (!ipAsset) {
      throw new Error(`Selected IP asset was not found: ${ipAssetId}`);
    }

    if (ipAsset.status !== "active") {
      throw new Error(
        `Selected IP asset is not active and cannot be licensed: ${ipAssetId}`
      );
    }

    if (
      !Number.isSafeInteger(ipAsset.revenuePoolAppId) ||
      ipAsset.revenuePoolAppId <= 0 ||
      !Number.isSafeInteger(ipAsset.revenueTokenAssetId) ||
      ipAsset.revenueTokenAssetId <= 0
    ) {
      throw new Error(
        `Selected IP asset does not have an active V7 revenue pool: ${ipAssetId}`
      );
    }

    const isProductOwner = String(ipAsset.ownerId) === String(productOwnerId);

    if (!ipAsset.isPublic && !isProductOwner) {
      throw new Error(
        `Private IP asset cannot be licensed by another product creator: ${ipAssetId}`
      );
    }

    if (ipAsset.isPublic && ipAsset.licensable !== true) {
      throw new Error(
        `Public IP asset is not available for licensing: ${ipAssetId}`
      );
    }

    const existingTerm = existingTermByIpAssetId.get(ipAssetId);

    if (existingTerm) {
      if (
        !Number.isSafeInteger(existingTerm.licensingFeeCents) ||
        existingTerm.licensingFeeCents < 0 ||
        !Number.isSafeInteger(existingTerm.platformFeeBps) ||
        existingTerm.platformFeeBps < 0
      ) {
        throw new Error(
          `Existing locked license term is invalid for IP asset: ${ipAssetId}`
        );
      }

      const revenuePoolAppId =
        Number.isSafeInteger(existingTerm.revenuePoolAppId) &&
        existingTerm.revenuePoolAppId > 0
          ? existingTerm.revenuePoolAppId
          : ipAsset.revenuePoolAppId;

      const revenueTokenAssetId =
        Number.isSafeInteger(existingTerm.revenueTokenAssetId) &&
        existingTerm.revenueTokenAssetId > 0
          ? existingTerm.revenueTokenAssetId
          : ipAsset.revenueTokenAssetId;

      return {
        ipAssetId,
        licensingFeeCents: existingTerm.licensingFeeCents,
        platformFeeBps: existingTerm.platformFeeBps,
        requiresSettlement: existingTerm.licensingFeeCents > 0,
        revenuePoolAppId,
        revenueTokenAssetId,
        lockedAt: existingTerm.lockedAt
          ? new Date(existingTerm.lockedAt)
          : new Date(lockedAt),
      };
    }

    if (
      !Number.isSafeInteger(ipAsset.licensingFeeCents) ||
      ipAsset.licensingFeeCents < 0
    ) {
      throw new Error(
        `Selected IP asset is missing a valid canonical licensing fee: ${ipAssetId}`
      );
    }

    return {
      ipAssetId,
      licensingFeeCents: ipAsset.licensingFeeCents,
      platformFeeBps: PLATFORM_LICENSE_FEE_BPS,
      requiresSettlement: ipAsset.licensingFeeCents > 0,
      revenuePoolAppId: ipAsset.revenuePoolAppId,
      revenueTokenAssetId: ipAsset.revenueTokenAssetId,
      lockedAt: new Date(lockedAt),
    };
  });
}

export const dynamic = "force-dynamic";

const DISABLED_REVENUE_CONFIGURATION = Object.freeze({
  enabled: false,
  destinationType: "ip_pool",
  ipAssetId: null,
});

async function normalizeRevenueConfiguration(db, revenueConfiguration) {
  if (revenueConfiguration === undefined) {
    return undefined;
  }

  if (
    !revenueConfiguration ||
    typeof revenueConfiguration !== "object" ||
    Array.isArray(revenueConfiguration)
  ) {
    throw new Error("revenueConfiguration must be an object");
  }

  if (revenueConfiguration.enabled !== true) {
    return { ...DISABLED_REVENUE_CONFIGURATION };
  }

  if (revenueConfiguration.destinationType !== "ip_pool") {
    throw new Error("Only ip_pool revenue destinations are currently supported");
  }

  const requestedIpAssetId = String(
    revenueConfiguration.ipAssetId || ""
  ).trim();

  if (!requestedIpAssetId) {
    throw new Error(
      "revenueConfiguration.ipAssetId is required when revenue is enabled"
    );
  }

  const ipAsset = await db.collection("ip_assets").findOne(
    {
      id: requestedIpAssetId,
      status: "active",
    },
    {
      projection: {
        id: 1,
        revenuePoolAppId: 1,
        revenueTokenAssetId: 1,
      },
    }
  );

  if (!ipAsset) {
    throw new Error(
      "Revenue destination IP was not found or is not active"
    );
  }

  if (
    !Number.isSafeInteger(ipAsset.revenuePoolAppId) ||
    ipAsset.revenuePoolAppId <= 0 ||
    !Number.isSafeInteger(ipAsset.revenueTokenAssetId) ||
    ipAsset.revenueTokenAssetId <= 0
  ) {
    throw new Error(
      "Revenue destination IP does not have a valid active V7 pool configuration"
    );
  }

  return {
    enabled: true,
    destinationType: "ip_pool",
    ipAssetId: ipAsset.id,
  };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie");
    const authCookie =
      cookieHeader?.match(/auth_token=([^;]+)/)?.[1] || null;
    const token =
      authHeader?.substring(7) || authCookie;

    if (!token)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );

    const body = await request.json();
    const {
      externalProductId,
      printfulTemplateId,
      selectedIPs,
      baseProduct,
      name,
      costAnalysis,
      originalPlacementAssets,
      revenueConfiguration,
    } = body;

    console.log(
      "[save-draft] incoming originalPlacementAssets",
      originalPlacementAssets
    );

    if (!externalProductId || !baseProduct) {
      return NextResponse.json(
        { error: "externalProductId and baseProduct are required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const products = db.collection("products");
    const now = new Date();

    const existingProduct = await products.findOne({
      userId: decoded.userId,
      externalProductId,
    });

    const submittedSelectedIPs = Array.isArray(selectedIPs)
      ? selectedIPs
      : [];

    const hasExistingLockedRevenueTerms =
      Array.isArray(existingProduct?.licensedRevenueTerms) &&
      existingProduct.licensedRevenueTerms.length > 0;

    const preserveExistingLicenseState =
      Boolean(existingProduct) &&
      submittedSelectedIPs.length === 0 &&
      hasExistingLockedRevenueTerms;

    const effectiveSelectedIPs = preserveExistingLicenseState
      ? Array.isArray(existingProduct.selectedIPs)
        ? existingProduct.selectedIPs
        : []
      : submittedSelectedIPs;

    const licensedRevenueTerms = preserveExistingLicenseState
      ? existingProduct.licensedRevenueTerms
      : await buildLockedRevenueTerms({
          db,
          selectedIPs: effectiveSelectedIPs,
          existingLockedTerms: existingProduct?.licensedRevenueTerms,
          productOwnerId: decoded.userId,
          lockedAt: now,
        });

    const normalizedRevenueConfiguration =
      await normalizeRevenueConfiguration(db, revenueConfiguration);

    const revenueConfigurationUpdate =
      normalizedRevenueConfiguration !== undefined
        ? { revenueConfiguration: normalizedRevenueConfiguration }
        : existingProduct
          ? {}
          : {
              revenueConfiguration: {
                ...DISABLED_REVENUE_CONFIGURATION,
              },
            };

    const catalogProductId = Number(
      baseProduct?.catalogProductId ??
        baseProduct?.product_id ??
        baseProduct?.printfulProductId ??
        baseProduct?.productId
    );

    if (!Number.isSafeInteger(catalogProductId) || catalogProductId <= 0) {
      throw new Error("A valid catalogProductId is required to save this draft.");
    }

    const blankProduct = await db.collection("blank_products").findOne({
      catalogProductId,
      isActive: true,
    });

    if (!blankProduct) {
      throw new Error("Selected blank product was not found or is inactive.");
    }

    const variants = buildPricedVariants({
      blankProduct,
      baseProduct,
      licensedRevenueTerms,
    });

    const normalizedSelectedIPs = effectiveSelectedIPs.map((ip) => ({
      ...ip,
      ipId: ip.ipId || ip.id || null,
      licensingFee: Number(ip.licensingFee || 0),
      ownerId: ip.ownerId || null,
      ownerName: ip.ownerName || null,
      imageUrl: normalizePrintFileUrl(ip.imageUrl),
      thumbnailUrl: normalizePrintFileUrl(ip.thumbnailUrl),
      publicUrl: normalizePrintFileUrl(ip.publicUrl),
      url: normalizePrintFileUrl(ip.url),
    }));

    // licensed IPs are only those with a real library ipId (not synthetic uploads)
    const licensedIPs = normalizedSelectedIPs.filter(
      (ip) => ip.ipId
    );

    // normalize and persist per-placement EDM assets as unified designAssets
    // Support both old array shape and new object keyed by placement name.
    let placementAssetsArray = [];

    if (Array.isArray(originalPlacementAssets)) {
      placementAssetsArray = originalPlacementAssets;
    } else if (
      originalPlacementAssets &&
      typeof originalPlacementAssets === "object"
    ) {
      // e.g. { default: [asset,...], front: [asset,...] }
      placementAssetsArray = Object.values(originalPlacementAssets).flat();
    }

    // designAssets = library IP layers + EDM uploads
    const designAssets = placementAssetsArray
      .map((asset) => {
        if (!asset) return null;

        // Prefer asset.originalUrl if present, otherwise fall back to any URL-ish field
        const rawUrl =
          asset.originalUrl ||
          asset.normalizedUrl ||
          asset.url ||
          asset.imageUrl ||
          asset.item_url ||
          null;

        const normalizedUrl = normalizePrintFileUrl(rawUrl);
        if (!normalizedUrl) return null;

        // try to match this placement back to a licensed IP by URL
        const matchedIP = licensedIPs.find((ip) => {
          const ipUrl =
            ip.imageUrl ||
            ip.thumbnailUrl ||
            ip.publicUrl ||
            ip.url;
          if (!ipUrl) return false;
          const normIpUrl = normalizePrintFileUrl(ipUrl);
          return normIpUrl === normalizedUrl;
        });

        const base = {
          edmPlacementId:
            asset.edmPlacementId || asset.placementId || null,
          placementName: asset.placementName || asset.placement || null,
          originalUrl: rawUrl,
          normalizedUrl,
          technique: asset.technique || null,
        };

        if (matchedIP) {
          // Library IP layer
          return {
            ...base,
            kind: "library_ip",
            sourceType: "meta_library",
            ipId: matchedIP.ipId || matchedIP.id || null,
            licensingFee:
              matchedIP.licensingFee ??
              asset.licensingFee ??
              0,
            ownerId: matchedIP.ownerId || asset.ownerId || null,
            ownerName:
              matchedIP.ownerName || asset.ownerName || null,
          };
        }

        // EDM upload (no library IP match)
        return {
          ...base,
          kind: "upload",
          sourceType: "edm",
          ipId: asset.ipId || null,
          licensingFee: asset.licensingFee ?? 0,
          ownerId: asset.ownerId || null,
          ownerName: asset.ownerName || null,
        };
      })
      .filter(Boolean);

    console.log("[save-draft] computed designAssets", designAssets);

    const result = await products.findOneAndUpdate(
      { userId: decoded.userId, externalProductId },
      {
        $set: {
          userId: decoded.userId,
          externalProductId,
          catalogProductId,
          printfulTemplateId: printfulTemplateId || null,
          selectedIPs: normalizedSelectedIPs,
          licensedIPs, // explicit licensing summary for this product
          licensedRevenueTerms,

          // Unified design assets: library IPs + EDM uploads
          designAssets,

          // Overwrite originalPlacementAssets with normalized designAssets
          // so older readers still get a flat, consistent shape
          originalPlacementAssets: designAssets,

          // Mark this as the unified EDM v2 snapshot
          designStateVersion: "edm-v2",

          baseProduct,
          variants,
          pricingVersion: "v1",
          name:
            name ||
            baseProduct?.name ||
            "Untitled Design",
          costAnalysis: costAnalysis || null,
          ...revenueConfigurationUpdate,
          status: "draft",
          printfulSyncProductId:
            existingProduct?.printfulSyncProductId || null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    // Process layouts instantly without executing 3-minute polling delays
    if (printfulTemplateId) {
      try {
        console.log("🔍 Processing configurations instantly...", {
          externalProductId,
          templateId: printfulTemplateId,
        });
        const mockupResult = await generatePrintfulMockup(
          externalProductId,
          printfulTemplateId
        );

        if (mockupResult) {
          const update = {
            mockupUrl: mockupResult.mockupUrl || null,
          };

          if (
            Array.isArray(mockupResult.placementConfigs) &&
            mockupResult.placementConfigs.length > 0
          ) {
            update.printfulPlacementConfigs = mockupResult.placementConfigs;
          }

          if (
            Array.isArray(mockupResult.productOptions) &&
            mockupResult.productOptions.length > 0
          ) {
            update.printfulProductOptions = mockupResult.productOptions;
          }

          await products.updateOne(
            { externalProductId },
            { $set: update }
          );

          console.log(
            "[save-draft] updating mockup and placements",
            {
              externalProductId,
              placementConfigs:
                mockupResult?.placementConfigs,
            }
          );
        }
      } catch (e) {
        console.warn(
          "Configuration extraction warning:",
          e.message
        );
      }
    }

    // Background push to sync endpoints
    try {
      const vercelUrl = process.env.VERCEL_URL;
      const publicBaseUrl =
        process.env.NEXT_PUBLIC_BASE_URL;
      const baseUrl =
        publicBaseUrl ||
        (vercelUrl
          ? `https://${vercelUrl}`
          : "http://localhost:3000");

      const ensureSyncRes = await fetch(
        `${baseUrl}${ENSURE_SYNC_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader || `Bearer ${token}`,
          },
          body: JSON.stringify({ externalProductId }),
        }
      );

      const ensureSyncData = await ensureSyncRes.json();
      console.log("ensure-sync response", {
        status: ensureSyncRes.status,
        ok: ensureSyncRes.ok,
        data: ensureSyncData,
      });
    } catch (err) {
      console.error(
        "Error scheduling ensure-sync:",
        err
      );
    }

    return NextResponse.json(
      {
        success: true,
        draftId: result.value?._id?.toString(),
        externalProductId,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ save-draft error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save draft" },
      { status: 500 }
    );
  }
}