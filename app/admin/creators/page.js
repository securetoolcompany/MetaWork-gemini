'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { topCreators } from '@/lib/admin-mock-data';

export default function CreatorsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('earnings');

  const sortedCreators = [...topCreators].sort((a, b) => {
    switch(sortBy) {
      case 'earnings':
        return b.totalEarnings - a.totalEarnings;
      case 'sales':
        return b.salesCount - a.salesCount;
      case 'products':
        return b.productsCount - a.productsCount;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const filteredCreators = sortedCreators.filter(creator =>
    creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <h1 className="text-3xl font-bold">All Creators</h1>
              <p className="text-muted-foreground mt-1">{filteredCreators.length} creators found</p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earnings">Highest Earnings</SelectItem>
                  <SelectItem value="sales">Most Sales</SelectItem>
                  <SelectItem value="products">Most Products</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Creators Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Total Earnings</TableHead>
                  <TableHead className="text-right">Product Sales</TableHead>
                  <TableHead className="text-right">IP Royalties</TableHead>
                  <TableHead className="text-right">Ad Revenue</TableHead>
                  <TableHead className="text-right">Tips</TableHead>
                  <TableHead className="text-right">Sales Count</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreators.map((creator) => (
                  <TableRow key={creator.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden">
                          <Image
                            src={creator.avatar}
                            alt={creator.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{creator.name}</p>
                          <p className="text-sm text-muted-foreground">@{creator.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-500">
                      ${creator.totalEarnings.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${creator.productSales.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${creator.ipRoyalties.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${creator.adRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${creator.tips.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {creator.salesCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {creator.productsCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={creator.status === 'active' ? 'success' : 'secondary'}>
                        {creator.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/creators/${creator.id}`}>
                          View Details
                        </Link>
                      </Button>
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
