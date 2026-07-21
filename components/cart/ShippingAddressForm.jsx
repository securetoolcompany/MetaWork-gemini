'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  COUNTRIES,
  getRegionsForCountry,
  countryRequiresRegion,
} from '@/lib/addressCodes';

export default function ShippingAddressForm({ onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address1: '',
    city: '',
    state_code: '',
    zip: '',
    country_code: 'US',
  });

  const regions = useMemo(
    () => getRegionsForCountry(formData.country_code),
    [formData.country_code]
  );

  const requiresRegion = countryRequiresRegion(formData.country_code);

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCountryChange = (e) => {
    const nextCountry = e.target.value;
    setFormData((prev) => ({
      ...prev,
      country_code: nextCountry,
      state_code: '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.country_code) return;
    if (requiresRegion && !formData.state_code) return;
    if (!requiresRegion && !formData.state_code.trim()) return;

    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10"
    >
      <h3 className="text-lg font-bold text-emerald-400">Shipping Details</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="bg-[#0f172a]"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="bg-[#0f172a]"
            placeholder="+1 555 555 5555"
          />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            required
            value={formData.address1}
            onChange={(e) => updateField('address1', e.target.value)}
            className="bg-[#0f172a]"
          />
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            required
            value={formData.country_code}
            onChange={handleCountryChange}
            className="flex h-10 w-full rounded-md border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white"
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              className="bg-[#0f172a]"
            />
          </div>

          <div>
            <Label htmlFor="state">
              {regions.length > 0 ? 'State / Province' : 'State / Region'}
            </Label>

            {regions.length > 0 ? (
              <select
                id="state"
                required={requiresRegion}
                value={formData.state_code}
                onChange={(e) => updateField('state_code', e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white"
              >
                <option value="">Select state / province</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="state"
                required
                value={formData.state_code}
                onChange={(e) => updateField('state_code', e.target.value.trim().toUpperCase())}
                className="bg-[#0f172a]"
                placeholder="Region code"
              />
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="zip">Postal / Zip Code</Label>
          <Input
            id="zip"
            required
            value={formData.zip}
            onChange={(e) => updateField('zip', e.target.value)}
            className="bg-[#0f172a]"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-emerald-500 text-black font-bold"
        >
          {isLoading ? 'Processing...' : 'Confirm Order'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-white/10"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}