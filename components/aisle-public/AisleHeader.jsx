'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Twitter, Instagram, Globe, Music, User, Share2, QrCode, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const socialIcons = {
  twitter: Twitter,
  instagram: Instagram,
  website: Globe,
  tiktok: Music,
  twitch: Music,
};

// Destructured collections from props
export default function AisleHeader({ creator, settings, products = [], collections = [] }) {
  const [selectedCollection, setSelectedCollection] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [qrImageSrc, setQrImageSrc] = useState('');
  const { headerStyle } = settings;
  const isOwner = creator?.isOwner;
  
  const [qrType, setQrType] = useState('aisle');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');
  const [qrUrl, setQrUrl] = useState('');

  const aisleUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/aisle/${creator?.aisleSettings?.slug || creator?.username}`
    : '';

  const generateQR = () => {
    let url = '';
    if (qrType === 'aisle') {
      url = aisleUrl;
    } else if (qrType === 'collection' && selectedCollection) {
      // Directs to the specific collection ID anchor
      url = `${aisleUrl}#${selectedCollection}`;
    } else if (qrType === 'product' && selectedProduct) {
      url = `${window.location.origin}/showroom/product/${selectedProduct}`;
    } else {
      toast.error('Please make a selection');
      return;
    }

    setQrUrl(url);
    const encoded = encodeURIComponent(url);
    const hex = qrColor.replace('#', '');
    const bgHex = qrBgColor.replace('#', '');
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encoded}&color=${hex}&bgcolor=${bgHex}`;
    setQrImageSrc(qrSrc);
  };

  const handleShare = () => {
    setShowShareDialog(true);
    generateQR();
  };

  const copyLink = () => {
    const targetUrl = qrUrl || aisleUrl;
    navigator.clipboard.writeText(targetUrl).then(
      () => {
        toast.success('Link copied!');
        setShowShareDialog(false);
      },
      () => toast.error('Could not copy link')
    );
  };

  const downloadQR = async () => {
    if (!qrImageSrc) return;
    try {
      const response = await fetch(qrImageSrc);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${creator?.username || 'aisle'}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const title = creator.aisleSettings?.title || creator.name || creator.username;
  const description = creator.aisleSettings?.description || creator.bio || '';
  const banner = creator.aisleSettings?.heroImage || creator.banner || creator.bannerUrl;
  const avatar = creator.aisleSettings?.logo || creator.avatar || creator.avatarUrl;
  const socialLinks = creator.aisleSettings?.socialLinks || creator.socialLinks || {};

  const ShareButton = (
    <Button
      onClick={handleShare}
      size="sm"
      className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
      variant="outline"
    >
      <Share2 className="w-4 h-4" />
      Share
    </Button>
  );

  let headerLayout;
  if (headerStyle === 'full-banner') {
    headerLayout = (
      <div className="relative">
        <div className="h-64 md:h-80 relative overflow-hidden">
          {banner ? (
            <Image src={banner} alt={title} fill className="object-cover" priority />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/20 to-purple-600/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-7xl mx-auto flex items-end gap-6">
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background overflow-hidden flex-shrink-0">
              {avatar ? <Image src={avatar} alt={title} fill className="object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white">{title.charAt(0)}</div>}
            </div>
            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
              <div className="flex gap-3 items-center">
                {ShareButton}
                <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Link href={`/profile/${creator.username}`}><User className="w-4 h-4 mr-2" />Profile</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (headerStyle === 'compact') {
    headerLayout = (
      <div className="border-b border-border p-6 bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border">
              {avatar ? <Image src={avatar} alt={title} fill className="object-cover" /> : <div className="w-full h-full bg-slate-200" />}
            </div>
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {ShareButton}
        </div>
      </div>
    );
  } else {
    headerLayout = (
      <div className="border-b border-border py-4 bg-background">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-tight">{title}</h1>
          {ShareButton}
        </div>
      </div>
    );
  }

  return (
    <>
      {headerLayout}
      
      {isOwner && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <Button asChild className="bg-red-500 hover:bg-red-600 text-white">
            <Link href="/aisle-settings">Edit Aisle</Link>
          </Button>
        </div>
      )}

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-3xl bg-[#020617] text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Share This Aisle</DialogTitle>
            <DialogDescription className="text-slate-400">Generate a QR code or copy a link</DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-[1fr,auto] gap-8 py-4">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block text-slate-300">Share Type</label>
                <div className="space-y-2">
                  <label className={`flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${qrType === "aisle" ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}>
                    <input type="radio" checked={qrType === "aisle"} onChange={() => setQrType("aisle")} className="mt-1 accent-blue-500" />
                    <div className="flex-1"><div className="font-bold text-slate-100">Entire Aisle</div><div className="text-sm text-slate-400">Link to all products</div></div>
                  </label>
                  
                  {/* Specific Collection option appears if collections exist */}
                  {collections?.length > 0 && (
                    <label className={`flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${qrType === "collection" ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}>
                      <input type="radio" checked={qrType === "collection"} onChange={() => setQrType("collection")} className="mt-1 accent-blue-500" />
                      <div className="flex-1">
                        <div className="font-bold text-slate-100">Specific Collection</div>
                        <div className="text-sm text-slate-400">Link to a curated group</div>
                      </div>
                    </label>
                  )}

                  {/* Specific Product option appears if products exist */}
                  {products?.length > 0 && (
                    <label className={`flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${qrType === "product" ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}>
                      <input type="radio" checked={qrType === "product"} onChange={() => setQrType("product")} className="mt-1 accent-blue-500" />
                      <div className="flex-1"><div className="font-bold text-slate-100">Specific Product</div><div className="text-sm text-slate-400">Link to one item</div></div>
                    </label>
                  )}
                </div>
              </div>

              {/* Dynamic Selector for Collections */}
              {qrType === "collection" && collections?.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium mb-2 block text-slate-300">Select Collection</label>
                  <select
                    className="w-full h-11 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white outline-none"
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value)}
                  >
                    <option value="">Choose a collection...</option>
                    {collections.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                </div>
              )}

              {qrType === "product" && products?.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium mb-2 block text-slate-300">Select Product</label>
                  <select
                    className="w-full h-11 px-3 rounded-lg border border-slate-800 bg-slate-900 text-white outline-none"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    <option value="">Choose a product...</option>
                    {products.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">QR Color</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    <input type="color" value={qrColor} onChange={(e) => setQrColor(e.target.value)} className="h-9 w-9 rounded-md cursor-pointer bg-transparent border-none" />
                    <input type="text" value={qrColor} onChange={(e) => setQrColor(e.target.value)} className="flex-1 bg-transparent border-none text-sm font-mono uppercase" maxLength={7} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Background</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    <input type="color" value={qrBgColor} onChange={(e) => setQrBgColor(e.target.value)} className="h-9 w-9 rounded-md cursor-pointer bg-transparent border-none" />
                    <input type="text" value={qrBgColor} onChange={(e) => setQrBgColor(e.target.value)} className="flex-1 bg-transparent border-none text-sm font-mono uppercase" maxLength={7} />
                  </div>
                </div>
              </div>

              <Button onClick={generateQR} className="w-full h-12 bg-white text-black hover:bg-slate-200 font-bold">
                <QrCode className="w-5 h-5 mr-2" /> Generate QR Code
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4 min-w-[300px]">
              <div className="p-4 bg-white rounded-2xl shadow-xl">
                {qrImageSrc ? <img src={qrImageSrc} alt="QR" className="w-64 h-64" /> : <div className="w-64 h-64 flex flex-col items-center justify-center bg-slate-50 text-slate-300 border border-dashed rounded-lg"><QrCode className="w-12 h-12 opacity-20" /><p className="text-[10px] font-bold opacity-40">PREVIEW</p></div>}
              </div>
              <div className="flex gap-2 w-full">
                <Button onClick={downloadQR} className="flex-1 border-slate-800 text-white hover:bg-slate-900" variant="outline"><Download className="w-4 h-4 mr-2" />Save</Button>
                <Button onClick={copyLink} className="flex-1 bg-white text-black hover:bg-slate-200"><Copy className="w-4 h-4 mr-2" />Copy</Button>
              </div>
              <div className="text-[11px] font-mono text-slate-500 break-all text-center">{qrUrl || aisleUrl}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}