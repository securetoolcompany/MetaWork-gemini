'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Wallet, Loader2, Plus, Lock, Mail, Bell, Star, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { useWalletLink } from '@/lib/hooks/useWalletLink';

interface WalletEntry {
  address: string;
  verified?: boolean;
  isDefault?: boolean;
}

interface NotificationPrefs {
  sales: boolean;
  royalties: boolean;
  minting: boolean;
  marketing: boolean;
}

interface UserWithWallets {
  email?: string;
  wallets?: WalletEntry[];
  defaultWallet?: string;
  notifications?: NotificationPrefs;
}

interface PasswordState {
  current: string;
  next: string;
  confirm: string;
}

export default function AccountManagement() {
  const router = useRouter();

  const { user, logout } = useAuth() as {
    user: UserWithWallets | null;
    logout: () => void;
  };
  const { accountAddress, connect, disconnect, isConnected } = useWallet() as {
    accountAddress: string | null;
    connect: () => Promise<string | null>;
    disconnect: () => void;
    isConnected: boolean;
  };
  const { linkWallet, isLinking } = useWalletLink() as {
    linkWallet: (type: string) => Promise<void>;
    isLinking: boolean;
  };

  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwords, setPasswords] = useState<PasswordState>({ current: '', next: '', confirm: '' });
  const [defaultWallet, setDefaultWallet] = useState<string>(user?.defaultWallet ?? '');
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    sales: true,
    royalties: true,
    minting: true,
    marketing: false,
    ...user?.notifications,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.defaultWallet) setDefaultWallet(user.defaultWallet);
    if (user?.notifications) setNotifications(n => ({ ...n, ...user.notifications }));
  }, [user]);

  // --- EMAIL ---
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);
    try {
      const res = await fetch('/api/user/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Email update failed');
      toast.success('Email updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email update failed');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // --- PASSWORD ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current) { toast.error('Enter your current password'); return; }
    if (passwords.next !== passwords.confirm) { toast.error('New passwords do not match'); return; }
    if (passwords.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/user/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
      });
      if (!res.ok) throw new Error('Password update failed');
      toast.success('Password updated successfully');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password update failed');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // --- WALLET CONNECT ---
  const handlePeraConnect = async () => {
    try {
      const addr = await connect();
      if (addr && user) {
        await linkWallet('algorand');
        toast.success('Wallet connected and linked!');
      }
    } catch {
      toast.error('Wallet connection failed');
    }
  };

  // --- DEFAULT WALLET ---
  const handleSaveDefaultWallet = async () => {
    setIsSavingDefault(true);
    try {
      const res = await fetch('/api/user/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultWallet }),
      });
      if (!res.ok) throw new Error('Failed to save default wallet');
      toast.success('Default wallet updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSavingDefault(false);
    }
  };

  // --- NOTIFICATIONS ---
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      const res = await fetch('/api/user/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // --- DELETE ACCOUNT ---
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/delete-account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      logout();
      router.push('/');
      toast.success('Account deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const activeWalletAlreadyLinked =
    accountAddress && user?.wallets?.some((w) => w.address === accountAddress);

  const notificationItems: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: 'sales',     label: 'Sales Alerts',         description: 'Notify me when a product sells' },
    { key: 'royalties', label: 'Royalty Payouts',       description: 'Notify me when royalties are distributed' },
    { key: 'minting',   label: 'Minting Confirmations', description: 'Notify me when IP is minted on-chain' },
    { key: 'marketing', label: 'Marketing & News',      description: 'Platform updates and promotional emails' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Management</h1>
        <p className="text-muted-foreground">
          Manage your credentials, wallets, notifications, and account settings.
        </p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="notifications">Alerts</TabsTrigger>
          <TabsTrigger value="default-wallet">Default</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        {/* SECURITY */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" /> Email Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <Button type="submit" disabled={isUpdatingEmail || !email}>
                  {isUpdatingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Email
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwords.next}
                      onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!passwords.current || !passwords.next || !passwords.confirm || isUpdatingPassword}
                >
                  {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WALLETS */}
        <TabsContent value="wallets" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5" /> Linked Wallets
              </CardTitle>
              <CardDescription>
                Products owned by these wallets will appear in your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.wallets && user.wallets.length > 0 ? (
                user.wallets.map((w) => (
                  <div key={w.address} className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="font-mono text-sm">
                      {w.address.slice(0, 8)}…{w.address.slice(-8)}
                    </span>
                    <div className="flex items-center gap-2">
                      {w.address === defaultWallet && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      <Badge variant="secondary">Verified</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
              )}

              {isConnected && accountAddress && !activeWalletAlreadyLinked && (
                <div className="flex justify-between items-center p-3 border border-blue-500/30 rounded-lg bg-blue-500/5">
                  <span className="font-mono text-sm">
                    {accountAddress.slice(0, 8)}…{accountAddress.slice(-8)}
                  </span>
                  <Badge>Active Session</Badge>
                </div>
              )}

              <Button onClick={handlePeraConnect} className="w-full" disabled={isLinking}>
                {isLinking
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Plus className="mr-2 h-4 w-4" />}
                {isConnected ? 'Link Another Wallet' : 'Connect Wallet (Pera QR)'}
              </Button>

              {isConnected && (
                <Button
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={disconnect}
                >
                  Disconnect Current Session
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" /> Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which email alerts you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notificationItems.map((item, i) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={item.key} className="text-sm font-medium">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      id={item.key}
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) =>
                        setNotifications((n) => ({ ...n, [item.key]: checked }))
                      }
                    />
                  </div>
                  {i < notificationItems.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
              <Button onClick={handleSaveNotifications} disabled={isSavingNotifications} className="w-full">
                {isSavingNotifications && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEFAULT WALLET */}
        <TabsContent value="default-wallet" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5" /> Default Payout Wallet
              </CardTitle>
              <CardDescription>
                Royalties and earnings will be sent to this wallet address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.wallets && user.wallets.length > 0 ? (
                user.wallets.map((w) => (
                  <div
                    key={w.address}
                    onClick={() => setDefaultWallet(w.address)}
                    className={`flex justify-between items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      defaultWallet === w.address
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="font-mono text-sm">
                      {w.address.slice(0, 8)}…{w.address.slice(-8)}
                    </span>
                    {defaultWallet === w.address && (
                      <Badge>Selected</Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No wallets linked yet. Add one in the Wallets tab first.
                </p>
              )}
              <Button
                onClick={handleSaveDefaultWallet}
                disabled={isSavingDefault || !defaultWallet}
                className="w-full"
              >
                {isSavingDefault && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Default Wallet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DANGER ZONE */}
        <TabsContent value="danger" className="space-y-6 mt-6">
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-red-400">
                <AlertTriangle className="h-5 w-5" /> Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are permanent and cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently deletes your account, all linked IP assets, products, and wallet associations.
                  On-chain assets are not affected but will be disassociated from this platform.
                </p>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label htmlFor="delete-confirm" className="text-sm">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="border-red-500/30 focus:border-red-500"
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={deleteConfirm !== 'DELETE' || isDeletingAccount}
                  onClick={handleDeleteAccount}
                >
                  {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Permanently Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}