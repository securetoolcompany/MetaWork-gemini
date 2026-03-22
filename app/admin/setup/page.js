'use client';
import { useState } from 'react';

export default function SetupPage() {
    const [status, setStatus] = useState('');
    const [mnemonic, setMnemonic] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const deploy = async () => {
        if (!mnemonic) {
            setStatus('Error: Please enter a mnemonic.');
            return;
        }

        setIsLoading(true);
        setStatus('Deploying Global Pool... (This may take 10-20 seconds)');

        try {
            const res = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    secret: 'setup_init', 
                    adminMnemonic: mnemonic 
                })
            });

            const data = await res.json();

            if (data.success) {
                setStatus(
                    `✅ SUCCESS!\n\n` +
                    `App ID: ${data.appId}\n` +
                    `App Address: ${data.appAddress}\n\n` +
                    `⚠️ ACTION REQUIRED:\n` +
                    `1. Copy the App ID: ${data.appId}\n` +
                    `2. Open your .env file (or Replit Secrets).\n` +
                    `3. Set/Update: NEXT_PUBLIC_REVENUE_POOL_APP_ID=${data.appId}\n` +
                    `4. Restart your server to apply changes.`
                );
            } else {
                setStatus('❌ Error: ' + data.error);
            }
        } catch (e) {
            setStatus('❌ Network Error: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg w-full space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Admin Setup: Deploy Pool</h1>

                <div className="bg-blue-50 text-blue-800 p-4 rounded text-sm">
                    This tool deploys the <strong>Global Revenue Pool</strong> smart contract. 
                    You only need to do this once.
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Platform Wallet Mnemonic</label>
                    <textarea 
                        className="w-full border border-gray-300 p-3 rounded h-32 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="enter 25 word mnemonic here..."
                        value={mnemonic}
                        onChange={e => setMnemonic(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                        This wallet will pay the deployment fees (~0.202 ALGO).
                    </p>
                </div>

                <button 
                    onClick={deploy} 
                    disabled={isLoading}
                    className={`w-full py-3 rounded text-white font-medium transition-colors ${
                        isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {isLoading ? 'Deploying...' : 'Deploy Contract'}
                </button>

                {status && (
                    <div className={`p-4 rounded text-sm overflow-auto whitespace-pre-wrap border ${
                        status.includes('SUCCESS') ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
                    }`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}