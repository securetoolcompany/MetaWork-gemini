'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tag, Ticket, QrCode, Calendar as CalendarIcon, Plus, Edit, Trash2, Copy, Download, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QRCodeGenerator from '@/components/promotions/QRCodeGenerator';

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [sales, setSales] = useState([
    {
      id: 1,
      title: 'Holiday Sale',
      description: '30% off all products',
      discount: 30,
      startDate: new Date('2024-12-20'),
      endDate: new Date('2024-12-31'),
      active: true,
    },
  ]);

  const [coupons, setCoupons] = useState([
    {
      id: 1,
      code: 'MEMBERS',
      description: 'Members-only discount',
      discount: 15,
      type: 'percentage',
      expiryDate: new Date('2024-12-31'),
      usageLimit: 100,
      timesUsed: 23,
      active: true,
    },
    {
      id: 2,
      code: 'WELCOME10',
      description: 'First-time customer discount',
      discount: 10,
      type: 'percentage',
      expiryDate: new Date('2024-12-31'),
      usageLimit: null,
      timesUsed: 45,
      active: true,
    },
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Promotions & Marketing</h1>
            <p className="text-muted-foreground">Manage sales, coupons, and promotional materials</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sales" className="gap-2">
                <Megaphone className="w-4 h-4" />
                Sales & Deals
              </TabsTrigger>
              <TabsTrigger value="coupons" className="gap-2">
                <Ticket className="w-4 h-4" />
                Coupons
              </TabsTrigger>
              <TabsTrigger value="qrcodes" className="gap-2">
                <QrCode className="w-4 h-4" />
                QR Codes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-6">
              <SalesDealsTab sales={sales} setSales={setSales} />
            </TabsContent>

            <TabsContent value="coupons" className="mt-6">
              <CouponsTab coupons={coupons} setCoupons={setCoupons} />
            </TabsContent>

            <TabsContent value="qrcodes" className="mt-6">
              <QRCodesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SalesDealsTab({ sales, setSales }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSale, setNewSale] = useState({
    title: '',
    description: '',
    discount: '',
    startDate: new Date(),
    endDate: new Date(),
    active: true,
  });

  const handleCreateSale = () => {
    if (!newSale.title || !newSale.discount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSales([...sales, { ...newSale, id: Date.now(), discount: parseInt(newSale.discount) }]);
    setNewSale({ title: '', description: '', discount: '', startDate: new Date(), endDate: new Date(), active: true });
    setIsCreating(false);
    toast.success('Sale created successfully!');
  };

  const toggleSaleActive = (id) => {
    setSales(sales.map(s => s.id === id ? { ...s, active: !s.active } : s));
    toast.success('Sale updated');
  };

  const deleteSale = (id) => {
    setSales(sales.filter(s => s.id !== id));
    toast.success('Sale deleted');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Active Sales & Deals</h3>
            <p className="text-sm text-muted-foreground">Promote special offers to your customers</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Sale</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sale-title">Sale Title *</Label>
                  <Input
                    id="sale-title"
                    placeholder="e.g., Holiday Sale, Summer Clearance"
                    value={newSale.title}
                    onChange={(e) => setNewSale({ ...newSale, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sale-description">Description</Label>
                  <Textarea
                    id="sale-description"
                    placeholder="Describe your sale..."
                    value={newSale.description}
                    onChange={(e) => setNewSale({ ...newSale, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sale-discount">Discount Percentage *</Label>
                  <Input
                    id="sale-discount"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g., 30"
                    value={newSale.discount}
                    onChange={(e) => setNewSale({ ...newSale, discount: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(newSale.startDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={newSale.startDate}
                          onSelect={(date) => setNewSale({ ...newSale, startDate: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(newSale.endDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={newSale.endDate}
                          onSelect={(date) => setNewSale({ ...newSale, endDate: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button onClick={handleCreateSale} className="w-full">Create Sale</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {sales.map((sale) => (
            <Card key={sale.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-lg">{sale.title}</h4>
                    <Badge variant={sale.active ? 'default' : 'secondary'}>
                      {sale.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                      {sale.discount}% OFF
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{sale.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(sale.startDate, 'MMM d, yyyy')} - {format(sale.endDate, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={sale.active}
                    onCheckedChange={() => toggleSaleActive(sale.id)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteSale(sale.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {sales.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No sales created yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function CouponsTab({ coupons, setCoupons }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discount: '',
    type: 'percentage',
    expiryDate: new Date(),
    usageLimit: '',
    active: true,
  });

  const handleCreateCoupon = () => {
    if (!newCoupon.code || !newCoupon.discount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCoupons([...coupons, { 
      ...newCoupon, 
      id: Date.now(), 
      code: newCoupon.code.toUpperCase(),
      discount: parseInt(newCoupon.discount),
      usageLimit: newCoupon.usageLimit ? parseInt(newCoupon.usageLimit) : null,
      timesUsed: 0,
    }]);
    setNewCoupon({ code: '', description: '', discount: '', type: 'percentage', expiryDate: new Date(), usageLimit: '', active: true });
    setIsCreating(false);
    toast.success('Coupon created successfully!');
  };

  const toggleCouponActive = (id) => {
    setCoupons(coupons.map(c => c.id === id ? { ...c, active: !c.active } : c));
    toast.success('Coupon updated');
  };

  const deleteCoupon = (id) => {
    setCoupons(coupons.filter(c => c.id !== id));
    toast.success('Coupon deleted');
  };

  const copyCouponCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied!');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Coupon Codes</h3>
            <p className="text-sm text-muted-foreground">Create custom discount codes for your customers</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Coupon</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="coupon-code">Coupon Code *</Label>
                  <Input
                    id="coupon-code"
                    placeholder="e.g., MEMBERS, WELCOME10"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="coupon-description">Description</Label>
                  <Input
                    id="coupon-description"
                    placeholder="e.g., Members-only discount"
                    value={newCoupon.description}
                    onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="coupon-discount">Discount Amount *</Label>
                    <Input
                      id="coupon-discount"
                      type="number"
                      min="1"
                      placeholder="e.g., 15"
                      value={newCoupon.discount}
                      onChange={(e) => setNewCoupon({ ...newCoupon, discount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="coupon-type">Type</Label>
                    <select
                      id="coupon-type"
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Expiry Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(newCoupon.expiryDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={newCoupon.expiryDate}
                          onSelect={(date) => setNewCoupon({ ...newCoupon, expiryDate: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="usage-limit">Usage Limit (optional)</Label>
                    <Input
                      id="usage-limit"
                      type="number"
                      placeholder="Unlimited"
                      value={newCoupon.usageLimit}
                      onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateCoupon} className="w-full">Create Coupon</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-lg font-mono font-bold bg-muted px-3 py-1 rounded">{coupon.code}</code>
                    <Badge variant={coupon.active ? 'default' : 'secondary'}>
                      {coupon.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {coupon.discount}{coupon.type === 'percentage' ? '%' : '$'} OFF
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{coupon.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Expires: {format(coupon.expiryDate, 'MMM d, yyyy')}</span>
                    <span>Used: {coupon.timesUsed}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => copyCouponCode(coupon.code)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Switch
                    checked={coupon.active}
                    onCheckedChange={() => toggleCouponActive(coupon.id)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteCoupon(coupon.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {coupons.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No coupons created yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function QRCodesTab() {
  const [qrType, setQrType] = useState('aisle');
  
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">QR Code Generator</h3>
          <p className="text-sm text-muted-foreground">Create QR codes for your aisle or individual products</p>
        </div>

        <QRCodeGenerator />
      </Card>
    </div>
  );
}