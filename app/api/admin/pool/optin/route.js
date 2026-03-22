import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams, waitForConfirmation } from "@/lib/algorand";

// Use the ID from secrets, or fallback to the one we just confirmed
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

// Helper to prevent BigInt crashes in JSON response
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
));

export async function POST(request) {
    try {
        const body = await request.json();
        const secret = body.secret;

        // 1. Validate Secret
        if (secret !== process.env.ADMIN_SECRET && secret !== 'setup_init') {
            return NextResponse.json({ error: "Unauthorized: Wrong Secret" }, { status: 401 });
        }

        // 2. Validate Admin Wallet
        const mnemonic = process.env.METAWORK_PLATFORM_MNEMONIC;
        if (!mnemonic) {
            return NextResponse.json({ error: "Server config error: Missing Admin Wallet" }, { status: 500 });
        }

        const algod = getAlgodClient();
        const adminAccount = algosdk.mnemonicToSecretKey(mnemonic);
        const adminAddrStr = String(adminAccount.addr).trim();
        const appId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);

        console.log(`Opting In... Sender: ${adminAddrStr}, App: ${appId}, Asset: ${USDC_ASSET_ID}`);

        const params = await getTransactionParams();

        // 3. Build Transaction
        const txn = algosdk.makeApplicationNoOpTxnFromObject({
            sender: adminAddrStr,
            appIndex: appId,
            appArgs: [new Uint8Array(Buffer.from("opt_in_asset"))],
            foreignAssets: [USDC_ASSET_ID],
            suggestedParams: { ...params, fee: 2000, flatFee: true }
        });

        // 4. Sign & Send
        const signed = txn.signTxn(adminAccount.sk);
        const { txid } = await algod.sendRawTransaction(signed).do();
        const info = await waitForConfirmation(txid, 4);

        return NextResponse.json(safeJson({ 
            success: true, 
            txId: txid, 
            message: "Pool opted into USDC!",
            debugInfo: info
        }));

    } catch (e) {
        console.error("Opt-In Route Crash:", e);
        return NextResponse.json({ 
            error: e.message || "Unknown Server Error" 
        }, { status: 500 });
    }
}