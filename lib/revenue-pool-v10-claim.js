import algosdk from "algosdk";

const encoder = new TextEncoder();

export function createV10PoolBoxName(poolKey) {
  return encoder.encode(`p_${poolKey}`);
}

export function createV10RoundBoxName(poolKey, roundId) {
  return Buffer.concat([
    Buffer.from(`rnd_${poolKey}`, "utf8"),
    Buffer.from(algosdk.encodeUint64(roundId)),
  ]);
}

export function buildUnsignedV10ClaimRevenueRoundTransaction({
  appId,
  poolKey,
  roundId,
  sender,
  suggestedParams,
}) {
  if (!Number.isSafeInteger(roundId) || roundId < 1) {
    throw new Error("roundId must be a positive safe integer");
  }

  return algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: appId,
    suggestedParams,
    appArgs: [
      encoder.encode("claim_revenue_round"),
      encoder.encode(poolKey),
      algosdk.encodeUint64(roundId),
    ],
    boxes: [
      { appIndex: 0, name: createV10PoolBoxName(poolKey) },
      { appIndex: 0, name: createV10RoundBoxName(poolKey, roundId) },
    ],
  });
}