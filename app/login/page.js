'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { Wallet, Mail, Loader2, CheckCircle, AlertCircle, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, checkSession } = useAuth();
  const { connect, accountAddress, isConnecting, signData, disconnect } = useWallet();
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Wallet auth states
  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [authStep, setAuthStep] = useState('idle');
  const [error, setError] = useState(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      await login(data.token, data.user);
      toast.success('Successfully logged in!');
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      await login(data.token, data.user);
      
      toast.success('Account created successfully!');
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletConnect = async () => {
    setError(null);
    const address = await connect();
    if (address) {
      setAuthStep('connected');
      toast.success('Wallet connected! Now sign to authenticate.');
    }
  };

  const handleWalletAuth = async () => {
    if (!accountAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    setError(null);
    setIsSigningMessage(true);
    setAuthStep('signing');
    
    try {
      // Step 1: Get nonce from server
      const nonceResponse = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: accountAddress })
      });
      
      if (!nonceResponse.ok) {
        throw new Error('Failed to get authentication challenge');
      }
      
      const { message } = await nonceResponse.json();
      
      // Step 2: Sign the message with Pera Wallet
      // Convert message to Uint8Array - Pera expects this format
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      
      // Pera's signData expects data as Uint8Array
      const signature = await signData(
        new Uint8Array(messageBytes), 
        'Sign to authenticate with MetaWork'
      );
      
      setAuthStep('verifying');
      
      // Step 3: Convert signature to base64 and send to server
      // signature is already a Uint8Array
      const signatureBase64 = btoa(String.fromCharCode.apply(null, signature));
      
      const verifyResponse = await fetch('/api/auth/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: accountAddress,
          signature: signatureBase64
        })
      });
      
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Verification failed');
      }
      
      const { token, user } = await verifyResponse.json();
      
      // Step 4: Login with token
      await login(token, user);
      
      toast.success('Successfully logged in with wallet!');
      router.push('/');
      
    } catch (err) {
      console.error('Wallet auth error:', err);
      if (err.message?.includes('rejected') || err.message?.includes('cancelled') || err.message?.includes('SIGN_TRANSACTIONS')) {
        setError('Signature request was cancelled');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
      setAuthStep('connected');
    } finally {
      setIsSigningMessage(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setAuthStep('idle');
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Welcome to MetaWork</CardTitle>
          <CardDescription>
            Sign in to manage your IP, products, and earnings
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>
            
            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Sign In with Email
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
            
            {/* Register Tab */}
            <TabsContent value="register" className="space-y-4 mt-4">
              <form onSubmit={handleEmailRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          {/* ADD GOOGLE BUTTON HERE
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => window.location.href = '/api/auth/google'}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button> */}
          
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or continue with wallet
            </span>
          </div>

          {/* Wallet Connection */}
          <div className="space-y-3">
            {!accountAddress ? (
              <Button 
                onClick={handleWalletConnect}
                variant="outline"
                className="w-full h-12"
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Pera Wallet
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Connected wallet display */}
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-mono text-sm">{truncateAddress(accountAddress)}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                </div>
                
                {/* Sign message to authenticate */}
                <Button 
                  onClick={handleWalletAuth}
                  className="w-full h-12"
                  disabled={isSigningMessage}
                >
                  {isSigningMessage ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {authStep === 'signing' ? 'Sign in Pera Wallet...' : 'Verifying...'}
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5 mr-2" />
                      Sign Message to Authenticate
                    </>
                  )}
                </Button>
                
                {authStep === 'signing' && (
                  <p className="text-sm text-muted-foreground text-center">
                    Please approve the signature request in your Pera Wallet app
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Info text */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              Don&apos;t have Pera Wallet?{' '}
              <a 
                href="https://perawallet.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Download here <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <p className="text-xs">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
