'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from 'components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { useWallet } from 'lib/WalletContext'

// TODO: wire these from props/searchParams/your DB
const JERSEY_CATALOG_PRODUCT_ID = '676'
const JERSEY_EXTERNAL_PRODUCT_ID = 'bc00dde2-fb75-4917-bc81-7589de4c2e2c' // or uuidv4()

function JerseyEDMInner() {
  const { accountAddress } = useWallet()

  const pfDesignMakerRef = useRef(null)
  const edmSaveResolveRef = useRef(null)
  const edmSaveTimeoutRef = useRef(null)
  const designerLoadedListenerRef = useRef(null)

  const [edmLoading, setEdmLoading] = useState(false)
  const [templateId, setTemplateId] = useState(null)

  const clearGlobalInteractionLocks = useCallback(() => {
    if (typeof document === 'undefined') return

    document.documentElement.style.pointerEvents = 'auto'
    document.body.style.pointerEvents = 'auto'
    document.documentElement.style.touchAction = 'auto'
    document.body.style.touchAction = 'auto'

    document.documentElement.removeAttribute('data-scroll-locked')
    document.body.removeAttribute('data-scroll-locked')
  }, [])

  const initializeEDM = useCallback(async () => {
    if (!JERSEY_CATALOG_PRODUCT_ID || !JERSEY_EXTERNAL_PRODUCT_ID) {
      toast.error('Missing jersey configuration')
      return
    }

    setEdmLoading(true)
    clearGlobalInteractionLocks()

    try {
      // Clean up any previous instance/listeners
      if (designerLoadedListenerRef.current) {
        window.removeEventListener('message', designerLoadedListenerRef.current)
        designerLoadedListenerRef.current = null
      }

      if (pfDesignMakerRef.current && pfDesignMakerRef.current.destroy) {
        pfDesignMakerRef.current.destroy()
        pfDesignMakerRef.current = null
      }

      const container = document.getElementById('printful-designer-container')
      if (container) {
        container.innerHTML = ''
        container.style.pointerEvents = 'auto'
        container.style.touchAction = 'manipulation'
      }

      // Get EDM nonce from your backend
      const res = await fetch('/api/printful/edm-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalProductId: JERSEY_EXTERNAL_PRODUCT_ID,
          externalCustomerId: accountAddress || 'guest',
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to get nonce')

      // Wait for PFDesignMaker from embed.js
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
        externalProductId: JERSEY_EXTERNAL_PRODUCT_ID,

        // Tell EDM to load the existing jersey design
        templateId: 105785235,

        // Product context (still useful)
        initProduct: { productId: JERSEY_CATALOG_PRODUCT_ID },

        onReady: () => {
          clearGlobalInteractionLocks()
          setEdmLoading(false)
          toast.success('Designer ready — jersey design loaded')
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

        onTemplateSaved: (savedTemplateId) => {
          if (edmSaveTimeoutRef.current) {
            clearTimeout(edmSaveTimeoutRef.current)
            edmSaveTimeoutRef.current = null
          }

          setTemplateId(savedTemplateId)

          if (edmSaveResolveRef.current) {
            edmSaveResolveRef.current.resolve(savedTemplateId)
            edmSaveResolveRef.current = null
          }

          toast.success('Jersey design saved!')
        },
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
        }
      }

      designerLoadedListenerRef.current = handleDesignerLoadedMessage
      window.addEventListener('message', handleDesignerLoadedMessage)

      // Safety timeout
      setTimeout(() => {
        clearGlobalInteractionLocks()
        setEdmLoading(false)
      }, 2500)
    } catch (e) {
      toast.error(`Failed to load designer: ${e.message}`)
      clearGlobalInteractionLocks()
      setEdmLoading(false)
    }
  }, [accountAddress, clearGlobalInteractionLocks])

  const triggerEdmSave = useCallback(() => {
    const instance = pfDesignMakerRef.current
    if (!instance) {
      return Promise.reject(new Error('Designer not ready'))
    }

    return new Promise((resolve, reject) => {
      if (edmSaveTimeoutRef.current) {
        clearTimeout(edmSaveTimeoutRef.current)
        edmSaveTimeoutRef.current = null
      }

      edmSaveResolveRef.current = {
        resolve: (savedTemplateId) => {
          resolve({ templateId: savedTemplateId })
        },
        reject,
      }

      edmSaveTimeoutRef.current = setTimeout(() => {
        if (edmSaveResolveRef.current) {
          edmSaveResolveRef.current.reject(new Error('Save timeout'))
          edmSaveResolveRef.current = null
        }
        edmSaveTimeoutRef.current = null
      }, 15000)

      try {
        instance.sendMessage({ event: 'saveDesign' })
      } catch (err) {
        if (edmSaveTimeoutRef.current) {
          clearTimeout(edmSaveTimeoutRef.current)
          edmSaveTimeoutRef.current = null
        }
        edmSaveResolveRef.current = null
        reject(err)
      }
    })
  }, [])

  // Load embed.js once
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://files.cdn.printful.com/embed/embed.js'
    script.async = true
    script.onerror = () => toast.error('Failed to load Printful Embedded Designer')
    document.body.appendChild(script)

    return () => {
      if (designerLoadedListenerRef.current) {
        window.removeEventListener('message', designerLoadedListenerRef.current)
        designerLoadedListenerRef.current = null
      }

      if (pfDesignMakerRef.current && pfDesignMakerRef.current.destroy) {
        pfDesignMakerRef.current.destroy()
        pfDesignMakerRef.current = null
      }

      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Auto-init EDM when page mounts
  useEffect(() => {
    initializeEDM()
  }, [initializeEDM])

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-card">
        <h1 className="text-sm font-bold uppercase tracking-tight">
          Metawork Jersey EDM
        </h1>
        {templateId && (
          <span className="text-xs text-green-400">
            Saved template: {templateId}
          </span>
        )}
      </header>

      <main className="flex-1 relative">
        {edmLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40 pointer-events-none">
            <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
          </div>
        )}

        <div
          id="printful-designer-container"
          className="absolute inset-0"
          style={{
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            WebkitOverflowScrolling: 'touch',
          }}
        />
      </main>

      <footer className="h-16 border-t border-zinc-800 flex items-center justify-between px-6 bg-card">
        <Button
          variant="default"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={() => {
            triggerEdmSave()
              .then(({ templateId: savedTemplateId }) => {
                console.log('Saved jersey template:', savedTemplateId)
              })
              .catch((err) => {
                toast.error(`Save failed: ${err.message}`)
              })
          }}
        >
          Save Jersey Design
        </Button>
      </footer>

      <Toaster position="top-right" richColors />
    </div>
  )
}

export default JerseyEDMInner