// hooks/usePrintfulEmbed.js
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Embed } from "@fyul/embed-sdk";

/**
 * Hook to initialize the Printful Embed SDK for a given product.
 *
 * @param {object} options
 * @param {string} options.externalCustomerId - MetaWork user id
 * @param {string} options.externalProductId  - MetaWork externalProductId
 */
export function usePrintfulEmbed(options) {
  const { externalCustomerId, externalProductId } = options || {};
  const embedRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const initEmbed = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch("/api/auth/generateJwt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalCustomerId,
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

      const embedSDK = new Embed(token, { debug: true });
      await embedSDK.init();

      embedRef.current = embedSDK;
      setReady(true);
    } catch (err) {
      console.error("[usePrintfulEmbed] init error:", err);
      setError(err);
      setReady(false);
    }
  }, [externalCustomerId, externalProductId]);

  useEffect(() => {
    initEmbed();

    return () => {
      if (embedRef.current) {
        embedRef.current.destroy();
        embedRef.current = null;
      }
    };
  }, [initEmbed]);

  return {
    embedSDK: embedRef.current,
    ready,
    error,
  };
}