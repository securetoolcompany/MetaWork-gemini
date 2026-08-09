'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
  useMemo,
} from 'react'
import { useWallet } from 'lib/WalletContext'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Badge } from 'components/ui/badge'
import { Loader2, ArrowLeft, Search, Database } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { BlankProductCard } from 'components/product-creator/BlankProductCard'
import { cn } from 'lib/utils'
import IPLibraryPanel from 'components/product-creator/IPLibraryPanel'
import DesignPropertiesPanel from 'components/product-creator/DesignPropertiesPanel'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import BlankProductDetailsDialog from 'components/product-creator/BlankProductDetailsDialog'

const CATEGORY_ID_MAP = {
  Activewear: ['leggings', 'sports bra', 'athletic', 'joggers', 'active'],
  Fightwear: ['rash guard', 'bjj', 'mma', 'boxing', 'fighter', 'martial'],
  Formalwear: ['dress', 'blazer', 'formal', 'suit'],
  Headwear: ['hat', 'beanie', 'cap', 'snapback', 'headband', 'visor'],
  Patches: ['patch', 'patches', 'embroidered'],
  'Phone Cases': ['iphone', 'samsung', 'case', 'airpods', 'magsafe'],
  'Purses Tote Bags': ['bag', 'tote', 'purse', 'handbag'],
  Schoolwear: ['school uniform', 'varsity', 'college'],
  Streetwear: [
    'hoodie',
    'sweatshirt',
    'tee',
    't-shirt',
    'tank',
    'men',
    'women',
    'unisex',
    'longsleeve',
    'sweater',
  ],
  Swimwear: ['swimsuit', 'swim', 'bikini', 'trunks', 'boardshort'],
  Bedroom: ['pillow', 'blanket', 'duvet', 'sheet', 'slipper'],
  Kitchen: ['apron', 'mug', 'coaster', 'towel'],
  'Magnets Stickers': ['magnet', 'sticker'],
  Pets: ['pet', 'dog', 'cat'],
  'Posters Wall Art': ['poster', 'canvas', 'framed', 'flag', 'wall art'],
  Tech: ['mouse pad', 'laptop sleeve', 'ipad'],
  Backpacks: ['backpack', 'bag'],
  Study: ['notebook', 'stationery'],
}

const TOP_LEVEL_GROUPS = {
  'Apparel Accessories': [
    'Activewear',
    'Fightwear',
    'Formalwear',
    'Headwear',
    'Patches',
    'Phone Cases',
    'Purses Tote Bags',
    'Schoolwear',
    'Streetwear',
    'Swimwear',
  ],
  'Home Office': [
    'Bedroom',
    'Kitchen',
    'Magnets Stickers',
    'Pets',
    'Posters Wall Art',
    'Tech',
  ],
  'School University': ['Backpacks', 'Study'],
}

const generateSlug = (text) => {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function ProductCreatorInner() {
  const { accountAddress } = useWallet()

  const pfDesignMakerRef = useRef(null)
  const edmSaveResolveRef = useRef(null)
  const currentNonceRef = useRef(null)
  const edmSaveTimeoutRef = useRef(null)
  const justClosedRef = useRef(false)
  const designerLoadedListenerRef = useRef(null)
  const saveErrorListenerRef = useRef(null)

  const searchParams = useSearchParams()
  const urlExternalProductId = searchParams.get('externalProductId')
  const urlInitialIpId = searchParams.get('ipId')
  const inspectSlug = searchParams.get('inspect')

  const isMobile = useIsMobile()

  const [isExpanded, setIsExpanded] = useState(false)

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
  const [selectedIPs, setSelectedIPs] = useState([])
  const [initialShowroomIP, setInitialShowroomIP] = useState(null)

  const hasInitializedRef = useRef(false)
  const hasAppliedShowroomIPRef = useRef(false)

  const selectedBlankId = selectedBlank?.catalogProductId

  const clearGlobalInteractionLocks = useCallback(() => {
    if (typeof document === 'undefined') return

    document.documentElement.style.pointerEvents = 'auto'
    document.body.style.pointerEvents = 'auto'
    document.documentElement.style.touchAction = 'auto'
    document.body.style.touchAction = 'auto'

    document.documentElement.removeAttribute('data-scroll-locked')
    document.body.removeAttribute('data-scroll-locked')

    const radixPortals = document.querySelectorAll('[data-radix-portal]')
      radixPortals.forEach((portal) => {
        // Remove the 'as HTMLElement' assertion
        if (!portal.hasChildNodes()) {
          portal.style.pointerEvents = 'none'
        }
      })
  }, [])

  useEffect(() => {
    if (step !== 'design') return

    clearGlobalInteractionLocks()

    const t1 = window.setTimeout(clearGlobalInteractionLocks, 50)
    const t2 = window.setTimeout(clearGlobalInteractionLocks, 250)
    const t3 = window.setTimeout(clearGlobalInteractionLocks, 800)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [step, clearGlobalInteractionLocks])

  useEffect(() => {
    const handleWindowFocus = () => {
      if (step === 'design') clearGlobalInteractionLocks()
    }

    const handleVisibility = () => {
      if (!document.hidden && step === 'design') clearGlobalInteractionLocks()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [step, clearGlobalInteractionLocks])

  useEffect(() => {
    if (justClosedRef.current) return
    if (inspectSlug && catalogProducts.length > 0 && !inspectingProduct) {
      const productToInspect = catalogProducts.find(
        (p) => generateSlug(p.name) === inspectSlug
      )
      if (productToInspect) {
        setInspectingProduct(productToInspect)
      }
    }
  }, [inspectSlug, catalogProducts, inspectingProduct])

  useEffect(() => {
    setSelectedIPs([])
  }, [selectedBlank, externalProductId, step])

  const refreshNonce = useCallback(async () => {
    try {
      const res = await fetch('/api/printful/edm-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalProductId,
          externalCustomerId: accountAddress || 'guest',
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to refresh nonce')

      currentNonceRef.current = json.nonce
      return json.nonce
    } catch (error) {
      toast.error('Failed to prepare for save')
      return null
    }
  }, [externalProductId, accountAddress])

  const addIPToDesign = useCallback(
  (ip) => {
    const imageUrl = (ip.imageUrl || ip.thumbnailUrl || '').replace(/\/ipfs\/ipfs\//, '/ipfs/')
      if (!imageUrl) return

    const tryAdd = (attempts = 0) => {
      const instance = pfDesignMakerRef.current
      if (!instance) {
        if (attempts < 5) setTimeout(() => tryAdd(attempts + 1), 200)
        else toast.error('Designer not ready — please try again')
        return
      }
      setSelectedIPs((prev) =>
        prev.some((p) => p.id === ip.id)
          ? prev.map((p) => (p.id === ip.id ? ip : p))
          : [...prev, ip]
      )
      try {
  clearGlobalInteractionLocks()

  const iframe = document.querySelector('#printful-designer-container iframe')
  if (!iframe?.contentWindow) {
    console.warn('[addIPToDesign] no iframe contentWindow found')
    return
  }

  const targetOrigin = 'https://www.printful.com'

  console.log('[addIPToDesign] sending to origin:', targetOrigin, 'imageUrl:', imageUrl)

  iframe.contentWindow.postMessage(
    {
      event: 'setUrlImageLayer',
      imageUrl
    },
    targetOrigin
  )
} catch (err) {
  console.error('[addIPToDesign] error:', err)
  toast.error('Failed to add image to designer')
}
}

    tryAdd()
  },
  [clearGlobalInteractionLocks]
)

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

  const initializeEDM = useCallback(
    async (extId, catId, isEditingExisting = false, existingTemplateId = null) => {
      if (!extId || !catId) return

      setEdmLoading(true)
      clearGlobalInteractionLocks()

      try {
        if (designerLoadedListenerRef.current) {
          window.removeEventListener('message', designerLoadedListenerRef.current)
          designerLoadedListenerRef.current = null
        }

        if (saveErrorListenerRef.current) {
          window.removeEventListener('message', saveErrorListenerRef.current)
          saveErrorListenerRef.current = null
        }

        if (pfDesignMakerRef.current) {
          if (typeof pfDesignMakerRef.current.destroy === 'function') {
            pfDesignMakerRef.current.destroy()
          }
          pfDesignMakerRef.current = null
        }

        const container = document.getElementById('printful-designer-container')
        if (container) {
          container.innerHTML = ''
          container.style.pointerEvents = 'auto'
          container.style.touchAction = 'manipulation'
        }

        const res = await fetch('/api/printful/edm-nonce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalProductId: extId,
            externalCustomerId: accountAddress || 'guest',
          }),
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to get nonce')

        const sdk = await new Promise((resolve) => {
          const poll = () => {
            if (window.PFDesignMaker) {
              resolve(window.PFDesignMaker)
            } else {
              setTimeout(poll, 200)
            }
          }
          poll()
        })

        const edmConfig = {
          elemId: 'printful-designer-container',
          nonce: String(json.nonce),
          externalProductId: extId,
          ...(existingTemplateId ? { templateId: existingTemplateId } : {}),
          
          onDesignStatusUpdate: () => {},

          onReady: () => {
            clearGlobalInteractionLocks()
            setEdmLoading(false)

            if (isEditingExisting && selectedIPs.length > 0) {
              setTimeout(() => {
                selectedIPs.forEach(addIPToDesign)
              }, 500)
            }

            if (initialShowroomIP && !hasAppliedShowroomIPRef.current) {
              hasAppliedShowroomIPRef.current = true
              setTimeout(() => addIPToDesign(initialShowroomIP), 500)
            }
          },

          onIframeLoaded: () => {
            clearGlobalInteractionLocks()
            setEdmLoading(false)
          },

          onError: (error) => {
            toast.error(`Design Maker error: ${error}`)
            clearGlobalInteractionLocks()
            setEdmLoading(false)
          },

          onTemplateSaved: (templateId) => {
            if (edmSaveTimeoutRef.current) {
              clearTimeout(edmSaveTimeoutRef.current);
              edmSaveTimeoutRef.current = null;
            }

            setPrintfulTemplateId(templateId);

            if (edmSaveResolveRef.current) {
              edmSaveResolveRef.current.resolve(templateId);
              edmSaveResolveRef.current = null;
            }

            if (saveErrorListenerRef.current) {
              window.removeEventListener('message', saveErrorListenerRef.current);
              saveErrorListenerRef.current = null;
            }

            toast.success('Design saved!');
          },
        }

        if (!existingTemplateId) {
          edmConfig.initProduct = { productId: catId }
        }

        const instance = new sdk(edmConfig)
        pfDesignMakerRef.current = instance
        window.PFDesignMakerInstance = instance

        const handleDesignerLoadedMessage = (event) => {
          if (!event.data || typeof event.data !== 'object') return

          const payload = event.data?.data || event.data
          const payloadString = JSON.stringify(payload)

          if (payloadString.includes('designerLoadedOK')) {
            clearGlobalInteractionLocks()
            setEdmLoading(false)

            if (initialShowroomIP && !hasAppliedShowroomIPRef.current) {
              hasAppliedShowroomIPRef.current = true
              setTimeout(() => addIPToDesign(initialShowroomIP), 500)
            }
          }
        }

        designerLoadedListenerRef.current = handleDesignerLoadedMessage
        window.addEventListener('message', handleDesignerLoadedMessage)

        setTimeout(() => {
          clearGlobalInteractionLocks()
          setEdmLoading(false)
        }, 2500)
      } catch (e) {
        toast.error(`Failed to load designer: ${e.message}`)
        clearGlobalInteractionLocks()
        setEdmLoading(false)
      }
    },
    [
      accountAddress,
      addIPToDesign,
      clearGlobalInteractionLocks,
      initialShowroomIP,
      selectedIPs,
    ]
  )

  const triggerEdmSave = useCallback(() => {
    const instance = pfDesignMakerRef.current;
    if (!instance) {
      return Promise.reject(new Error('Designer not ready'));
    }

    return new Promise((resolve, reject) => {
      if (edmSaveTimeoutRef.current) {
        clearTimeout(edmSaveTimeoutRef.current);
        edmSaveTimeoutRef.current = null;
      }

      edmSaveResolveRef.current = {
        resolve: (templateId) => {
          resolve({
            templateId,
          });
        },
        reject,
      };

      edmSaveTimeoutRef.current = setTimeout(() => {
        if (edmSaveResolveRef.current) {
          edmSaveResolveRef.current.reject(new Error('Save timeout'));
          edmSaveResolveRef.current = null;
        }
        edmSaveTimeoutRef.current = null;
      }, 15000);

      try {
        instance.sendMessage({ event: 'saveDesign' });
      } catch (err) {
        if (edmSaveTimeoutRef.current) {
          clearTimeout(edmSaveTimeoutRef.current);
          edmSaveTimeoutRef.current = null;
        }
        edmSaveResolveRef.current = null;
        reject(err);
      }
    });
  }, []);

  const removeIP = useCallback((id) => {
    setSelectedIPs((prev) => prev.filter((ip) => ip.id !== id))
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://files.cdn.printful.com/embed/embed.js'
    script.async = true
    script.onerror = () => toast.error('Failed to load MetaWork Product Creator')
    document.body.appendChild(script)

    return () => {
      if (designerLoadedListenerRef.current) {
        window.removeEventListener('message', designerLoadedListenerRef.current)
        designerLoadedListenerRef.current = null
      }

      if (saveErrorListenerRef.current) {
        window.removeEventListener('message', saveErrorListenerRef.current)
        saveErrorListenerRef.current = null
      }

      if (pfDesignMakerRef.current?.destroy) {
        pfDesignMakerRef.current.destroy()
        pfDesignMakerRef.current = null
      }

      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
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
          const processedVariants =
            p.variants?.map((v) => ({
              ...v,
              colorCode: v.colorCode || v.colorcode || v.colorcode2 || null,
              colorKey: v.color?.trim().toLowerCase(),
            })) || []

          return {
            ...p,
            name: p.catalogProductName || p.name || 'Unknown Product',
            thumbnailUrl:
              p.printfulImage ||
              p.printfulThumbnail ||
              p.thumbnailUrl ||
              processedVariants[0]?.files?.[0]?.previewUrl,
            description: p.description || 'No description available.',
            availableColors: p.availableColors?.length
              ? p.availableColors
              : [...new Set(processedVariants.map((v) => v.color).filter(Boolean))],
            availableSizes: p.availableSizes?.length
              ? p.availableSizes
              : [...new Set(processedVariants.map((v) => v.size))],
            variants: processedVariants,
            preferredTechnique:
              p.preferredTechnique ||
              p.printTechniques?.[0]?.displayName ||
              'Standard',
          }
        })

        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[ProductCreatorInner] catalog polo pricing",
            mappedProducts
              .filter((p) =>
                (p.name || "").toLowerCase().includes("adidas space-dyed polo shirt")
              )
              .map((p) => ({
                id: p.id || p.catalogProductId,
                name: p.name,
                variants: (p.variants || []).map((v) => ({
                  id: v.id || v.variantId,
                  size: v.size,
                  color: v.color,
                  price: v.price,
                  retail_price: v.retail_price,
                })),
              }))
          );
        }

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
      list.sort((a, b) =>
        (a.printfulCategories?.[0] || '').localeCompare(
          b.printfulCategories?.[0] || ''
        )
      )
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
          targetKeywords = [...targetKeywords, ...(CATEGORY_ID_MAP[sub] || [])]
        })
      } else {
        targetKeywords = CATEGORY_ID_MAP[selectedCategory] || []
      }

      list = list.filter((p) => {
        const nameLower = p.name.toLowerCase()
        const tags = p.printfulCategories?.map((t) => t.toLowerCase()) || []

        return targetKeywords.some(
          (kw) =>
            tags.includes(kw.toLowerCase()) ||
            new RegExp(kw.toLowerCase(), 'i').test(nameLower)
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
        const product = products.find(
          (p) => p.externalProductId === urlExternalProductId
        )

        if (product) {
          setSelectedBlank({
            catalogProductId:
              product.catalogProductId || product.baseProductId || product._id,
            name:
              product.catalogProductName ||
              product.name ||
              product.baseProduct?.name,
            thumbnailUrl:
              product.mockupUrl || product.baseProduct?.thumbnailUrl,
            variants: product.baseProduct?.variants || [],
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
    if (step !== 'design' || !externalProductId || !selectedBlankId) return

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      const isEditingExisting = !!urlExternalProductId
      initializeEDM(
        externalProductId,
        selectedBlankId,
        isEditingExisting,
        printfulTemplateId
      )
    }
  }, [
    step,
    externalProductId,
    selectedBlankId,
    initializeEDM,
    printfulTemplateId,
    urlExternalProductId,
  ])

    const [originalPlacementAssets, setOriginalPlacementAssets] = useState({});

    useEffect(() => {
      const handleDesignStatus = (event) => {
        if (
          !event.data ||
          typeof event.data !== 'object' ||
          event.data.event !== 'designStatus'
        ) {
          return;
        }

        // Printful EDM sends usedPlacements as an array of strings, e.g. ["default"] or ["front", "back"].
        const usedPlacements =
          event.data?.data?.response?.usedPlacements || [];

        if (!Array.isArray(usedPlacements) || usedPlacements.length === 0) {
          return;
        }

        console.log('[ProductCreatorInner] usedPlacements', usedPlacements);

        // Build a grouped structure keyed by raw placement name.
        const groupedAssets = {};

        usedPlacements.forEach((placementKey, idx) => {
          const safeKey = String(placementKey || '').trim();
          if (!safeKey) return;

          const assetRecord = {
            edmPlacementId: `edm-${Date.now()}-${idx}`,
            placementName: safeKey,
            originalUrl: null, // EDM doesn't give us URLs here yet
            technique: null,
            ipId: null,
            licensingFee: 0,
            ownerId: null,
            ownerName: null,
          };

          if (!Array.isArray(groupedAssets[safeKey])) {
            groupedAssets[safeKey] = [];
          }
          groupedAssets[safeKey].push(assetRecord);
        });

        console.log(
          '[ProductCreatorInner] originalPlacementAssets (grouped)',
          groupedAssets
        );

        setOriginalPlacementAssets(groupedAssets);

        // IMPORTANT:
        // Do NOT try to derive selectedIPs from usedPlacements.
        // IPs are already managed via addIPToDesign and the IP library.
        // Keeping this logic out avoids brittle .map usage on string arrays.
      };

      window.addEventListener('message', handleDesignStatus);
      return () => window.removeEventListener('message', handleDesignStatus);
    }, []);

  const handleExitToCatalog = () => {
    setStep('catalog')
    setIsExpanded(false)
    hasInitializedRef.current = false
    hasAppliedShowroomIPRef.current = false
    clearGlobalInteractionLocks()
  }

    // Map EDM placement names to MetaWork placement keys used in pricing panel.
  const normalizePlacementKey = (raw) => {
    if (!raw) return null;
    const key = String(raw).toLowerCase();

    if (key.includes('front')) return 'front';
    if (key.includes('back')) return 'back';
    if (key.includes('right') && key.includes('sleeve')) return 'sleeve_right';
    if (key.includes('left') && key.includes('sleeve')) return 'sleeve_left';

    return null;
  };

  const enrichedProduct = useMemo(() => {
    if (!selectedBlank) return null;

    const placementConfigs = Object.keys(originalPlacementAssets || {})
      .map((rawKey) => normalizePlacementKey(rawKey))
      .filter(Boolean)
      .map((placementKey) => ({ placement: placementKey }));

    return {
      ...selectedBlank,
      printfulPlacementConfigs: placementConfigs,
    };
  }, [selectedBlank, originalPlacementAssets]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans relative">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card z-[60] shadow-sm relative shrink-0">
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitToCatalog}
            className="gap-2 border-zinc-800 hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>
        </div>

        <h1 className="text-sm font-bold uppercase tracking-tight">Metawork</h1>

        <Badge className="bg-indigo-900/10 text-indigo-400 border-none uppercase text-[10px]">
          Sync Active
        </Badge>
      </header>

      {step === 'catalog' && (
        <nav className="bg-background border-b px-6 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-10 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant={selectedCategory === 'All Products' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedCategory('All Products')
                setSearchQuery('')
              }}
              className={cn(
                'font-bold h-10 px-6 rounded-full border-zinc-800 transition-all',
                selectedCategory === 'All Products'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-300'
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
                  'text-xs font-bold h-10 px-4 rounded-full transition-colors whitespace-nowrap',
                  selectedCategory === group
                    ? 'bg-indigo-900/40 text-indigo-400'
                    : 'text-zinc-300 hover:bg-zinc-800'
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

      <div className="flex-1 overflow-hidden relative">
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

        {step === 'design' && (
          <div className="h-full w-full flex flex-col md:flex-row bg-black overflow-hidden relative">
            <div
              className={cn(
                'shrink-0 bg-zinc-950 border-zinc-800 relative z-30',
                isMobile ? 'w-full h-32 border-b' : 'w-80 border-r h-full'
              )}
            >
              <IPLibraryPanel
                selectedIPs={selectedIPs}
                onIPClick={addIPToDesign}
                onRemoveIP={removeIP}
                product={selectedBlank}
                isConnected={true}
              />
            </div>

            <main className="flex-1 relative bg-slate-950 z-10 w-full min-h-0">
              {edmLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40 pointer-events-none">
                  <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
                </div>
              )}

              <div
                className={cn(
                  'absolute inset-0 z-10',
                  isMobile ? 'bottom-[72px]' : 'bottom-0'
                )}
              >
                <div
                  id="printful-designer-container"
                  className="absolute inset-0 touch-auto"
                  style={{
                    pointerEvents: 'auto',
                    touchAction: 'manipulation',
                    WebkitOverflowScrolling: 'touch',
                  }}
                />
              </div>
            </main>

            {!isMobile && (
              <div className="w-80 border-l border-zinc-800 shrink-0 h-full z-30 relative bg-zinc-950">
                <DesignPropertiesPanel
                  selectedIPs={selectedIPs}
                  onRemoveIP={removeIP}
                  product={enrichedProduct}
                  baseProductPrice={selectedBlank?.variants?.[0]?.price || 0}
                  externalProductId={externalProductId}
                  printfulTemplateId={printfulTemplateId}
                  onTriggerEdmSave={triggerEdmSave}
                  refreshNonce={refreshNonce}
                  originalPlacementAssets={originalPlacementAssets}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {isMobile && step === 'design' && (
        <>
          {isExpanded && (
            <div
              className="fixed inset-0 z-[90] bg-black/40 transition-opacity"
              onClick={() => setIsExpanded(false)}
            />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-[100]">
            <div className="w-full pointer-events-auto">
              <DesignPropertiesPanel
                selectedIPs={selectedIPs}
                onRemoveIP={removeIP}
                product={enrichedProduct}
                baseProductPrice={selectedBlank?.variants?.[0]?.price || 0}
                externalProductId={externalProductId}
                printfulTemplateId={printfulTemplateId}
                onTriggerEdmSave={triggerEdmSave}
                refreshNonce={refreshNonce}
                originalPlacementAssets={originalPlacementAssets}
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
              />
            </div>
          </div>
        </>
      )}
                  {inspectingProduct && (
                  <BlankProductDetailsDialog
                    product={inspectingProduct}
                    open={!!inspectingProduct}
                    onOpenChange={(isOpen) => {
                      if (!isOpen) {
                        justClosedRef.current = true
                        setInspectingProduct(null)
                        setTimeout(() => { justClosedRef.current = false }, 100)
                      }
                    }}
              onSelect={(prod) => {
                justClosedRef.current = true
                setInspectingProduct(null)
                setSelectedBlank(prod)
                setExternalProductId(uuidv4())
                setStep('design')
                setTimeout(() => { justClosedRef.current = false }, 100)
              }}
            />
          )}
    </div>
  )
}

export default function ProductCreatorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <ProductCreatorInner />
      <Toaster position="top-right" richColors />
    </Suspense>
  )
}