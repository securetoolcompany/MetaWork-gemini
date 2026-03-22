'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  Lock,
  Wallet,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Constants
const SECURE_METAWORK_ADDRESS = 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';
const ALLOCATION_TYPE_FIXED = 1;
const ALLOCATION_TYPE_PERCENTAGE = 2;

/**
 * Stakeholder Configuration Form
 * Used during the "propose" phase to configure token allocations
 */
export default function StakeholderConfigForm({
  ipAssetId,
  ipAssetName,
  totalSupply,
  assetId,
  existingStakeholders = [],
  onPropose,
  isLoading = false
}) {
  const [stakeholders, setStakeholders] = useState(existingStakeholders);
  
  // Platform allocation (fixed 20%)
  const platformAllocation = Math.floor(totalSupply * 0.2);
  const maxOtherAllocation = totalSupply - platformAllocation;
  
  // Calculate validation synchronously (not in useEffect)
  const calculateValidation = () => {
    let totalOther = 0;
    const errors = [];
    const addresses = new Set();
    
    for (const stk of stakeholders) {
      // Check duplicates
      if (addresses.has(stk.address?.toLowerCase())) {
        errors.push(`Duplicate address: ${stk.address}`);
      }
      if (stk.address) {
        addresses.add(stk.address.toLowerCase());
      }
      
      // Calculate allocation
      if (stk.allocationType === ALLOCATION_TYPE_FIXED) {
        totalOther += Number(stk.allocationValue) || 0;
      } else {
        totalOther += Math.floor((Number(stk.allocationValue) / 100) * totalSupply) || 0;
      }
    }
    
    if (totalOther > maxOtherAllocation) {
      errors.push(`Total allocations (${totalOther}) exceed maximum (${maxOtherAllocation})`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      platformAllocation,
      otherAllocations: totalOther,
      totalAllocated: platformAllocation + totalOther,
      unallocated: totalSupply - (platformAllocation + totalOther)
    };
  };
  
  // Compute validation on each render
  const validation = calculateValidation();
  
  const addStakeholder = () => {
    setStakeholders([
      ...stakeholders,
      {
        address: '',
        allocationType: ALLOCATION_TYPE_PERCENTAGE,
        allocationValue: 10
      }
    ]);
  };
  
  const removeStakeholder = (index) => {
    setStakeholders(stakeholders.filter((_, i) => i !== index));
  };
  
  const updateStakeholder = (index, field, value) => {
    const updated = [...stakeholders];
    updated[index] = { ...updated[index], [field]: value };
    setStakeholders(updated);
  };
  
  const handlePropose = async () => {
    if (!validation?.valid) {
      toast.error('Please fix validation errors before proposing');
      return;
    }
    
    // Filter out empty entries
    const validStakeholders = stakeholders.filter(
      stk => stk.address && stk.address.length === 58
    );
    
    if (onPropose) {
      await onPropose(validStakeholders);
    }
  };
  
  const calculateTokenAmount = (stk) => {
    if (stk.allocationType === ALLOCATION_TYPE_FIXED) {
      return Number(stk.allocationValue) || 0;
    }
    return Math.floor((Number(stk.allocationValue) / 100) * totalSupply) || 0;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Configure Revenue Stakeholders
        </CardTitle>
        <CardDescription>
          Define how the {totalSupply} ownership tokens for &quot;{ipAssetName}&quot; will be distributed.
          SECURE MetaWork automatically receives 20%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Allocation - Read Only */}
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">SECURE MetaWork Platform</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {SECURE_METAWORK_ADDRESS.substring(0, 8)}...{SECURE_METAWORK_ADDRESS.substring(50)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                Fixed 20%
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {platformAllocation} tokens
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            This allocation is hard-coded and cannot be modified.
          </p>
        </div>
        
        <Separator />
        
        {/* Other Stakeholders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Additional Stakeholders</h3>
            <p className="text-sm text-muted-foreground">
              Max: {maxOtherAllocation} tokens (80%)
            </p>
          </div>
          
          {stakeholders.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No additional stakeholders configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                The remaining 80% can be allocated to the IP creator or other stakeholders
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stakeholders.map((stk, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Stakeholder {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStakeholder(index)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Address */}
                  <div className="space-y-2">
                    <Label>Wallet Address</Label>
                    <Input
                      placeholder="ALGO address (58 characters)"
                      value={stk.address}
                      onChange={(e) => updateStakeholder(index, 'address', e.target.value)}
                      className="font-mono text-sm"
                    />
                    {stk.address && stk.address.length !== 58 && (
                      <p className="text-xs text-destructive">Invalid address length</p>
                    )}
                  </div>
                  
                  {/* Allocation Type & Value */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Allocation Type</Label>
                      <Select
                        value={String(stk.allocationType)}
                        onValueChange={(value) => updateStakeholder(index, 'allocationType', Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={String(ALLOCATION_TYPE_PERCENTAGE)}>Percentage</SelectItem>
                          <SelectItem value={String(ALLOCATION_TYPE_FIXED)}>Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>
                        {stk.allocationType === ALLOCATION_TYPE_PERCENTAGE ? 'Percentage' : 'Token Amount'}
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max={stk.allocationType === ALLOCATION_TYPE_PERCENTAGE ? 80 : maxOtherAllocation}
                          value={stk.allocationValue}
                          onChange={(e) => updateStakeholder(index, 'allocationValue', Number(e.target.value))}
                        />
                        {stk.allocationType === ALLOCATION_TYPE_PERCENTAGE && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Calculated amount */}
                  <div className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                    <span className="text-muted-foreground">Token Allocation:</span>
                    <span className="font-medium">{calculateTokenAmount(stk)} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Button
            variant="outline"
            onClick={addStakeholder}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Stakeholder
          </Button>
        </div>
        
        <Separator />
        
        {/* Summary */}
        <div className="space-y-3">
          <h3 className="font-medium">Allocation Summary</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className="text-2xl font-bold text-primary">
                {validation?.totalAllocated || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total Allocated</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className={`text-2xl font-bold ${(validation?.unallocated || 0) > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                {validation?.unallocated || 0}
              </div>
              <div className="text-xs text-muted-foreground">Unallocated</div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-primary h-full"
                style={{ width: `${(platformAllocation / totalSupply) * 100}%` }}
                title="Platform (20%)"
              />
              <div
                className="bg-green-500 h-full"
                style={{ width: `${((validation?.otherAllocations || 0) / totalSupply) * 100}%` }}
                title="Other Stakeholders"
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Platform: {platformAllocation}</span>
            <span>Others: {validation?.otherAllocations || 0}</span>
            <span>Unallocated: {validation?.unallocated || 0}</span>
          </div>
          
          {/* Validation Errors */}
          {validation?.errors?.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Validation Errors</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {validation?.unallocated > 0 && validation?.valid && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Unallocated Tokens</p>
                  <p className="text-xs text-muted-foreground">
                    {validation.unallocated} tokens ({((validation.unallocated / totalSupply) * 100).toFixed(1)}%) are not allocated to any stakeholder.
                    These will remain in the vault.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <Button
          className="w-full"
          onClick={handlePropose}
          disabled={!validation?.valid || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Proposing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Propose Stakeholder Configuration
            </>
          )}
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          This will save the proposed configuration. You can still modify it until you finalize.
        </p>
      </CardContent>
    </Card>
  );
}
