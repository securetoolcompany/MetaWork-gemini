'use client';

import { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function AisleTipJar({ creator, settings, placement }) {
  const [showModal, setShowModal] = useState(false);
  const tipSettings = settings || creator?.aisleSettings || {};
  const presets = tipSettings.tipPresets || [5, 10, 20, 50];
  const accentColor = tipSettings.accentColor || '#3b82f6';
  const [selectedAmount, setSelectedAmount] = useState(presets[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');

  const handleSendTip = () => {
    const amount = customAmount || selectedAmount;
    toast.success(`Tip of $${amount} sent to ${creator.name}! 🎉`);
    setShowModal(false);
    setMessage('');
    setCustomAmount('');
  };

  // Floating Button
  if (placement === 'floating') {
    return (
      <>
        <Button
          className="fixed bottom-6 right-6 rounded-full shadow-lg text-white px-6 py-6 z-40"
          style={{ backgroundColor: accentColor }}
          onClick={() => setShowModal(true)}
        >
          <Heart className="w-5 h-5 mr-2 fill-current" />
          {tipSettings.tipButtonText || 'Send Tip'}
        </Button>

        <TipModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  creator={creator}
  settings={tipSettings}  // <-- Use tipSettings instead
  accentColor={accentColor}  // <-- ADD THIS LINE
  selectedAmount={selectedAmount}
  setSelectedAmount={setSelectedAmount}
  customAmount={customAmount}
  setCustomAmount={setCustomAmount}
  message={message}
  setMessage={setMessage}
  onSendTip={handleSendTip}
/>

      </>
    );
  }

  // Header Button
  return (
    <>
      <div className="flex justify-center">
        <Button
          className="text-white px-8 py-3 text-lg"
          style={{ backgroundColor: accentColor }}
          onClick={() => setShowModal(true)}
        >
          <Heart className="w-5 h-5 mr-2 fill-current" />
          {tipSettings.tipButtonText || 'Send Tip'}
        </Button>
      </div>

      <TipModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  creator={creator}
  settings={tipSettings}     // CHANGE: use tipSettings instead of settings
  accentColor={accentColor}  // ADD: pass accentColor
  selectedAmount={selectedAmount}
  setSelectedAmount={setSelectedAmount}
  customAmount={customAmount}
  setCustomAmount={setCustomAmount}
  message={message}
  setMessage={setMessage}
  onSendTip={handleSendTip}
/>

    </>
  );
}

function TipModal({
  isOpen,
  onClose,
  creator,
  settings,
  accentColor,
  selectedAmount,
  setSelectedAmount,
  customAmount,
  setCustomAmount,
  message,
  setMessage,
  onSendTip
}) {
  const tipPresets = settings?.tipPresets || [5, 10, 20, 50];
  const tipJarWallet = settings?.tipJarWallet || 'Not configured';
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" style={{ color: accentColor }} />
            Support {creator.name}
          </DialogTitle>
          <DialogDescription>
            Show your appreciation with a tip. All contributions go directly to the creator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Amounts */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Amount</label>
            <div className="grid grid-cols-3 gap-3">
                {tipPresets.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount && !customAmount ? 'default' : 'outline'}
                  className="text-lg"
                  style={selectedAmount === amount && !customAmount ? {
                    backgroundColor: accentColor,
                    color: 'white'
                  } : {}}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Custom Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-2">Add a Message (Optional)</label>
            <Textarea
              placeholder="Say something nice..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Connected Wallet */}
          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="text-muted-foreground mb-1">Tip will be sent to:</p>
            <p className="font-mono font-medium">{tipJarWallet}</p>
          </div>

          {/* Send Button */}
          <Button
            className="w-full text-white text-lg py-6"
            style={{ backgroundColor: accentColor }}
            onClick={onSendTip}
            disabled={!customAmount && !selectedAmount}
          >
            <Heart className="w-5 h-5 mr-2 fill-current" />
            Send ${customAmount || selectedAmount} Tip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}