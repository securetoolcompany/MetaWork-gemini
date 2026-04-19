// scripts/test-deposit-usdc.mjs
// Run with: node scripts/test-deposit-usdc.mjs

import algosdk from "algosdk";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const CREATOR_MNEMONIC = "color update panther cage purity alcohol able that asset series review comfort window car consider opinion ozone best bounce glare boil shadow invest absent day";
const IP_ASSET_ID = "ip_1767293382706_uu6p1";
// ────────────────────────────────────────────────────────────────────────────

const POOL_APP_ID  = 753007068;
const USDC_ASA_ID  = 10458941;
const DEPOSIT_AMOUNT = 20_000_000; // 20 USDC

const algodClient = new algosdk.Algodv2(
  "",
  "https://testnet-api.algonode.cloud",
  ""
);

async function main() {
  const account = algosdk.mnemonicToSecretKey(CREATOR_MNEMONIC);
  console.log("Wallet:", account.addr.toString());

  const params = await algodClient.getTransactionParams().do();

  // Replace the opt-in block with this:
const accountInfo = await algodClient.accountInformation(account.addr).do();
const hasUSDC = accountInfo.assets?.some(a => Number(a.assetId ?? a['asset-id']) === USDC_ASA_ID);

if (!hasUSDC) {
  console.log("Opting into USDC...");
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: USDC_ASA_ID,
    suggestedParams: params,
  });
  const signedOptIn = optInTxn.signTxn(account.sk);
  const { txid: optInTxid } = await algodClient.sendRawTransaction(signedOptIn).do();
  await algosdk.waitForConfirmation(algodClient, optInTxid, 10);
  console.log("✅ Opted into USDC");
} else {
  console.log("✅ Already opted into USDC, skipping");
}

  // ── Step 3: Deposit USDC into pool ────────────────────────────
  console.log("Depositing USDC...");
  const usdcTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: algosdk.getApplicationAddress(POOL_APP_ID),
    amount: DEPOSIT_AMOUNT,
    assetIndex: USDC_ASA_ID,
    suggestedParams: params,
  });

  const boxName = new Uint8Array(
    Buffer.concat([Buffer.from("p_"), Buffer.from(IP_ASSET_ID)])
  );

  const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: account.addr,
    appIndex: POOL_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from("deposit_usdc")),
      new Uint8Array(Buffer.from(IP_ASSET_ID)),
    ],
    foreignAssets: [USDC_ASA_ID],
    boxes: [{ appIndex: POOL_APP_ID, name: boxName }],
    suggestedParams: params,
  });

  algosdk.assignGroupID([usdcTxn, appTxn]);

  const signed = [
    usdcTxn.signTxn(account.sk),
    appTxn.signTxn(account.sk),
  ];

  const { txid } = await algodClient.sendRawTransaction(signed).do();
  console.log("Submitted! TxID:", txid);
  console.log(`https://testnet.explorer.perawallet.app/tx/${txid}/`);

  await algosdk.waitForConfirmation(algodClient, txid, 10);
  console.log("✅ Deposit confirmed! Check your USDC claim tab.");
}

main().catch(console.error);