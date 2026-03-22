'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Download,
  Plus,
  Trash2,
  Play,
  Save,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { bestSellingProducts, reportTemplates } from '@/lib/admin-mock-data';
import { toast } from 'sonner';

export default function ReportBuilderPage() {
  const [filters, setFilters] = useState([
    { id: 1, field: 'category', operator: 'equals', value: '' }
  ]);
  const [reportName, setReportName] = useState('');
  const [dateRange, setDateRange] = useState('all_time');
  const [sortBy, setSortBy] = useState('sales');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const fieldOptions = [
    { value: 'category', label: 'Product Category' },
    { value: 'sales', label: 'Sales Count' },
    { value: 'revenue', label: 'Total Revenue' },
    { value: 'price', label: 'Retail Price' },
    { value: 'creator', label: 'Creator Name' },
    { value: 'hasIP', label: 'Has IP' },
  ];

  const operatorOptions = {
    category: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
    ],
    sales: [
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'equals', label: 'Equals' },
    ],
    revenue: [
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'equals', label: 'Equals' },
    ],
    price: [
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'between', label: 'Between' },
    ],
    creator: [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' },
    ],
    hasIP: [
      { value: 'equals', label: 'Equals' },
    ],
  };

  const categoryValues = [
    "Men's T-Shirt",
    "Women's T-Shirt",
    'Unisex Hoodie',
    '11oz Mug',
    'Sticker Sheet',
    'Tote Bag',
  ];

  const addFilter = () => {
    setFilters([...filters, {
      id: Date.now(),
      field: 'category',
      operator: 'equals',
      value: ''
    }]);
  };

  const removeFilter = (id) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id, key, value) => {
    setFilters(filters.map(f => {
      if (f.id === id) {
        const updated = { ...f, [key]: value };
        // Reset operator when field changes
        if (key === 'field') {
          updated.operator = operatorOptions[value][0].value;
          updated.value = '';
        }
        return updated;
      }
      return f;
    }));
  };

  const runReport = () => {
    let filtered = [...bestSellingProducts];

    // Apply date range filter (mock - would check actual dates)
    // For demo, we'll just use all data

    // Apply custom filters
    filters.forEach(filter => {
      if (!filter.value) return;

      switch (filter.field) {
        case 'category':
          if (filter.operator === 'equals') {
            filtered = filtered.filter(p => p.category === filter.value);
          } else if (filter.operator === 'not_equals') {
            filtered = filtered.filter(p => p.category !== filter.value);
          } else if (filter.operator === 'contains') {
            filtered = filtered.filter(p => p.category.toLowerCase().includes(filter.value.toLowerCase()));
          }
          break;
        case 'sales':
          const salesVal = parseInt(filter.value);
          if (filter.operator === 'greater_than') {
            filtered = filtered.filter(p => p.salesCount > salesVal);
          } else if (filter.operator === 'less_than') {
            filtered = filtered.filter(p => p.salesCount < salesVal);
          } else if (filter.operator === 'equals') {
            filtered = filtered.filter(p => p.salesCount === salesVal);
          }
          break;
        case 'revenue':
          const revenueVal = parseFloat(filter.value);
          if (filter.operator === 'greater_than') {
            filtered = filtered.filter(p => p.totalRevenue > revenueVal);
          } else if (filter.operator === 'less_than') {
            filtered = filtered.filter(p => p.totalRevenue < revenueVal);
          }
          break;
        case 'price':
          const priceVal = parseFloat(filter.value);
          if (filter.operator === 'greater_than') {
            filtered = filtered.filter(p => p.retailPrice > priceVal);
          } else if (filter.operator === 'less_than') {
            filtered = filtered.filter(p => p.retailPrice < priceVal);
          }
          break;
        case 'creator':
          if (filter.operator === 'equals') {
            filtered = filtered.filter(p => p.creator === filter.value);
          } else if (filter.operator === 'contains') {
            filtered = filtered.filter(p => p.creator.toLowerCase().includes(filter.value.toLowerCase()));
          }
          break;
        case 'hasIP':
          const hasIP = filter.value === 'true';
          filtered = filtered.filter(p => hasIP ? p.ipUsed !== null : p.ipUsed === null);
          break;
      }
    });

    // Apply sorting
    switch (sortBy) {
      case 'sales':
        filtered.sort((a, b) => b.salesCount - a.salesCount);
        break;
      case 'revenue':
        filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      case 'price':
        filtered.sort((a, b) => b.retailPrice - a.retailPrice);
        break;
    }

    setResults(filtered);
    setShowResults(true);
    toast.success(`Report generated with ${filtered.length} results`);
  };

  const saveReport = () => {
    if (!reportName) {
      toast.error('Please enter a report name');
      return;
    }
    toast.success(`Report "${reportName}" saved successfully!`);
  };

  const loadTemplate = (template) => {
    // Load template filters
    toast.success(`Loaded template: ${template.name}`);
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
              <h1 className="text-3xl font-bold">Report Builder</h1>
              <p className="text-muted-foreground mt-1">Create custom reports with advanced filters</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto">
        <Tabs defaultValue="build" className="space-y-6">
          <TabsList>
            <TabsTrigger value="build">Build Report</TabsTrigger>
            <TabsTrigger value="templates">Saved Templates</TabsTrigger>
          </TabsList>

          {/* Build Report Tab */}
          <TabsContent value="build" className="space-y-6">
            {/* Report Name */}
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Report Name</Label>
                  <Input
                    placeholder="e.g., Best Selling Shirts Last Month"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date Range</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_quarter">Last Quarter</SelectItem>
                        <SelectItem value="this_quarter">This Quarter</SelectItem>
                        <SelectItem value="last_year">Last Year</SelectItem>
                        <SelectItem value="all_time">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Most Sales</SelectItem>
                        <SelectItem value="revenue">Highest Revenue</SelectItem>
                        <SelectItem value="price">Highest Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters (Boolean Logic)
                </CardTitle>
                <Button onClick={addFilter} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Filter
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {filters.map((filter, index) => (
                  <div key={filter.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {index > 0 && (
                      <Badge variant="outline" className="mr-2">AND</Badge>
                    )}
                    
                    <Select
                      value={filter.field}
                      onValueChange={(val) => updateFilter(filter.id, 'field', val)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(val) => updateFilter(filter.id, 'operator', val)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorOptions[filter.field]?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {filter.field === 'category' ? (
                      <Select
                        value={filter.value}
                        onValueChange={(val) => updateFilter(filter.id, 'value', val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryValues.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : filter.field === 'hasIP' ? (
                      <Select
                        value={filter.value}
                        onValueChange={(val) => updateFilter(filter.id, 'value', val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Enter value..."
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        className="flex-1"
                        type={['sales', 'revenue', 'price'].includes(filter.field) ? 'number' : 'text'}
                      />
                    )}

                    {filters.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={saveReport}>
                <Save className="w-4 h-4 mr-2" />
                Save Report
              </Button>
              <Button onClick={runReport}>
                <Play className="w-4 h-4 mr-2" />
                Run Report
              </Button>
            </div>

            {/* Results */}
            {showResults && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Report Results ({results.length} items)</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead>IP Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((product) => (
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
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{product.creator}</TableCell>
                          <TableCell className="text-right">${product.retailPrice}</TableCell>
                          <TableCell className="text-right">{product.salesCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${product.totalRevenue.toLocaleString()}
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
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Saved Report Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h4 className="font-semibold">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Created by {template.createdBy} on {new Date(template.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadTemplate(template)}
                        >
                          Load
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
