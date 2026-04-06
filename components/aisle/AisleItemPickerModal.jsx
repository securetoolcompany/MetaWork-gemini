'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  CheckCircle2, 
  Package, 
  FolderGit2, 
  Users, 
  Layers 
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function AisleItemPickerModal({ 
  isOpen, 
  onClose, 
  onSelectItems, 
  sectionId, 
  accentColor = '#10b981',
  maxSelection = null
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('products');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // Reset selection and fetch data when modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      fetchData(activeTab);
    }
  }, [isOpen, activeTab]);

  const fetchData = async (tab) => {
    setIsLoading(true);
    setData([]);
    try {
      let endpoint = '';
      if (tab === 'products') {
        const creatorId = user?.id || user?.username || '';
        endpoint = `/api/products?creator=${creatorId}&includeDrafts=true&limit=1000`; 
      }
      if (tab === 'ip') endpoint = '/api/ip/my-library?limit=1000';
      if (tab === 'collections') endpoint = '/api/collections';
      if (tab === 'community') endpoint = '/api/showroom/products?community=true&limit=100';

      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const result = await res.json();
      
      const items = result.products || result.ipAssets || result.collections || result.data || [];
      setData(items);
    } catch (error) {
      console.error(`Error fetching ${tab} for picker:`, error);
      toast.error('Failed to load items.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (item) => {
    const itemId = item.id || item._id?.toString();
    
    setSelectedItems(prev => {
      const isSelected = prev.some(i => (i.id || i._id?.toString()) === itemId);
      
      if (isSelected) {
        // Deselect
        return prev.filter(i => (i.id || i._id?.toString()) !== itemId);
      } else {
        // Select
        if (maxSelection && prev.length >= maxSelection) {
          // If it's a single-select (like Featured Item), swap the selection instead of failing
          if (maxSelection === 1) return [item];
          
          toast.warning(`You can only select up to ${maxSelection} items.`);
          return prev;
        }
        return [...prev, item];
      }
    });
  };

  const handleConfirm = () => {
    // Standardize the item structure before sending it back to the Aisle Layout
    const formattedItems = selectedItems.map(item => ({
      id: item.id || item._id?.toString(),
      itemType: activeTab, // 'products', 'ip', 'collections', 'community'
      title: item.name || item.title || 'Untitled Item',
      // Ensure we grab the best image using the Printful mockup logic we fixed earlier
      imageUrl: item.mockupUrl || item.thumbnailUrl || item.imageUrl || item.images?.[0] || item.mockupImages?.[0] || '/placeholder.png',
      price: item.price || item.basePrice || null
    }));

    onSelectItems(sectionId, formattedItems);
    onClose();
  };

  // Helper to extract image for grid rendering
  const getPreviewImage = (item) => {
    let url = item.mockupUrl || item.thumbnailUrl || item.imageUrl || item.images?.[0] || item.mockupImages?.[0];
    if (!url) return '/placeholder.png';
    if (url.startsWith('//')) return `https:${url}`;
    return url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 bg-background border-white/10">
        
        {/* Header */}
        <DialogHeader className="p-6 border-b border-white/10 shrink-0">
          <DialogTitle className="text-2xl font-bold">
            {sectionId === 'featured' ? 'Select Featured Item' : 'Add Items to Section'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {sectionId === 'featured' 
              ? 'Choose one main item to highlight at the top of your Aisle.' 
              : 'Select products, IP assets, or collections to display in this row.'}
          </p>
        </DialogHeader>

        {/* Body / Tabs */}
        <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50">
              <TabsTrigger value="products" className="data-[state=active]:bg-background">
                <Package className="w-4 h-4 mr-2" /> My Products
              </TabsTrigger>
              <TabsTrigger value="ip" className="data-[state=active]:bg-background">
                <FolderGit2 className="w-4 h-4 mr-2" /> My IP Vaults
              </TabsTrigger>
              <TabsTrigger value="collections" className="data-[state=active]:bg-background">
                <Layers className="w-4 h-4 mr-2" /> Collections
              </TabsTrigger>
              <TabsTrigger value="community" className="data-[state=active]:bg-background">
                <Users className="w-4 h-4 mr-2" /> Community Fan Art
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrolling Grid Area */}
          <ScrollArea className="flex-1 p-6">
            {isLoading ? (
              <div className="w-full h-full min-h-[300px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : data.length === 0 ? (
              <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">No items found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  You don't have any {activeTab} available yet. Create some first to add them to your Aisle!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                {data.map((item) => {
                  const itemId = item.id || item._id?.toString();
                  const isSelected = selectedItems.some(i => (i.id || i._id?.toString()) === itemId);

                  return (
                    <div 
                      key={itemId}
                      onClick={() => toggleSelection(item)}
                      className={`
                        relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all
                        ${isSelected ? 'border-primary ring-4 ring-primary/20 scale-[0.98]' : 'border-white/5 hover:border-white/20'}
                      `}
                      style={{ borderColor: isSelected ? accentColor : undefined }}
                    >
                      <div className="aspect-square bg-muted/30 overflow-hidden relative">
                        <img 
                          src={getPreviewImage(item)} 
                          alt={item.name || item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        
                        {/* Selection Overlay */}
                        <div className={`
                          absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center
                          ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                        `}>
                          {isSelected ? (
                            <CheckCircle2 className="w-12 h-12" style={{ color: accentColor }} />
                          ) : (
                            <div className="bg-background/80 text-foreground px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                              Select
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-card/90 backdrop-blur-sm absolute bottom-0 left-0 right-0 border-t border-white/5">
                        <p className="font-semibold text-sm truncate">
                          {item.name || item.title || 'Untitled'}
                        </p>
                        {item.price && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${Number(item.price).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="p-6 border-t border-white/10 bg-background/50 shrink-0 flex-row items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
              style={{ backgroundColor: selectedItems.length > 0 ? accentColor : undefined }}
              className={selectedItems.length > 0 ? 'text-white' : ''}
            >
              Add {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'}
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}