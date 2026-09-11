import { NextResponse } from "next/server";
import { getAlgodClient } from "@/lib/algorand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonValue = (value) =>
  typeof value === "bigint" ? value.toString() : value;

export async function GET() {
  try {
    const status = await getAlgodClient("mainnet").status().do();

    return NextResponse.json({
      ok: true,
      network: "mainnet",
      lastRound: jsonValue(status.lastRound),
      catchupTime: jsonValue(status.catchupTime),
      nextVersionRound: jsonValue(status.nextVersionRound),
      nextVersionSupported: status.nextVersionSupported,
      stoppedAtUnsupportedRound: status.stoppedAtUnsupportedRound,
      timeSinceLastRound: jsonValue(status.timeSinceLastRound),
    });
  } catch (error) {
    console.error("MainNet Algod status check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "MainNet Algod status check failed",
      },
      { status: 502 }
    );
  }
}