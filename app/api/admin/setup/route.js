import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient } from "@/lib/algorand";
import fs from "fs";
import path from "path";

// Helper to safely stringify BigInts (prevents crash)
const bigintReplacer = (key, value) => 
  typeof value === 'bigint' ? value.toString() : value;

export async function POST(request) {
    try {
        const { secret, adminMnemonic } = await request.json();

        // 1. Security Check
        if (secret !== 'setup_init' && secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const algod = getAlgodClient();

        // 2. Wallet Setup
        const mnemonic = adminMnemonic || process.env.METAWORK_PLATFORM_MNEMONIC;
        if (!mnemonic) return NextResponse.json({ error: "No admin wallet configured" }, { status: 500 });

        const adminAccount = algosdk.mnemonicToSecretKey(mnemonic);
        const adminAddrStr = String(adminAccount.addr).trim();

        // 3. Load Contracts
        const approvalPath = path.join(process.cwd(), "contracts/revenue_pool_global_approval.teal");
        const clearPath = path.join(process.cwd(), "contracts/revenue_pool_global_clear.teal");

        if (!fs.existsSync(approvalPath)) return NextResponse.json({ error: "TEAL files not found." }, { status: 500 });

        const approvalProgram = await algod.compile(fs.readFileSync(approvalPath)).do();
        const clearProgram = await algod.compile(fs.readFileSync(clearPath)).do();

        // 4. Build Deployment Transaction
        const params = await algod.getTransactionParams().do();
        const appTxn = algosdk.makeApplicationCreateTxnFromObject({
            sender: adminAddrStr,
            onComplete: algosdk.OnApplicationComplete.NoOpOC,
            approvalProgram: new Uint8Array(Buffer.from(approvalProgram.result, "base64")),
            clearProgram: new Uint8Array(Buffer.from(clearProgram.result, "base64")),
            // SCHEMA: 1 Byte (admin_wallet) + 1 Int (init_flag)
            numGlobalByteSlices: 1, 
            numGlobalInts: 1,
            numLocalByteSlices: 0, 
            numLocalInts: 0,
            // ARGUMENT: Pass Admin Address
            appArgs: [algosdk.decodeAddress(adminAddrStr).publicKey],
            suggestedParams: params
        });

        // 5. Sign & Submit
        const signed = appTxn.signTxn(adminAccount.sk);
        const { txid } = await algod.sendRawTransaction(signed).do();
        console.log(`Deployment Tx ID: ${txid}`);

        const info = await algosdk.waitForConfirmation(algod, txid, 4);

        // DEBUG: Use replacer to prevent "Do not know how to serialize a BigInt" crash here
        console.log("CONFIRMATION OBJECT:", JSON.stringify(info, bigintReplacer, 2));

        // 6. Robust App ID Extraction
        let appId = info['application-index'];
        if (appId === undefined) appId = info['created-application-index'];
        if (appId === undefined) appId = info['applicationIndex'];
        if (appId === undefined) appId = info['createdApplicationIndex'];

        if (!appId) {
            throw new Error(`Tx confirmed but App ID not found. Check server logs.`);
        }

        // Ensure integer
        appId = Number(appId);
        const appAddr = algosdk.getApplicationAddress(appId);

        // 7. Fund App (MBR)
        const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: adminAddrStr,
            receiver: appAddr,
            amount: 200000, 
            suggestedParams: await algod.getTransactionParams().do()
        });

        const signedFund = fundTxn.signTxn(adminAccount.sk);
        await algod.sendRawTransaction(signedFund).do();
        await algosdk.waitForConfirmation(algod, fundTxn.txID(), 4);

        return NextResponse.json({ 
            success: true,
            appId: appId, 
            appAddress: appAddr,
            message: "Pool deployed successfully! Please update your .env file."
        });

    } catch (e) {
        console.error("Deployment Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}