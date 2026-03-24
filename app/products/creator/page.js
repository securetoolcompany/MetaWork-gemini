'use client'

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useWallet } from 'lib/WalletContext'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import {  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from 'components/ui/dialog'
import { Badge } from 'components/ui/badge'
import { Loader2, ArrowLeft, Search, Database, ChevronRight, Info, Globe, Truck, Fingerprint, Link } from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { BlankProductCard } from 'components/product-creator/BlankProductCard'
import { sortSizes, cn } from 'lib/utils'
import IPLibraryPanel from 'components/product-creator/IPLibraryPanel' // Adjust path
import DesignPropertiesPanel from 'components/product-creator/DesignPropertiesPanel' // Your provided component
import { Toaster } from 'sonner'
import { useSearchParams } from 'next/navigation'

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
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, '');    // Trim leading/trailing hyphens
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

  // State declarations
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
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [pendingTitle, setPendingTitle] = useState('')
  const [initialShowroomIP, setInitialShowroomIP] = useState(null)
  const [hasAppliedShowroomIP, setHasAppliedShowroomIP] = useState(false)
  const hasAppliedShowroomIPRef = useRef(false)

  console.log('RENDER DEBUG:', {
  step,
  externalProductId: !!externalProductId,
  selectedBlankId: !!selectedBlank?.catalogProductId,
  edmLoading,
  container: typeof document !== 'undefined' ? !!document.getElementById('printful-designer-container') : false
});
  console.log('🔍 SAVE STATE:', { printfulTemplateId, externalProductId, selectedIPs: selectedIPs.length });

  const inspectSlug = searchParams.get('inspect');
    useEffect(() => {
    // If we just closed it manually, don't let the URL re-open it
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
  
  // Reset IPs when blank/product changes
  useEffect(() => {
    setSelectedIPs([])
  }, [selectedBlank, externalProductId, step])

    const refreshNonce = useCallback(async () => {
  try {
    console.log('Refreshing nonce for next save...');
    const res = await fetch('/api/printful/edm-nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalProductId, externalCustomerId: accountAddress || 'guest' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to refresh nonce');
    
    const newNonce = json.nonce;
    console.log('New nonce obtained:', newNonce.substring(0, 10) + '...');
    
    currentNonceRef.current = newNonce;
    
    return newNonce;
  } catch (error) {
    console.error('Failed to refresh nonce', error);
    toast.error('Failed to prepare for save');
    return null;
  }
}, [externalProductId, accountAddress]);

  const addIPToDesign = useCallback((ip) => {
    console.log('addIPToDesign called with:', ip)
    const instance = pfDesignMakerRef.current
    console.log('EDM instance present?', !!instance)
    const imageUrl = ip.imageUrl || ip.thumbnailUrl
    console.log('imageUrl:', imageUrl)

    if (!instance || !imageUrl) {
      console.warn('Cannot send to EDM:', { hasInstance: !!instance, imageUrl })
      return
    }

    // Add to selected IPs (replace if exists)
    setSelectedIPs((prev) =>
      prev.some((p) => p.id === ip.id)
        ? prev.map((p) => (p.id === ip.id ? ip : p))
        : [...prev, ip]
    )

    try {
      console.log('sendMessage setUrlImageLayer:', imageUrl)
      instance.sendMessage({ event: 'setUrlImageLayer', url: imageUrl })
    } catch (err) {
      console.error('sendMessage failed:', err)
      toast.error('Failed to add image to designer')
    }
  }, [pfDesignMakerRef])

// NEW: Image upload handler
  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        // ✅ PERFECT - saves COMPLETE data with url
        setSelectedIPs(prev => {
          // Replace first IP or add new
          if (prev.length > 0) {
            return prev.map((p, i) => i === 0 ? data : p);
          }
          return [data];
        });
        toast.success('Image added to design!');
        addIPToDesign(data);  // Auto-add to EDM
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed');
      console.error(err);
    }
  }, [addIPToDesign]);

  // Load initial showroom IP
  useEffect(() => {
    if (!urlInitialIpId) return

    const run = async () => {
      try {
        console.log('urlInitialIpId in creator:', urlInitialIpId)
        const res = await fetch(`/api/ip/${urlInitialIpId}`)
        const data = await res.json()

        if (data.success && data.ipAsset) {
          console.log('Loaded initial showroom IP:', data.ipAsset)
          // Normalize to library shape
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
          console.log('initialShowroomIP state just set:', normalized)
        } else {
          console.warn('No IP asset found for id detail API:', urlInitialIpId, data)
        }
      } catch (e) {
        console.error('Failed to load initial showroom IP detail API:', e)
      }
    }
    run()
  }, [urlInitialIpId])

  // Fallback timer for EDM loading
  useEffect(() => {
    if (step !== 'design' || !edmLoading) return

    const timer = setTimeout(() => {
      console.log('Fallback: Force-hiding spinner')
      setEdmLoading(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [step, edmLoading]) // Fresh closure

  const selectedBlankId = selectedBlank?.catalogProductId

  // Enhanced syncEDMLayers - FIXED: make async and handle properly
  const syncEDMLayers = useCallback(async (currentIPs) => {
  console.log('Syncing EDM with', currentIPs.length, 'IPs')
  const instance = pfDesignMakerRef.current
  if (!instance || !externalProductId || !selectedBlankId) {
    console.warn('Cannot sync EDM - missing instance/product')
    return
  }

  setEdmLoading(true)

  try {
    // Destroy current EDM instance (clears all layers)
    if (typeof instance.destroy === 'function') {
      instance.destroy()
    }
    const container = document.getElementById('printful-designer-container')
    if (container) container.innerHTML = ''

    // Re-init clean EDM with fresh nonce
    await initializeEDM(externalProductId, selectedBlankId)

    // After re-init, add back remaining IPs
    setTimeout(() => {
      currentIPs.forEach((ip) => addIPToDesign(ip))
      setEdmLoading(false)
    }, 800) // Wait for EDM onReady
  } catch (err) {
    console.error('Sync failed:', err)
    toast.error('Failed to sync design')
    setEdmLoading(false)
  }
}, [accountAddress, externalProductId, selectedBlankId, initialShowroomIP, addIPToDesign,])

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

    const containerCheck = document.getElementById('printful-designer-container');
    if (!containerCheck) throw new Error('Container element not found');

    const edmConfig = {
      elemId: 'printful-designer-container',
      nonce: String(json.nonce),
      externalProductId: extId,
      ...(existingTemplateId && {
    templateId: existingTemplateId,}),
      onDesignStatusUpdate: (status) => {
        console.log('EDM layers:', status.usedPlacements?.length || 0);
      },
      onReady: () => {
        console.log('EDM Ready!', isEditingExisting ? 'edit' : 'new');
        setEdmLoading(false);
        if (isEditingExisting && selectedIPs.length > 0) {
          console.log('Restoring IPs');
          setTimeout(() => selectedIPs.forEach(addIPToDesign), 500);
        }
        if (initialShowroomIP) {
          console.log('onReady applying showroom IP', initialShowroomIP.id);
          addIPToDesign(initialShowroomIP);
        } else {
          console.log('onReady no showroom IP to apply', { hasInitial: !!initialShowroomIP });
        }
      },
      onError: (error) => {
        console.error('EDM Error', error);
        toast.error(`Design Maker error: ${error}`);
        setEdmLoading(false);
      },
      onTemplateSaved: async (templateId) => {
  console.log('Template saved with ID', templateId);
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


      console.log('🔑 Using nonce for EDM init:', json.nonce.substring(0, 10) + '...');
      console.log('🔑 Full edmConfig:', JSON.stringify({nonce: json.nonce, externalProductId: extId}, null, 2));


    const instance = new sdk(edmConfig);
    pfDesignMakerRef.current = instance;
    window.PFDesignMakerInstance = instance;

    const handleMessage = (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      const msgType = event.data.type || event.data.event || event.data.message;
      if (JSON.stringify(event.data).includes('designerLoadedOK')) {
        console.log('Designer loaded!');
        window.removeEventListener('message', handleMessage);
        setEdmLoading(false);
        if (initialShowroomIP && !hasAppliedShowroomIPRef.current) {
          console.log('Applying showroom IP first time only', initialShowroomIP.id);
          hasAppliedShowroomIPRef.current = true;
          setTimeout(() => addIPToDesign(initialShowroomIP), 500);
        } else {
          console.log('Skipping showroom IP re-apply');
        }
      }
    };
    window.addEventListener('message', handleMessage);

    setTimeout(() => {
      console.log('Fallback: Force-hiding spinner');
      setEdmLoading(false);
    }, 2500);

  } catch (e) {
    console.error('EDM initialization failed', e);
    toast.error(`Failed to load designer: ${e.message}`);
    setEdmLoading(false);
  }
}, [accountAddress, externalProductId, selectedBlankId, initialShowroomIP, addIPToDesign, refreshNonce, selectedIPs]);

const triggerEdmSave = useCallback(async () => {
  console.log('🎯 triggerEdmSave called', { printfulTemplateId, hasInstance: !!pfDesignMakerRef.current });

  const instance = pfDesignMakerRef.current;

  console.log('EDM DEBUG:', {
    hasInstance: !!instance,
    instanceType: instance?.constructor?.name || 'unknown',
  });

  // If no instance, just fall back to existing templateId (if any)
  if (!instance) {
    console.warn('No EDM instance—using existing templateId');
    return printfulTemplateId;
  }

  // Normal saveDesign flow
  return new Promise((resolve, reject) => {
    edmSaveResolveRef.current = { resolve, reject };

    const timeout = setTimeout(() => {
      console.warn('EDM save timeout - resolving with existing template');
      if (edmSaveResolveRef.current) {
        if (printfulTemplateId) {
          edmSaveResolveRef.current.resolve(printfulTemplateId);
        } else {
          edmSaveResolveRef.current.reject(new Error('Save timeout'));
        }
        edmSaveResolveRef.current = null;
      }
      if (edmSaveTimeoutRef.current) {
        edmSaveTimeoutRef.current = null;
      }
    }, 5000);  // 5s for testing


    try {
      instance.sendMessage({ event: 'saveDesign' });
      console.log('✅ EDM save triggered');
    } catch (err) {
      console.error('Trigger failed:', err);
      clearTimeout(timeout);
      edmSaveResolveRef.current = null;
      reject(err);
    }
    // ✅ NEW: Listen for saveDesignFailed / rpcError
    const handleSaveError = (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      
      const data = event.data.data || event.data;
      if (data.event === 'rpcError' || data.event === 'saveDesignFailed') {
        console.log('💥 EDM save failed:', data);
        clearTimeout(timeout);
        edmSaveResolveRef.current = null;
        
        // ✅ Resolve with existing templateId (don't fail!)
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
    console.log('Removing IP from panel:', id)
    setSelectedIPs((prev) => prev.filter((ip) => ip.id !== id))
  }, [])

  // Load Printful EDM SDK
  useEffect(() => {
    console.log('Loading Printful EDM SDK...')
    const script = document.createElement('script')
    script.src = 'https://files.cdn.printful.com/embed/embed.js'
    script.async = true
    script.onload = () => {
      console.log('Printful EDM SDK loaded successfully')
      console.log('window.PFDesignMaker available:', !!window.PFDesignMaker)
    }
    script.onerror      = () => {
        console.error('Failed to load Printful Design Maker')
        toast.error('Failed to load Printful Design Maker')
      }
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Fetch catalog
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
            availableSizes: p.availableSizes?.length ? p.availableSizes              : [...new Set(processedVariants.map((v) => v.size))],
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

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = [...catalogProducts]

    if (selectedCategory === 'All Products' && !searchQuery) {
      list.sort((a, b) => (a.printfulCategories?.[0] || '').localeCompare(b.printfulCategories?.[0] || ''))
    }

    if (searchQuery) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== 'All Products') {
      let targetKeywords = []
      if (TOP_LEVEL_GROUPS[selectedCategory]) {
        TOP_LEVEL_GROUPS[selectedCategory].forEach((sub) => {
          targetKeywords = [...targetKeywords, ...(CATEGORY_ID_MAP[sub]            || [])]
        })
      } else {
        targetKeywords = CATEGORY_ID_MAP[selectedCategory] || []
      }

      list = list.filter((p) => {
        const nameLower = p.name.toLowerCase()
        const tags = p.printfulCategories?.map((t) => t.toLowerCase()) || []
        return targetKeywords.some((kw) =>
          tags.includes(kw.toLowerCase()) ||
          new RegExp(kw.toLowerCase(), 'i').test(nameLower)
        )
      })
    }

    return list
  }, [catalogProducts, selectedCategory, searchQuery])

  // Load existing product when deep-linked from my-products
  useEffect(() => {
    if (!urlExternalProductId || step !== 'catalog') return

    const loadExistingProduct = async ()      => {
      try {
        console.log('Loading existing product:', urlExternalProductId)
        const res = await fetch('/api/metawork/products/list')
        const data = await res.json()
        console.log('API response:', data)

        const products = data.products || []
        const product = products.find((p) => p.externalProductId === urlExternalProductId)

        if (product) {
          console.log('Found product:', product)
          console.log('Setting selectedBlank with catalogProductId:', product.catalogProduct)

          setSelectedBlank({
            catalogProductId: product.catalogProductId || product.baseProductId || product._id,
            name: product.catalogProductName || product.name || product.baseProduct?.name,
            thumbnailUrl: product.mockupUrl || product.baseProduct?.thumbnailUrl,
          })
          setExternalProductId(urlExternalProductId)
          setPrintfulTemplateId(product.printfulTemplateId)
          setStep('design')
        } else {
          console.warn('Product not found in list')
        }
      } catch (e) {
        console.error('Failed to load product:', e)
      }
    }
    loadExistingProduct()
  }, [urlExternalProductId, step])

  // Main EDM effect
useEffect(() => {
  console.log('EDM effect run:', { step, externalProductId, selectedBlankId: selectedBlank?.catalogProductId, hasInitialized: hasInitializedRef.current });

  if (step !== 'design' || !externalProductId || !selectedBlankId) return;

  // SINGLE init block - reset handled externally (onTemplateSaved)
  if (!hasInitializedRef.current) {
    hasInitializedRef.current = true;
    console.log('🚀 Triggering EDM initialization...');
    const isEditingExisting = !!urlExternalProductId;
    initializeEDM(externalProductId, selectedBlankId, isEditingExisting, printfulTemplateId);
  }
}, [step, externalProductId, selectedBlankId, initializeEDM, initialShowroomIP]);

// Sync panel with EDM layers via postMessage
useEffect(() => {
  const handleDesignStatus = (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.event !== 'designStatus') return;

    const usedPlacements = event.data?.data?.response?.usedPlacements || [];
    const layerCount = usedPlacements.length;
    console.log('EDM layer sync:', layerCount, 'layers', usedPlacements.map(p => ({id: p.id, url: p.url})));

    setSelectedIPs((prev) => {
      if (layerCount < prev.length) {
        console.log('EDM removed a layer, syncing panel');
        return prev.slice(0, layerCount);
      }
      
      // NEW: Add mock IPs for Printful uploads (no id)
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
        console.log('✅ Added mock IPs for uploads:', mockIPs.length);
        return [...prev, ...mockIPs];
      }
      
      return prev;
    });
  };

  window.addEventListener('message', handleDesignStatus);
  return () => window.removeEventListener('message', handleDesignStatus);
}, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
      {/* TOP HEADER */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card z-50 shadow-sm relative">
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
        <div className="h-8 w-px bg-zinc-800 hidden md:block" />
        <h1 className="text-sm font-bold uppercase tracking-tight">Metawork</h1>
        <div />

        <div className="hidden lg:flex items-center gap-8 text-white">
          <div className={cn(
            "flex items-center gap-2 text-xs font-semibold",
            step === 'catalog' ? 'opacity-100' : 'opacity-40'
          )}>
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shadow-0015px-rgba(79,70,229,0.2)">
              1
            </span>
            <span>Select Base</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30" />
          <div className={cn(
            "flex items-center            gap-2 text-xs font-semibold",
            step === 'design' ? 'opacity-100' : 'opacity-40'
          )}>
            <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Design Studio</span>
          </div>
        </div>
        <Badge className="bg-indigo-900/10 text-indigo-400 border-none uppercase text-[10px]">Sync Active</Badge>
      </header>

      {/* REFINED SUB-NAV */}
      {step === 'catalog' && (
        <nav className="bg-background border-b px-6 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-10 z-40 overflow-visible no-scrollbar scrollbar-hide">
          <div className="flex items-center gap-4 overflow-visible no-scrollbar scrollbar-hide">
            <Button
              variant={selectedCategory === 'All Products' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedCategory('All Products')
                setSearchQuery('')
              }}
              className={cn(
                "font-bold h-10 px-6 rounded-full border-zinc-800 transition-all",
                selectedCategory === 'All Products'
                  ? "bg-indigo-600 text-white border-none shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                  : "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <Database className="mr-2 h-4 w-4" />
              All Blanks
            </Button>
          </div>

          <div className="flex items-center overflow-visible gap-1 no-scrollbar scrollbar-hide">
            {Object.keys(TOP_LEVEL_GROUPS).map((group)              => (
                <div key={group} className="relative group overflow-visible">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory(group)}
                    className={cn(
                      "text-xs font-bold h-10 px-4 rounded-full transition-colors",
                      selectedCategory === group
                        ? "bg-indigo-900/40 text-indigo-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                    )}
                  >
                    {group}
                  </Button>
                  <div className="absolute top-full left-0 mt-0 pt-2 hidden group-hover:block z-[100] min-w-[220px]">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 no-scrollbar scrollbar-hide">
                      {TOP_LEVEL_GROUPS[group].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setSelectedCategory(sub)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-xs rounded-xl flex items-center justify-between transition-colors",
                            selectedCategory === sub
                              ? "bg-indigo-900/40 text-indigo-400 font-bold"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          )}
                        >
                          {sub}
                          {selectedCategory === sub && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="flex-1 w-full relative max-w-lg ml-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search catalog intelligence..."
              className="pl-11 h-10 bg-zinc-900 border-zinc-800 rounded-full text-zinc-300 focus-visible:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </nav>
      )}

           {/* MAIN GRID */}
      <div className="flex-1 overflow-hidden">
        {step === 'catalog' && (
          <main className="h-full overflow-y-auto bg-black no-scrollbar scrollbar-hide scroll-smooth">
            <div className="max-w-[1920px] mx-auto p-12 pt-8 text-white">
              {loadingCatalog ? (
                <div className="flex flex-col items-center justify-center p-40 gap-4">
                  <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
                  <div />
                </div>
              ) : (
                <>
                  <div className="space-y-12">
                    <div className="flex items-baseline gap-4">
                      <h2 className="text-4xl font-black tracking-tighter uppercase">
                        {selectedCategory}
                      </h2>
                      <span className="text-zinc-600 font-bold text-sm">
                        {filteredProducts.length} curated bases
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-6 gap-y-10">
                      {filteredProducts.map((p) => (
                        <BlankProductCard
                          key={p.id}
                          product={p}
                          onInspect={() => {
                            // 1. Open the dialog locally
                            setInspectingProduct(p);
                            // 2. Update the URL for shareability
                            const url = new URL(window.location);
                            url.searchParams.set('inspect', generateSlug(p.name));
                            window.history.pushState({}, '', url);
                          }}
                          onSelect={(prod) => {
                            console.log('Selecting blank with current initialShowroomIP:', initialShowroomIP)
                            setSelectedBlank(prod)
                            setExternalProductId(uuidv4())
                            setStep('design')
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </main>
        )}

        {step === 'design' && (
          <div className="h-full flex bg-black">
            {/* Left: IP Library */}
            <div className="w-80 border-r border-zinc-800 shrink-0 hidden lg:block">
              <IPLibraryPanel
                selectedIPs={selectedIPs}
                onIPClick={addIPToDesign}
                onRemoveIP={removeIP}
                product={selectedBlank}
                isConnected={true}
              />
            </div>

            {/* Center: Printful EDM */}
            <div className="flex-1 min-h-0 relative">
              {/* Loading overlay */}
              {edmLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-10">
                  <div className="text-center space-y-4">
                    <Loader2 className="animate-spin h-12 w-12 text-indigo-500 mx-auto" />
                    <p className="text-lg font-semibold">Loading Design Studio...</p>
                  </div>
                </div>
              )}

              {/* Container always exists, just hidden during loading */}
              <div
                id="printful-designer-container"
                className="w-full h-full"
                style={{ visibility: edmLoading ? 'hidden' : 'visible' }}
              />
            </div>

            {/* Right: Properties */}
            <div className="w-80 border-l border-zinc-800 shrink-0">
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
          </div>
        )}
      </div>

      {/* REARRANGED SPECS INSPECTOR AS DIALOG */}
      <Dialog 
        open={!!inspectingProduct} 
        onOpenChange={(open) => {
          if (!open) {
            // 1. SET THE GUARD
            justClosedRef.current = true;

            // 2. CLEAR URL
            const url = new URL(window.location.href);
            url.searchParams.delete('inspect');
            window.history.replaceState(null, '', url.pathname + url.search);

            // 3. RESET STATE
            setInspectingProduct(null);
            setSelectedColor(null);

            // 4. Release guard after a short timeout (tick)
            setTimeout(() => { justClosedRef.current = false; }, 100);
          }
        }}
      >
        <DialogContent className="max-w-7xl h-[90vh] p-0 bg-zinc-950 border-zinc-800 text-white overflow-hidden flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{inspectingProduct?.name} Details</DialogTitle>
            <DialogDescription>Technical specifications and production details.</DialogDescription>
          </DialogHeader>

          {/* --- START NEW WIDER SCROLLABLE CONTENT --- */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            
            {/* 🌟 1. NEW 21:9 SPLIT HERO SECTION 🌟 */}
            <div className="aspect-[21/9] w-full bg-zinc-900 border-b border-zinc-800 relative shrink-0 grid grid-cols-2">
              
              {/* 📸 LEFT SIDE: Product Image (As before, contained and blend-mode) */}
              <div className="h-full w-full border-r border-zinc-800/50 p-12 flex items-center justify-center relative">
                <img
                  src={inspectingProduct?.thumbnailUrl}
                  alt={inspectingProduct?.name}
                  className="object-contain w-full h-full mix-blend-lighten"
                />
                {/* Subtle Gradient Shadow at bottom of Image area */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950/50 to-transparent pointer-events-none" />
              </div>

              {/* 🎨 RIGHT SIDE: High-Level Info (Strategy, Share, Colors, and Logistics) */}
              <div className="h-full w-full p-12 space-y-8 flex flex-col justify-center">
                
                {/* Production Strategy & Share Block */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.25em]">
                    Primary Technique
                  </p>
                  <div className="flex items-center gap-6">
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-white">
                      {inspectingProduct?.preferredTechnique}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 rounded-full bg-zinc-800 text-[10px] font-bold uppercase text-zinc-400 hover:bg-indigo-600 hover:text-white transition-all shrink-0"
                      onClick={() => {
                        const slug = generateSlug(inspectingProduct.name);
                        const shareUrl = `${window.location.origin}${window.location.pathname}?inspect=${slug}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success("Link Copied!");
                      }}
                    >
                      <Link className="h-3 w-3" />
                      Share Base
                    </Button>
                  </div>
                </div>

                {/* 🚀 NEW: TOP-LEVEL LOGISTICS GRID 🚀 */}
                <div className="grid grid-cols-2 gap-4 border-y border-zinc-800/50 py-6">
                  <div className="flex items-start gap-3">
                    <Globe className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Produced In</p>
                      <p className="text-xs font-bold mt-1 text-zinc-200">{inspectingProduct?.producedIn || 'Global Centers'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Truck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Logistics</p>
                      <p className="text-xs font-bold mt-1 uppercase text-zinc-200">Ships to {inspectingProduct?.shipsTo || 'Global'}</p>
                    </div>
                  </div>
                </div>

                {/* Available Colors Block */}
                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-indigo-500" />
                    Available Swatches
                    <span className="ml-2 text-indigo-400 font-bold uppercase tracking-tight">
                      {selectedColor || inspectingProduct?.availableColors?.[0]}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {inspectingProduct?.availableColors?.map((c) => {
                      const variant = inspectingProduct.variants?.find(v => v.color === c);
                      return (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(c)}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 p-1 transition-all",
                            (selectedColor === c || (!selectedColor && c === inspectingProduct?.availableColors?.[0]))
                              ? "border-indigo-600 scale-110 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                              : "border-transparent hover:scale-105"
                          )}
                        >
                          <div className="w-full h-full rounded-full border border-white/5" style={{ backgroundColor: variant?.colorCode || c }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 🌟 2. UPDATED REMAINING METADATA STACK (Cost Table) 🌟 */}
            <div className="p-12 space-y-12">
              {/* COST MATRIX TABLE (Preserved logic, removed color selection block) */}
              <div className="space-y-6">
                <h3 className="font-black text-xs uppercase tracking-widest text-zinc-500">
                  Price Breakdown
                </h3>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden shadow-inner shadow-black/10">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-800/50 text-zinc-500 font-black uppercase">
                      <tr>
                        <th className="p-5 text-left tracking-wide">Size</th>
                        <th className="p-5 text-right tracking-wide">Base Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {inspectingProduct?.variants?.filter(v => v.color === (selectedColor || inspectingProduct.availableColors?.[0])).map((v) => (
                        <tr key={v.variantId} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-5 font-bold text-white uppercase">{v.size}</td>
                          <td className="p-5 text-right font-black text-emerald-400 text-sm">${v.price?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          {/* STICKY FOOTER */}
          <div className="p-8 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 shrink-0">
            <Button
              className="w-full h-16 text-lg font-black bg-indigo-600 hover:bg-indigo-500 rounded-xl uppercase tracking-tighter shadow-2xl shadow-indigo-600/30"
              onClick={() => {
                setSelectedBlank(inspectingProduct)
                setExternalProductId(uuidv4())
                hasInitializedRef.current = false
                setStep('design')
                setInspectingProduct(null)
              }}
            >
              Enter Design Studio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
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