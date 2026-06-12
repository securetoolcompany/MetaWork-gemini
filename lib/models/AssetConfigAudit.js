// lib/models/AssetConfigAudit.js
import mongoose from "mongoose";

const AssetConfigAuditSchema = new mongoose.Schema(
  {
    assetId:  { type: Number, required: true },
    network:  { type: String, enum: ["testnet", "mainnet"], required: true },
    oldValues: {
      manager:  String,
      reserve:  String,
      freeze:   String,
      clawback: String,
    },
    newValues: {
      manager:  String,
      reserve:  String,
      freeze:   String,
      clawback: String,
    },
    txId:      { type: String, required: true },
    adminUser: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.AssetConfigAudit ||
  mongoose.model("AssetConfigAudit", AssetConfigAuditSchema);