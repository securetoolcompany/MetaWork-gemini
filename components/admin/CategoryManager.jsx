'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoryManager({ type, title }) {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/admin/categories?type=${type}&includeInactive=true`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, [type]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name: newName.trim() })
    });
    if (res.ok) {
      toast.success(`Added to ${title}`);
      setNewName('');
      fetchCategories();
    }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Removed');
      fetchCategories();
    }
  };

  return (
    <div className="p-6 bg-slate-900/50 border border-white/5 rounded-xl flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-4 h-4 text-sky-400" />
        <h3 className="text-lg font-bold text-white">{title} Categories</h3>
      </div>
      
      <div className="flex gap-2 mb-6">
        <Input 
          placeholder="Category name..." 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="bg-slate-950 border-white/10 text-white"
        />
        <Button onClick={handleAdd} size="sm" className="bg-sky-600 hover:bg-sky-500">
          <Plus className="w-4 h-4"/>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : categories.length === 0 ? (
          <p className="text-center text-slate-600 text-sm pt-10">No categories defined.</p>
        ) : categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between px-4 py-2 bg-slate-950/50 border border-white/5 rounded-lg group transition-colors hover:border-white/10">
            <span className="text-sm text-slate-300">{cat.name}</span>
            <button 
              onClick={() => handleDelete(cat.id)} 
              className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}