'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import ProductDetailPage from '@/components/showroom/ProductDetailDialog';
import { Loader2, Save, ExternalLink, Settings2, UploadCloud, X, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SmartProductPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { accountAddress, isConnected } = useWallet();
  const { user } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // Global upload state

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

  // 2. THE SAVE LOGIC (Reused for status updates and image persistence)
  const handleUpdateProduct = async (updatedData) => {
    try {
      const res = await fetch(`/api/products/${product.id || product._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) throw new Error('System sync failed');

      // Update local state immediately
      setProduct(prev => ({ ...prev, ...updatedData }));
      toast.success('System Synced');
    } catch (err) {
      console.error("Save Error:", err);
      toast.error(err.message);
    }
  };

  // 3. THE UPLOAD PIPELINE
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading("Syncing asset with Cloudinary...");

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderContext', 'product-mockups'); // Established convention

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload pipeline failed");

      // 4. PERSIST TO MONGODB
      // Assuming 'mockups' is an array in your schema
      const currentMockups = product.mockups || [];
      await handleUpdateProduct({
        mockups: [...currentMockups, data.url]
      });

      toast.success("Asset Vault Updated", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input to allow re-uploading same file
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!product) return <div className="p-20 text-center font-mono text-white bg-[#020617]">PRODUCT_NOT_FOUND_IN_VAULT</div>;

  const isOwner = isConnected && (
    accountAddress === product.creatorAddress || 
    user?.id === (product.creatorId || product.userId) ||
    user?.userId === product.userId
  );

  return (
    <>
      {isOwner ? (
        <div className="min-h-screen bg-[#020617] text-white p-8 relative isolate">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* TOP COMMAND BAR */}
            <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
                  <Settings2 className="text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Industrial Command Center</h1>
                  <p className="text-emerald-500/60 font-mono text-xs uppercase">ID: {product.id || product._id}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="border-white/10 hover:bg-white/5 text-white"
                  onClick={() => window.open(`/products/${product.id}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> View Public Page
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleUpdateProduct({ status: 'active' })}
                >
                  <Save className="w-4 h-4 mr-2" /> Sync Changes
                </Button>
              </div>
            </div>

            {/* MANAGEMENT PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                
                {/* CONFIGURATION & PRIMARY IMAGE */}
                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-2xl">
                  <h3 className="text-lg font-semibold mb-6">Product Configuration</h3>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 mb-8">
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
                  
                  <div className="aspect-video bg-black/20 rounded-xl border border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                    <img src={product.imageUrl} alt="Preview" className="max-h-full object-contain" />
                  </div>
                </div>

                {/* --- NEW: THE WHOLE SECTION IS THE BUTTON --- */}
                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                        <h3 className="text-lg font-semibold text-white">Product Mockups</h3>
                        <p className="text-sm text-slate-500">Secondary visual assets for the vault.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* THE CLICKABLE UPLOAD AREA */}
                        <label className={`aspect-square rounded-xl bg-black/40 border-2 border-dashed ${isUploading ? 'border-emerald-500/50 cursor-not-allowed' : 'border-white/10 hover:border-emerald-500/50 cursor-pointer'} transition-all flex flex-col items-center justify-center p-6 text-center group relative overflow-hidden`}>
                            {/* Hidden Input */}
                            <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={isUploading} />
                            
                            {/* The UI inside the clickable area */}
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-2" />
                                    <span className="text-xs text-emerald-500 font-mono">UPLOADING...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-10 h-10 text-slate-700 group-hover:text-emerald-500 transition-colors mb-3" />
                                    <span className="text-sm font-medium text-slate-500 group-hover:text-white transition-colors">Click to Upload</span>
                                    <span className="text-xs text-slate-700">PNG, JPG up to 10MB</span>
                                </>
                            )}
                        </label>

                        {/* EXISTING MOCKUP PREVIEWS */}
                        {product.mockups?.map((url, idx) => (
                        <div key={idx} className="aspect-square rounded-xl bg-black/40 border border-white/10 overflow-hidden relative group">
                            <img src={url} alt="Mockup" className="w-full h-full object-cover" />
                            {/* Delete Button (with preventDefault to not trigger label click) */}
                            <button 
                                onClick={(e) => {
                                    e.preventDefault(); 
                                    e.stopPropagation();
                                    const filtered = product.mockups.filter((_, i) => i !== idx);
                                    handleUpdateProduct({ mockups: filtered });
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-red-600"
                            >
                            <X className="w-4 h-4" />
                            </button>
                        </div>
                        ))}
                    </div>
                </div>
              </div>

              {/* SIDEBAR TOOLS */}
              <div className="space-y-6">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl">
                  <h4 className="font-bold mb-4 uppercase text-xs tracking-widest text-slate-500">Performance</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span>Total Sales</span><span>{product.salesCount || 0} units</span></div>
                    <div className="flex justify-between text-sm"><span>Net Profit</span><span className="text-emerald-500">${product.earnings?.toFixed(2) || '0.00'}</span></div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl space-y-3">
                  <h4 className="font-bold mb-2 uppercase text-xs tracking-widest text-slate-500">External Tools</h4>
                  <Button variant="outline" className="w-full justify-start border-white/10 text-white" onClick={() => window.open(`/products/${product.id}`, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" /> View in Showroom
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