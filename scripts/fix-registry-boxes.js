// Run with: node scripts/fix-registry-final.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';

// --- SEARCH MODE REGISTRY LOGIC ---
// Finds the Asset ID whether it is 1 step back OR 2 steps back.
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

// 1. CHECK ARGUMENTS (Explicit ID)
txn NumAppArgs
int 2
>=
bnz handle_arg_create

// 2. SEARCH GROUP FOR MINT
// If we are in a group, look for the Mint transaction.
txn GroupIndex
int 0
>
bnz handle_search_create

int 1
return

handle_arg_create:
txna ApplicationArgs 1
store 0 // Found ID in Arg 1
b create_box

handle_search_create:
// OPTION A: Check Immediate Neighbor (Index - 1)
txn GroupIndex
int 1
-
gtxns CreatedAssetID
store 0 

// If valid ID found (>0), create box
load 0
int 0
>
bnz create_box

// OPTION B: Check Neighbor's Neighbor (Index - 2)
// (Only possible if our index is >= 2)
txn GroupIndex
int 2
>=
bz generic_approve // If not enough txns, exit

txn GroupIndex
int 2
-
gtxns CreatedAssetID
store 0

// If valid ID found, create box. If not, just approve.
load 0
int 0
>
bnz create_box

b generic_approve

create_box:
load 0
itob // Convert to bytes
int 64
box_create
pop
int 1
return

generic_approve:
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
    const registryId = parseInt(process.env.NEXT_PUBLIC_REGISTRY_APP_ID);
    if (!registryId) throw new Error("Missing NEXT_PUBLIC_REGISTRY_APP_ID in .env");

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Updating Registry (Search Mode) for ID: ${registryId}`);

    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true;

    const txn = algosdk.makeApplicationUpdateTxnFromObject({
        sender: creator.addr,
        appIndex: registryId,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId || sendRes.txID;

    console.log(`⏳ Update Sent! TXID: ${txId}`);
    await algosdk.waitForConfirmation(algod, txId, 30);
    console.log("✅ SUCCESS! Registry will now search the group to find the Asset ID.");
}

main().catch(console.error);