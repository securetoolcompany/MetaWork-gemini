'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { ArrowUpRight, Upload, Palette } from 'lucide-react';
import { salesData } from '@/lib/mock-data';
import OnboardingDialog from '@/components/onboarding/OnboardingDialog';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const metrics = [
    {
      title: 'Total Earnings',
      value: '$2,847.50',
      change: '+12%',
      positive: true
    },
    {
      title: 'Total Sales',
      value: '156 items',
      change: '',
      positive: null
    },
    {
      title: 'Active Products',
      value: '18',
      change: '',
      positive: null
    },
    {
      title: 'Pending IP Reviews',
      value: '2',
      change: '',
      positive: null
    }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>
      
      <div className="flex-1 space-y-6 p-8">
        {/* Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => (
            <Card key={index} className="border-border bg-card hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                {metric.change && (
                  <span className="flex items-center text-xs font-medium text-green-500">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    {metric.change}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Sales */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Product Name</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.map((sale) => (
                  <TableRow key={sale.id} className="border-border hover:bg-accent/50">
                    <TableCell className="font-medium text-foreground">{sale.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                    <TableCell className="text-foreground">${sale.amount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={sale.status === 'completed' ? 'default' : 'secondary'}
                        className={sale.status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}
                      >
                        {sale.status === 'completed' ? 'Completed' : 'Processing'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 hover:shadow-xl transition-all duration-200 cursor-pointer" onClick={() => router.push('/upload-ip')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Upload New IP</h3>
                <p className="text-sm text-muted-foreground">Submit your artwork for approval</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20 hover:shadow-xl transition-all duration-200 cursor-pointer" onClick={() => router.push('/product-designer')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500">
                <Palette className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Design a Product</h3>
                <p className="text-sm text-muted-foreground">Create custom products with your IP</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Onboarding Dialog */}
      <OnboardingDialog open={showOnboarding} onOpenChange={setShowOnboarding} />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}