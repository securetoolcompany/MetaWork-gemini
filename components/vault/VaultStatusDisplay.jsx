'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Lock,
  Shield,
  Users
} from 'lucide-react';

const SECURE_METAWORK_ADDRESS = 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

/**
 * Vault Status Display
 * Shows the current status of a vault configuration
 */
export default function VaultStatusDisplay({
  vault,
  onFinalize,
  canFinalize = false,
  className = ''
}) {
  if (!vault) return null;
  
  const platformStakeholder = vault.stakeholders?.find(s => s.isPlatform);
  const otherStakeholders = vault.stakeholders?.filter(s => !s.isPlatform) || [];
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Vault Configuration
            </CardTitle>
            <CardDescription>
              Token distribution for &quot;{vault.ipAssetName}&quot;
            </CardDescription>
          </div>
          <Badge
            variant={vault.finalized ? 'default' : 'secondary'}
            className={vault.finalized ? 'bg-green-500' : 'bg-yellow-500'}
          >
            {vault.finalized ? (
              <>
                <Lock className="w-3 h-3 mr-1" />
                Finalized
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {!vault.finalized && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  Pending Finalization
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  These splits are not locked yet. Tokens cannot be claimed until finalized.
                  You can still modify the configuration before finalizing.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Vault Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{vault.totalSupply}</div>
            <div className="text-xs text-muted-foreground">Total Supply</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {(vault.stakeholders?.length || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Stakeholders</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-yellow-500">
              {vault.unallocated || 0}
            </div>
            <div className="text-xs text-muted-foreground">Unallocated</div>
          </div>
        </div>
        
        <Separator />
        
        {/* Stakeholder List */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Stakeholders
          </h3>
          
          {/* Platform (always first) */}
          {platformStakeholder && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">SECURE MetaWork</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {SECURE_METAWORK_ADDRESS.substring(0, 8)}...{SECURE_METAWORK_ADDRESS.substring(50)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-primary">
                    <Lock className="w-3 h-3 mr-1" />
                    20%
                  </Badge>
                  <p className="text-sm mt-1">
                    {platformStakeholder.tokenAmount} tokens
                  </p>
                  {vault.finalized && (
                    <p className="text-xs text-muted-foreground">
                      Claimed: {platformStakeholder.claimed || 0}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Other Stakeholders */}
          {otherStakeholders.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No additional stakeholders configured
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
                    {vault.finalized && (
                      <p className="text-xs text-muted-foreground">
                        Claimed: {stk.claimed || 0}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Finalize Button */}
        {!vault.finalized && canFinalize && (
          <>
            <Separator />
            <Button className="w-full" onClick={onFinalize}>
              <Lock className="w-4 h-4 mr-2" />
              Finalize Configuration
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Once finalized, allocations become immutable and claims can begin.
            </p>
          </>
        )}
        
        {/* Finalized Info */}
        {vault.finalized && vault.finalizedAt && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Finalized on {new Date(vault.finalizedAt).toLocaleDateString()}
            </div>
            {vault.finalizeTxId && (
              <a
                href={`https://testnet.explorer.perawallet.app/tx/${vault.finalizeTxId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              >
                View transaction
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
