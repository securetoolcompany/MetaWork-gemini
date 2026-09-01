"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/AuthContext";
import { useWallet } from "@/lib/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function normalizeAlgorandAddress(address) {
  return String(address || "").trim().toUpperCase();
}

function shortAddress(address) {
  const normalizedAddress = normalizeAlgorandAddress(address);

  if (!normalizedAddress) {
    return "";
  }

  if (normalizedAddress.length <= 16) {
    return normalizedAddress;
  }

  return `${normalizedAddress.slice(0, 8)}…${normalizedAddress.slice(-8)}`;
}

export default function VerifiedWalletSelector({
  selectedAddress,
  onSelectedAddressChange,
  onConnectionReadyChange,
  disabled = false,
}) {
  const { user, isAuthenticated } = useAuth();

  const {
    accountAddress,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  } = useWallet();

  const verifiedAlgorandWallets = useMemo(() => {
    const uniqueWallets = new Map();

    for (const wallet of user?.wallets || []) {
      const address = normalizeAlgorandAddress(wallet?.address);
      const chain = String(wallet?.chain || "algorand").toLowerCase();

      if (!address || chain !== "algorand" || wallet?.verified !== true) {
        continue;
      }

      if (!uniqueWallets.has(address)) {
        uniqueWallets.set(address, {
          ...wallet,
          address,
          chain: "algorand",
        });
      }
    }

    return Array.from(uniqueWallets.values());
  }, [user?.wallets]);

  const normalizedSelectedAddress = normalizeAlgorandAddress(selectedAddress);
  const normalizedConnectedAddress = normalizeAlgorandAddress(accountAddress);

  const selectedWallet = useMemo(
    () =>
      verifiedAlgorandWallets.find(
        (wallet) => wallet.address === normalizedSelectedAddress
      ) || null,
    [normalizedSelectedAddress, verifiedAlgorandWallets]
  );

  const isSelectedWalletConnected =
    Boolean(selectedWallet) &&
    isConnected &&
    normalizedSelectedAddress === normalizedConnectedAddress;

  const isDifferentWalletConnected =
    Boolean(selectedWallet) &&
    isConnected &&
    Boolean(normalizedConnectedAddress) &&
    normalizedSelectedAddress !== normalizedConnectedAddress;

  useEffect(() => {
    if (!isAuthenticated || verifiedAlgorandWallets.length === 0) {
      if (normalizedSelectedAddress) {
        onSelectedAddressChange?.("");
      }

      return;
    }

    const connectedWalletIsSelectable = verifiedAlgorandWallets.some(
      (wallet) => wallet.address === normalizedConnectedAddress
    );

    if (connectedWalletIsSelectable) {
      if (normalizedSelectedAddress !== normalizedConnectedAddress) {
        onSelectedAddressChange?.(normalizedConnectedAddress);
      }

      return;
    }

    const selectedWalletStillExists = verifiedAlgorandWallets.some(
      (wallet) => wallet.address === normalizedSelectedAddress
    );

    if (!selectedWalletStillExists) {
      onSelectedAddressChange?.(verifiedAlgorandWallets[0].address);
    }
  }, [
    isAuthenticated,
    normalizedConnectedAddress,
    normalizedSelectedAddress,
    onSelectedAddressChange,
    verifiedAlgorandWallets,
  ]);

  useEffect(() => {
    onConnectionReadyChange?.({
      isReady: isSelectedWalletConnected,
      selectedAddress: selectedWallet?.address || null,
      connectedAddress: normalizedConnectedAddress || null,
      hasVerifiedWallets: verifiedAlgorandWallets.length > 0,
    });
  }, [
    isSelectedWalletConnected,
    normalizedConnectedAddress,
    onConnectionReadyChange,
    selectedWallet?.address,
    verifiedAlgorandWallets.length,
  ]);

  const handleConnect = async () => {
    try {
      const connectedAddress = await connect();
      const normalizedAddress = normalizeAlgorandAddress(connectedAddress);

      if (!normalizedAddress) {
        return;
      }

      const connectedWalletIsVerified = verifiedAlgorandWallets.some(
        (wallet) => wallet.address === normalizedAddress
      );

      if (!connectedWalletIsVerified) {
        toast.error(
          "This Pera wallet is not linked to your MetaWork account. Link it in Account Management before using it for tokenization."
        );
        return;
      }

      onSelectedAddressChange?.(normalizedAddress);
      toast.success(`Pera connected: ${shortAddress(normalizedAddress)}`);
    } catch (error) {
      toast.error(error?.message || "Unable to connect Pera Wallet.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success("Pera Wallet disconnected.");
    } catch (error) {
      toast.error(error?.message || "Unable to disconnect Pera Wallet.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p>Sign in to select a wallet for this on-chain action.</p>
      </div>
    );
  }

  if (verifiedAlgorandWallets.length === 0) {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">No verified Algorand wallets</p>
          <p className="mt-1 text-muted-foreground">
            Link a wallet in Account Management before tokenizing. Product
            drafting and editing remain available without a wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label
          htmlFor="verified-wallet-selector"
          className="text-sm font-medium"
        >
          Owner and signing wallet
        </label>

        <Select
          value={normalizedSelectedAddress}
          onValueChange={onSelectedAddressChange}
          disabled={disabled || isConnecting}
        >
          <SelectTrigger id="verified-wallet-selector">
            <SelectValue placeholder="Choose a verified wallet" />
          </SelectTrigger>

          <SelectContent>
            {verifiedAlgorandWallets.map((wallet) => (
              <SelectItem key={wallet.address} value={wallet.address}>
                {shortAddress(wallet.address)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {normalizedSelectedAddress ? (
          <p className="font-mono text-xs text-muted-foreground">
            {normalizedSelectedAddress}
          </p>
        ) : null}
      </div>

      {isSelectedWalletConnected ? (
        <div className="flex gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">Selected wallet connected in Pera</p>
            <p className="mt-1 text-muted-foreground">
              {shortAddress(normalizedSelectedAddress)} will sign the
              tokenization transaction.
            </p>
          </div>
        </div>
      ) : isDifferentWalletConnected ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">A different Pera wallet is connected</p>
            <p className="mt-1 text-muted-foreground">
              Connected: {shortAddress(normalizedConnectedAddress)}
              <br />
              Selected: {shortAddress(normalizedSelectedAddress)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Connect the selected wallet</p>
            <p className="mt-1 text-muted-foreground">
              If Pera is not already connected to this wallet, connect it
              before preparing tokenization.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isConnected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disabled || isConnecting}
          >
            Disconnect Pera
          </Button>
        ) : null}

        {!isSelectedWalletConnected ? (
          <Button
            type="button"
            size="sm"
            onClick={handleConnect}
            disabled={
              disabled ||
              isConnecting ||
              !normalizedSelectedAddress
            }
          >
            {isConnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="mr-2 h-4 w-4" />
            )}
            Connect Pera
          </Button>
        ) : null}
      </div>
    </div>
  );
}