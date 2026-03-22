'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Rocket, CheckCircle, AlertCircle, Copy, ExternalLink, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DeployContractPage() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [peraWallet, setPeraWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState(null); // null, 'preparing', 'signing', 'submitting', 'success', 'error'
  const [deployedContract, setDeployedContract] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // Initialize Pera Wallet
  useEffect(() => {
    const initPeraWallet = async () => {
      if (typeof window !== 'undefined') {
        try {
          const { PeraWalletConnect } = await import('@perawallet/connect');
          const wallet = new PeraWalletConnect();
          setPeraWallet(wallet);

          // Reconnect if previously connected
          wallet.reconnectSession().then((accounts) => {
            if (accounts.length > 0) {
              setWalletAddress(accounts[0]);
            }
          }).catch(console.error);
        } catch (err) {
          console.error('Failed to initialize Pera Wallet:', err);
        }
      }
    };
    initPeraWallet();
  }, []);

  const connectWallet = async () => {
    if (!peraWallet) return;
    
    setIsConnecting(true);
    try {
      const accounts = await peraWallet.connect();
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(0, 8)}...${accounts[0].slice(-6)}`,
        });
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to connect to Pera Wallet",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (peraWallet) {
      peraWallet.disconnect();
      setWalletAddress(null);
    }
  };

  const deployContract = async () => {
    if (!walletAddress || !peraWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    setError(null);
    setDeploymentStatus('preparing');

    try {
      // Step 1: Get deployment transaction
      const response = await fetch(`/api/vault/deploy?creatorAddress=${walletAddress}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create deployment transaction');
      }

      setDeploymentStatus('signing');

      // Step 2: Decode and sign transaction with Pera Wallet
      const algosdk = (await import('algosdk')).default;
      const txnBytes = new Uint8Array(Buffer.from(data.transaction, 'base64'));
      const txn = algosdk.decodeUnsignedTransaction(txnBytes);

      // Sign with Pera Wallet
      const signedTxns = await peraWallet.signTransaction([[{ txn }]]);
      
      if (!signedTxns || signedTxns.length === 0) {
        throw new Error('Transaction signing was cancelled');
      }

      setDeploymentStatus('submitting');

      // Step 3: Submit signed transaction
      const signedTxnBase64 = Buffer.from(signedTxns[0]).toString('base64');
      
      const submitResponse = await fetch('/api/vault/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTxn: signedTxnBase64,
          creatorAddress: walletAddress
        })
      });

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitData.error || 'Failed to deploy contract');
      }

      setDeploymentStatus('success');
      setDeployedContract({
        appId: submitData.appId,
        appAddress: submitData.appAddress,
        txId: submitData.txId
      });

      toast({
        title: "Contract Deployed! 🎉",
        description: `IP Vault contract deployed with App ID: ${submitData.appId}`,
      });

    } catch (err) {
      console.error('Deployment error:', err);
      setDeploymentStatus('error');
      setError(err.message);
      toast({
        title: "Deployment Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  const getStatusBadge = () => {
    switch (deploymentStatus) {
      case 'preparing':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-400">Preparing Transaction...</Badge>;
      case 'signing':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">Waiting for Signature...</Badge>;
      case 'submitting':
        return <Badge variant="outline" className="bg-purple-500/20 text-purple-400">Submitting to Blockchain...</Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400">Deployed Successfully!</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400">Deployment Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Deploy IP Vault Contract</h1>
            <p className="text-gray-400">
              Deploy the IP Vault smart contract to Algorand Testnet for managing ownership token allocations.
            </p>
          </div>

          {/* Wallet Connection */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Wallet Connection
              </CardTitle>
              <CardDescription>
                Connect your Algorand wallet to deploy the contract. You'll need ALGO for the deployment fee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {walletAddress ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Connected</p>
                      <p className="text-gray-400 text-sm font-mono">
                        {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={connectWallet} 
                  disabled={isConnecting}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Pera Wallet'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Contract Info */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">IP Vault Contract Features</CardTitle>
              <CardDescription>
                The smart contract that will be deployed to Algorand Testnet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-white font-medium mb-2">🔒 Fixed Platform Allocation</h4>
                  <p className="text-gray-400 text-sm">
                    SECURE MetaWork receives exactly 20% of all tokens - hard-coded and immutable.
                  </p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-white font-medium mb-2">📋 Two-Phase Flow</h4>
                  <p className="text-gray-400 text-sm">
                    Propose → Finalize workflow allows review before locking allocations.
                  </p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-white font-medium mb-2">📦 Box Storage</h4>
                  <p className="text-gray-400 text-sm">
                    Stakeholder allocations stored on-chain in boxes for transparency.
                  </p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-white font-medium mb-2">💰 Claim Mechanism</h4>
                  <p className="text-gray-400 text-sm">
                    Stakeholders can withdraw only up to their allocated share.
                  </p>
                </div>
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-500">Testnet Deployment</AlertTitle>
                <AlertDescription className="text-yellow-400/80">
                  This will deploy to Algorand Testnet. Make sure you have testnet ALGO in your wallet.
                  You can get free testnet ALGO from the <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noopener noreferrer" className="underline">Algorand Testnet Faucet</a>.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Deployment Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Deploy Contract
                </CardTitle>
                {getStatusBadge()}
              </div>
              <CardDescription>
                Deploy the IP Vault contract to start managing IP ownership tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {deployedContract ? (
                <div className="space-y-4">
                  <Alert className="bg-green-500/10 border-green-500/30">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertTitle className="text-green-500">Contract Deployed Successfully!</AlertTitle>
                    <AlertDescription className="text-green-400/80">
                      Your IP Vault contract is now live on Algorand Testnet.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Application ID</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-lg">{deployedContract.appId}</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(deployedContract.appId.toString())}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Application Address</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm">
                            {deployedContract.appAddress.slice(0, 10)}...{deployedContract.appAddress.slice(-8)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(deployedContract.appAddress)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Transaction ID</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm">
                            {deployedContract.txId.slice(0, 10)}...{deployedContract.txId.slice(-8)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(deployedContract.txId)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <a 
                            href={`https://testnet.explorer.perawallet.app/tx/${deployedContract.txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <a 
                      href={`https://testnet.explorer.perawallet.app/application/${deployedContract.appId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button className="w-full" variant="outline">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on Pera Explorer
                      </Button>
                    </a>
                    <Button 
                      onClick={() => {
                        setDeployedContract(null);
                        setDeploymentStatus(null);
                      }}
                      variant="outline"
                    >
                      Deploy Another
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={deployContract}
                  disabled={!walletAddress || isDeploying}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  size="lg"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {deploymentStatus === 'preparing' && 'Preparing Transaction...'}
                      {deploymentStatus === 'signing' && 'Please Sign in Wallet...'}
                      {deploymentStatus === 'submitting' && 'Deploying to Blockchain...'}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5 mr-2" />
                      Deploy IP Vault Contract
                    </>
                  )}
                </Button>
              )}
            </CardContent>
            <CardFooter className="text-sm text-gray-500">
              Estimated deployment cost: ~0.5 ALGO (includes contract storage)
            </CardFooter>
          </Card>
        </div>
      </div>
  );
}
