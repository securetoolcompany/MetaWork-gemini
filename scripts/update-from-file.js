// Run with: node scripts/update-from-file.js
require('dotenv').config({ path: '.env.local' });
const algosdk = require('algosdk');
const fs = require('fs');
const path = require('path');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';

async function main() {
    const appId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);
    if (!appId) throw new Error("Missing ID in .env");

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, '');
    const creator = algosdk.mnemonicToSecretKey(process.env.METAWORK_PLATFORM_MNEMONIC);

    // 1. READ TEAL FILES
    const approvalPath = path.join(__dirname, '../contracts/revenue_pool_global_approval.teal');
    const clearPath = path.join(__dirname, '../contracts/revenue_pool_global_clear.teal');

    // Default Clear Program if file is empty/missing
    let clearSource = "#pragma version 8\nint 1\nreturn";
    if (fs.existsSync(clearPath)) {
        clearSource = fs.readFileSync(clearPath, 'utf8');
    }

    const approvalSource = fs.readFileSync(approvalPath, 'utf8');

    console.log(`🚀 Updating App ${appId} from file: ${approvalPath}`);

    // 2. COMPILE
    const compiledApproval = await algod.compile(Buffer.from(approvalSource)).do();
    const compiledClear = await algod.compile(Buffer.from(clearSource)).do();

    // 3. SEND UPDATE
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
    const txId = sendRes.txid || sendRes.txId;

    console.log(`⏳ Update Sent! TXID: ${txId}`);
    await algosdk.waitForConfirmation(algod, txId, 30);
    console.log("✅ SUCCESS! Smart Contract Logic Updated.");
}

main().catch(console.error);