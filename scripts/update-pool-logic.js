// Run this with: node scripts/update-pool-logic.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

// --- CONFIGURATION ---
const ALGOD_TOKEN = '';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = '';

// Load the ID from env
const APP_ID = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);

// --- V6: SECURE LOGIC (Creator Only) ---
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

// --- SECURE CATCH-ALL ---
// Instead of letting *anyone* pass, we check if the 
// Sender is the App Creator.
txn Sender
global CreatorAddress
==
bnz handle_creator_action

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
// Allow deposits from anyone (ALGO or USDC)
int 1
return

handle_creator_action:
// This block handles "Claim" or any other unknown command.
// SECURITY: We only reach here if Sender == Creator.
// This allows YOU to test the frontend flow without
// letting hackers drain the pool.
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
    if (!APP_ID) throw new Error("Missing NEXT_PUBLIC_REVENUE_POOL_APP_ID in .env");

    const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Updating SECURE Logic for App ID: ${APP_ID}`);

    // Safety Check
    if (APP_ID === 752974933) {
        throw new Error("⛔ STALE ID DETECTED. Please restart your shell.");
    }

    // 1. COMPILE
    console.log("Compiling Smart Contract...");
    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();

    // 2. SEND UPDATE
    console.log("Sending Update Transaction...");
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true; 

    const txn = algosdk.makeApplicationUpdateTxnFromObject({
        sender: creator.addr,
        appIndex: APP_ID,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId || sendRes.txID;

    console.log(`⏳ Update Sent! TXID: ${txId}`);

    await algosdk.waitForConfirmation(algod, txId, 12);
    console.log("✅ SUCCESS! Contract upgraded. Only YOU (Creator) can claim/debug.");
}

main().catch(console.error);