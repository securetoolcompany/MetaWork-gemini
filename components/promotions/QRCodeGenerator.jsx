'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { userProducts } from '@/lib/mock-data';

export default function QRCodeGenerator() {
  const [qrType, setQrType] = useState('aisle');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');
  const [qrUrl, setQrUrl] = useState('');
  const [qrImageSrc, setQrImageSrc] = useState('');

  const generateQR = () => {
    let url = '';
    
    if (qrType === 'aisle') {
      // Generate URL for creator's aisle
      url = `${window.location.origin}/aisle/rogue-combat-club`; // In real app, use actual creator slug
    } else if (qrType === 'product' && selectedProduct) {
      // Generate URL for specific product
      url = `${window.location.origin}/showroom/product/${selectedProduct}`;
    } else {
      toast.error('Please select a product');
      return;
    }

    setQrUrl(url);

    // Generate QR code using qrserver.com API
    const encoded = encodeURIComponent(url);
    const hex = qrColor.replace('#', '');
    const bgHex = qrBgColor.replace('#', '');
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encoded}&color=${hex}&bgcolor=${bgHex}`;
    
    setQrImageSrc(qrSrc);
    toast.success('QR code generated!');
  };

  const downloadQR = async () => {
    if (!qrImageSrc) {
      toast.error('Please generate a QR code first');
      return;
    }

    try {
      const response = await fetch(qrImageSrc);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${qrType}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('QR code downloaded!');
    } catch (e) {
      toast.error('Could not download the QR image');
    }
  };

  const copyLink = () => {
    if (!qrUrl) {
      toast.error('Please generate a QR code first');
      return;
    }

    navigator.clipboard.writeText(qrUrl).then(
      () => toast.success('Link copied to clipboard!'),
      () => toast.error('Could not copy link')
    );
  };

  const liveProducts = userProducts.filter(p => p.status === 'live');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Configuration */}
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">QR Code Type</Label>
          <RadioGroup value={qrType} onValueChange={setQrType}>
            <div className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="aisle" id="qr-aisle" />
              <Label htmlFor="qr-aisle" className="flex-1 cursor-pointer">
                <div className="font-semibold">My Aisle</div>
                <div className="text-sm text-muted-foreground">Link to your creator storefront</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="product" id="qr-product" />
              <Label htmlFor="qr-product" className="flex-1 cursor-pointer">
                <div className="font-semibold">Specific Product</div>
                <div className="text-sm text-muted-foreground">Link to an individual product</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {qrType === 'product' && (
          <div>
            <Label htmlFor="product-select">Select Product</Label>
            <select
              id="product-select"
              className="w-full h-10 px-3 rounded-md border bg-background mt-2"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">Choose a product...</option>
              {liveProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.price}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qr-color">QR Color</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="qr-color"
                type="color"
                value={qrColor}
                onChange={(e) => setQrColor(e.target.value)}
                className="h-10 w-20"
              />
              <Input
                type="text"
                value={qrColor}
                onChange={(e) => setQrColor(e.target.value)}
                className="flex-1 font-mono"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qr-bgcolor">Background</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="qr-bgcolor"
                type="color"
                value={qrBgColor}
                onChange={(e) => setQrBgColor(e.target.value)}
                className="h-10 w-20"
              />
              <Input
                type="text"
                value={qrBgColor}
                onChange={(e) => setQrBgColor(e.target.value)}
                className="flex-1 font-mono"
              />
            </div>
          </div>
        </div>

        <Button onClick={generateQR} className="w-full gap-2" size="lg">
          <QrCode className="w-5 h-5" />
          Generate QR Code
        </Button>

        {qrUrl && (
          <Card className="p-4 bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">This QR code links to:</p>
            <p className="text-sm font-mono break-all">{qrUrl}</p>
          </Card>
        )}
      </div>

      {/* Preview & Actions */}
      <div className="flex flex-col items-center justify-center space-y-6">
        {qrImageSrc ? (
          <>
            <div className="relative">
              <img
                src={qrImageSrc}
                alt="QR Code"
                className="w-full max-w-sm rounded-lg border-4 border-border shadow-lg"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={downloadQR} className="gap-2">
                <Download className="w-4 h-4" />
                Download QR
              </Button>
              <Button onClick={copyLink} variant="outline" className="gap-2">
                <Copy className="w-4 h-4" />
                Copy Link
              </Button>
            </div>

            <Card className="p-4 w-full">
              <h4 className="font-semibold mb-2">Usage Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Print on business cards, flyers, or posters</li>
                <li>• Display at your gym, studio, or event</li>
                <li>• Share on social media as an image</li>
                <li>• Add to email signatures</li>
              </ul>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground">
            <QrCode className="w-24 h-24 mb-4 opacity-20" />
            <p>Configure your QR code settings and click Generate</p>
          </div>
        )}
      </div>
    </div>
  );
}