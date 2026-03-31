'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, Wallet, Loader2, CheckCircle, 
  ExternalLink, Lock, Mail, Trash2, Plus, QrCode, UserPlus 
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

  // --- STATE ---
  const [tutorialStatus, setTutorialStatus] = useState({});
  const [email, setEmail] = useState(user?.email || '');
  const [manualAddress, setManualAddress] = useState('');
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
      setTutorialStatus(completed);
    }
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setIsUpdatingCreds(true);
    try {
      const res = await fetch('/api/user/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...passwords })
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Account security updated');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUpdatingCreds(false);
    }
  };

  const handlePeraConnect = async () => {
    try {
      const addr = await connect(); // This triggers the Pera QR Modal
      if (addr && user) {
        await linkWallet('algorand'); 
        toast.success("Wallet connected and linked!");
      }
    } catch (error) {
      toast.error('Connection failed');
    }
  };

  const handleManualLink = async () => {
    if (manualAddress.length !== 58) {
      toast.error("Invalid Algorand address length");
      return;
    }
    // Call your linking API directly for manual addresses
    // This allows users to track IP they own in "Cold Wallets"
    toast.info("Manual linking request sent for verification");
    setManualAddress('');
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Management</h1>
        <p className="text-muted-foreground">Manage your account credentials, connected wallets, and tutorials.</p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
        </TabsList>

        {/* --- SECURITY TAB --- */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" /> Email Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <Button onClick={handleUpdateAccount} disabled={isUpdatingCreds}>
                {isUpdatingCreds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Email
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5" /> Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={passwords.next} onChange={e => setPasswords({...passwords, next: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                </div>
              </div>
              <Button onClick={handleUpdateAccount} variant="outline" disabled={!passwords.next || isUpdatingCreds}>
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- WALLETS TAB --- */}
        <TabsContent value="wallets" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Linked Wallets</CardTitle>
              <CardDescription>All products owned by these wallets will appear in your dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* List of wallets already in the user's DB record */}
              {user?.wallets?.map((w) => (
                <div key={w.address} className="flex justify-between items-center p-3 border rounded">
                  <span className="font-mono text-sm">{w.address.slice(0,8)}...{w.address.slice(-8)}</span>
                  <Badge>Verified</Badge>
                </div>
              ))}

              {/* The ONLY button they need */}
              <Button onClick={handlePeraConnect} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Link Another Wallet (Scan QR)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TUTORIALS TAB --- */}
        <TabsContent value="tutorials" className="space-y-6 mt-6">
           <div className="grid gap-4 sm:grid-cols-2">
              {[
                { id: 'upload-ip', label: 'IP Uploading', icon: <Plus className="h-4 w-4" />, color: 'bg-blue-500' },
                { id: 'create-product', label: 'Product Creation', icon: <Plus className="h-4 w-4" />, color: 'bg-purple-500' }
              ].map(item => (
                <Card key={item.id}>
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className={`p-2 rounded-full ${item.color} text-white`}>{item.icon}</div>
                    <CardTitle className="text-sm font-bold uppercase">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      onClick={() => router.push(`/${item.id}?tutorial=true`)}
                    >
                      {tutorialStatus[item.id] ? 'Restart Tutorial' : 'Start Tutorial'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}