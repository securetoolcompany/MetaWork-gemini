'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { platformMetrics, topCreators, bestSellingProducts, monthlyTrends } from '@/lib/admin-mock-data';

export default function AdminDashboard() {
  const metrics = [
    {
      title: 'Total Revenue',
      value: `$${platformMetrics.totalRevenue.toLocaleString()}`,
      change: `+${platformMetrics.growthRate}%`,
      positive: true,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Platform Fee',
      value: `$${platformMetrics.platformFee.toLocaleString()}`,
      subtext: '10% of revenue',
      icon: TrendingUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Active Creators',
      value: `${platformMetrics.activeCreators}/${platformMetrics.totalCreators}`,
      subtext: 'Total registered',
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Total Sales',
      value: platformMetrics.totalSales,
      subtext: `Avg: $${platformMetrics.avgOrderValue}`,
      icon: ShoppingCart,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Platform-wide analytics and management</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin/reports">
                Report Builder
              </Link>
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button asChild>
              <Link href="/dashboard">Back to Creator View</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{metric.title}</p>
                      <h3 className="text-2xl font-bold">{metric.value}</h3>
                      {metric.change && (
                        <div className="flex items-center gap-1 mt-2">
                          {metric.positive ? (
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                          )}
                          <span className={metric.positive ? 'text-green-500 text-sm font-medium' : 'text-red-500 text-sm font-medium'}>
                            {metric.change}
                          </span>
                        </div>
                      )}
                      {metric.subtext && (
                        <p className="text-xs text-muted-foreground mt-2">{metric.subtext}</p>
                      )}
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

        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-64 gap-2">
              {monthlyTrends.map((data, idx) => {
                const maxRevenue = Math.max(...monthlyTrends.map(d => d.revenue));
                const heightPercent = (data.revenue / maxRevenue) * 100;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full relative" style={{ height: '200px' }}>
                      <div 
                        className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:opacity-80 transition-opacity cursor-pointer group"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap">
                          ${data.revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {data.month.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Earning Creators */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top Earning Creators</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/creators">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Earnings</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCreators.slice(0, 5).map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden">
                            <Image
                              src={creator.avatar}
                              alt={creator.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{creator.name}</p>
                            <p className="text-xs text-muted-foreground">@{creator.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{creator.salesCount}</TableCell>
                      <TableCell className="text-right font-semibold text-green-500">
                        ${creator.totalEarnings.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/creators/${creator.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Best Selling Products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Best Selling Products</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/products">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestSellingProducts.slice(0, 5).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded overflow-hidden">
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.creator}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{product.salesCount}</TableCell>
                      <TableCell className="text-right font-semibold text-green-500">
                        ${product.totalRevenue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
            <Link href="/admin/creators">
              <CardContent className="p-6">
                <Users className="w-8 h-8 text-purple-500 mb-3" />
                <h3 className="font-semibold mb-1">Manage Creators</h3>
                <p className="text-sm text-muted-foreground">
                  View detailed analytics for individual creators
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
            <Link href="/admin/reports">
              <CardContent className="p-6">
                <Package className="w-8 h-8 text-blue-500 mb-3" />
                <h3 className="font-semibold mb-1">Report Builder</h3>
                <p className="text-sm text-muted-foreground">
                  Create custom reports with advanced filters
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
            <Link href="/admin/payouts">
              <CardContent className="p-6">
                <DollarSign className="w-8 h-8 text-green-500 mb-3" />
                <h3 className="font-semibold mb-1">Payout Management</h3>
                <p className="text-sm text-muted-foreground">
                  Track and manage creator payouts
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
