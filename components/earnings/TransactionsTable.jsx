'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function TransactionsTable({ transactions }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentTransactions = transactions.slice(startIdx, endIdx);

  const getTypeColor = (type) => {
    switch(type) {
      case 'Product Sale': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'IP Royalty': return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
      case 'Ad Revenue': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'Tip': return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {new Date(transaction.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getTypeColor(transaction.type)}>
                      {transaction.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-500">
                    ${transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={transaction.status === 'completed' ? 'success' : 'warning'}
                      className={transaction.status === 'completed' 
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                      }
                    >
                      {transaction.status === 'completed' ? 'Completed' : 'Pending'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIdx + 1}-{Math.min(endIdx, transactions.length)} of {transactions.length} transactions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}