'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Download,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { topCreators, bestSellingProducts, detailedSales, payoutRecords } from '@/lib/admin-mock-data';

export default function CreatorDetailPage() {
  const params = useParams();
  const creatorId = parseInt(params.id);
  
  const creator = topCreators.find(c => c.id === creatorId);
  const creatorProducts = bestSellingProducts.filter(p => p.creatorId === creatorId);
  const creatorSales = detailedSales.filter(s => s.storeOwnerId === creatorId);
  const creatorPayouts = payoutRecords.filter(p => p.creatorId === creatorId);

  if (!creator) {
    return <div className="p-6">Creator not found</div>;
  }

  const metrics = [
    {
      title: 'Total Earnings',
      value: `$${creator.totalEarnings.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Product Sales',
      value: `$${creator.productSales.toLocaleString()}`,
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'IP Royalties',
      value: `$${creator.ipRoyalties.toLocaleString()}`,
      icon: Package,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Total Sales',
      value: creator.salesCount,
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/creators">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden">
                <Image
                  src={creator.avatar}
                  alt={creator.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{creator.name}</h1>
                <p className="text-muted-foreground">@{creator.username}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/aisle/${creator.username}`} target="_blank">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Aisle
              </Link>
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{metric.title}</p>
                      <h3 className="text-2xl font-bold">{metric.value}</h3>
                    </div>
                    <div className={`${metric.bgColor} ${metric.color} p-3 rounded-lg`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Products ({creatorProducts.length})</TabsTrigger>
            <TabsTrigger value="sales">Recent Sales</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
            <TabsTrigger value="payouts">Payout History</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Creator's Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Retail Price</TableHead>
                      <TableHead className="text-right">Base Price</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Creator Earnings</TableHead>
                      <TableHead>IP Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatorProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded overflow-hidden">
                              <Image
                                src={product.imageUrl}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${product.retailPrice}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${product.basePrice}
                        </TableCell>
                        <TableCell className="text-right">{product.salesCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${product.totalRevenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-500">
                          ${product.creatorEarnings.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {product.ipUsed ? (
                            <Badge variant="secondary">{product.ipUsed}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
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
                      <TableHead className="text-right">Creator Earned</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatorSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.orderId}</TableCell>
                        <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                        <TableCell>{sale.product}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{sale.customer}</p>
                            <p className="text-xs text-muted-foreground">{sale.customerEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${sale.totalSale.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-500">
                          ${sale.storeOwnerEarnings.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={sale.status === 'completed' ? 'success' : 'secondary'}>
                            {sale.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Breakdown Tab */}
          <TabsContent value="revenue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="font-medium">Product Sales</span>
                      </div>
                      <span className="font-bold text-blue-500">
                        ${creator.productSales.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="font-medium">IP Royalties</span>
                      </div>
                      <span className="font-bold text-purple-500">
                        ${creator.ipRoyalties.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="font-medium">Ad Revenue</span>
                      </div>
                      <span className="font-bold text-green-500">
                        ${creator.adRevenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="font-medium">Tips</span>
                      </div>
                      <span className="font-bold text-orange-500">
                        ${creator.tips.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Avg Order Value</span>
                        <span className="text-sm font-medium">
                          ${(creator.totalEarnings / creator.salesCount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Revenue per Product</span>
                        <span className="text-sm font-medium">
                          ${(creator.totalEarnings / creator.productsCount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Member Since</span>
                        <span className="text-sm font-medium">
                          {new Date(creator.joinDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Total Products</span>
                        <span className="text-sm font-medium">{creator.productsCount}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatorPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">{payout.period}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(payout.startDate).toLocaleDateString()} - {new Date(payout.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-500">
                          ${payout.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{payout.method}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {payout.walletAddress}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={payout.status === 'completed' ? 'success' : 'secondary'}>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payout.paidDate ? new Date(payout.paidDate).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
