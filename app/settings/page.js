'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  GraduationCap, 
  Upload, 
  Palette, 
  Edit2, 
  Package, 
  FolderOpen, 
  Layout, 
  DollarSign, 
  Wallet, 
  Shield, 
  Loader2, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import algosdk from 'algosdk';

// Integrated Hooks
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { useWalletLink } from '@/lib/hooks/useWalletLink';

export default function Settings() {
  const router = useRouter();
  
  // Auth and Wallet Hooks
  const { user } = useAuth();
  const { accountAddress, connect, disconnect, isConnected } = useWallet();
  const { linkWallet, isLinking } = useWalletLink();

  const [tutorialStatus, setTutorialStatus] = useState({ 
    'upload-ip': false, 
    'create-product': false,
    'edit-ip': false,
    'edit-product': false,
    'aisle-theme': false,
    'aisle-collections': false,
    'aisle-layout': false,
    'aisle-revenue': false
  });
  
  // Platform Settings State
  const [platformWallet, setPlatformWallet] = useState('');
  const [platformPercentage, setPlatformPercentage] = useState(20);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(true);
  const [isSavingPlatform, setIsSavingPlatform] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
      setTutorialStatus(completed);
    }
    fetchPlatformSettings();
  }, []);
  
  const fetchPlatformSettings = async () => {
    try {
      const response = await fetch('/api/admin/platform-settings');
      if (response.ok) {
        const data = await response.json();
        setPlatformWallet(data.platformWallet || '');
        setPlatformPercentage(data.platformPercentage || 20);
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setIsLoadingPlatform(false);
    }
  };

const handleWalletAction = async () => {
    try {
      if (isConnected) {
        await disconnect();
        toast.success('Wallet disconnected');
      } else {
        // 1. Wait for the wallet to provide an address
        const walletAddress = await connect();
        
        // 2. If the user is already logged in (via Google/Email), trigger the link
        if (walletAddress && user) {
          console.log('Wallet connected. Requesting signature to link/merge...');
          
          // This must be called to send the request to /api/auth/link-wallet
          await linkWallet('algorand'); 
        }
      }
    } catch (error) {
      console.error('Wallet Action Error:', error);
      toast.error('Failed to connect or link wallet');
    }
  };
  
  const savePlatformSettings = async () => {
    if (platformWallet && !algosdk.isValidAddress(platformWallet)) {
      toast.error('Invalid Algorand wallet address');
      return;
    }
    
    setIsSavingPlatform(true);
    try {
      const response = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformWallet, platformPercentage })
      });
      
      if (response.ok) {
        toast.success('Platform settings saved!');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save platform settings');
    } finally {
      setIsSavingPlatform(false);
    }
  };

  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

  const startTutorial = (path) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_tutorial', path);
    }
    const routes = {
      'upload-ip': '/upload-ip?tutorial=true',
      'create-product': '/product-designer?tutorial=true',
      'edit-ip': '/my-ip?tutorial=true',
      'edit-product': '/my-products?tutorial=true',
      'aisle-theme': '/aisle-settings?tab=theme&tutorial=true',
      'aisle-collections': '/aisle-settings?tab=collections&tutorial=true',
      'aisle-layout': '/aisle-settings?tab=layout&tutorial=true',
      'aisle-revenue': '/aisle-settings?tab=revenue&tutorial=true'
    };
    router.push(routes[path]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Tutorials Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Tutorials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Learn how to use MetaWork with our interactive tutorials.</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border border-border bg-background space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-500 p-2"><Upload className="h-4 w-4 text-white" /></div>
                    <div>
                      <h4 className="font-semibold text-foreground">Upload IP Tutorial</h4>
                      {tutorialStatus['upload-ip'] && <span className="text-xs text-green-500">✓ Completed</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => startTutorial('upload-ip')}>
                    {tutorialStatus['upload-ip'] ? 'Restart Tutorial' : 'Start Tutorial'}
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-border bg-background space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-purple-500 p-2"><Palette className="h-4 w-4 text-white" /></div>
                    <div>
                      <h4 className="font-semibold text-foreground">Product Creation Tutorial</h4>
                      {tutorialStatus['create-product'] && <span className="text-xs text-green-500">✓ Completed</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => startTutorial('create-product')}>
                    {tutorialStatus['create-product'] ? 'Restart Tutorial' : 'Start Tutorial'}
                  </Button>
                </div>
              </div>

              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground mb-1">Aisle Settings Tutorials</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg border border-border bg-background space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-cyan-500 p-2"><Palette className="h-4 w-4 text-white" /></div>
                      <h4 className="font-semibold text-foreground">Theme & Branding</h4>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => startTutorial('aisle-theme')}>
                      Start Tutorial
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg border border-border bg-background space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-emerald-500 p-2"><DollarSign className="h-4 w-4 text-white" /></div>
                      <h4 className="font-semibold text-foreground">Revenue Settings</h4>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => startTutorial('aisle-revenue')}>
                      Start Tutorial
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="Enter username" defaultValue="creator123" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter email" defaultValue="creator@metawork.com" className="bg-background border-border" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive email updates about your products</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Sales Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when someone buys your product</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Settings - UPDATED FOR MULTI-CHAIN */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Blockchain Settings
              </CardTitle>
              <CardDescription>Manage your connected wallets and blockchain identities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Linked Wallets List */}
              <div className="space-y-4">
                <Label>Linked Wallets</Label>
                {user?.wallets && user.wallets.length > 0 ? (
                  <div className="grid gap-3">
                    {user.wallets.map((wallet, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-md bg-background border border-border">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary">
                            {wallet.chain}
                          </div>
                          <span className="font-mono text-sm truncate">{wallet.address}</span>
                        </div>
                        <a 
                          href={wallet.chain === 'algorand' ? `https://allo.info/account/${wallet.address}` : '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No wallets linked to this account yet.</p>
                )}
              </div>

              <Separator />

              {/* Connection Interface */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active Connection</Label>
                    <p className="text-xs text-muted-foreground">Connect a wallet to link it to your account</p>
                  </div>
                  <Button 
                    variant={isConnected ? "destructive" : "default"}
                    size="sm"
                    onClick={handleWalletAction}
                    disabled={isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isConnected ? (
                      'Disconnect'
                    ) : (
                      'Connect Wallet'
                    )}
                  </Button>
                </div>
                
                {isConnected && (
                  <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-primary">Current Session Address</span>
                      <span className="font-mono text-sm truncate">{accountAddress}</span>
                    </div>
                    
                    {/* Check if already linked */}
                    {!user?.wallets?.some(w => w.address === accountAddress) ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => linkWallet('algorand')}
                        disabled={isLinking}
                      >
                        {isLinking ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Linking...</>
                        ) : (
                          'Link this Wallet to Account'
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-green-500 font-medium pt-1">
                        <CheckCircle className="h-3 w-3" />
                        This wallet is linked to your account
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Default Network</Label>
                <Input
                  value="Algorand Mainnet"
                  disabled
                  className="bg-background border-border"
                />
              </div>
            </CardContent>
          </Card>

          {/* Platform Admin Settings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Platform Admin Settings
              </CardTitle>
              <CardDescription>
                Configure the MetaWork platform wallet and revenue share settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPlatform ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="platformWallet">Platform Wallet Address</Label>
                    <Input
                      id="platformWallet"
                      placeholder="Enter Algorand wallet address"
                      value={platformWallet}
                      onChange={(e) => setPlatformWallet(e.target.value)}
                      className="bg-background border-border font-mono text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="platformPercentage">Platform Revenue Share (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="platformPercentage"
                        type="number"
                        min="0"
                        max="100"
                        value={platformPercentage}
                        onChange={(e) => setPlatformPercentage(parseInt(e.target.value) || 0)}
                        className="bg-background border-border w-24"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      onClick={savePlatformSettings} 
                      disabled={isSavingPlatform}
                      className="bg-primary"
                    >
                      {isSavingPlatform ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Save Platform Settings
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end pb-8">
            <Button onClick={handleSave} className="bg-primary">
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}