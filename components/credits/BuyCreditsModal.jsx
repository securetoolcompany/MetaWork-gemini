'use client';

import { useEffect, useState } from 'react';
import PeraQRPanel from './PeraQRPanel';

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || '';
const TRANSAK_ENV = process.env.NEXT_PUBLIC_TRANSAK_ENVIRONMENT || 'STAGING';
const TRANSAK_URL =
  TRANSAK_ENV === 'PRODUCTION'
    ? 'https://global.transak.com'
    : 'https://global-stg.transak.com';

export default function BuyCreditsModal({ isOpen, onClose, onSuccess, userId, userAddress }) {
  const [packs, setPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [payMethod, setPayMethod] = useState('pera');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch('/api/credits/packs')
      .then((r) => r.json())
      .then((data) => {
        if (data.packs?.length) {
          setPacks(data.packs);
          setSelectedPack(data.packs[0]);
        }
      })
      .catch(() => setError('Failed to load pricing. Please refresh.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  function openTransak(pack) {
    if (!TRANSAK_API_KEY) {
      setError('Transak is not configured. Please use Pera Wallet QR.');
      return;
    }
    const partnerOrderId = `${userId}:${pack._id}`;
    const params = new URLSearchParams({
      apiKey: TRANSAK_API_KEY,
      cryptoCurrencyCode: 'USDC',
      network: 'algorand',
      walletAddress: userAddress || '',
      fiatAmount: String(pack.priceUSDC),
      fiatCurrency: 'USD',
      partnerOrderId,
      disableWalletAddressForm: 'true',
    });
    window.open(`${TRANSAK_URL}?${params.toString()}`, '_blank', 'width=500,height=700');
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="font-semibold text-lg">Buy Mint Credits</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">×</button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {!loading && packs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Select a pack</p>
              {packs.map((pack) => (
                <button
                  key={pack._id}
                  onClick={() => setSelectedPack(pack)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition ${
                    selectedPack?._id === pack._id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{pack.name} — {pack.credits} credit{pack.credits !== 1 ? 's' : ''}</span>
                  <span className="text-gray-600 dark:text-gray-400">${pack.priceUSDC.toFixed(2)} USDC</span>
                </button>
              ))}
            </div>
          )}

          {selectedPack && (
            <>
              <div className="flex rounded-lg overflow-hidden border dark:border-gray-700">
                <button
                  onClick={() => setPayMethod('pera')}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    payMethod === 'pera'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pera Wallet (QR)
                </button>
                <button
                  onClick={() => setPayMethod('transak')}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    payMethod === 'transak'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Card / Bank
                </button>
              </div>

              {payMethod === 'pera' && (
                <PeraQRPanel
                  pack={selectedPack}
                  userId={userId}
                  onSuccess={(data) => { onSuccess?.(data); onClose(); }}
                  onError={setError}
                />
              )}

              {payMethod === 'transak' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    Purchase <strong>{selectedPack.credits} credit{selectedPack.credits !== 1 ? 's' : ''}</strong> for{' '}
                    <strong>${selectedPack.priceUSDC.toFixed(2)} USDC</strong> using your card or bank account.
                  </p>
                  <button
                    onClick={() => openTransak(selectedPack)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 text-sm font-medium transition"
                  >
                    Continue with Card / Bank →
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    Powered by Transak. Credits are added automatically once payment is confirmed.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}