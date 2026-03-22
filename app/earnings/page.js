'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Image as ImageIcon, 
  BarChart3,
  Heart,
  Calendar,
  Download,
  Eye,
  MousePointerClick,
  ArrowUpRight
} from 'lucide-react';
import EarningsChart from '@/components/earnings/EarningsChart';
import RevenueBreakdown from '@/components/earnings/RevenueBreakdown';
import TopProducts from '@/components/earnings/TopProducts';
import TransactionsTable from '@/components/earnings/TransactionsTable';

// Mock data for earnings
const earningsData = {
  overview: {
    totalEarnings: 2847.50,
    thisMonth: 340.25,
    lastMonth: 298.80,
    pendingPayout: 127.80,
    nextPayout: '2024-12-15',
  },
  revenueBreakdown: {
    productSales: 1680.50,
    ipRoyalties: 540.75,
    adRevenue: 486.25,
    tips: 140.00,
  },
  monthlyData: [
    { month: 'Jul', productSales: 220, ipRoyalties: 85, adRevenue: 62, tips: 15 },
    { month: 'Aug', productSales: 280, ipRoyalties: 92, adRevenue: 71, tips: 18 },
    { month: 'Sep', productSales: 310, ipRoyalties: 78, adRevenue: 68, tips: 22 },
    { month: 'Oct', productSales: 265, ipRoyalties: 95, adRevenue: 74, tips: 20 },
    { month: 'Nov', productSales: 298, ipRoyalties: 88, adRevenue: 79, tips: 25 },
    { month: 'Dec', productSales: 307, ipRoyalties: 102, adRevenue: 132, tips: 40 },
  ],
  adMetrics: {
    impressions: 45230,
    clicks: 1826,
    ctr: 4.04,
    cpm: 10.75,
    revenue: 486.25,
  },
  topProducts: [
    { id: 1, name: 'Dragon Fighter Tee', sales: 43, revenue: 1074.50, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop' },
    { id: 2, name: 'Warrior Hoodie', sales: 28, revenue: 1119.20, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop' },
    { id: 3, name: 'Combat Mug', sales: 35, revenue: 454.65, image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop' },
    { id: 4, name: 'Victory Tote', sales: 22, revenue: 373.78, image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop' },
    { id: 5, name: 'Fighter Stickers', sales: 48, revenue: 431.52, image: 'https://images.unsplash.com/photo-1611003228941-98852ba62227?w=400&h=400&fit=crop' },
  ],
  transactions: [
    { id: 1, date: '2024-12-10', type: 'Product Sale', description: 'Dragon Fighter Tee - Size M', amount: 24.99, status: 'completed' },
    { id: 2, date: '2024-12-10', type: 'IP Royalty', description: 'Dragon Logo used in product', amount: 5.00, status: 'completed' },
    { id: 3, date: '2024-12-09', type: 'Ad Revenue', description: 'Header banner impressions (1,250)', amount: 13.44, status: 'completed' },
    { id: 4, date: '2024-12-09', type: 'Tip', description: 'Customer tip via aisle', amount: 10.00, status: 'completed' },
    { id: 5, date: '2024-12-08', type: 'Product Sale', description: 'Warrior Hoodie - Size L', amount: 39.99, status: 'completed' },
    { id: 6, date: '2024-12-08', type: 'Ad Revenue', description: 'Sidebar ad clicks (45)', amount: 8.10, status: 'completed' },
    { id: 7, date: '2024-12-07', type: 'Product Sale', description: 'Combat Mug', amount: 12.99, status: 'completed' },
    { id: 8, date: '2024-12-07', type: 'IP Royalty', description: 'Tiger Logo used in product', amount: 5.00, status: 'completed' },
    { id: 9, date: '2024-12-06', type: 'Ad Revenue', description: 'In-grid ad impressions (2,100)', amount: 22.58, status: 'pending' },
    { id: 10, date: '2024-12-06', type: 'Tip', description: 'Customer tip via aisle', amount: 25.00, status: 'pending' },
  ],
};

export default function EnhancedEarningsPage() {
  const [timeframe, setTimeframe] = useState('6months');
  
  const { overview, revenueBreakdown, monthlyData, adMetrics, topProducts, transactions } = earningsData;
  
  const percentageChange = ((overview.thisMonth - overview.lastMonth) / overview.lastMonth * 100).toFixed(1);
  const isPositive = percentageChange > 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Earnings & Analytics</h1>
              <p className="text-muted-foreground">Track your revenue and performance</p>
            </div>
            <Button className="gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Earnings</span>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold mb-1">${overview.totalEarnings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All-time revenue</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">This Month</span>
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="text-3xl font-bold mb-1">${overview.thisMonth.toFixed(2)}</div>
              <div className="flex items-center gap-1">
                <Badge variant={isPositive ? 'default' : 'destructive'} className="text-xs">
                  {isPositive ? '+' : ''}{percentageChange}%
                </Badge>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Pending Payout</span>
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold mb-1">${overview.pendingPayout.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Next: {overview.nextPayout}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Ad Revenue</span>
                <BarChart3 className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold mb-1">${revenueBreakdown.adRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{adMetrics.ctr.toFixed(2)}% CTR</p>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="ads">Ad Revenue</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Earnings Chart */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Revenue Trends</h3>
                    <p className="text-sm text-muted-foreground">Monthly earnings by source</p>
                  </div>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="6months">Last 6 Months</option>
                    <option value="12months">Last 12 Months</option>
                    <option value="alltime">All Time</option>
                  </select>
                </div>
                <EarningsChart data={monthlyData} />
              </Card>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Revenue Breakdown */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-6">Revenue Breakdown</h3>
                  <RevenueBreakdown data={revenueBreakdown} />
                </Card>

                {/* Top Products */}
                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-6">Top Performing Products</h3>
                  <TopProducts products={topProducts.slice(0, 5)} />
                </Card>
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-6">Product Performance</h3>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        #{index + 1}
                      </div>
                      <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                        <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">{product.sales} sales</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">${product.revenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">${(product.revenue / product.sales).toFixed(2)} avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Ad Revenue Tab */}
            <TabsContent value="ads" className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Eye className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Impressions</span>
                  </div>
                  <div className="text-3xl font-bold">{adMetrics.impressions.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total ad views</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <MousePointerClick className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">Clicks</span>
                  </div>
                  <div className="text-3xl font-bold">{adMetrics.clicks.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">{adMetrics.ctr.toFixed(2)}% click-through rate</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-muted-foreground">CPM</span>
                  </div>
                  <div className="text-3xl font-bold">${adMetrics.cpm.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Cost per 1K impressions</p>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-6">Ad Placement Performance</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold mb-1">Header Banner</h4>
                        <p className="text-sm text-muted-foreground">Prime visibility position</p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Impressions</p>
                        <p className="font-semibold">18,450</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Clicks</p>
                        <p className="font-semibold">742</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">CTR</p>
                        <p className="font-semibold">4.02%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Revenue</p>
                        <p className="font-semibold text-green-600">$198.34</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold mb-1">Sidebar Ads</h4>
                        <p className="text-sm text-muted-foreground">Sticky placement</p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Impressions</p>
                        <p className="font-semibold">14,280</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Clicks</p>
                        <p className="font-semibold">571</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">CTR</p>
                        <p className="font-semibold">4.00%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Revenue</p>
                        <p className="font-semibold text-green-600">$153.51</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold mb-1">In-Grid Ads</h4>
                        <p className="text-sm text-muted-foreground">Between products</p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Impressions</p>
                        <p className="font-semibold">12,500</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Clicks</p>
                        <p className="font-semibold">513</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">CTR</p>
                        <p className="font-semibold">4.10%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Revenue</p>
                        <p className="font-semibold text-green-600">$134.40</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <ArrowUpRight className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Optimize Your Ad Revenue</p>
                      <p className="text-sm text-muted-foreground">
                        Your CTR is above average! Consider increasing ad frequency to maximize revenue.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <TransactionsTable transactions={transactions} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
