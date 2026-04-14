'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Package, ExternalLink, Loader2, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TrackingPage() {
  const { user, loading: authLoading } = useAuth(); 
  
  const [identifier, setIdentifier] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (user?.email || user?.walletAddress) {
      fetchUserOrders();
    }
  }, [user]);

  const fetchUserOrders = async () => {
    setLoading(true);
    setError(null);
    setOrderNumber(''); // Clear the manual input box
    setIdentifier('');
    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isLoggedIn: true,
          userEmail: user?.email,
          userWallet: user?.walletAddress
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrack = async (e) => {
    e.preventDefault();
    
    if (!orderNumber && !identifier) {
      setError("Please enter an Order Number or an Email/Wallet Address.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, orderNumber })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setOrders(data); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return <Badge variant="outline">Processing</Badge>;
    switch(status.toLowerCase()) {
      case 'fulfilled': return <Badge className="bg-green-500 hover:bg-green-600">Shipped</Badge>;
      case 'inprocess': return <Badge className="bg-blue-500 hover:bg-blue-600">In Production</Badge>;
      case 'pending': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">Pending</Badge>;
      case 'canceled': return <Badge variant="destructive">Canceled</Badge>;
      case 'paid': return <Badge className="bg-blue-500 hover:bg-blue-600">In Production</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-16 pb-24">
      {/* Increased max-width to 7xl to give the side-by-side layout room to breathe */}
      <div className="max-w-7xl mx-auto px-4">
        
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3">{user ? 'My Orders' : 'Track Your Package'}</h1>
          <p className="text-muted-foreground text-lg">
            {user ? 'View your purchase history or look up a specific package.' : 'Enter an order number or identity to locate your shipping details.'}
          </p>
        </div>

        {/* SIDE-BY-SIDE GRID LAYOUT */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Tracking Box */}
          <div className="lg:col-span-4 sticky top-24">
            <Card className="p-6 border-muted/60 shadow-sm">
              <div className="mb-6 border-b pb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" /> Lookup Order
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Received a gift? Just enter the order number below. You can also enter an email or wallet address to load an entire purchase history.
                </p>
              </div>
              
              {/* Stacked inputs vertically since the sidebar is narrower */}
              <form onSubmit={handleManualTrack} className="space-y-5">
                <div>
                  <Label htmlFor="orderNumber">Order Number (Specific Package)</Label>
                  <Input 
                    id="orderNumber" 
                    placeholder="e.g. 123456" 
                    value={orderNumber} 
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="mt-1.5" 
                  />
                </div>
                <div>
                  <Label htmlFor="identifier">Email or Wallet (Full History)</Label>
                  <Input 
                    id="identifier" 
                    placeholder="john@example.com or Wallet" 
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="leading-tight">{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locating...</> : 'Track Package'}
                  </Button>
                  
                  {user && (
                    <Button type="button" variant="outline" className="w-full h-11" onClick={fetchUserOrders} disabled={loading}>
                      Reset to My Orders
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </div>

          {/* RIGHT COLUMN: Results Table */}
          <div className="lg:col-span-8">
            
            {/* LOADING STATE */}
            {loading && orders.length === 0 && (
              <Card className="flex flex-col items-center justify-center py-24 border-muted/60 border-dashed">
                <Loader2 className="w-10 h-10 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">Retrieving order data...</p>
              </Card>
            )}

            {/* ORDERS TABLE */}
            {orders.length > 0 && !loading && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="overflow-hidden border-muted/60 shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Date & Order #</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Tracking</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.orderNumber}>
                          <TableCell>
                            <div className="font-bold text-base">#{order.orderNumber}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{order.items?.length || 0} Items</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px] mt-0.5">
                              {order.items?.map(i => `${i.quantity}x ${i.name || i.title}`).join(', ')}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                            {order.tracking?.length > 0 ? (
                              <a href={order.tracking[0].trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors">
                                Track {order.tracking[0].carrier} <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
                                Preparing...
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && orders.length === 0 && (
               <Card className="flex flex-col items-center justify-center py-24 border-muted/60 border-dashed text-center px-4">
                 <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                   <Package className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-xl font-bold mb-2">No orders found</h3>
                 <p className="text-muted-foreground max-w-sm">
                   {user 
                     ? "When you make a purchase, your shipping and tracking information will appear here." 
                     : "Use the search box on the left to locate your package."}
                 </p>
               </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}