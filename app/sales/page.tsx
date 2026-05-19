// app/sales/page.tsx
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Download,
  Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dummy data to populate the page beautifully
const recentSales = [
  { id: "ORD-7291", product: "Cyberpunk Aviators (3D File)", customer: "0x8F4...2b9A", date: "Today, 2:45 PM", amount: "$12.00", status: "Completed", type: "Digital" },
  { id: "ORD-7290", product: "Bored Ape Hoodie", customer: "Alex Mercer", date: "Yesterday", amount: "$55.00", status: "Processing", type: "Physical" },
  { id: "ORD-7289", product: "Synthwave Beats Vol. 1", customer: "0x1A2...9cF4", date: "Oct 12, 2026", amount: "$8.50", status: "Completed", type: "Digital" },
  { id: "ORD-7288", product: "Metawork Logo Mug", customer: "Sarah Jenkins", date: "Oct 11, 2026", amount: "$18.00", status: "Shipped", type: "Physical" },
  { id: "ORD-7287", product: "Hunters On-Chain Asset", customer: "0x9B1...4eD1", date: "Oct 10, 2026", amount: "$150.00", status: "Completed", type: "Tokenized IP" },
];

export default function SalesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4 sm:px-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales & Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage your customer orders, physical fulfillment, and digital sales history.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button asChild className="gap-2 w-full sm:w-auto">
            <Link href="/earnings">
              View Earnings <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="h-3 w-3" /> +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,543.00</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="h-3 w-3" /> +8.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Fulfillment</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">
              Physical items awaiting shipment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Table Area */}
      <Card className="border-muted/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className="text-lg flex-1">Recent Transactions</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search orders..." className="pl-8 bg-background" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10 hover:bg-muted/10">
                <TableHead className="w-[100px] pl-6">Order ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/30">
                  <TableCell className="font-medium pl-6">{sale.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sale.product}</p>
                      <p className="text-xs text-muted-foreground">{sale.type}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sale.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={
                        sale.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20" :
                        sale.status === "Processing" ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20"
                      }
                    >
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium pr-6">{sale.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination/Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">Showing 1-5 of 1,248 orders</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}