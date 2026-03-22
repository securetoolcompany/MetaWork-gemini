'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Lock,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
  FileCheck,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

const SECURE_METAWORK_ADDRESS = 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

/**
 * Vault Review Modal
 * Shown before proposing or finalizing to confirm all allocations
 */
export default function VaultReviewModal({
  vault,
  mode = 'propose', // 'propose' | 'finalize'
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  
  if (!vault) return null;
  
  const platformStakeholder = vault.stakeholders?.find(s => s.isPlatform);
  const otherStakeholders = vault.stakeholders?.filter(s => !s.isPlatform) || [];
  
  const handleConfirm = async () => {
    if (mode === 'finalize' && !acknowledged) {
      toast.error('Please acknowledge that allocations become immutable');
      return;
    }
    
    if (onConfirm) {
      await onConfirm();
    }
  };
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            {mode === 'finalize' ? 'Finalize Vault Configuration' : 'Review Proposed Configuration'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'finalize'
              ? 'Review all stakeholder allocations before locking them permanently.'
              : 'Review the proposed stakeholder configuration before saving.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Vault Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">IP Asset</p>
              <p className="font-medium">{vault.ipAssetName}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Supply</p>
              <p className="font-medium">{vault.totalSupply} tokens</p>
            </div>
          </div>
          
          <Separator />
          
          {/* Platform Allocation */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Platform Allocation (Fixed)
            </h3>
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">SECURE MetaWork</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {SECURE_METAWORK_ADDRESS.substring(0, 12)}...{SECURE_METAWORK_ADDRESS.substring(46)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="bg-primary">
                    <Lock className="w-3 h-3 mr-1" />
                    20%
                  </Badge>
                  <p className="text-sm font-medium mt-1">
                    {platformStakeholder?.tokenAmount || vault.platformAllocation} tokens
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                This allocation is hard-coded in the smart contract and cannot be changed.
              </p>
            </div>
          </div>
          
          {/* Other Stakeholders */}
          <div>
            <h3 className="font-medium mb-3">Other Stakeholders ({otherStakeholders.length})</h3>
            {otherStakeholders.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No additional stakeholders</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherStakeholders.map((stk, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm">
                        {stk.address.substring(0, 12)}...{stk.address.substring(46)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {stk.percentage.toFixed(1)}%
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {stk.tokenAmount} tokens
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {vault.totalSupply - (vault.unallocated || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Allocated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">
                  {vault.unallocated || 0}
                </p>
                <p className="text-xs text-muted-foreground">Unallocated</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {vault.totalSupply}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
          
          {/* Finalize Warning */}
          {mode === 'finalize' && (
            <>
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Irreversible Action</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      After you sign this transaction, the stakeholder allocations become
                      <strong> immutable</strong>. No one can change them, including SECURE MetaWork.
                      Make sure all addresses and percentages are correct.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={setAcknowledged}
                />
                <label htmlFor="acknowledge" className="text-sm cursor-pointer">
                  I understand that after finalizing, the allocations cannot be modified
                  and each stakeholder can only claim up to their allocated share.
                </label>
              </div>
            </>
          )}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (mode === 'finalize' && !acknowledged)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {mode === 'finalize' ? 'Finalizing...' : 'Saving...'}
              </>
            ) : mode === 'finalize' ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Finalize & Lock
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm & Save
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
