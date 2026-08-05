import { NextResponse } from "next/server";

const EWL_API_KEY = process.env.EWL_API_KEY;

export async function POST(req) {
  try {
    if (!EWL_API_KEY) {
      console.warn("[generateJwt] EWL_API_KEY is not set");
      return NextResponse.json(
        { error: "EWL_API_KEY not configured" },
        { status: 500 },
      );
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      externalCustomerId,
      externalProductId,
      markupAmount,
      markupType,
      sellingRegion,
      displayCurrency,
    } = body || {};

    // Build payload exactly as per the EWL docs
    const ewlPayload = {
      scopes: ["creator"], // required
    };

    if (externalCustomerId) {
      ewlPayload.external_customer_id = String(externalCustomerId);
    }
    if (externalProductId) {
      ewlPayload.external_product_id = String(externalProductId);
    }
    if (typeof markupAmount === "number") {
      ewlPayload.markup_amount = markupAmount;
    }
    if (markupType === "percent" || markupType === "fixed") {
      ewlPayload.markup_type = markupType;
    }
    if (sellingRegion) {
      ewlPayload.selling_region = String(sellingRegion);
    }
    if (displayCurrency) {
      ewlPayload.display_currency = String(displayCurrency);
    }

    // This is the correct EWL JWT endpoint and header pattern from the docs
    const ewlRes = await fetch("https://ewl.printify.com/api/v1/authorize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ewlPayload),
    });

    const ewlJson = await ewlRes.json().catch(() => ({}));

    if (!ewlRes.ok || !ewlJson?.data?.token) {
      console.error("[generateJwt] EWL error:", ewlRes.status, ewlJson);
      return NextResponse.json(
        { error: "Failed to generate JWT", details: ewlJson },
        { status: 502 },
      );
    }

    // Mirror the documented response shape
    return NextResponse.json(
      { data: ewlJson.data },
      { status: 200 },
    );
  } catch (error) {
    console.error("[generateJwt] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}