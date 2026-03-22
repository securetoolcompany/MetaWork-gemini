'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, GripVertical, MoreVertical, Trash2, Copy, ChevronDown, ChevronUp, X, Loader2, Cloud } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

/**
 * Hook to sync collections with MongoDB backend
 */
function useCollectionsSync(enableSync = false) {
  const [mongoCollections, setMongoCollections] = useState([]);
  const [mongoProducts, setMongoProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  // Fetch collections from MongoDB
  const fetchCollections = useCallback(async () => {
    if (!enableSync) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/collections');
      
      if (response.ok) {
        const data = await response.json();
        setMongoCollections(data.collections || []);
        setSynced(true);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  }, [enableSync]);

  // Fetch products from MongoDB
  const fetchProducts = useCallback(async () => {
    if (!enableSync) return;
    
    try {
      // Use the clean products API
      const response = await fetch('/api/products');
      
      if (response.ok) {
        const data = await response.json();
        setMongoProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [enableSync]);

  // Create collection
  const createCollection = useCallback(async (collectionData) => {
    if (!enableSync) return null;
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionData)
      });
      if (response.ok) {
        const data = await response.json();
        setMongoCollections(prev => [...prev, data.collection]);
        return data.collection;
      }
    } catch (error) { console.error(error); }
    return null;
  }, [enableSync]);

  // Update collection
  const updateCollection = useCallback(async (collectionData) => {
    if (!enableSync) return null;
    try {
      const response = await fetch('/api/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionData)
      });
      if (response.ok) {
        const data = await response.json();
        setMongoCollections(prev => 
          prev.map(c => c.id === data.collection.id ? data.collection : c)
        );
        return data.collection;
      }
    } catch (error) { console.error(error); }
    return null;
  }, [enableSync]);

  // Delete collection
  const deleteCollection = useCallback(async (collectionId) => {
    if (!enableSync) return false;
    try {
      const response = await fetch(`/api/collections?id=${collectionId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setMongoCollections(prev => prev.filter(c => c.id !== collectionId));
        return true;
      }
    } catch (error) { console.error(error); }
    return false;
  }, [enableSync]);

  useEffect(() => {
    fetchCollections();
    fetchProducts();
  }, [fetchCollections, fetchProducts]);

  return {
    mongoCollections,
    mongoProducts,
    loading,
    synced,
    createCollection,
    updateCollection,
    deleteCollection
  };
}

function SortableCollectionCard({ collection, index, isExpanded, toggleExpanded, updateCollectionField, handleDuplicateCollection, handleDeleteCollection, setAddProductsDialog, products }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const collectionProducts = products.filter(p => collection.productIds?.includes(p.id));

  return (
    <div ref={setNodeRef} style={style}>
      <Card data-tutorial={index === 0 ? "collection-card" : undefined}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div {...attributes} {...listeners} className="cursor-move touch-none">
                <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </div>
              <div className="flex-1">
                <Input
                  value={collection.name}
                  onChange={(e) => updateCollectionField(collection.id, 'name', e.target.value)}
                  className="font-semibold text-lg h-auto p-0 border-0 focus-visible:ring-0"
                />
              </div>
              <Badge variant="secondary">{collectionProducts.length} products</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggleExpanded(collection.id)}>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDuplicateCollection(collection)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCollection(collection.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Products Per Row</Label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(num => (
                    <Button
                      key={num}
                      variant={collection.columns === num ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateCollectionField(collection.id, 'columns', num)}
                      className="flex-1"
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={collection.description || ''}
                  onChange={(e) => updateCollectionField(collection.id, 'description', e.target.value)}
                  placeholder="Collection description"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Products ({collectionProducts.length})</Label>
              {collectionProducts.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {collectionProducts.map(product => (
                    <div key={product.id} className="relative group">
                      <img
                        src={product.imageUrl || product.thumbnailUrl || '/placeholder.png'}
                        alt={product.name}
                        className="w-full aspect-square object-cover rounded-lg border border-border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const updatedProductIds = collection.productIds.filter(id => id !== product.id);
                          updateCollectionField(collection.id, 'productIds', updatedProductIds);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="text-xs mt-1 truncate">{product.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No products in this collection
                </div>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setAddProductsDialog(collection.id)}>
              <Plus className="mr-2 h-4 w-4" /> Add Products
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function CollectionsTab({ 
  settings, 
  updateSettings, 
  tutorialActive = false, 
  tutorialStep = 0, 
  onTutorialAdvance = null,
  enableMongoSync = false 
}) {
  const [expandedCollections, setExpandedCollections] = useState(new Set([]));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '', columns: 3 });
  const [addProductsDialog, setAddProductsDialog] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);

  // MongoDB sync hook
  const {
    mongoCollections,
    mongoProducts,
    loading: mongoLoading,
    synced,
    createCollection: createMongoCollection,
    updateCollection: updateMongoCollection,
    deleteCollection: deleteMongoCollection
  } = useCollectionsSync(enableMongoSync);

  // LOGIC FIX: If sync is enabled, use ONLY mongo data.
  const collections = enableMongoSync ? mongoCollections : (settings?.collections || []);
  const allProducts = enableMongoSync ? mongoProducts : []; 

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDialogOpenChange = (open) => {
    if (tutorialActive && tutorialStep >= 2 && tutorialStep <= 5) return;
    setCreateDialogOpen(open);
  };

  const toggleExpanded = (collectionId) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleCreateCollection = async () => {
    setSaving(true);
    try {
      if (enableMongoSync) {
        const created = await createMongoCollection({
          name: newCollection.name,
          description: newCollection.description,
          columns: newCollection.columns,
          productIds: []
        });
        if (created) {
          // Update parent state so Preview updates immediately
          updateSettings('collections', [...collections, created]);
          toast.success('Collection created!');
        }
      } else {
        const newCol = {
          id: Date.now(),
          name: newCollection.name,
          description: newCollection.description,
          productIds: [],
          columns: newCollection.columns,
          showHeader: true
        };
        updateSettings('collections', [...collections, newCol]);
        toast.success('Collection created!');
      }
      setNewCollection({ name: '', description: '', columns: 3 });
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error('Failed to create collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (enableMongoSync) {
      const success = await deleteMongoCollection(collectionId);
      if (success) {
        // Update parent state
        updateSettings('collections', collections.filter(c => c.id !== collectionId));
        toast.success('Collection deleted');
      }
    } else {
      updateSettings('collections', collections.filter(c => c.id !== collectionId));
    }
  };

  const handleDuplicateCollection = async (collection) => {
    if (enableMongoSync) {
      const created = await createMongoCollection({
        name: `${collection.name} (Copy)`,
        description: collection.description,
        columns: collection.columns,
        productIds: collection.productIds || []
      });
      if (created) {
        // Update parent state
        updateSettings('collections', [...collections, created]);
        toast.success('Collection duplicated');
      }
    } else {
      const duplicate = { ...collection, id: Date.now(), name: `${collection.name} (Copy)` };
      updateSettings('collections', [...collections, duplicate]);
    }
  };

  const handleAddProducts = async () => {
    if (addProductsDialog && selectedProducts.length > 0) {
      const collection = collections.find(c => c.id === addProductsDialog);
      if (!collection) return;
      
      const updatedProductIds = [...new Set([...(collection.productIds || []), ...selectedProducts])];
      
      if (enableMongoSync) {
        const updated = await updateMongoCollection({ id: addProductsDialog, productIds: updatedProductIds });
        if (updated) {
          // Update parent state for immediate preview refresh
          const updatedCollections = collections.map(c => 
            c.id === addProductsDialog ? updated : c
          );
          updateSettings('collections', updatedCollections);
          toast.success(`${selectedProducts.length} product(s) added`);
        }
      } else {
        const updatedCollections = collections.map(c => 
          c.id === addProductsDialog ? { ...c, productIds: updatedProductIds } : c
        );
        updateSettings('collections', updatedCollections);
      }
      
      setAddProductsDialog(null);
      setSelectedProducts([]);
    }
  };

  const updateCollectionField = async (collectionId, field, value) => {
    if (enableMongoSync) {
      const updated = await updateMongoCollection({ id: collectionId, [field]: value });
      if (updated) {
        // Update parent state
        const updatedCollections = collections.map(c => 
          c.id === collectionId ? updated : c
        );
        updateSettings('collections', updatedCollections);
      }
    } else {
      const updatedCollections = collections.map(c => 
        c.id === collectionId ? { ...c, [field]: value } : c
      );
      updateSettings('collections', updatedCollections);
    }
  };

  const handleDragStart = (event) => setActiveId(event.active.id);
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = collections.findIndex(c => c.id === active.id);
      const newIndex = collections.findIndex(c => c.id === over.id);
      
      const newOrder = arrayMove(collections, oldIndex, newIndex);
      
      // Update parent state for display
      updateSettings('collections', newOrder);
      
      // Note: MongoDB reordering would typically require a separate API endpoint
      // for bulk update of order indices, not implemented in this snippet.
      toast.success('Collections reordered (Display only)');
    }
    setActiveId(null);
  };
  
  const handleDragCancel = () => setActiveId(null);

  const activeCollection = collections.find(c => c.id === activeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Organize Your Products</h3>
            {enableMongoSync && synced && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <Cloud className="h-3 w-3 mr-1" /> Synced
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Create collections to group related products</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={mongoLoading}>
              {mongoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>Group your products into organized collections</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Collection Name *</Label>
                <Input
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="e.g., Summer Drop, Best Sellers"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  placeholder="Brief description"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Products Per Row</Label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(num => (
                    <Button
                      key={num}
                      variant={newCollection.columns === num ? 'default' : 'outline'}
                      onClick={() => setNewCollection({ ...newCollection, columns: num })}
                      className="flex-1"
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreateCollection} disabled={!newCollection.name || saving} className="flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {mongoLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading collections...</span>
        </div>
      ) : collections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No collections yet</p>
            <p className="text-sm">Create your first collection to organize your products</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={collections.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {collections.map((collection, index) => (
                <SortableCollectionCard
                  key={collection.id}
                  collection={collection}
                  index={index}
                  isExpanded={expandedCollections.has(collection.id)}
                  toggleExpanded={toggleExpanded}
                  updateCollectionField={updateCollectionField}
                  handleDuplicateCollection={handleDuplicateCollection}
                  handleDeleteCollection={handleDeleteCollection}
                  setAddProductsDialog={setAddProductsDialog}
                  products={allProducts}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeCollection ? (
              <Card className="opacity-80 cursor-grabbing">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div className="font-semibold text-lg">{activeCollection.name}</div>
                  </div>
                </CardHeader>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add Products Dialog */}
      <Dialog open={addProductsDialog !== null} onOpenChange={(open) => !open && setAddProductsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Products</DialogTitle>
            <DialogDescription>Select products to add to this collection</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 max-h-96 overflow-auto py-4">
            {allProducts.length === 0 ? (
               <div className="col-span-3 text-center py-8 text-muted-foreground">
                 <p>No products found.</p>
                 <Button variant="link" onClick={() => window.open('/products/creator', '_blank')}>Create Products</Button>
               </div>
            ) : (
              allProducts.map(product => {
                const isSelected = selectedProducts.includes(product.id);
                const collection = collections.find(c => c.id === addProductsDialog);
                const alreadyInCollection = collection?.productIds?.includes(product.id);
                return (
                  <button
                    key={product.id}
                    disabled={alreadyInCollection}
                    onClick={() => {
                      if (isSelected) setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                      else setSelectedProducts([...selectedProducts, product.id]);
                    }}
                    className={`relative rounded-lg border-2 transition-all ${
                      alreadyInCollection ? 'border-muted opacity-50 cursor-not-allowed' :
                      isSelected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary'
                    }`}
                  >
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full aspect-square object-cover rounded-t-md" 
                    />
                    <div className="p-2 text-left">
                      <div className="text-xs font-medium truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground">${product.price}</div>
                    </div>
                    {alreadyInCollection && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">Added</div>
                    )}
                    {isSelected && !alreadyInCollection && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Checkbox checked className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddProductsDialog(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddProducts} disabled={selectedProducts.length === 0} className="flex-1">
              Add {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
