// Run this with: node scripts/setup-v2.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

// --- CONFIGURATION ---
const ALGOD_TOKEN = '';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = '';

const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941'); 

const APPROVAL_PROGRAM = `
#pragma version 8
txn ApplicationID
int 0
==
bnz main_l12

txn OnCompletion
int 4
==
bnz main_l11

txn OnCompletion
int 1
==
bnz main_l13

txna ApplicationArgs 0
byte "opt_in_asset"
==
bnz handle_opt_in

txna ApplicationArgs 0
byte "deposit"
==
bnz handle_deposit

err

handle_opt_in:
txn Sender
global CreatorAddress
==
assert
itxn_begin
int axfer
itxn_field TypeEnum
global CurrentApplicationAddress
itxn_field AssetReceiver
int 0
itxn_field AssetAmount
txna Assets 0
itxn_field XferAsset
itxn_submit
int 1
return

handle_deposit:
txn GroupIndex
int 1
-
gtxns TypeEnum
int axfer
==
assert
int 1
return

main_l11:
txn Sender
global CreatorAddress
==
return

main_l12:
int 1
return

main_l13:
int 1
return
`;

const CLEAR_PROGRAM = `#pragma version 8\nint 1\nreturn`;

async function main() {
    if (!process.env.METAWORK_PLATFORM_MNEMONIC) {
        throw new Error("❌ Error: METAWORK_PLATFORM_MNEMONIC is missing in .env.local");
    }

    const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Deploying Pool from: ${creator.addr}`);
    console.log(`🔹 Target USDC ID: ${USDC_ASSET_ID}`);

    // 2. COMPILE
    console.log("Compiling Smart Contract...");
    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();

    // 3. DEPLOY APP
    console.log("Deploying Application...");
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true; 

    const txn = algosdk.makeApplicationCreateTxnFromObject({
        sender: creator.addr,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        numGlobalByteSlices: 0,
        numGlobalInts: 0,
        numLocalByteSlices: 0,
        numLocalInts: 16, 
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId || sendRes.txID;

    if (!txId) {
        console.error("Raw Response:", sendRes);
        throw new Error("CRITICAL: No TXID returned from Node!");
    }

    console.log(`⏳ Transaction Sent! TXID: ${txId}`);

    const result = await algosdk.waitForConfirmation(algod, txId, 20);

    // --- FIX: CHECK EVERY POSSIBLE NAME FOR APP ID ---
    const rawAppId = result["application-index"] || result.applicationIndex || result["app-index"];

    if (!rawAppId) {
        console.error("❌ FULL CONFIRMATION OBJECT:", JSON.stringify(result, null, 2));
        throw new Error("Application Index NOT found in confirmation result (see log above)");
    }

    const appId = BigInt(rawAppId); 
    const appAddress = algosdk.getApplicationAddress(appId);

    console.log(`✅ App Deployed! ID: ${appId}`);
    console.log(`📍 App Address: ${appAddress}`);

    // 4. FUND APP (1 ALGO)
    console.log("💰 Funding App (1 ALGO)...");
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creator.addr,
        receiver: appAddress,
        amount: 1000000, 
        suggestedParams: { ...(await algod.getTransactionParams().do()), fee: 2000, flatFee: true }
    });
    const signedPay = payTxn.signTxn(creator.sk);
    const payRes = await algod.sendRawTransaction(signedPay).do();
    const payId = payRes.txid || payRes.txId || payRes.txID;
    await algosdk.waitForConfirmation(algod, payId, 20);

    // 5. AUTO OPT-IN
    console.log("🔗 Opting-In to USDC...");
    const optInTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creator.addr,
        appIndex: Number(appId), 
        appArgs: [new Uint8Array(Buffer.from("opt_in_asset"))],
        foreignAssets: [USDC_ASSET_ID],
        suggestedParams: { ...(await algod.getTransactionParams().do()), fee: 2000, flatFee: true }
    });

    const signedOptIn = optInTxn.signTxn(creator.sk);
    const optRes = await algod.sendRawTransaction(signedOptIn).do();
    const optId = optRes.txid || optRes.txId || optRes.txID;
    await algosdk.waitForConfirmation(algod, optId, 20);

    console.log("✅ SUCCESS!");
    console.log("------------------------------------------------");
    console.log(`NEXT_PUBLIC_REVENUE_POOL_APP_ID=${appId}`);
    console.log("------------------------------------------------");
}

main().catch(console.error);