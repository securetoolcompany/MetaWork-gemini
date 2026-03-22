'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Download,
  Search,
  Eye,
  DollarSign,
  TrendingUp,
  Users,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { detailedSales, platformMetrics } from '@/lib/admin-mock-data';

export default function SalesRevenuePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSale, setSelectedSale] = useState(null);

  const filteredSales = detailedSales.filter(sale => {
    const matchesSearch = 
      sale.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = detailedSales.reduce((sum, s) => sum + s.totalSale, 0);
  const totalStoreOwnerEarnings = detailedSales.reduce((sum, s) => sum + s.storeOwnerEarnings, 0);
  const totalIPRoyalties = detailedSales.reduce((sum, s) => sum + s.ipRoyalty, 0);
  const totalPlatformFees = detailedSales.reduce((sum, s) => sum + s.platformFee, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Sales & Revenue Splits</h1>
              <p className="text-muted-foreground mt-1">Detailed breakdown of who earned what from each sale</p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                  <h3 className="text-2xl font-bold">${totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="bg-green-500/10 text-green-500 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Store Owner Earnings</p>
                  <h3 className="text-2xl font-bold">${totalStoreOwnerEarnings.toLocaleString()}</h3>
                </div>
                <div className="bg-blue-500/10 text-blue-500 p-3 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">IP Royalties</p>
                  <h3 className="text-2xl font-bold">${totalIPRoyalties.toLocaleString()}</h3>
                </div>
                <div className="bg-purple-500/10 text-purple-500 p-3 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Platform Fees</p>
                  <h3 className="text-2xl font-bold">${totalPlatformFees.toLocaleString()}</h3>
                </div>
                <div className="bg-orange-500/10 text-orange-500 p-3 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders, products, customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Sales ({filteredSales.length} orders)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Sale</TableHead>
                  <TableHead className="text-right">Store Owner</TableHead>
                  <TableHead className="text-right">IP Owner</TableHead>
                  <TableHead className="text-right">Platform Fee</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-sm">{sale.orderId}</TableCell>
                    <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{sale.product}</p>
                        <p className="text-xs text-muted-foreground">Qty: {sale.quantity}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{sale.customer}</p>
                        <p className="text-xs text-muted-foreground">{sale.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ${sale.totalSale.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-blue-500 font-semibold">
                      ${sale.storeOwnerEarnings.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-purple-500 font-semibold">
                      {sale.ipRoyalty > 0 ? `$${sale.ipRoyalty.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-orange-500 font-semibold">
                      ${sale.platformFee.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sale.status === 'completed' ? 'success' : 'secondary'}>
                        {sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSale(sale)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Order Details: {sale.orderId}</DialogTitle>
                            <DialogDescription>
                              Complete revenue split breakdown
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 mt-4">
                            {/* Order Info */}
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                              <div>
                                <p className="text-sm text-muted-foreground">Order ID</p>
                                <p className="font-mono font-semibold">{sale.orderId}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Order Date</p>
                                <p className="font-semibold">{new Date(sale.date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Customer</p>
                                <p className="font-semibold">{sale.customer}</p>
                                <p className="text-xs text-muted-foreground">{sale.customerEmail}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant={sale.status === 'completed' ? 'success' : 'secondary'}>
                                  {sale.status}
                                </Badge>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div>
                              <h4 className="font-semibold mb-3">Product Details</h4>
                              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                  <span>Product</span>
                                  <span className="font-semibold">{sale.product}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Quantity</span>
                                  <span className="font-semibold">{sale.quantity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Base Price (Printful)</span>
                                  <span className="font-semibold">${sale.basePrice}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Retail Price</span>
                                  <span className="font-semibold">${sale.retailPrice}</span>
                                </div>
                              </div>
                            </div>

                            {/* Revenue Split */}
                            <div>
                              <h4 className="font-semibold mb-3">Revenue Split Breakdown</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                                  <div>
                                    <p className="font-semibold text-green-500">Total Sale</p>
                                    <p className="text-xs text-muted-foreground">
                                      {sale.quantity} × ${sale.retailPrice}
                                    </p>
                                  </div>
                                  <p className="text-xl font-bold text-green-500">
                                    ${sale.totalSale.toFixed(2)}
                                  </p>
                                </div>

                                <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10">
                                  <div>
                                    <p className="font-semibold text-blue-500">Store Owner: {sale.storeOwner}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Markup profit: ({sale.retailPrice} - {sale.basePrice}) × {sale.quantity}
                                    </p>
                                  </div>
                                  <p className="text-lg font-bold text-blue-500">
                                    ${sale.storeOwnerEarnings.toFixed(2)}
                                  </p>
                                </div>

                                {sale.ipOwner && (
                                  <div className="flex justify-between items-center p-3 rounded-lg bg-purple-500/10">
                                    <div>
                                      <p className="font-semibold text-purple-500">IP Owner: {sale.ipOwner}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Royalty per use × {sale.quantity}
                                      </p>
                                    </div>
                                    <p className="text-lg font-bold text-purple-500">
                                      ${sale.ipRoyalty.toFixed(2)}
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-between items-center p-3 rounded-lg bg-orange-500/10">
                                  <div>
                                    <p className="font-semibold text-orange-500">Platform Fee (MetaWork)</p>
                                    <p className="text-xs text-muted-foreground">
                                      10% of total sale
                                    </p>
                                  </div>
                                  <p className="text-lg font-bold text-orange-500">
                                    ${sale.platformFee.toFixed(2)}
                                  </p>
                                </div>

                                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                                  <div>
                                    <p className="font-semibold">Printful (Fulfillment Cost)</p>
                                    <p className="text-xs text-muted-foreground">
                                      Manufacturing & shipping
                                    </p>
                                  </div>
                                  <p className="text-lg font-bold">
                                    ${sale.printfulCost.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Verification */}
                            <div className="border-t pt-4">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Accounted:</span>
                                <span className="font-mono">
                                  ${(sale.storeOwnerEarnings + sale.ipRoyalty + sale.platformFee + sale.printfulCost).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm mt-1">
                                <span className="text-muted-foreground">Total Sale:</span>
                                <span className="font-mono font-bold">
                                  ${sale.totalSale.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Payout Status */}
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <h5 className="font-semibold mb-2">Payout Status</h5>
                              <div className="flex items-center gap-2">
                                <Badge variant={sale.payoutStatus === 'paid' ? 'success' : 'secondary'}>
                                  {sale.payoutStatus}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {sale.payoutStatus === 'paid' ? 'All parties have been paid' : 'Pending payout cycle'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Revenue Flow Diagram */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Flow Example</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Here's how a $24.99 t-shirt sale is split:
              </p>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-blue-500/10 border-2 border-blue-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Store Owner</p>
                  <p className="text-2xl font-bold text-blue-500">$5.00</p>
                  <p className="text-xs text-muted-foreground mt-1">Markup profit</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border-2 border-purple-500/20">
                  <p className="text-sm text-muted-foreground mb-1">IP Owner</p>
                  <p className="text-2xl font-bold text-purple-500">$2.50</p>
                  <p className="text-xs text-muted-foreground mt-1">Royalty fee</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/10 border-2 border-orange-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Platform</p>
                  <p className="text-2xl font-bold text-orange-500">$2.50</p>
                  <p className="text-xs text-muted-foreground mt-1">10% platform fee</p>
                </div>
                <div className="p-4 rounded-lg bg-muted border-2 border-border">
                  <p className="text-sm text-muted-foreground mb-1">Printful</p>
                  <p className="text-2xl font-bold">$14.99</p>
                  <p className="text-xs text-muted-foreground mt-1">Fulfillment</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
