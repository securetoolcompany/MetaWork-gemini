'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, Image as ImageIcon, DollarSign, User, Filter, Globe, Lock, Store } from 'lucide-react';
import { toast } from 'sonner';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export default function IPLibraryDialog({ open, onOpenChange, onSelectIP, isConnected, initialIP, }) {
  const [activeTab, setActiveTab] = useState('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCreator, setSelectedCreator] = useState('all');
  
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [creators, setCreators] = useState([]);
  
  // Track which IP is being viewed in detail
  const [viewingIP, setViewingIP] = useState(null);

  // Reset view when dialog closes
    useEffect(() => {
      if (open && initialIP) {
        // dialog just opened with a preselected IP from the panel
        setViewingIP(initialIP);
      }
      if (!open) {
        // dialog closed; clean up detail view
        setViewingIP(null);
      }
    }, [open, initialIP]);

  // Fetch logic
  const fetchIPs = useCallback(async () => {
    setLoading(true);
    try {
      let url = activeTab === 'global' ? '/api/ip/library' : '/api/ip/my-library';
      const params = new URLSearchParams();
      
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedCreator && selectedCreator !== 'all') params.set('creator', selectedCreator);
      
      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setIps(data.ipAssets || []);
        if (data.filters?.categories) setCategories(data.filters.categories);
        if (data.filters?.creators) setCreators(data.filters.creators);
      }
    } catch (error) {
      console.error('Error fetching IPs:', error);
      toast.error('Failed to load IP library');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, selectedCategory, selectedCreator]);

  useEffect(() => {
    if (open) fetchIPs();
  }, [open, fetchIPs]);

  // Handle clicking a card -> Open Detail View
  const handleCardClick = (ip) => {
    setViewingIP(ip);
  };

  // Handle final selection from Detail View
  const handleConfirmSelect = (ip) => {
    onSelectIP(ip);
    onOpenChange(false);
    setViewingIP(null);
    toast.success(`Selected "${ip.name}"`);
  };

  const renderCard = (ip) => (
    <div 
      key={ip._id || ip.id} 
      className="group relative border rounded-lg overflow-hidden cursor-pointer hover:border-primary hover:shadow-md transition-all bg-card flex flex-col"
      onClick={() => handleCardClick(ip)}
    >
      <div className="aspect-square relative bg-muted">
        {ip.thumbnailUrl || ip.imageUrl ? (
          <img 
            src={ip.thumbnailUrl || ip.imageUrl} 
            alt={ip.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
            <Badge variant="secondary" className="opacity-90 text-xs shadow-sm">{ip.category}</Badge>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h4 className="font-medium truncate text-sm" title={ip.name}>{ip.name}</h4>
        
        {ip.ownerName && (
           <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
             <User className="h-3 w-3" />
             <span className="truncate">{ip.ownerName}</span>
           </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
            <DollarSign className="h-3 w-3" />
            {ip.licensingFee?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl">
        
        {/* Render DETAILS view if an IP is selected */}
        {viewingIP ? (
        <>
          {/* A11y-only title for this content */}
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>{viewingIP.name}</DialogTitle>
              <DialogDescription>IP asset details</DialogDescription>
            </DialogHeader>
          </VisuallyHidden>

          <IPConsumerDialog
            ip={viewingIP}
            onBack={() => setViewingIP(null)}
            onSelect={(ipToUse) => {
              onSelectIP?.(ipToUse);
              onOpenChange(false);
              setViewingIP(null);
            }}
          />
        </>
        ) : (
          /* Render LIST view otherwise */
          <>
            <DialogHeader className="p-4 border-b">
              <DialogTitle>IP Asset Library</DialogTitle>
              <DialogDescription>Discover and license unique IP from our creator community.</DialogDescription>
            </DialogHeader>

            {/* Filters Bar */}
            <div className="p-4 border-b flex flex-wrap gap-3 items-center bg-muted/30">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search assets, descriptions, or creators..." 
                  className="pl-9 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[160px] bg-background">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCreator} onValueChange={setSelectedCreator}>
                <SelectTrigger className="w-[180px] bg-background border-dashed border-primary/50 text-primary">
                  <Store className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Shop by Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Creators</SelectItem>
                  {creators.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-2 border-b">
                <TabsList className="bg-transparent p-0 gap-4">
                  <TabsTrigger 
                    value="global" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-2"
                  >
                    Global Market
                  </TabsTrigger>
                  <TabsTrigger 
                    value="my-ip" 
                    disabled={!isConnected}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-2"
                  >
                    My Uploads
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="global" className="flex-1 overflow-hidden p-0 m-0 bg-muted/10">
                <ScrollArea className="h-full">
                  <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
                    {loading ? (
                      <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                    ) : ips.length === 0 ? (
                      <div className="col-span-full text-center text-muted-foreground py-20">
                        <p>No IP found matching your filters.</p>
                      </div>
                    ) : (
                      ips.map(renderCard)
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="my-ip" className="flex-1 overflow-hidden p-0 m-0 bg-muted/10">
                <ScrollArea className="h-full">
                  <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
                     {loading ? (
                      <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                    ) : ips.length === 0 ? (
                      <div className="col-span-full text-center text-muted-foreground py-20">
                        <p>You haven't uploaded any IP yet.</p>
                        <Button variant="link" onClick={() => window.open('/upload-ip', '_blank')}>Upload New IP</Button>
                      </div>
                    ) : (
                      ips.map(renderCard)
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
