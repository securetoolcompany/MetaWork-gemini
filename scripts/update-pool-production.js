// Run with: node scripts/update-pool-production.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';

// --- HYBRID LOGIC: Real Claims + Flexible Setup ---
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

// 1. Critical Financial Commands (Keep these Strict)
txna ApplicationArgs 0
byte "claim"
==
bnz handle_claim

txna ApplicationArgs 0
byte "deposit"
==
bnz handle_deposit

// 2. The "Minting Fix"
// If the command is NOT claim or deposit (e.g., "register", "link", "opt_in"),
// we approve it automatically. This prevents the Mint from crashing.
b handle_generic_approve

err

handle_deposit:
int 1
return

handle_generic_approve:
int 1
return

handle_claim:
// --- REAL CLAIM LOGIC (Unchanged) ---
// 1. Validate Token Ownership
txna Assets 0
store 0 
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

// 2. Payout (Simulated for V1)
itxn_begin
int axfer
itxn_field TypeEnum
txn Sender
itxn_field AssetReceiver
int 10000000 
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
    const appId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);
    if (!appId) throw new Error("Missing ID in .env");

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Updating Pool Logic for ID: ${appId}`);

    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true;

    const txn = algosdk.makeApplicationUpdateTxnFromObject({
        sender: creator.addr,
        appIndex: appId,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();

    // FIX: Check all possible casings for the ID
    const txId = sendRes.txid || sendRes.txId || sendRes.txID;
    console.log(`⏳ Update Sent! TXID: ${txId}`);

    await algosdk.waitForConfirmation(algod, txId, 30);
    console.log("✅ SUCCESS! Pool Logic Updated. Minting should now work.");
}

main().catch(console.error);