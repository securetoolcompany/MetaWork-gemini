// Run with: node scripts/deploy-registry-v2.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';

// Simple Registry that approves Registration
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

err

handle_register:
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
    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    console.log(`🚀 Deploying REGISTRY from: ${creator.addr}`);

    const compiledApproval = await algod.compile(Buffer.from(APPROVAL_PROGRAM)).do();
    const compiledClear = await algod.compile(Buffer.from(CLEAR_PROGRAM)).do();
    const params = await algod.getTransactionParams().do();
    params.fee = 2000; params.flatFee = true;

    const txn = algosdk.makeApplicationCreateTxnFromObject({
        sender: creator.addr,
        approvalProgram: new Uint8Array(Buffer.from(compiledApproval.result, "base64")),
        clearProgram: new Uint8Array(Buffer.from(compiledClear.result, "base64")),
        numGlobalByteSlices: 0, numGlobalInts: 0, numLocalByteSlices: 0, numLocalInts: 0,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params,
    });

    const signedTxn = txn.signTxn(creator.sk);
    const sendRes = await algod.sendRawTransaction(signedTxn).do();
    const txId = sendRes.txid || sendRes.txId;
    console.log(`⏳ Deploying... TXID: ${txId}`);

    const result = await algosdk.waitForConfirmation(algod, txId, 10);
    const appId = result["application-index"] || result.applicationIndex;

    console.log(`✅ REGISTRY DEPLOYED! ID: ${appId}`);
    console.log("-------------------------------------------");
    console.log(`NEXT_PUBLIC_REGISTRY_APP_ID=${appId}`);
    console.log("-------------------------------------------");
}
main().catch(console.error);