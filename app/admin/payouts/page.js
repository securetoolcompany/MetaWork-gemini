'use client';

import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Download,
  Eye,
  DollarSign,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { payoutRecords, platformMetrics } from '@/lib/admin-mock-data';
import { toast } from 'sonner';

export default function PayoutsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState(null);

  const filteredPayouts = payoutRecords.filter(payout => {
    if (statusFilter === 'all') return true;
    return payout.status === statusFilter;
  });

  const totalPaid = payoutRecords
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payoutRecords
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const markAsPaid = (payoutId) => {
    toast.success('Payout marked as completed!');
  };

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
              <h1 className="text-3xl font-bold">Payout Management</h1>
              <p className="text-muted-foreground mt-1">Track and manage creator payouts</p>
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
                  <p className="text-sm text-muted-foreground mb-1">Total Paid Out</p>
                  <h3 className="text-2xl font-bold">${totalPaid.toLocaleString()}</h3>
                </div>
                <div className="bg-green-500/10 text-green-500 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending Payouts</p>
                  <h3 className="text-2xl font-bold">${totalPending.toLocaleString()}</h3>
                </div>
                <div className="bg-orange-500/10 text-orange-500 p-3 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Platform Fee Earned</p>
                  <h3 className="text-2xl font-bold">${platformMetrics.platformFee.toLocaleString()}</h3>
                </div>
                <div className="bg-blue-500/10 text-blue-500 p-3 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Payouts</p>
                  <h3 className="text-2xl font-bold">{payoutRecords.length}</h3>
                </div>
                <div className="bg-purple-500/10 text-purple-500 p-3 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Filter by status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payouts</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground ml-auto">
                Showing {filteredPayouts.length} of {payoutRecords.length} payouts
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.creatorName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {payout.walletAddress}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payout.period}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(payout.startDate).toLocaleDateString()} - {new Date(payout.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-500">
                      ${payout.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payout.method}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payout.status === 'completed' ? 'success' : 'secondary'}>
                        {payout.status === 'completed' ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Completed</>
                        ) : (
                          <><Clock className="w-3 h-3 mr-1" /> Pending</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payout.paidDate ? (
                        new Date(payout.paidDate).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayout(payout)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Payout Details</DialogTitle>
                              <DialogDescription>
                                Detailed breakdown for {payout.creatorName}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Creator</p>
                                  <p className="font-semibold">{payout.creatorName}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Period</p>
                                  <p className="font-semibold">{payout.period}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Total Amount</p>
                                  <p className="font-semibold text-green-500 text-xl">
                                    ${payout.amount.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Payment Method</p>
                                  <p className="font-semibold">{payout.method}</p>
                                </div>
                              </div>

                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-3">Revenue Breakdown</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between p-2 rounded bg-blue-500/10">
                                    <span>Product Sales</span>
                                    <span className="font-semibold">
                                      ${payout.breakdown.productSales.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between p-2 rounded bg-purple-500/10">
                                    <span>IP Royalties</span>
                                    <span className="font-semibold">
                                      ${payout.breakdown.ipRoyalties.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between p-2 rounded bg-green-500/10">
                                    <span>Ad Revenue</span>
                                    <span className="font-semibold">
                                      ${payout.breakdown.adRevenue.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between p-2 rounded bg-orange-500/10">
                                    <span>Tips</span>
                                    <span className="font-semibold">
                                      ${payout.breakdown.tips.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="border-t pt-4">
                                <p className="text-sm text-muted-foreground">Wallet Address</p>
                                <p className="font-mono text-sm mt-1">{payout.walletAddress}</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {payout.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsPaid(payout.id)}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
