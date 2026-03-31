'use client'

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useWallet } from 'lib/WalletContext'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Badge } from 'components/ui/badge'
import { Loader2, ArrowLeft, Search, Database } from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { BlankProductCard } from 'components/product-creator/BlankProductCard'
import { cn } from 'lib/utils'
import IPLibraryPanel from 'components/product-creator/IPLibraryPanel' 
import DesignPropertiesPanel from 'components/product-creator/DesignPropertiesPanel' 
import { Toaster } from 'sonner'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile';

const CATEGORY_ID_MAP = {
  Activewear: ['leggings', 'sports bra', 'athletic', 'joggers', 'active'],
  Fightwear: ['rash guard', 'bjj', 'mma', 'boxing', 'fighter', 'martial'],
  Formalwear: ['dress', 'blazer', 'formal', 'suit'],
  Headwear: ['hat', 'beanie', 'cap', 'snapback', 'headband', 'visor'],
  Patches: ['patch', 'patches', 'embroidered'],
  'Phone Cases': ['iphone', 'samsung', 'case', 'airpods', 'magsafe'],
  'Purses Tote Bags': ['bag', 'tote', 'purse', 'handbag'],
  Schoolwear: ['school uniform', 'varsity', 'college'],
  Streetwear: ['hoodie', 'sweatshirt', 'tee', 't-shirt', 'tank', 'men', 'women', 'unisex', 'longsleeve', 'sweater'],
  Swimwear: ['swimsuit', 'swim', 'bikini', 'trunks', 'boardshort'],
  Bedroom: ['pillow', 'blanket', 'duvet', 'sheet', 'slipper'],
  Kitchen: ['apron', 'mug', 'coaster', 'towel'],
  'Magnets Stickers': ['magnet', 'sticker'],
  Pets: ['pet', 'dog', 'cat'],
  'Posters Wall Art': ['poster', 'canvas', 'framed', 'flag', 'wall art'],
  Tech: ['mouse pad', 'laptop sleeve', 'ipad'],
  Backpacks: ['backpack', 'bag'],
  Study: ['notebook', 'stationery']
}

const TOP_LEVEL_GROUPS = {
  'Apparel Accessories': ['Activewear', 'Fightwear', 'Formalwear', 'Headwear', 'Patches', 'Phone Cases', 'Purses Tote Bags', 'Schoolwear', 'Streetwear', 'Swimwear'],
  'Home Office': ['Bedroom', 'Kitchen', 'Magnets Stickers', 'Pets', 'Posters Wall Art', 'Tech'],
  'School University': ['Backpacks', 'Study']
}

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') 
    .replace(/(^-|-$)/g, '');    
};

function ProductCreatorInner() {
  const { accountAddress } = useWallet()
  const pfDesignMakerRef = useRef(null)
  const edmSaveResolveRef = useRef(null)
  const currentNonceRef = useRef(null)
  const edmSaveTimeoutRef = useRef(null);
  const justClosedRef = useRef(false);

  const searchParams = useSearchParams()
  const urlExternalProductId = searchParams.get('externalProductId')
  const urlInitialIpId  = searchParams.get('ipId')

  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  const [step, setStep] = useState('catalog')
  const [catalogProducts, setCatalogProducts] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Products')
  const [selectedColor, setSelectedColor] = useState(null)
  const [inspectingProduct, setInspectingProduct] = useState(null)
  const [selectedBlank, setSelectedBlank] = useState(null)
  const [externalProductId, setExternalProductId] = useState(null)
  const [printfulTemplateId, setPrintfulTemplateId] = useState(null)
  const [edmLoading, setEdmLoading] = useState(false)
  const hasInitializedRef = useRef(false)
  const [selectedIPs, setSelectedIPs] = useState([])
  const [initialShowroomIP, setInitialShowroomIP] = useState(null)
  const hasAppliedShowroomIPRef = useRef(false)
  
  const inspectSlug = searchParams.get('inspect');
  
  useEffect(() => {
    if (justClosedRef.current) return;
    if (inspectSlug && catalogProducts.length > 0 && !inspectingProduct) {
      const productToInspect = catalogProducts.find(
        (p) => generateSlug(p.name) === inspectSlug
      );
      if (productToInspect) {
        setInspectingProduct(productToInspect);
      }
    }
  }, [inspectSlug, catalogProducts, inspectingProduct]);
  
  useEffect(() => {
    setSelectedIPs([])
  }, [selectedBlank, externalProductId, step])

  const refreshNonce = useCallback(async () => {
    try {
      const res = await fetch('/api/printful/edm-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalProductId, externalCustomerId: accountAddress || 'guest' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to refresh nonce');
      currentNonceRef.current = json.nonce;
      return json.nonce;
    } catch (error) {
      toast.error('Failed to prepare for save');
      return null;
    }
  }, [externalProductId, accountAddress]);

  const addIPToDesign = useCallback((ip) => {
    const instance = pfDesignMakerRef.current
    const imageUrl = ip.imageUrl || ip.thumbnailUrl

    if (!instance || !imageUrl) return

    setSelectedIPs((prev) =>
      prev.some((p) => p.id === ip.id)
        ? prev.map((p) => (p.id === ip.id ? ip : p))
        : [...prev, ip]
    )

    try {
      instance.sendMessage({ event: 'setUrlImageLayer', url: imageUrl })
      const edm = document.getElementById('printful-designer-container');
      if (edm) edm.focus();
    } catch (err) {
      toast.error('Failed to add image to designer')
    }
  }, [pfDesignMakerRef])

  useEffect(() => {
    if (!urlInitialIpId) return
    const run = async () => {
      try {
        const res = await fetch(`/api/ip/${urlInitialIpId}`)
        const data = await res.json()
        if (data.success && data.ipAsset) {
          const normalized = {
            id: data.ipAsset.id,
            name: data.ipAsset.name || data.ipAsset.title,
            title: data.ipAsset.title || data.ipAsset.name,
            description: data.ipAsset.description,
            imageUrl: data.ipAsset.imageUrl,
            thumbnailUrl: data.ipAsset.thumbnailUrl || data.ipAsset.imageUrl,
            category: data.ipAsset.category,
            ownerName: data.ipAsset.ownerName,
            licensingFee: data.ipAsset.licensingFee || 0,
          }
          setInitialShowroomIP(normalized)
        }
      } catch (e) {
        console.error('Failed to load initial showroom IP detail API:', e)
      }
    }
    run()
  }, [urlInitialIpId])

  useEffect(() => {
    if (step !== 'design' || !edmLoading) return
    const timer = setTimeout(() => {
      setEdmLoading(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [step, edmLoading]) 

  const selectedBlankId = selectedBlank?.catalogProductId

  const initializeEDM = useCallback(async (extId, catId, isEditingExisting = false, existingTemplateId = null) => {
    if (!extId || !catId) return;
    setEdmLoading(true);

    try {
      if (pfDesignMakerRef.current) {
        if (typeof pfDesignMakerRef.current.destroy === 'function') {
          pfDesignMakerRef.current.destroy();
        }
        pfDesignMakerRef.current = null;
      }

      const container = document.getElementById('printful-designer-container');
      if (container) container.innerHTML = '';

      const res = await fetch('/api/printful/edm-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalProductId: extId,
          externalCustomerId: accountAddress || 'guest',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to get nonce');

      const sdk = await new Promise((resolve) => {
        const poll = () => {
          if (window.PFDesignMaker) {
            resolve(window.PFDesignMaker);
          } else {
            setTimeout(poll, 200);
          }
        };
        poll();
      });

      const edmConfig = {
        elemId: 'printful-designer-container',
        nonce: String(json.nonce),
        externalProductId: extId,
        ...(existingTemplateId && { templateId: existingTemplateId }),
        onDesignStatusUpdate: (status) => {},
        onReady: () => {
          setEdmLoading(false);
          if (isEditingExisting && selectedIPs.length > 0) {
            setTimeout(() => selectedIPs.forEach(addIPToDesign), 500);
          }
          if (initialShowroomIP) {
            addIPToDesign(initialShowroomIP);
          }
        },
        onError: (error) => {
          toast.error(`Design Maker error: ${error}`);
          setEdmLoading(false);
        },
        onTemplateSaved: async (templateId) => {
          if (edmSaveTimeoutRef.current) {
            clearTimeout(edmSaveTimeoutRef.current);
            edmSaveTimeoutRef.current = null;
          }
          setPrintfulTemplateId(templateId);
          if (edmSaveResolveRef.current) {
            edmSaveResolveRef.current.resolve(templateId);
            edmSaveResolveRef.current = null;
          }
          toast.success('Design saved!');
        },
      };

      if (!existingTemplateId) {
        edmConfig.initProduct = { productId: catId };
      }

      const instance = new sdk(edmConfig);
      pfDesignMakerRef.current = instance;
      window.PFDesignMakerInstance = instance;

      const handleMessage = (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        if (JSON.stringify(event.data).includes('designerLoadedOK')) {
          window.removeEventListener('message', handleMessage);
          setEdmLoading(false);
          if (initialShowroomIP && !hasAppliedShowroomIPRef.current) {
            hasAppliedShowroomIPRef.current = true;
            setTimeout(() => addIPToDesign(initialShowroomIP), 500);
          }
        }
      };
      window.addEventListener('message', handleMessage);

      setTimeout(() => {
        setEdmLoading(false);
      }, 2500);

    } catch (e) {
      toast.error(`Failed to load designer: ${e.message}`);
      setEdmLoading(false);
    }
  }, [accountAddress, externalProductId, selectedBlankId, initialShowroomIP, addIPToDesign, selectedIPs]);

  const triggerEdmSave = useCallback(async () => {
    const instance = pfDesignMakerRef.current;
    if (!instance) return printfulTemplateId;

    return new Promise((resolve, reject) => {
      edmSaveResolveRef.current = { resolve, reject };

      const timeout = setTimeout(() => {
        if (edmSaveResolveRef.current) {
          if (printfulTemplateId) {
            edmSaveResolveRef.current.resolve(printfulTemplateId);
          } else {
            edmSaveResolveRef.current.reject(new Error('Save timeout'));
          }
          edmSaveResolveRef.current = null;
        }
      }, 5000);

      try {
        instance.sendMessage({ event: 'saveDesign' });
      } catch (err) {
        clearTimeout(timeout);
        edmSaveResolveRef.current = null;
        reject(err);
      }

      const handleSaveError = (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        const data = event.data.data || event.data;
        if (data.event === 'rpcError' || data.event === 'saveDesignFailed') {
          clearTimeout(timeout);
          edmSaveResolveRef.current = null;
          if (printfulTemplateId) {
            resolve(printfulTemplateId);
          } else {
            reject(new Error('Save failed: ' + (data.error || 'Unknown error')));
          }
          window.removeEventListener('message', handleSaveError);
        }
      };
      window.addEventListener('message', handleSaveError);
    });
  }, [printfulTemplateId]);

  const removeIP = useCallback((id) => {
    setSelectedIPs((prev) => prev.filter((ip) => ip.id !== id))
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://files.cdn.printful.com/embed/embed.js'
    script.async = true
    script.onerror = () => toast.error('Failed to load Printful Design Maker')
    document.body.appendChild(script)
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script)
    }
  }, [])

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/blank-products')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load catalog')

        const rawItems = data.products || []
        const mappedProducts = rawItems.map((p) => {
          const processedVariants = p.variants?.map((v) => ({
            ...v,
            colorCode: v.colorCode || v.colorcode || v.colorcode2 || null,
            colorKey: v.color?.trim().toLowerCase(),
          })) || []
          return {
            ...p,
            name: p.catalogProductName || p.name || 'Unknown Product',
            thumbnailUrl: p.printfulImage || p.printfulThumbnail || p.thumbnailUrl || processedVariants[0]?.files?.[0]?.previewUrl,
            description: p.description || 'No description available.',
            availableColors: p.availableColors?.length ? p.availableColors : [...new Set(processedVariants.map((v) => v.color).filter(Boolean))],
            availableSizes: p.availableSizes?.length ? p.availableSizes : [...new Set(processedVariants.map((v) => v.size))],
            variants: processedVariants,
            preferredTechnique: p.preferredTechnique || p.printTechniques?.[0]?.displayName || 'Standard',
          }
        })
        setCatalogProducts(mappedProducts)
      } catch (e) {
        toast.error(e.message)
      } finally {
        setLoadingCatalog(false)
      }
    }
    fetchCatalog()
  }, [])

  const filteredProducts = useMemo(() => {
    let list = [...catalogProducts]
    if (selectedCategory === 'All Products' && !searchQuery) {
      list.sort((a, b) => (a.printfulCategories?.[0] || '').localeCompare(b.printfulCategories?.[0] || ''))
    }
    if (searchQuery) {
      list = list.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (selectedCategory !== 'All Products') {
      let targetKeywords = []
      if (TOP_LEVEL_GROUPS[selectedCategory]) {
        TOP_LEVEL_GROUPS[selectedCategory].forEach((sub) => {
          targetKeywords = [...targetKeywords, ...(CATEGORY_ID_MAP[sub] || [])]
        })
      } else {
        targetKeywords = CATEGORY_ID_MAP[selectedCategory] || []
      }
      list = list.filter((p) => {
        const nameLower = p.name.toLowerCase()
        const tags = p.printfulCategories?.map((t) => t.toLowerCase()) || []
        return targetKeywords.some((kw) =>
          tags.includes(kw.toLowerCase()) || new RegExp(kw.toLowerCase(), 'i').test(nameLower)
        )
      })
    }
    return list
  }, [catalogProducts, selectedCategory, searchQuery])

  useEffect(() => {
    if (!urlExternalProductId || step !== 'catalog') return
    const loadExistingProduct = async () => {
      try {
        const res = await fetch('/api/metawork/products/list')
        const data = await res.json()
        const products = data.products || []
        const product = products.find((p) => p.externalProductId === urlExternalProductId)

        if (product) {
          setSelectedBlank({
            catalogProductId: product.catalogProductId || product.baseProductId || product._id,
            name: product.catalogProductName || product.name || product.baseProduct?.name,
            thumbnailUrl: product.mockupUrl || product.baseProduct?.thumbnailUrl,
          })
          setExternalProductId(urlExternalProductId)
          setPrintfulTemplateId(product.printfulTemplateId)
          setStep('design')
        }
      } catch (e) {
        console.error('Failed to load product:', e)
      }
    }
    loadExistingProduct()
  }, [urlExternalProductId, step])

  useEffect(() => {
    if (step !== 'design' || !externalProductId || !selectedBlankId) return;
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const isEditingExisting = !!urlExternalProductId;
      initializeEDM(externalProductId, selectedBlankId, isEditingExisting, printfulTemplateId);
    }
  }, [step, externalProductId, selectedBlankId, initializeEDM, initialShowroomIP]);

  useEffect(() => {
    const handleDesignStatus = (event) => {
      if (!event.data || typeof event.data !== 'object' || event.data.event !== 'designStatus') return;
      const usedPlacements = event.data?.data?.response?.usedPlacements || [];
      const layerCount = usedPlacements.length;

      setSelectedIPs((prev) => {
        if (layerCount < prev.length) return prev.slice(0, layerCount);
        if (layerCount > prev.length) {
          const newLayers = usedPlacements.slice(prev.length);
          const mockIPs = newLayers.map((placement, idx) => ({
            id: placement.id || `upload-${Date.now()}-${idx}`,
            name: 'Uploaded Image',
            title: 'Uploaded Design',
            imageUrl: placement.url || placement.imageUrl,
            thumbnailUrl: placement.url || placement.imageUrl,
            licensingFee: 0,
            category: 'Upload'
          }));
          return [...prev, ...mockIPs];
        }
        return prev;
      });
    };
    window.addEventListener('message', handleDesignStatus);
    return () => window.removeEventListener('message', handleDesignStatus);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans relative pointer-events-auto">
      
      {/* GLOBAL RADIX UI LOCK OVERRIDE */}
      {step === 'design' && (
        <style dangerouslySetInnerHTML={{ __html: `
          body { pointer-events: auto !important; }
          [data-radix-scroll-area-viewport] { pointer-events: auto !important; }
        `}} />
      )}

      {/* 1. TOP HEADER */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card z-[60] shadow-sm relative shrink-0">
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStep('catalog')
              hasInitializedRef.current = false
              hasAppliedShowroomIPRef.current = false
            }}
            className="gap-2 border-zinc-800 hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>
        </div>
        <h1 className="text-sm font-bold uppercase tracking-tight">Metawork</h1>
        <Badge className="bg-indigo-900/10 text-indigo-400 border-none uppercase text-[10px]">Sync Active</Badge>
      </header>

      {/* 2. SUB-NAV (Catalog) */}
      {step === 'catalog' && (
        <nav className="bg-background border-b px-6 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-10 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant={selectedCategory === 'All Products' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedCategory('All Products')
                SearchQuery('')
              }}
              className={cn(
                "font-bold h-10 px-6 rounded-full border-zinc-800 transition-all",
                selectedCategory === 'All Products' ? "bg-indigo-600 text-white" : "text-zinc-300"
              )}
            >
              <Database className="mr-2 h-4 w-4" />
              All Blanks
            </Button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {Object.keys(TOP_LEVEL_GROUPS).map((group) => (
              <Button
                key={group}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(group)}
                className={cn(
                  "text-xs font-bold h-10 px-4 rounded-full transition-colors whitespace-nowrap",
                  selectedCategory === group ? "bg-indigo-900/40 text-indigo-400" : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                {group}
              </Button>
            ))}
          </div>
          <div className="flex-1 w-full relative max-w-lg ml-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search catalog..."
              className="pl-11 h-10 bg-zinc-900 border-zinc-800 rounded-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </nav>
      )}

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        {/* CATALOG VIEW */}
        {step === 'catalog' && (
          <main className="h-full overflow-y-auto bg-black no-scrollbar scroll-smooth p-6 md:p-12">
            <div className="max-w-[1920px] mx-auto text-white">
              {loadingCatalog ? (
                <div className="flex flex-col items-center justify-center p-40">
                  <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
                </div>
              ) : (
                <div className="space-y-12">
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">
                    {selectedCategory}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                    {filteredProducts.map((p) => (
                      <BlankProductCard
                        key={p.id}
                        product={p}
                        onInspect={() => setInspectingProduct(p)}
                        onSelect={(prod) => {
                          setSelectedBlank(prod)
                          setExternalProductId(uuidv4())
                          setStep('design')
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        )}

        {/* DESIGN STUDIO VIEW */}
        {step === 'design' && (
          <div className="h-full flex flex-col md:flex-row bg-black overflow-hidden relative w-full">
            {/* IP Library Strip */}
            <div className={cn(
              "shrink-0 bg-zinc-950 border-zinc-800 relative z-30",
              isMobile ? "w-full h-32 border-b" : "w-80 border-r h-full"
            )}>
              <IPLibraryPanel
                selectedIPs={selectedIPs}
                onIPClick={addIPToDesign}
                onRemoveIP={removeIP}
                product={selectedBlank}
                isConnected={true}
              />
            </div>

            {/* THE DESIGNER STAGE (min-h-0 prevents flexbox from destroying bounds) */}
            <main 
              className={cn(
                "flex-1 relative bg-slate-950 z-10 min-h-0 min-w-0 h-full", 
                isMobile ? "mb-16" : "mb-0" 
              )}
            >
              {edmLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40 pointer-events-none">
                  <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
                </div>
              )}

              <div
                id="printful-designer-container"
                className="absolute inset-0 w-full h-full pointer-events-auto z-20"
              />
            </main>

            {/* DESKTOP SIDEBAR */}
            {!isMobile && (
              <div className="w-80 border-l border-zinc-800 shrink-0 h-full z-30 relative">
                <DesignPropertiesPanel
                  selectedIPs={selectedIPs}
                  onRemoveIP={removeIP}
                  product={selectedBlank}
                  baseProductPrice={selectedBlank?.variants?.[0]?.price || 0}
                  externalProductId={externalProductId}
                  printfulTemplateId={printfulTemplateId}
                  onTriggerEdmSave={triggerEdmSave}
                  refreshNonce={refreshNonce}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. MOBILE DRAWER: Removed transparent wrapper overlay to fix iOS/Safari bugs */}
      {isMobile && step === 'design' && (
        <>
          {/* Backdrop only renders when expanded */}
          {isExpanded && (
            <div 
              className="fixed inset-0 z-[90] bg-black/40 pointer-events-auto transition-opacity"
              onClick={() => setIsExpanded(false)}
            />
          )}

          {/* Drawer sits natively at the bottom */}
          <div 
            className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-auto transition-transform" 
          >
            <DesignPropertiesPanel
              selectedIPs={selectedIPs}
              onRemoveIP={removeIP}
              product={selectedBlank}
              baseProductPrice={selectedBlank?.variants?.[0]?.price || 0}
              externalProductId={externalProductId}
              printfulTemplateId={printfulTemplateId}
              onTriggerEdmSave={triggerEdmSave}
              refreshNonce={refreshNonce}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductCreatorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    }>
      <ProductCreatorInner />
      <Toaster position="top-right" richColors />
    </Suspense>
  )
}