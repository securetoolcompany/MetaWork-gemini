'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Check, X, ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CommunityCurationTab({ creatorId, accentColor }) {
  const [communityProducts, setCommunityProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all products using this user's IP
  const fetchCommunityProducts = async () => {
    try {
      const res = await fetch(`/api/metawork/products/list?ipOwnerId=${creatorId}&public=true`);
      const data = await res.json();
      if (data.success) {
        setCommunityProducts(data.products || []);
      }
    } catch (err) {
      toast.error("Failed to load community products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommunityProducts(); }, [creatorId]);

  const handleAction = async (productId, action, mockupIndex = 0) => {
    try {
      const res = await fetch('/api/aisle-settings/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action, mockupIndex })
      });
      
      if (res.ok) {
        toast.success(action === 'approve' ? "Approved for Aisle" : "Updated");
        fetchCommunityProducts(); // Refresh state
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-2">Community Curation</h3>
        <p className="text-slate-400 text-sm">Manage products created by others using your IP.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {communityProducts.map((product) => (
          <Card key={product.id} className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="flex p-4 gap-4">
              {/* Product Preview */}
              <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                <Image 
                  src={product.imageUrl} 
                  alt={product.title} 
                  fill 
                  className="object-cover" 
                />
              </div>

              {/* Info & Curation */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold truncate">{product.title}</h4>
                <p className="text-xs text-slate-400 mb-3">By {product.creatorName || 'Community Member'}</p>
                
                <div className="flex flex-wrap gap-2">
                  {!product.isApproved ? (
                    <Button 
                      size="sm" 
                      onClick={() => handleAction(product.id, 'approve')}
                      style={{ backgroundColor: accentColor }}
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleAction(product.id, 'deny')}
                    >
                      <X className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Mockup Selection Bar */}
            {product.isApproved && product.images?.length > 1 && (
              <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-2 flex items-center">
                  <ImageIcon className="w-3 h-3 mr-1" /> Select Front-Facing Image
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(product.id, 'set_mockup', idx)}
                      className={`relative w-12 h-12 rounded border-2 transition-all ${
                        product.thumbnailUrl === img ? 'border-blue-500 scale-110' : 'border-transparent opacity-50 hover:opacity-100'
                      }`}
                    >
                      <Image src={img} alt="mockup" fill className="object-cover rounded" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}