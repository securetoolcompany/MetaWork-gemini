"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useWallet } from "@/lib/WalletContext";
import algosdk from "algosdk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import VerifiedWalletSelector from "@/components/wallet/VerifiedWalletSelector";

function formatMoney(value) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? `$${amount.toFixed(2)}`
    : "—";
}

function getProductName(product) {
  return (
    product?.name ||
    product?.title ||
    product?.externalProductId ||
    "Untitled product"
  );
}

function getAttachedIpCount(product) {
  if (Array.isArray(product?.licensedIPs)) {
    return product.licensedIPs.length;
  }

  if (Array.isArray(product?.selectedIPs)) {
    return product.selectedIPs.length;
  }

  return 0;
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

export default function ProductTokenizationDialog({
  product,
  open,
  onOpenChange,
}) {
  const { isAuthenticated, getAuthHeader } = useAuth();
	const { signTransactionGroup } = useWallet();
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("");
  const [walletConnection, setWalletConnection] = useState({
    isReady: false,
    selectedAddress: null,
    connectedAddress: null,
    hasVerifiedWallets: false,
  });
  const [stakeholderDraft, setStakeholderDraft] = useState([
    {
      name: 'Product creator',
      address: '',
      percentage: '100',
    },
  ]);
  const [stakeholderError, setStakeholderError] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedRevenuePool, setPreparedRevenuePool] = useState(
    product?.productRevenuePool || null
  );
  
	const [fundingPreparation, setFundingPreparation] = useState(null);
  const [isPreparingFunding, setIsPreparingFunding] = useState(false);
	const [isSigningFunding, setIsSigningFunding] = useState(false);
	const [isSubmittingFunding, setIsSubmittingFunding] = useState(false);
	const [isCreatingRevenuePool, setIsCreatingRevenuePool] =
  	useState(false);
	const fundingSubmissionInFlightRef = useRef(false);
  const [isLoadingActiveFunding, setIsLoadingActiveFunding] =
    useState(false);
	const activeFundingRequestKeyRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPreparedRevenuePool(product?.productRevenuePool || null);
    setFundingPreparation(null);
		setIsPreparing(false);
		setIsPreparingFunding(false);
		setIsSigningFunding(false);
		setIsSubmittingFunding(false);
		setIsCreatingRevenuePool(false);
		fundingSubmissionInFlightRef.current = false;
		activeFundingRequestKeyRef.current = null;
			}, [
    open,
    product?.id,
    product?._id,
    product?.externalProductId,
    product?.productRevenuePool,
  ]);

  useEffect(() => {
    if (!selectedWalletAddress) {
      return;
    }

    setStakeholderDraft((previous) => {
      if (previous.length === 0) {
        return [
          {
            name: 'Product creator',
            address: selectedWalletAddress,
            percentage: '100.00',
          },
        ];
      }

      const next = [...previous];

      next[0] = {
        ...next[0],
        name: 'Product creator',
        address: selectedWalletAddress,
      };

      return next;
    });
  }, [selectedWalletAddress]);

	useEffect(() => {
    const tokenizationStatus =
      preparedRevenuePool?.tokenizationStatus;

    if (
      !open ||
      isPreparingFunding ||
      fundingPreparation ||
      tokenizationStatus !== 'awaiting_funding_signature' ||
      !walletConnection.isReady ||
      !selectedWalletAddress
    ) {
      return;
    }

    const productId =
      product?.id ||
      product?._id?.toString?.() ||
      product?.externalProductId;

    if (!productId) {
      return;
    }

    const activeFundingRequestKey = [
      String(productId),
      selectedWalletAddress,
      tokenizationStatus,
    ].join(':');

    if (
      activeFundingRequestKeyRef.current === activeFundingRequestKey
    ) {
      return;
    }

    activeFundingRequestKeyRef.current = activeFundingRequestKey;

    let cancelled = false;

    async function loadActiveFundingAttempt() {
      setIsLoadingActiveFunding(true);

      try {
        const searchParams = new URLSearchParams({
          walletAddress: selectedWalletAddress,
          cacheBust: String(Date.now()),
        });

        const response = await fetch(
          `/api/products/${encodeURIComponent(
            String(productId)
          )}/revenue-tokenization/funding/active?${searchParams.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              ...getAuthHeader(),
            },
          }
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (response.ok && data?.success === true) {
          setPreparedRevenuePool((currentPool) => ({
            ...currentPool,
            tokenizationStatus: 'awaiting_funding_signature',
            fundingAttempt: {
              ...(currentPool?.fundingAttempt || {}),
              ...(data.fundingAttempt || {}),
              status: 'awaiting_signature',
            },
          }));

          setFundingPreparation(data);
          return;
        }

        if (data?.code === 'FUNDING_ATTEMPT_EXPIRED') {
          setFundingPreparation(null);

          setPreparedRevenuePool((currentPool) => ({
            ...currentPool,
            tokenizationStatus: 'pending_funding',
            fundingAttempt: {
              ...(currentPool?.fundingAttempt || {}),
              status: 'expired',
            },
          }));

          return;
        }

        activeFundingRequestKeyRef.current = null;

        throw new Error(
          data?.error || 'Unable to retrieve the active funding request.'
        );
      } catch (error) {
        if (!cancelled) {
          activeFundingRequestKeyRef.current = null;

          toast.error(
            error?.message ||
              'Unable to retrieve the active funding request.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActiveFunding(false);
        }
      }
    }

    loadActiveFundingAttempt();

    return () => {
      cancelled = true;
    };
  }, [
    fundingPreparation,
    getAuthHeader,
    isPreparingFunding,
    open,
    preparedRevenuePool?.tokenizationStatus,
    product?.externalProductId,
    product?.id,
    product?._id,
    selectedWalletAddress,
    walletConnection.isReady,
  ]);

  const productName = getProductName(product);

  const productSummary = useMemo(
    () => ({
      productName,
      attachedIpCount: getAttachedIpCount(product),
      variantCount: Array.isArray(product?.variants)
        ? product.variants.length
        : 0,
      lowestRetailPrice: Array.isArray(product?.variants)
        ? product.variants.reduce((lowestPrice, variant) => {
            const price = Number(variant?.retail_price);

            if (!Number.isFinite(price) || price < 0) {
              return lowestPrice;
            }

            return lowestPrice === null
              ? price
              : Math.min(lowestPrice, price);
          }, null)
        : null,
    }),
    [product, productName]
  );

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setIsPreparing(false);
    }

    onOpenChange(nextOpen);
  };

  const percentageToBps = (percentage) => {
    const value = String(percentage ?? '').trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ''] = value.split('.');

    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  };

  const updateStakeholderDraft = (index, patch) => {
    setStakeholderDraft((previous) => {
      const next = previous.map((stakeholder, rowIndex) =>
        rowIndex === index
          ? { ...stakeholder, ...patch }
          : stakeholder,
      );

      const collaboratorBps = next.slice(1).reduce(
        (sum, stakeholder) => {
          const bps = percentageToBps(stakeholder.percentage);
          return bps === null ? sum : sum + bps;
        },
        0,
      );

      next[0] = {
        ...next[0],
        name: 'Product creator',
        address: selectedWalletAddress || '',
        percentage: ((10000 - collaboratorBps) / 100).toFixed(2),
      };

      return next;
    });

    setStakeholderError('');
  };

  const addStakeholderDraft = () => {
    setStakeholderDraft((previous) => [
      ...previous,
      {
        name: '',
        address: '',
        percentage: '',
      },
    ]);

    setStakeholderError('');
  };

  const removeStakeholderDraft = (index) => {
    if (index === 0) {
      return;
    }

    setStakeholderDraft((previous) => {
      const next = previous.filter((_, rowIndex) => rowIndex !== index);

      const collaboratorBps = next.slice(1).reduce(
        (sum, stakeholder) => {
          const bps = percentageToBps(stakeholder.percentage);
          return bps === null ? sum : sum + bps;
        },
        0,
      );

      next[0] = {
        ...next[0],
        name: 'Product creator',
        address: selectedWalletAddress || '',
        percentage: ((10000 - collaboratorBps) / 100).toFixed(2),
      };

      return next;
    });

    setStakeholderError('');
  };

  const stakeholderDraftTotalBps = stakeholderDraft.reduce(
    (sum, stakeholder) => {
      const bps = percentageToBps(stakeholder.percentage);
      return bps === null ? sum : sum + bps;
    },
    0,
  );

  const validateStakeholderDraft = () => {
    const normalizedStakeholders = stakeholderDraft.map(
      (stakeholder, index) => ({
        name: (
          stakeholder.name ||
          (index === 0 ? 'Product creator' : '')
        ).trim(),
        address: (
          index === 0
            ? selectedWalletAddress
            : stakeholder.address || ''
        ).trim(),
        percentage: String(stakeholder.percentage ?? '').trim(),
      }),
    );

    const missingStakeholder = normalizedStakeholders.find(
      (stakeholder) =>
        !stakeholder.address ||
        !stakeholder.percentage,
    );

    if (missingStakeholder) {
      return {
        error:
          'Every stakeholder must include a wallet address and allocation percentage.',
      };
    }

    const invalidPercentage = normalizedStakeholders.find(
      (stakeholder) =>
        percentageToBps(stakeholder.percentage) === null ||
        percentageToBps(stakeholder.percentage) <= 0,
    );

    if (invalidPercentage) {
      return {
        error:
          'Stakeholder allocations must be greater than 0% and use at most two decimal places.',
      };
    }

    const invalidAddress = normalizedStakeholders.find(
      (stakeholder) => !algosdk.isValidAddress(stakeholder.address),
    );

    if (invalidAddress) {
      return {
        error:
          'Each stakeholder must use a valid Algorand wallet address.',
      };
    }

    const addresses = normalizedStakeholders.map((stakeholder) =>
      stakeholder.address.toUpperCase(),
    );

    if (new Set(addresses).size !== addresses.length) {
      return {
        error: 'Duplicate stakeholder addresses are not allowed.',
      };
    }

    const totalBps = normalizedStakeholders.reduce(
      (sum, stakeholder) =>
        sum + percentageToBps(stakeholder.percentage),
      0,
    );

    if (totalBps !== 10000) {
      return {
        error: 'Stakeholder allocations must total exactly 100.00%.',
      };
    }

    return {
      stakeholders: normalizedStakeholders,
    };
  };

	const handlePrepareFunding = async () => {
    const productId =
      product?.id ||
      product?._id?.toString?.() ||
      product?.externalProductId;

    if (!productId) {
      toast.error("This product is missing a durable product identifier.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please sign in before preparing product funding.");
      return;
    }

    if (!walletConnection.isReady || !selectedWalletAddress) {
      toast.error(
        "Connect the selected verified Algorand wallet before preparing funding."
      );
      return;
    }

    setIsPreparingFunding(true);

    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(
          String(productId)
        )}/revenue-tokenization/funding/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            walletAddress: selectedWalletAddress,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.error || "Unable to prepare product revenue-pool funding."
        );
      }

      setFundingPreparation(data);

      toast.success(
        "Funding payment prepared. Review the amount before signing in Pera."
      );
    } catch (error) {
      toast.error(
        error?.message || "Unable to prepare product revenue-pool funding."
      );
    } finally {
      setIsPreparingFunding(false);
    }
  };

	const handleSignAndSubmitFunding = async () => {
  if (fundingSubmissionInFlightRef.current) {
    return;
  }

  const productId =
    product?.id ||
    product?._id?.toString?.() ||
    product?.externalProductId;

  const transaction = fundingPreparation?.transactions?.[0];
  const expectedTransactionId =
    fundingPreparation?.funding?.expectedTransactionId;
  const fundingAttemptId = fundingPreparation?.fundingAttempt?.id;
  const expectedOwnerAddress =
    fundingPreparation?.funding?.ownerAddress;

  if (!productId) {
    toast.error("This product is missing a durable product identifier.");
    return;
  }

  if (!isAuthenticated) {
    toast.error("Please sign in before submitting product funding.");
    return;
  }

  if (
    !walletConnection.isReady ||
    !walletConnection.hasVerifiedWallets ||
    !selectedWalletAddress ||
    !walletConnection.connectedAddress
  ) {
    toast.error(
      "Connect the selected verified Algorand wallet before submitting funding."
    );
    return;
  }

  if (
    selectedWalletAddress !== walletConnection.connectedAddress ||
    selectedWalletAddress !== expectedOwnerAddress
  ) {
    toast.error(
      "The connected wallet must match the wallet used to prepare this funding payment."
    );
    return;
  }

  if (
    !transaction?.txnBase64 ||
    !expectedTransactionId ||
    !fundingAttemptId
  ) {
    toast.error(
      "The prepared funding request is incomplete. Refresh and try again."
    );
    return;
  }

  fundingSubmissionInFlightRef.current = true;

  try {
    const unsignedTransactionBytes = Uint8Array.from(
      window.atob(transaction.txnBase64),
      (character) => character.charCodeAt(0)
    );

    const unsignedTransaction = algosdk.decodeUnsignedTransaction(
      unsignedTransactionBytes
    );

    if (unsignedTransaction.txID() !== expectedTransactionId) {
      throw new Error(
        "The prepared funding transaction does not match the expected payment."
      );
    }

    setIsSigningFunding(true);

    const signedTransactionGroup = await signTransactionGroup([
			unsignedTransactionBytes,
		]);

    const signedTransactionBytes = signedTransactionGroup?.[0];

    if (
      !signedTransactionBytes ||
      !(signedTransactionBytes instanceof Uint8Array) ||
      signedTransactionBytes.length === 0
    ) {
      throw new Error("Pera did not return a signed funding transaction.");
    }

    setIsSigningFunding(false);
    setIsSubmittingFunding(true);

    const response = await fetch(
      `/api/products/${encodeURIComponent(
        String(productId)
      )}/revenue-tokenization/funding/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          fundingAttemptId,
          expectedTransactionId,
          signedTransactionBase64: bytesToBase64(
            signedTransactionBytes
          ),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data?.success !== true) {
      throw new Error(
        data?.error || "Unable to submit the signed funding payment."
      );
    }

    setFundingPreparation(null);

    setPreparedRevenuePool((currentPool) => ({
      ...currentPool,
      tokenizationStatus:
        data?.product?.tokenizationStatus ||
        currentPool?.tokenizationStatus,
      fundingAttempt: {
        ...(currentPool?.fundingAttempt || {}),
        ...(data?.fundingAttempt || {}),
      },
    }));

    if (data?.fundingAttempt?.status === "confirmed") {
      toast.success("Funding payment confirmed on Algorand.");
    } else {
      toast.message(
        "Funding payment submitted. Waiting for Algorand confirmation."
      );
    }
  } catch (error) {
    const message =
      error?.message ||
      "Unable to sign and submit the funding payment.";

    if (/cancel|reject|deny|decline|abort/i.test(message)) {
      toast.message(
        "Funding signature cancelled. Your prepared payment is still available."
      );
    } else {
      toast.error(message);
    }
  } finally {
    setIsSigningFunding(false);
    setIsSubmittingFunding(false);
    fundingSubmissionInFlightRef.current = false;
  }
	};

	const handleCreateRevenuePool = async () => {
		const productId =
			product?.id ||
			product?._id?.toString?.() ||
			product?.externalProductId;

		if (!productId) {
			toast.error("This product is missing a durable product identifier.");
			return;
		}

		if (!isAuthenticated) {
			toast.error("Please sign in before creating the revenue pool.");
			return;
		}

		if (isCreatingRevenuePool) {
			return;
		}

		setIsCreatingRevenuePool(true);

		try {
			const response = await fetch(
				`/api/products/${encodeURIComponent(
					String(productId)
				)}/revenue-tokenization/create`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...getAuthHeader(),
					},
				}
			);

			const data = await response.json();

			if (!response.ok || data?.success !== true) {
				throw new Error(
					data?.error || "Unable to create the product revenue pool."
				);
			}

			setPreparedRevenuePool((currentPool) => ({
				...currentPool,
				...(data?.productRevenuePool || {}),
				tokenizationStatus:
					data?.product?.tokenizationStatus ||
					data?.productRevenuePool?.tokenizationStatus ||
					currentPool?.tokenizationStatus,
			}));

			if (data?.confirmed) {
				toast.success(
					"Revenue pool created and revenue token ASA is active."
				);
			} else if (data?.pending) {
				toast.message(
					"Revenue pool creation was submitted and is awaiting confirmation."
				);
			} else if (data?.recovered) {
				toast.message("Recovered the existing revenue pool creation.");
			} else {
				toast.message("Revenue pool creation is in progress.");
			}
		} catch (error) {
			toast.error(
				error?.message || "Unable to create the product revenue pool."
			);
		} finally {
			setIsCreatingRevenuePool(false);
		}
	};

  const handlePrepareTokenization = async () => {
    const productId =
      product?.id ||
      product?._id?.toString?.() ||
      product?.externalProductId;

    if (!productId) {
      toast.error("This product is missing a durable product identifier.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please sign in before preparing product tokenization.");
      return;
    }

    if (!walletConnection.isReady || !selectedWalletAddress) {
      toast.error(
        "Connect the selected verified Algorand wallet before preparing tokenization."
      );
      return;
    }

    const stakeholderValidation = validateStakeholderDraft();

    if (stakeholderValidation.error) {
      setStakeholderError(stakeholderValidation.error);
      toast.error(stakeholderValidation.error);
      return;
    }

    setIsPreparing(true);

    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(
          String(productId)
        )}/revenue-tokenization/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            walletAddress: selectedWalletAddress,
            stakeholders: stakeholderValidation.stakeholders,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.error || "Unable to prepare product tokenization."
        );
      }

      setPreparedRevenuePool(data.productRevenuePool);

      toast.success(
        "Product tokenization prepared. Funding can now be prepared."
      );
    } catch (error) {
      toast.error(
        error?.message || "Unable to prepare product tokenization."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tokenize Product</DialogTitle>
          <DialogDescription>
            Select the verified Algorand wallet that will own and sign this
            product’s on-chain tokenization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="mt-1 font-medium">{productSummary.productName}</p>

            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">IP assets</p>
                <p className="font-medium">{productSummary.attachedIpCount}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Variants</p>
                <p className="font-medium">{productSummary.variantCount}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Lowest retail price
                </p>
                <p className="font-medium">
                  {formatMoney(productSummary.lowestRetailPrice)}
                </p>
              </div>
            </div>
          </div>

          <VerifiedWalletSelector
						selectedAddress={selectedWalletAddress}
						onSelectedAddressChange={setSelectedWalletAddress}
						onConnectionReadyChange={setWalletConnection}
						disabled={
							isPreparing ||
							isPreparingFunding ||
							isSigningFunding ||
							isSubmittingFunding
						}
					/>

          {!preparedRevenuePool ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Stakeholders</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add everyone who should receive product revenue tokens. The creator
                  wallet is the selected verified wallet. Allocations must total 100.00%.
                </p>
              </div>

              <div className="space-y-3">
                {stakeholderDraft.map((stakeholder, index) => (
                  <div
                    key={`${index}-${stakeholder.address}`}
                    className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <input
                        value={stakeholder.name}
                        placeholder={index === 0 ? 'Product creator' : 'Stakeholder'}
                        disabled={index === 0 || isPreparing}
                        onChange={(event) =>
                          updateStakeholderDraft(index, {
                            name: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="text-xs text-muted-foreground">
                        Wallet Address
                      </label>
                      <input
                        value={
                          index === 0
                            ? selectedWalletAddress || ''
                            : stakeholder.address
                        }
                        placeholder="Algorand wallet address"
                        disabled={index === 0 || isPreparing}
                        onChange={(event) =>
                          updateStakeholderDraft(index, {
                            address: event.target.value.trim(),
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs text-muted-foreground">
                        Allocation %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={stakeholder.percentage}
                        disabled={index === 0 || isPreparing}
                        onChange={(event) =>
                          updateStakeholderDraft(index, {
                            percentage: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="flex items-end sm:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        disabled={index === 0 || isPreparing}
                        onClick={() => removeStakeholderDraft(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPreparing}
                  onClick={addStakeholderDraft}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stakeholder
                </Button>

                <span
                  className={
                    stakeholderDraftTotalBps === 10000
                      ? 'text-sm text-emerald-600'
                      : 'text-sm text-destructive'
                  }
                >
                  {(stakeholderDraftTotalBps / 100).toFixed(2)}% allocated
                </span>
              </div>

              {stakeholderError ? (
                <p className="text-sm text-destructive">{stakeholderError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Drafting, editing, and Printful design work do not require a
              wallet. A wallet is required only to create and sign the
              on-chain tokenization transaction.
            </p>
          </div>

          {walletConnection.isReady ? (
            <div className="flex gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                The selected wallet is connected in Pera and is ready for
                server-side transaction preparation.
              </p>
            </div>
          ) : null}
					{preparedRevenuePool?.tokenizationStatus === "pending_funding" ? (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
              <p className="font-medium">
                Product tokenization prepared
              </p>
              <p className="mt-1 text-muted-foreground">
                Required pool funding:{" "}
                {Number(
                  preparedRevenuePool?.mbr?.totalMicroAlgos || 0
                ).toLocaleString()}{" "}
                microAlgos (
                {(
                  Number(
                    preparedRevenuePool?.mbr?.totalMicroAlgos || 0
                  ) / 1_000_000
                ).toFixed(6)}{" "}
                ALGO).
              </p>
            </div>
          ) : null}

					{preparedRevenuePool?.tokenizationStatus ===
            "awaiting_funding_signature" &&
          !fundingPreparation ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">Funding signature is pending</p>
              <p className="mt-1 text-muted-foreground">
                A funding payment was already prepared for this product. For
                safety, another payment cannot be prepared while that signing
                attempt is active.
              </p>
            </div>
          ) : null}

          {fundingPreparation?.funding ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">Funding payment prepared</p>

              <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                <p>
                  Amount: {fundingPreparation.funding.amountAlgos} ALGO
                </p>
                <p>
                  From: {fundingPreparation.funding.ownerAddress}
                </p>
                <p>
                  To: {fundingPreparation.funding.receiverAddress}
                </p>
                <p>
                  Expires:{" "}
                  {new Date(
                    fundingPreparation.fundingAttempt.expiresAt
                  ).toLocaleTimeString()}
                </p>
              </div>

              <p className="mt-2 text-muted-foreground">
                No funds have moved yet. The next step will ask Pera to sign
                this exact payment.
              </p>
            </div>
          ) : null}
					{preparedRevenuePool?.tokenizationStatus === "creating" ? (
						<div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
							<p className="font-medium">Funding confirmed</p>
							<p className="mt-1 text-muted-foreground">
								Your funding payment is confirmed. Create the product revenue pool
								and its revenue-token ASA to complete tokenization.
							</p>
						</div>
					) : null}

					{preparedRevenuePool?.tokenizationStatus === "active" ? (
						<div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
							<p className="font-medium">Product revenue pool active</p>
							<p className="mt-1 text-muted-foreground">
								Revenue token ASA:{" "}
								{preparedRevenuePool?.revenueTokenAssetId || "—"}
							</p>
						</div>
					) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={
							isPreparing ||
							isPreparingFunding ||
							isSigningFunding ||
							isSubmittingFunding
						}
          >
            Cancel
          </Button>

          {!preparedRevenuePool ? (
            <Button
              type="button"
              onClick={handlePrepareTokenization}
              disabled={
                isPreparing ||
                !walletConnection.isReady ||
                !selectedWalletAddress ||
                stakeholderDraftTotalBps !== 10000
              }
            >
              {isPreparing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Prepare Tokenization
            </Button>
          ) : fundingPreparation?.fundingAttempt?.status === "awaiting_signature" ? (
						<Button
							type="button"
							onClick={handleSignAndSubmitFunding}
							disabled={
								isSigningFunding ||
								isSubmittingFunding ||
								isLoadingActiveFunding ||
								!walletConnection.isReady ||
								!walletConnection.hasVerifiedWallets ||
								!selectedWalletAddress ||
								selectedWalletAddress !== walletConnection.connectedAddress
							}
						>
							{isSigningFunding ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Waiting for Pera
								</>
							) : isSubmittingFunding ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Submitting Funding
								</>
							) : (
								"Sign and Submit Funding"
							)}
						</Button>
						) : preparedRevenuePool?.tokenizationStatus === "creating" ? (
							<Button
								type="button"
								onClick={handleCreateRevenuePool}
								disabled={isCreatingRevenuePool}
							>
								{isCreatingRevenuePool ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating Revenue Pool
									</>
								) : (
									"Create Revenue Pool"
								)}
							</Button>
					) : preparedRevenuePool.tokenizationStatus ===
            "pending_funding" ? (
            <Button
              type="button"
              onClick={handlePrepareFunding}
              disabled={
                isPreparingFunding ||
                isLoadingActiveFunding ||
                !walletConnection.isReady ||
                !selectedWalletAddress
              }
            >
              {isPreparingFunding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Prepare Funding
            </Button>
          ) : preparedRevenuePool?.tokenizationStatus === "active" ? (
						<Button type="button" disabled>
							Revenue Pool Active
						</Button>
					) : (
						<Button type="button" disabled>
							{isLoadingActiveFunding
								? "Checking Funding Request"
								: fundingPreparation?.fundingAttempt?.status === "submitting"
									? "Submitting Funding"
									: fundingPreparation?.fundingAttempt?.status === "submitted" ||
											fundingPreparation?.fundingAttempt?.status === "confirming"
										? "Funding Pending Confirmation"
										: fundingPreparation?.fundingAttempt?.status === "confirmed"
											? "Funding Confirmed"
											: "Funding Signature Pending"}
						</Button>
					)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}