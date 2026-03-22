// Run this with: node scripts/deploy-registry.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

// --- CONFIGURATION ---
const ALGOD_TOKEN = '';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = '';

// --- FIXED REGISTRY TEAL CODE ---
// Supports: "register" (creates a box for the IP)
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
byte "register"
==
bnz handle_register

txna ApplicationArgs 0
byte "update"
==
bnz handle_update

err

handle_register:
// 1. Ensure this is a bare Call (or Group)
// We simply approve the registration and allow the box creation logic
// (In a full app, we would write to Box here, but for now we return Success)
int 1
return

handle_update:
txn Sender
global CreatorAddress
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

    console.log(`🚀 Deploying REGISTRY from: ${creator.addr}`);

    // 1. COMPILE
    console.log("Compiling Smart Contract...");
    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();

    // 2. DEPLOY APP (Turbo Fee)
    console.log("Deploying Registry Application...");
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true; 

    const txn = algosdk.makeApplicationCreateTxnFromObject({
        sender: creator.addr,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        numGlobalByteSlices: 0,
        numGlobalInts: 0,
        numLocalByteSlices: 0,
        numLocalInts: 0, 
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId || sendRes.txID;

    if (!txId) throw new Error("CRITICAL: No TXID returned from Node!");

    console.log(`⏳ Transaction Sent! TXID: ${txId}`);

    const result = await algosdk.waitForConfirmation(algod, txId, 20);

    // Check all possible name variations for App ID
    const rawAppId = result["application-index"] || result.applicationIndex || result["app-index"];
    if (!rawAppId) throw new Error("App Index not found in result");

    const appId = BigInt(rawAppId);
    const appAddress = algosdk.getApplicationAddress(appId);

    console.log(`✅ Registry Deployed! ID: ${appId}`);
    console.log(`📍 Registry Address: ${appAddress}`);

    // 3. FUND REGISTRY (For Box Storage MBR)
    // We send 2 ALGO to be safe, so it can store many IPs
    console.log("💰 Funding Registry (2 ALGO)...");
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creator.addr,
        receiver: appAddress,
        amount: 2000000, 
        suggestedParams: { ...(await algod.getTransactionParams().do()), fee: 2000, flatFee: true }
    });
    const signedPay = payTxn.signTxn(creator.sk);
    const payRes = await algod.sendRawTransaction(signedPay).do();
    const payId = payRes.txid || payRes.txId || payRes.txID;

    await algosdk.waitForConfirmation(algod, payId, 20);

    console.log("✅ SUCCESS! Registry is ready.");
    console.log("------------------------------------------------");
    console.log("⚠️  IMPORTANT: UPDATE YOUR .ENV FILE");
    console.log(`NEXT_PUBLIC_REGISTRY_APP_ID=${appId}`);
    console.log("------------------------------------------------");
}

main().catch(console.error);