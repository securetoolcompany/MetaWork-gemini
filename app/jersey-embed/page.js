"use client";

import { useEffect, useRef, useState } from "react";

export default function JerseyEmbedPage() {
  const [status, setStatus] = useState("initializing...");
  const [loading, setLoading] = useState(true);
  const designerRef = useRef(null);
  const scriptRef = useRef(null);
  const mountId = "jersey-designer-container";
  const cancelledRef = useRef(false);

  const externalProductId = "bc00dde2-fb75-4917-bc81-7589de4c2e2c";
  const printfulProductId = 676;

  useEffect(() => {
    cancelledRef.current = false;

    const script = document.createElement("script");
    script.src = "https://files.cdn.printful.com/embed/embed.js";
    script.async = true;
    scriptRef.current = script;

    script.onload = () => {
      setStatus("Printful script loaded.");
    };

    script.onerror = () => {
      setLoading(false);
      setStatus("Error: failed to load Printful script");
    };

    document.body.appendChild(script);

    return () => {
      cancelledRef.current = true;

      if (designerRef.current?.destroy) {
        designerRef.current.destroy();
        designerRef.current = null;
      }

      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
      }

      scriptRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJwtAndInit() {
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
            sellingRegion: "usa",
            displayCurrency: "USD",
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "Failed to fetch JWT");
        }

        const jwt = json?.data?.token;
        if (!jwt) {
          throw new Error("JWT token missing in response");
        }

        if (cancelled || cancelledRef.current) return;

        setStatus("JWT received.");

        const waitForSdk = () =>
          new Promise((resolve, reject) => {
            const startedAt = Date.now();

            const poll = () => {
              if (cancelled || cancelledRef.current) {
                return reject(new Error("Cancelled"));
              }

              if (window.PFDesignMaker) {
                return resolve(window.PFDesignMaker);
              }

              if (Date.now() - startedAt > 15000) {
                return reject(new Error("PFDesignMaker did not load"));
              }

              setTimeout(poll, 100);
            };

            poll();
          });

        const SDK = await waitForSdk();

        if (cancelled || cancelledRef.current) return;

        const mountEl = document.getElementById(mountId);
        if (!mountEl) {
          throw new Error("Designer mount container not found");
        }

        if (designerRef.current?.destroy) {
          designerRef.current.destroy();
          designerRef.current = null;
        }

        setStatus("Initializing designer...");

        const instance = new SDK({
          elemId: mountId,
          nonce: jwt,
          externalProductId,
          initProduct: { productId: printfulProductId },
          disabledPlacements: ["label_inside", "label_outside"],

          onReady: () => {
            if (cancelled || cancelledRef.current) return;
            setLoading(false);
            setStatus("Designer ready.");
            console.log("[JerseyEmbedPage] onReady");
          },

          onIframeLoaded: () => {
            if (cancelled || cancelledRef.current) return;
            setLoading(false);
            setStatus("Designer iframe loaded.");
            console.log("[JerseyEmbedPage] onIframeLoaded");
          },

          onError: (error) => {
            if (cancelled || cancelledRef.current) return;
            setLoading(false);
            setStatus(`Designer error: ${error}`);
            console.error("[JerseyEmbedPage] onError:", error);
          },

          onTemplateSaved: (templateId) => {
            if (cancelled || cancelledRef.current) return;
            console.log("[JerseyEmbedPage] template saved:", templateId);
            setStatus(`Template saved: ${templateId}`);
          },

          onDesignStatusUpdate: () => {},
        });

        designerRef.current = instance;

        setTimeout(() => {
          if (!cancelled && !cancelledRef.current && loading) {
            setLoading(false);
          }
        }, 5000);
      } catch (err) {
        if (cancelled || cancelledRef.current) return;
        console.error("[JerseyEmbedPage] init error:", err);
        setStatus(`Error: ${err.message}`);
        setLoading(false);
      }
    }

    loadJwtAndInit();

    return () => {
      cancelled = true;
    };
  }, [externalProductId, loading]);

  const handleSave = () => {
    const instance = designerRef.current;
    if (!instance) {
      setStatus("Designer not ready");
      return;
    }

    setStatus("Saving design...");

    try {
      instance.sendMessage({ event: "saveDesign" });
    } catch (err) {
      console.error("[JerseyEmbedPage] save error:", err);
      setStatus(`Save error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Jersey Embed Save</h1>
          <p className="text-sm mt-1">{status}</p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          disabled={loading}
        >
          Save Design
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div
          id={mountId}
          className="absolute inset-0 bg-zinc-950"
          style={{
            pointerEvents: "auto",
            touchAction: "manipulation",
            WebkitOverflowScrolling: "touch",
          }}
        />
      </div>
    </div>
  );
}