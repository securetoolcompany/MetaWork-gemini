// app/api/admin/asset-config/route.js
import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { connectToDatabase } from "@/lib/mongodb";
import { getAlgodClient, getSigner } from "@/lib/algorand";
import AssetConfigAudit from "@/lib/models/AssetConfigAudit";

function isAuthorized(request) {
  return request.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId, newManager, newReserve, newFreeze, newClawback } =
    await request.json();

  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const network = process.env.ALGORAND_NETWORK || "testnet";
  const algodClient = getAlgodClient(network);
  const signer = getSigner();

  // Fetch current asset info for audit log
  const assetInfo = await algodClient.getAssetByID(assetId).do();
  const params = assetInfo.params;

  const oldValues = {
    manager:  params.manager  || null,
    reserve:  params.reserve  || null,
    freeze:   params.freeze   || null,
    clawback: params.clawback || null,
  };

  // Build AssetConfigTxn
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
    from: signer.address,
    assetIndex: assetId,
    manager:  newManager  || params.manager,
    reserve:  newReserve  || params.reserve,
    freeze:   newFreeze   || params.freeze,
    clawback: newClawback || params.clawback,
    suggestedParams,
    strictEmptyAddressChecking: false,
  });

  const signedTxn = signer.signTxn(txn);
  const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
  await algosdk.waitForConfirmation(algodClient, txId, 4);

  // Write audit log
  await connectToDatabase();
  await AssetConfigAudit.create({
    assetId,
    network,
    oldValues,
    newValues: {
      manager:  newManager  || params.manager,
      reserve:  newReserve  || params.reserve,
      freeze:   newFreeze   || params.freeze,
      clawback: newClawback || params.clawback,
    },
    txId,
    timestamp: new Date(),
  });

  return NextResponse.json({ success: true, txId });
}