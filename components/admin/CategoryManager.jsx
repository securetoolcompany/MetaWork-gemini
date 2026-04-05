'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, FolderTree } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from "@/components/ui/label";

export default function PlatformCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Input states for adding new items
  const [newSubcategories, setNewSubcategories] = useState({});
  const [newMainCategories, setNewMainCategories] = useState({ product: '', ip: '', aisle: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories?includeInactive=true', {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      if (data.success && data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  // Group categories into the 3 main domains
  const groupedData = categories.reduce((acc, cat) => {
    const type = cat.type || 'default';
    let domain = 'product';
    if (type.startsWith('ip-')) domain = 'ip';
    else if (type.startsWith('aisle-')) domain = 'aisle';

    if (!acc[domain]) acc[domain] = {};
    if (!acc[domain][type]) acc[domain][type] = [];
    acc[domain][type].push(cat);
    
    return acc;
  }, { product: {}, ip: {}, aisle: {} });

  // Format the raw DB type string into a readable Main Category title
  const formatTitle = (type) => {
    return type.replace('ip-', '').replace('aisle-', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleAddSubcategory = async (type) => {
    const name = newSubcategories[type];
    if (!name || !name.trim()) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type: type })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Added ${name} to ${formatTitle(type)}`);
        setNewSubcategories(prev => ({ ...prev, [type]: '' }));
        fetchCategories();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add subcategory');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMainCategory = async (domain) => {
    const name = newMainCategories[domain];
    if (!name || !name.trim()) return;

    // We must create a "dummy" or initial subcategory to establish the new type in the DB.
    // We'll create one called "General" under this new type.
    let newType = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (domain === 'ip') newType = `ip-${newType}`;
    if (domain === 'aisle') newType = `aisle-${newType}`;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'General', type: newType })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Created new category group: ${name}`);
        setNewMainCategories(prev => ({ ...prev, [domain]: '' }));
        fetchCategories();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add main category');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id, name, isMainCategory = false, categoryIds = []) => {
    const confirmMessage = isMainCategory 
      ? `Are you sure you want to delete this ENTIRE main category and ALL its subcategories?`
      : `Are you sure you want to delete the subcategory "${name}"?`;
      
    if (!window.confirm(confirmMessage)) return;

    setIsProcessing(true);
    try {
      const idsToDelete = isMainCategory ? categoryIds : [id];
      
      // Delete all selected IDs
      await Promise.all(idsToDelete.map(catId => 
        fetch(`/api/admin/categories?id=${catId}`, { method: 'DELETE' })
      ));

      toast.success(isMainCategory ? 'Main category deleted' : 'Subcategory deleted');
      fetchCategories();
    } catch (error) {
      toast.error('Failed to delete');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>;
  }

  const renderDomainSection = (domain, title, description, icon) => {
    const groups = groupedData[domain];
    
    return (
      <Card className="bg-slate-900/50 border-white/5 text-white mb-8 overflow-hidden">
        <CardHeader className="bg-slate-950/50 border-b border-white/5 pb-4">
          <CardTitle className="text-2xl flex items-center gap-3">
            <span className="text-sky-400">{icon}</span> {title}
          </CardTitle>
          <p className="text-sm text-slate-400">{description}</p>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          
          {Object.keys(groups).length === 0 ? (
            <p className="text-slate-500 italic text-sm">No categories configured for this section.</p>
          ) : (
            Object.entries(groups).map(([type, cats]) => (
              <div key={type} className="border border-white/10 rounded-lg p-4 bg-slate-900/30">
                {/* Main Category Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5">
                  <h3 className="text-lg font-bold text-sky-300 flex items-center gap-2">
                    <FolderTree className="w-4 h-4" /> {formatTitle(type)}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                    onClick={() => handleDelete(null, type, true, cats.map(c => c._id || c.id))}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                  </Button>
                </div>

                {/* Subcategories List */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {cats.map(cat => (
                    <Badge key={cat._id || cat.id} variant="secondary" className="bg-slate-800 text-slate-200 border-white/10 py-1.5 px-3 flex items-center gap-2 text-sm font-medium">
                      {cat.name}
                      <button 
                        onClick={() => handleDelete(cat._id || cat.id, cat.name)}
                        className="text-slate-500 hover:text-red-400 transition-colors ml-1 focus:outline-none"
                        disabled={isProcessing}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>

                {/* Add Subcategory Input */}
                <div className="flex items-center gap-2 max-w-sm">
                  <Input 
                    placeholder="New subcategory..." 
                    className="bg-slate-950 border-white/10 h-9 text-sm"
                    value={newSubcategories[type] || ''}
                    onChange={(e) => setNewSubcategories(prev => ({ ...prev, [type]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(type)}
                    disabled={isProcessing}
                  />
                  <Button size="sm" onClick={() => handleAddSubcategory(type)} disabled={isProcessing || !newSubcategories[type]} className="h-9">
                    Add
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Add New Main Category */}
          <div className="pt-4 mt-6 border-t border-white/10">
            <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Create New Main Category</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 max-w-md">
              <Input 
                placeholder="e.g. Electronics, Clothing..." 
                className="bg-slate-950 border-white/20"
                value={newMainCategories[domain] || ''}
                onChange={(e) => setNewMainCategories(prev => ({ ...prev, [domain]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMainCategory(domain)}
                disabled={isProcessing}
              />
              <Button onClick={() => handleAddMainCategory(domain)} disabled={isProcessing || !newMainCategories[domain]} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Add Group
              </Button>
            </div>
          </div>
          
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-2">
      {renderDomainSection('product', 'Product Showroom Categories', 'Manage physical and digital product categories.', '🛒')}
      {renderDomainSection('ip', 'IP Asset Categories', 'Manage categories for licensing art, music, and models.', '🎨')}
      {renderDomainSection('aisle', 'Creator Aisle Categories', 'Manage categories used to discover creator storefronts.', '🏪')}
    </div>
  );
}