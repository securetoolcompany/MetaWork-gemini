'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ShippingAddressForm({ onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    address1: '',
    city: '',
    state_code: '',
    zip: '',
    country_code: 'US'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
      <h3 className="text-lg font-bold text-emerald-400">Shipping Details</h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="bg-[#0f172a]" />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" required value={formData.address1} onChange={(e) => setFormData({...formData, address1: e.target.value})} className="bg-[#0f172a]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" required value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="bg-[#0f172a]" />
          </div>
          <div>
            <Label htmlFor="state">State (Code)</Label>
            <Input id="state" placeholder="AZ" required value={formData.state_code} onChange={(e) => setFormData({...formData, state_code: e.target.value.toUpperCase()})} className="bg-[#0f172a]" />
          </div>
        </div>
        <div>
          <Label htmlFor="zip">Zip Code</Label>
          <Input id="zip" required value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} className="bg-[#0f172a]" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="flex-1 bg-emerald-500 text-black font-bold">
          {isLoading ? 'Processing...' : 'Confirm Order'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-white/10">Cancel</Button>
      </div>
    </form>
  );
}