// Run with: node scripts/initialize-pool.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941'); 

async function main() {
    const appId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);
    if (!appId) throw new Error("Missing NEXT_PUBLIC_REVENUE_POOL_APP_ID in .env");

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);
    const appAddress = algosdk.getApplicationAddress(appId);

    console.log(`🔧 Initializing Pool ID: ${appId}`);

    // --- CHECK STATUS FIRST ---
    // If the pool already has USDC, we stop early.
    try {
        const accountInfo = await algod.accountInformation(appAddress).do();
        const assets = accountInfo.assets || [];
        const hasUSDC = assets.some(a => a['asset-id'] === USDC_ASSET_ID);

        if (hasUSDC) {
            console.log("✅ SUCCESS! This pool is ALREADY opted-in to USDC.");
            console.log("You do not need to do anything else.");
            return;
        }
    } catch (e) {
        // Ignore error if account is new/empty
    }

    console.log("1️⃣  Sending 1 ALGO + Opt-In Command...");

    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true;

    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creator.addr, 
        receiver: appAddress, 
        amount: 1000000, 
        suggestedParams: params
    });

    const optInTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creator.addr, 
        appIndex: appId,
        appArgs: [new Uint8Array(Buffer.from("opt_in_asset"))],
        foreignAssets: [USDC_ASSET_ID],
        suggestedParams: params
    });

    algosdk.assignGroupID([payTxn, optInTxn]);
    const signedPay = payTxn.signTxn(creator.sk);
    const signedOpt = optInTxn.signTxn(creator.sk);

    try {
        const response = await algod.sendRawTransaction([signedPay, signedOpt]).do();
        // FIX: Check both casing possibilities
        const txId = response.txid || response.txId; 

        console.log(`⏳ Transaction Sent! TXID: ${txId}`);
        await algosdk.waitForConfirmation(algod, txId, 30);
        console.log("✅ SUCCESS! Pool initialized.");

    } catch (e) {
        if (e.message.includes("already opted in")) {
            console.log("✅ SUCCESS! (It was already done).");
        } else {
            console.error("❌ Error:", e.message);
        }
    }
}

main().catch(console.error);