'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileTipJar({ title, description, presets, wallet, accentColor }) {
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);

  const handleTip = (amount) => {
    toast.success(`Thank you for your ${amount > 0 ? `$${amount}` : 'custom'} tip!`, {
      description: 'This would connect to Algorand wallet',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5" style={{ color: accentColor }} />
          {title || 'Tip Jar'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {/* Preset Amounts */}
        <div className="grid grid-cols-2 gap-2">
          {presets.map((amount) => (
            <Button
              key={amount}
              variant={selectedPreset === amount ? 'default' : 'outline'}
              onClick={() => {
                setSelectedPreset(amount);
                setCustomAmount('');
                handleTip(amount);
              }}
              style={selectedPreset === amount ? { backgroundColor: accentColor } : {}}
            >
              ${amount}
            </Button>
          ))}
        </div>

        {/* Custom Amount */}
        <div>
          <Input
            type="number"
            placeholder="Custom amount"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedPreset(null);
            }}
          />
          {customAmount && (
            <Button
              className="w-full mt-2"
              onClick={() => handleTip(parseFloat(customAmount))}
              style={{ backgroundColor: accentColor }}
            >
              Send ${customAmount} Tip
            </Button>
          )}
        </div>

        {/* Wallet Info */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1">Wallet Address:</p>
          <p className="text-xs font-mono bg-muted p-2 rounded break-all">
            {wallet}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
