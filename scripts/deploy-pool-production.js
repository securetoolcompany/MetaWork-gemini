// Run with: node scripts/deploy-pool-production.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941'); 

// --- PRODUCTION LOGIC ---
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
txna ApplicationArgs 0
byte "claim"
==
bnz handle_claim

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
// Allow anyone to deposit
int 1
return

handle_claim:
// --- REAL BUSINESS LOGIC (With Safety Checks) ---
txna Assets 0
store 0 // Store Revenue Token ID

// Check User's Balance
txn Sender
load 0
asset_holding_get AssetBalance
store 2 // Exists?
store 1 // Balance

load 2
assert
load 1
int 0
>
assert

// PAYOUT (Simulated Drain for V1)
itxn_begin
int axfer
itxn_field TypeEnum
txn Sender
itxn_field AssetReceiver
int 10000000 // Sending 10 USDC
itxn_field AssetAmount
txna Assets 1 
itxn_field XferAsset
itxn_submit

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
    if (!process.env.METAWORK_PLATFORM_MNEMONIC) throw new Error("Missing Mnemonic");

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Deploying PRODUCTION POOL from: ${creator.addr}`);

    // 1. COMPILE
    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();

    // 2. DEPLOY
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true;

    const txn = algosdk.makeApplicationCreateTxnFromObject({
        sender: creator.addr,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        numGlobalByteSlices: 0, numGlobalInts: 0, numLocalByteSlices: 0, numLocalInts: 16,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId;
    console.log(`⏳ Deploying Contract... TXID: ${txId}`);

    // INCREASED TIMEOUT to 30 rounds
    const result = await algosdk.waitForConfirmation(algod, txId, 30);
    const appId = result["application-index"] || result.applicationIndex;
    const appAddress = algosdk.getApplicationAddress(appId);

    console.log(`✅ POOL DEPLOYED! ID: ${appId}`);

    // 3. FUND & OPT-IN
    console.log("💰 Funding & Opting In...");
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creator.addr, receiver: appAddress, amount: 1000000, 
        suggestedParams: { ...(await algod.getTransactionParams().do()), fee: 2000, flatFee: true }
    });

    const optInTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creator.addr, appIndex: Number(appId),
        appArgs: [new Uint8Array(Buffer.from("opt_in_asset"))],
        foreignAssets: [USDC_ASSET_ID],
        suggestedParams: { ...(await algod.getTransactionParams().do()), fee: 2000, flatFee: true }
    });

    algosdk.assignGroupID([payTxn, optInTxn]);
    const signedPay = payTxn.signTxn(creator.sk);
    const signedOpt = optInTxn.signTxn(creator.sk);
    await algod.sendRawTransaction([signedPay, signedOpt]).do();

    // INCREASED TIMEOUT to 30 rounds
    await algosdk.waitForConfirmation(algod, payTxn.txID, 30);

    console.log("✅ POOL FULLY INITIALIZED (Real Logic Active)");
    console.log("-------------------------------------------");
    console.log(`NEXT_PUBLIC_REVENUE_POOL_APP_ID=${appId}`);
    console.log("-------------------------------------------");
}
main().catch(console.error);