'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Percent, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  Loader2,
  Tag,
  Globe,
  Package,
  Settings,
  AlertTriangle
} from 'lucide-react';

export default function AdminPricingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [pricingRules, setPricingRules] = useState([]);
  const [globalDefault, setGlobalDefault] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    printfulProductId: 'global',
    percentMarkup: '',
    flatMarkup: '',
    customCategories: [],
    isActive: true
  });
  const [saving, setSaving] = useState(false);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: 'tag',
    sortOrder: 0
  });
  const [savingCategory, setSavingCategory] = useState(false);

  // Check admin access
  useEffect(() => {
    if (isAuthenticated && user && !user.isAdmin) {
      toast.error('Admin access required');
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // Fetch data
  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pricing rules
      const pricingRes = await fetch('/api/admin/product-pricing', {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        }
      });
      const pricingData = await pricingRes.json();
      
      if (pricingData.success) {
        setPricingRules(pricingData.pricingRules || []);
        setGlobalDefault(pricingData.globalDefault || null);
      }
      
      // Fetch categories
      const catRes = await fetch('/api/admin/categories?includeInactive=true', {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        }
      });
      const catData = await catRes.json();
      
      if (catData.success) {
        setCategories(catData.categories || []);
      }
      
      // Fetch products for reference
      const prodRes = await fetch('/api/printful/catalog?all=true');
      const prodData = await prodRes.json();
      
      if (prodData.success) {
        setProducts(prodData.products || []);
      }
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  // Save pricing rule
  const handleSaveRule = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/product-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        },
        body: JSON.stringify({
          printfulProductId: ruleForm.printfulProductId,
          percentMarkup: parseFloat(ruleForm.percentMarkup) || 0,
          flatMarkup: parseFloat(ruleForm.flatMarkup) || 0,
          customCategories: ruleForm.customCategories,
          isActive: ruleForm.isActive
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      
      toast.success(data.updated ? 'Pricing rule updated!' : 'Pricing rule created!');
      setDialogOpen(false);
      fetchData();
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete pricing rule
  const handleDeleteRule = async (productId) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    
    try {
      const response = await fetch(`/api/admin/product-pricing?productId=${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      
      toast.success('Pricing rule deleted');
      fetchData();
      
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Save category
  const handleSaveCategory = async () => {
    try {
      setSavingCategory(true);
      
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        },
        body: JSON.stringify({
          id: editingCategory?.id,
          name: categoryForm.name,
          description: categoryForm.description,
          icon: categoryForm.icon,
          sortOrder: categoryForm.sortOrder,
          isActive: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      
      toast.success(data.updated ? 'Category updated!' : 'Category created!');
      setCategoryDialogOpen(false);
      fetchData();
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingCategory(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      
      toast.success('Category deleted');
      fetchData();
      
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Open edit dialog
  const openEditDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        printfulProductId: rule.printfulProductId,
        percentMarkup: rule.percentMarkup?.toString() || '',
        flatMarkup: rule.flatMarkup?.toString() || '',
        customCategories: rule.customCategories || [],
        isActive: rule.isActive !== false
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        printfulProductId: 'global',
        percentMarkup: '',
        flatMarkup: '',
        customCategories: [],
        isActive: true
      });
    }
    setDialogOpen(true);
  };

  // Open category edit dialog
  const openCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'tag',
        sortOrder: category.sortOrder || 0
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        icon: 'tag',
        sortOrder: 0
      });
    }
    setCategoryDialogOpen(true);
  };

  // Get product name by ID
  const getProductName = (productId) => {
    if (productId === 'global') return 'Global Default';
    const product = products.find(p => p.catalogProductId === productId);
    return product?.name || `Product #${productId}`;
  };

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Admin - Access Denied" />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground">You need admin privileges to access this page.</p>
              <Button className="mt-4" onClick={() => router.push('/')}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header title="Admin - Product Pricing & Categories" />
      
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pricing & Categories</h1>
              <p className="text-muted-foreground">Manage product markups and custom categories</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="pricing" className="space-y-4">
              <TabsList>
                <TabsTrigger value="pricing" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Product Pricing
                </TabsTrigger>
                <TabsTrigger value="categories" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Categories
                </TabsTrigger>
              </TabsList>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-4">
                {/* Global Default Card */}
                <Card className="border-2 border-primary/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <CardTitle>Global Default Markup</CardTitle>
                      </div>
                      <Button size="sm" onClick={() => openEditDialog(globalDefault || { printfulProductId: 'global' })}>
                        <Edit className="h-4 w-4 mr-2" />
                        {globalDefault ? 'Edit' : 'Set Default'}
                      </Button>
                    </div>
                    <CardDescription>
                      Applied to all products without specific overrides
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {globalDefault ? (
                      <div className="flex gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground">Percent Markup</p>
                          <p className="text-2xl font-bold">{globalDefault.percentMarkup || 0}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Flat Markup</p>
                          <p className="text-2xl font-bold">${globalDefault.flatMarkup?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No global default set. Products will use base price.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Product-specific overrides */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Product-Specific Overrides</CardTitle>
                        <CardDescription>Custom pricing for individual products</CardDescription>
                      </div>
                      <Button onClick={() => openEditDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Override
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {pricingRules.filter(r => r.printfulProductId !== 'global').length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No product-specific overrides. All products use global default.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>% Markup</TableHead>
                            <TableHead>$ Markup</TableHead>
                            <TableHead>Categories</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pricingRules.filter(r => r.printfulProductId !== 'global').map(rule => (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">
                                {getProductName(rule.printfulProductId)}
                              </TableCell>
                              <TableCell>{rule.percentMarkup}%</TableCell>
                              <TableCell>${rule.flatMarkup?.toFixed(2)}</TableCell>
                              <TableCell>
                                {rule.customCategories?.length > 0 ? (
                                  <div className="flex gap-1 flex-wrap">
                                    {rule.customCategories.slice(0, 2).map(cat => (
                                      <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                                    ))}
                                    {rule.customCategories.length > 2 && (
                                      <Badge variant="outline" className="text-xs">+{rule.customCategories.length - 2}</Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">None</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                                  {rule.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.printfulProductId)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Custom Categories</CardTitle>
                        <CardDescription>Define categories for organizing products in the catalog</CardDescription>
                      </div>
                      <Button onClick={() => openCategoryDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Category
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {categories.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No custom categories defined. Products will use Printful's native categories.
                      </p>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categories.map(cat => (
                          <Card key={cat.id} className={!cat.isActive ? 'opacity-50' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-semibold">{cat.name}</h3>
                                  {cat.description && (
                                    <p className="text-sm text-muted-foreground">{cat.description}</p>
                                  )}
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      Order: {cat.sortOrder}
                                    </Badge>
                                    {!cat.isActive && (
                                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openCategoryDialog(cat)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Pricing Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
            <DialogDescription>
              Set markup percentages and flat amounts for products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ruleForm.printfulProductId}
                onChange={(e) => setRuleForm(prev => ({ ...prev, printfulProductId: e.target.value }))}
                disabled={editingRule}
              >
                <option value="global">Global Default (All Products)</option>
                {products.map(p => (
                  <option key={p.catalogProductId} value={p.catalogProductId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Percent Markup
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="20"
                  value={ruleForm.percentMarkup}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, percentMarkup: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g., 20 = +20% of base price</p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Flat Markup
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2.00"
                  value={ruleForm.flatMarkup}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, flatMarkup: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g., 2.00 = +$2.00</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={ruleForm.isActive}
                onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              Define a custom category for organizing products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                placeholder="e.g., Summer Collection"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                placeholder="0"
                value={categoryForm.sortOrder}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory || !categoryForm.name}>
              {savingCategory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
