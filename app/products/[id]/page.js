'use client';

import { use, useState, useEffect } from 'react'; // Added 'use' here
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import ProductDetailPage from '@/components/showroom/ProductDetailDialog';
import { Loader2, Save, ExternalLink, Settings2, BarChart3, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SmartProductPage({ params }) {
  const { id } = use(params);
  const router = useRouter(); // Initialize router
  const { accountAddress, isConnected } = useWallet();
  const { user } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. DATA FETCHING
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (data.success) setProduct(data.product);
      } catch (err) {
        console.error("Failed to fetch product", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  // 2. THE SAVE LOGIC
  const handleUpdateProduct = async (updatedData) => {
    try {
      const res = await fetch(`/api/products/${product.id || product._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const text = await res.text(); 
      const data = text ? JSON.parse(text) : {}; 

      if (!res.ok) throw new Error(data.error || 'Update failed');

      setProduct(prev => ({ ...prev, ...updatedData }));
      toast.success('Sync Successful');
    } catch (err) {
      console.error("Save Error:", err);
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!product) return <div className="p-20 text-center font-mono">PRODUCT_NOT_FOUND_IN_VAULT</div>;

  // 3. THE GATEKEEPER
  const isOwner = isConnected && (
    accountAddress === product.creatorAddress || 
    user?.id === (product.creatorId || product.userId) ||
    user?.userId === product.userId
  );

  return (
    <>
      {isOwner ? (
        <div className="min-h-screen bg-[#020617] text-white p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* TOP COMMAND BAR */}
            <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
                  <Settings2 className="text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Industrial Command Center</h1>
                  <p className="text-emerald-500/60 font-mono text-xs uppercase tracking-widest">ID: {product.id || product._id}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="bg-transparent border-white/10 hover:bg-white/5"
                  onClick={() => window.open(`/showroom/${product.id}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> View Public Page
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleUpdateProduct({ status: 'active' })}
                >
                  <Save className="w-4 h-4 mr-2" /> Sync Changes
                </Button>
              </div>
            </div>

            {/* MANAGEMENT PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Product Configuration</h3>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <p className="font-medium">Listed on Aisle</p>
                      <p className="text-sm text-slate-500">Ready for customers to purchase.</p>
                    </div>
                    <button 
                      onClick={() => handleUpdateProduct({ isPublic: !product.isPublic })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${product.isPublic ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${product.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="mt-8 aspect-video bg-black/20 rounded-xl border border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                    <img src={product.imageUrl} alt="Preview" className="max-h-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl">
                  <h4 className="font-bold mb-4 uppercase text-xs tracking-widest text-slate-500">Performance</h4>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm"><span>Total Sales</span><span>{product.salesCount || 0} units</span></div>
                    <div className="flex justify-between text-sm"><span>Net Profit</span><span className="text-emerald-500">${product.earnings?.toFixed(2) || '0.00'}</span></div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => router.push('/dashboard/revenue')}>
                    Claim Revenue Tokens
                  </Button>
                </div>

                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl space-y-3">
                  <h4 className="font-bold mb-2 uppercase text-xs tracking-widest text-slate-500">External Tools</h4>
                  <Button variant="outline" className="w-full justify-start border-white/10" onClick={() => window.open(`/showroom/${product.id}`, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" /> View in Showroom
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-white/10" onClick={() => router.push(`/tools/qr?productId=${product.id}`)}>
                    <Package className="w-4 h-4 mr-2" /> Generate Product QR
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ProductDetailPage product={product} />
      )}
    </>
  );
}