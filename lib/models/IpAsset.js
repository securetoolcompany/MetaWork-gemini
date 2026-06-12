// lib/models/IpAsset.js  (add fields to your existing schema)
import mongoose from "mongoose";

const MintManifestSchema = new mongoose.Schema(
  {
    assetName: { type: String, required: true },
    unitName: { type: String, required: true },
    metadataUri: { type: String },       // ARC-3 metadata JSON URI
    imageUri: { type: String },          // ARC-3 image URI
    ipIdentifier: { type: String, required: true },
    shareholders: [
      {
        address: { type: String, required: true },
        bps: { type: Number, required: true },  // basis points, sum must = 10000
      },
    ],
    poolKey: { type: String },
    poolCreationParams: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const IpAssetSchema = new mongoose.Schema(
  {
    // ── Existing fields (keep yours here) ──────────────────────────────────

    // ── Lifecycle fields ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["quarantine", "live", "failed"],
      default: "quarantine",
      required: true,
    },
    clearsAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },

    // ── Algorand identifiers ───────────────────────────────────────────────
    testnetAssetId: { type: String, default: null },
    mainnetAssetId: { type: String, default: null },
    testnetAppId:   { type: String, default: null },
    mainnetAppId:   { type: String, default: null },

    // ── Mint manifest (source of truth for mainnet promotion) ─────────────
    mintManifest: { type: MintManifestSchema, required: true },

    // ── Promotion tracking ─────────────────────────────────────────────────
    promotionAttempts: { type: Number, default: 0 },
    lastPromotionError: { type: String, default: null },
  },
  { timestamps: true }
);

// Index for the cron query
IpAssetSchema.index({ status: 1, clearsAt: 1, mainnetAssetId: 1 });

export default mongoose.models.IpAsset ||
  mongoose.model("IpAsset", IpAssetSchema);