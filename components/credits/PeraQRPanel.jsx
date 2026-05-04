'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildUSDCPaymentURI, dollarToMicro } from '@/lib/usdc';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '';

function generateNote(userId) {
  const slice = userId.slice(-6);
  const ts = Date.now().toString(36);
  return `mw-${slice}-${ts}`;
}

export default function PeraQRPanel({ pack, userId, onSuccess, onError }) {
  const [qrDataURL, setQrDataURL] = useState(null);
  const [note] = useState(() => generateNote(userId));
  const [status, setStatus] = useState('idle');
  const [txIdInput, setTxIdInput] = useState('');

  const microAmount = dollarToMicro(pack.priceUSDC);
  const paymentURI = buildUSDCPaymentURI(TREASURY_ADDRESS, microAmount, note);

  useEffect(() => {
    QRCode.toDataURL(paymentURI, { width: 220, margin: 2 }).then(setQrDataURL);
  }, [paymentURI]);

  async function verifyPayment() {
    if (!txIdInput.trim()) {
      onError?.('Please paste your transaction ID');
      return;
    }
    setStatus('verifying');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txId: txIdInput.trim(), note, packId: pack._id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        onError?.(data.error || 'Verification failed');
        return;
      }
      setStatus('success');
      onSuccess?.(data);
    } catch (err) {
      setStatus('error');
      onError?.(err.message);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <p className="text-sm text-center text-gray-600 dark:text-gray-400">
        Scan with Pera Wallet and send{' '}
        <strong>{pack.priceUSDC.toFixed(2)} USDC</strong> to purchase{' '}
        <strong>{pack.credits} mint credit{pack.credits !== 1 ? 's' : ''}</strong>.
      </p>

      {qrDataURL ? (
        <img
          src={qrDataURL}
          alt="USDC payment QR code"
          className="rounded-lg border border-gray-200 dark:border-gray-700"
          width={220}
          height={220}
        />
      ) : (
        <div className="w-[220px] h-[220px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      )}

      <p className="text-xs text-gray-500 font-mono break-all text-center max-w-[260px]">
        Order ref: <span className="select-all">{note}</span>
      </p>

      <div className="w-full">
        <label className="block text-xs text-gray-500 mb-1">
          After sending, paste your Transaction ID here:
        </label>
        <input
          type="text"
          value={txIdInput}
          onChange={(e) => setTxIdInput(e.target.value)}
          placeholder="e.g. ABC123XYZ..."
          className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
        />
      </div>

      <button
        onClick={verifyPayment}
        disabled={status === 'verifying' || status === 'success'}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium transition"
      >
        {status === 'verifying'
          ? 'Verifying…'
          : status === 'success'
          ? '✓ Credits added!'
          : "I've sent the payment"}
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center">
          Verification failed. Double-check your TX ID and try again.
        </p>
      )}
    </div>
  );
}