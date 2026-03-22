'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Coins,
  ExternalLink,
  Loader2,
  Lock,
  Shield,
  Wallet,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@/lib/WalletContext';

const SECURE_METAWORK_ADDRESS = 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

/**
 * Stakeholder Claim Dashboard
 * Shows a stakeholder's allocation and allows claiming tokens
 */
export default function StakeholderClaimDashboard({
  vaultId,
  onClaim,
  className = ''
}) {
  const { accountAddress, isConnected, connect, signTransactionGroup } = useWallet();
  const [claimStatus, setClaimStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  
  // Fetch claim status when wallet connects
  useEffect(() => {
    if (isConnected && accountAddress && vaultId) {
      fetchClaimStatus();
    } else {
      setClaimStatus(null);
    }
  }, [isConnected, accountAddress, vaultId]);
  
  const fetchClaimStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/vault/claim?vaultId=${vaultId}&address=${accountAddress}`
      );
      const data = await response.json();
      setClaimStatus(data);
      
      if (data.remaining > 0) {
        setClaimAmount(String(data.remaining));
      }
    } catch (error) {
      console.error('Error fetching claim status:', error);
      toast.error('Failed to fetch claim status');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClaim = async () => {
    const amount = Number(claimAmount);
    
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (amount > claimStatus.remaining) {
      toast.error(`Cannot claim more than ${claimStatus.remaining} tokens`);
      return;
    }
    
    setIsClaiming(true);
    toast.dismiss();
    
    try {
      if (onClaim) {
        await onClaim(amount);
      }
      
      // Refresh status
      await fetchClaimStatus();
      
      toast.success(`Successfully claimed ${amount} tokens!`);
      
    } catch (error) {
      console.error('Claim error:', error);
      toast.error(error.message || 'Failed to claim tokens');
    } finally {
      setIsClaiming(false);
    }
  };
  
  const claimPercentage = claimStatus?.tokenAmount
    ? (claimStatus.claimed / claimStatus.tokenAmount) * 100
    : 0;
  
  // Not connected state
  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Claim Your Tokens
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your allocation and claim tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Connect your Pera Wallet to check if you&apos;re a stakeholder in this vault.
            </p>
            <Button onClick={connect}>
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your allocation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Not a stakeholder
  if (claimStatus && !claimStatus.isStakeholder) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Stakeholder Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <p className="font-medium">Not a Stakeholder</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your connected wallet ({accountAddress?.substring(0, 8)}...) is not
              configured as a stakeholder in this vault.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Stakeholder view
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {claimStatus?.isPlatform ? (
            <Shield className="w-5 h-5 text-primary" />
          ) : (
            <Coins className="w-5 h-5" />
          )}
          Your Allocation
        </CardTitle>
        <CardDescription>
          {claimStatus?.isPlatform
            ? 'SECURE MetaWork Platform - Fixed 20% allocation'
            : 'Your configured stakeholder allocation'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Allocation Info Card */}
        <div className="p-4 bg-muted rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your Address</span>
            <span className="font-mono text-sm">
              {accountAddress?.substring(0, 8)}...{accountAddress?.substring(50)}
            </span>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Allocation</p>
              <p className="text-xl font-bold text-primary">
                {claimStatus?.percentage?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Token Amount</p>
              <p className="text-xl font-bold">
                {claimStatus?.tokenAmount || 0}
              </p>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            This allocation is locked on-chain and cannot be changed.
          </div>
        </div>
        
        {/* Claim Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Claimed Progress</span>
            <span className="text-muted-foreground">
              {claimStatus?.claimed || 0} / {claimStatus?.tokenAmount || 0} tokens
            </span>
          </div>
          <Progress value={claimPercentage} className="h-3" />
        </div>
        
        {/* Claim Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <div className="text-lg font-bold text-green-500">
              {claimStatus?.claimed || 0}
            </div>
            <div className="text-xs text-muted-foreground">Claimed</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <div className="text-lg font-bold text-blue-500">
              {claimStatus?.remaining || 0}
            </div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-lg font-bold">
              {claimStatus?.tokenAmount || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
        
        <Separator />
        
        {/* Claim Form */}
        {!claimStatus?.vaultFinalized ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  Vault Not Finalized
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  The vault configuration has not been finalized yet.
                  Claims are not available until the owner finalizes the splits.
                </p>
              </div>
            </div>
          </div>
        ) : claimStatus?.remaining > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount to Claim</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max={claimStatus.remaining}
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  placeholder="Enter amount"
                />
                <Button
                  variant="outline"
                  onClick={() => setClaimAmount(String(claimStatus.remaining))}
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Available to claim: {claimStatus.remaining} tokens
              </p>
            </div>
            
            <Button
              className="w-full"
              onClick={handleClaim}
              disabled={isClaiming || !claimAmount || Number(claimAmount) <= 0}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Claim {claimAmount || 0} Tokens
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-600 dark:text-green-400">
                  Fully Claimed
                </p>
                <p className="text-sm text-muted-foreground">
                  You have claimed all {claimStatus.tokenAmount} tokens from your allocation.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
