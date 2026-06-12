// components/ip/IPAssetStatusBadge.jsx
"use client";

import { useEffect, useState } from "react";

function formatCountdown(clearsAt) {
  const diff = new Date(clearsAt) - Date.now();
  if (diff <= 0) return "Processing...";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m remaining`;
}

export default function IPAssetStatusBadge({ asset }) {
  const { status, clearsAt, mainnetAssetId, mintManifest } = asset;
  const [countdown, setCountdown] = useState(() => formatCountdown(clearsAt));

  useEffect(() => {
    if (status !== "quarantine") return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(clearsAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [status, clearsAt]);

  if (status === "quarantine") {
    return (
      <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4">
        <span className="font-semibold text-yellow-700">
          ⏳ Pending Verification
        </span>
        <p className="mt-1 text-sm text-yellow-600">
          Your asset is currently passing our security and copyright check.
        </p>
        <p className="text-sm text-yellow-600">
          It will become live on the public marketplace within 48 hours.
        </p>
        {clearsAt && (
          <p className="mt-2 text-xs text-yellow-500">{countdown}</p>
        )}
      </div>
    );
  }

  if (status === "live") {
    return (
      <div className="rounded-lg border border-green-400 bg-green-50 p-4">
        <span className="font-semibold text-green-700">✅ Live on Mainnet</span>
        {mainnetAssetId && (
          <p className="mt-1 text-sm text-green-600">
            <a
              href={`https://explorer.perawallet.app/assets/${mainnetAssetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Explorer
            </a>
          </p>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-red-400 bg-red-50 p-4">
        <span className="font-semibold text-red-700">❌ Not Approved</span>
        <p className="mt-1 text-sm text-red-600">
          This asset did not pass verification.
        </p>
        <p className="text-sm text-red-600">
          Contact{" "}
          <a href="mailto:support@metawork.com" className="underline">
            support@metawork.com
          </a>{" "}
          to appeal.
        </p>
      </div>
    );
  }

  return null;
}