"use client";

import { useEffect, useState } from "react";
import { Embed } from "@fyul/embed-sdk";

export default function JerseyEmbedPage() {
  const [status, setStatus] = useState("initializing...");
  const externalProductId = "bc00dde2-fb75-4917-bc81-7589de4c2e2c"; // set this to the jersey's externalProductId

  useEffect(() => {
    let embedSDK;

    async function run() {
      try {
        setStatus("Requesting JWT...");

        const res = await fetch("/api/auth/generateJwt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalCustomerId: "embed-test",
            externalProductId,
            markupAmount: 20,
            markupType: "percent",
            sellingRegion: "us",
            displayCurrency: "USD",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch JWT");
        }

        const json = await res.json();
        const token = json?.data?.token;
        if (!token) {
          throw new Error("JWT token missing in response");
        }

        setStatus("Initializing Embed...");

        embedSDK = new Embed(token, { debug: true });
        await embedSDK.init();

        setStatus("Embed ready. Use the Printful UI to open the jersey design and then save it.");

        // OPTIONALLY: if the SDK exposes a direct save API, you can wire a button:
        // const result = await embedSDK.saveProduct();
        // setStatus(`Saved template ${result.template_id}`);
      } catch (err) {
        console.error("[JerseyEmbedPage] error:", err);
        setStatus(`Error: ${err.message}`);
      }
    }

    run();

    return () => {
      if (embedSDK) {
        embedSDK.destroy();
      }
    };
  }, [externalProductId]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-xl font-bold">Jersey Embed Save</h1>
        <p className="text-sm">{status}</p>
        <p className="text-xs text-zinc-400">
          Once the Embed UI loads, follow the Printful interface to open the jersey design and save it as a template/product.
        </p>
      </div>
    </div>
  );
}