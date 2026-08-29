'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MANUAL_STATUS_OPTIONS = [
  'pending',
  'awaiting_approval',
  'on_hold',
  'shipped',
  'refunded',
];

function getAuthHeader() {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString();
}

function formatAddress(address) {
  if (!address || typeof address !== 'object') {
    return [];
  }

  const cityRegionPostal = [
    address.city,
    address.state ||
      address.stateCode ||
      address.province ||
      address.region,
    address.zip ||
      address.postalCode ||
      address.postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    address.name,
    address.company,
    address.address1 ||
      address.line1 ||
      address.street ||
      address.street1,
    address.address2 ||
      address.line2 ||
      address.street2,
    cityRegionPostal,
    address.country ||
      address.countryCode ||
      address.country_code,
  ].filter(Boolean);
}

function statusVariant(status) {
  if (status === 'delivered') return 'success';
  if (status === 'refunded' || status === 'on_hold') return 'destructive';
  if (status === 'shipped') return 'default';

  return 'secondary';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reason, setReason] = useState('');
  const [nextStatus, setNextStatus] = useState('shipped');
  const [isSaving, setIsSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/orders', {
        headers: getAuthHeader(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to load orders.');
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load orders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        String(order.orderNumber || '')
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(order.printfulOrderId || '')
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(order.customerName || '')
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        statusFilter === 'all' ||
        order.fulfillmentStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  function openManualStatusDialog(order) {
    setSelectedOrder(order);
    setNextStatus(
      MANUAL_STATUS_OPTIONS.includes(order.fulfillmentStatus)
        ? order.fulfillmentStatus
        : 'shipped',
    );
    setReason('');
  }

  function openDeliveredDialog(order) {
    setSelectedOrder(order);
    setNextStatus('delivered');
    setReason('');
  }

  function closeDialog() {
    if (isSaving) {
      return;
    }

    setSelectedOrder(null);
    setReason('');
  }

  async function submitFulfillmentUpdate() {
    if (!selectedOrder) {
      return;
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setError('A fulfillment update reason is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const isDelivered = nextStatus === 'delivered';

      const response = await fetch(
        isDelivered
          ? `/api/admin/orders/${selectedOrder.id}/mark-delivered`
          : `/api/admin/orders/${selectedOrder.id}/fulfillment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify(
            isDelivered
              ? { reason: trimmedReason }
              : {
                  fulfillmentStatus: nextStatus,
                  reason: trimmedReason,
                },
          ),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Unable to update fulfillment status.',
        );
      }

      closeDialog();
      await loadOrders();
    } catch (submitError) {
      setError(
        submitError.message || 'Unable to update fulfillment status.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <h1 className="text-3xl font-bold">Order Fulfillment</h1>
            <p className="text-sm text-muted-foreground">
              Track Printful orders and update non-Printful fulfillment manually.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={loadOrders}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number, Printful ID, or customer"
          />

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder="Fulfillment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="awaiting_approval">
                Awaiting approval
              </SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Orders ({filteredOrders.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading orders…
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">
              No orders match the selected filter.
            </p>
          ) : (
            filteredOrders.map((order) => {
              const canMarkDelivered =
                order.fulfillmentStatus !== 'delivered' &&
                order.fulfillmentStatus !== 'refunded' &&
                order.refundStatus !== 'refunded' &&
                order.status !== 'cancelled' &&
                order.status !== 'canceled';

              const canManuallyUpdate =
                order.fulfillmentStatus !== 'delivered' &&
                order.fulfillmentStatus !== 'refunded' &&
                order.status !== 'cancelled' &&
                order.status !== 'canceled';

							const shippingLines = formatAddress(order.shippingAddress);

              return (
                <div
                  key={order.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all font-mono text-sm font-semibold">
                          {order.orderNumber}
                        </p>

                        <Badge
                          variant={statusVariant(
                            order.fulfillmentStatus,
                          )}
                        >
                          {order.fulfillmentStatus}
                        </Badge>

                        <Badge variant="outline">
                          {order.isPrintfulOrder
                            ? 'Printful-managed'
                            : 'Manual fulfillment'}
                        </Badge>
                      </div>

                      <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
												<div className="space-y-1">
													<p className="font-medium text-foreground">
														Customer
													</p>

													<p className="text-muted-foreground">
														{order.customerName || 'Customer name unavailable'}
													</p>

													{order.customerEmail && (
														<a
															className="block text-primary underline underline-offset-4"
															href={`mailto:${order.customerEmail}`}
														>
															{order.customerEmail}
														</a>
													)}

													{order.customerPhone && (
														<a
															className="block text-primary underline underline-offset-4"
															href={`tel:${order.customerPhone}`}
														>
															{order.customerPhone}
														</a>
													)}
												</div>

												<div className="space-y-1">
													<p className="font-medium text-foreground">
														Ship to
													</p>

													{shippingLines.length > 0 ? (
														shippingLines.map((line, index) => (
															<p
																key={`${order.id}-shipping-${index}`}
																className="text-muted-foreground"
															>
																{line}
															</p>
														))
													) : (
														<p className="text-muted-foreground">
															Shipping address unavailable
														</p>
													)}
												</div>

												<div className="space-y-1">
													<p className="font-medium text-foreground">
														Items
													</p>

													{order.items.length > 0 ? (
														order.items.map((item, index) => (
															<p
																key={
																	item.orderItemId ||
																	`${order.id}-item-${index}`
																}
																className="text-muted-foreground"
															>
																{item.quantity || 0} ×{' '}
																{item.name || 'Unnamed item'}
																{item.variant ? ` — ${item.variant}` : ''}
																{item.sku ? ` (${item.sku})` : ''}
															</p>
														))
													) : (
														<p className="text-muted-foreground">
															Item details unavailable
														</p>
													)}
												</div>

												<div className="space-y-1">
													<p className="font-medium text-foreground">
														Fulfillment
													</p>

													<p className="text-muted-foreground">
														Created: {formatDate(order.createdAt)}
													</p>

													<p className="text-muted-foreground">
														Delivered: {formatDate(order.deliveredAt)}
													</p>

													<p className="text-muted-foreground">
														Printful order: {order.printfulOrderId || 'Not linked'}
													</p>

													<p className="text-muted-foreground">
														Source: {order.fulfillmentSource || '—'}
													</p>
												</div>
											</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canManuallyUpdate && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openManualStatusDialog(order)}
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          Update status
                        </Button>
                      )}

                      {canMarkDelivered && (
                        <Button
                          type="button"
                          onClick={() => openDeliveredDialog(order)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark delivered
                        </Button>
                      )}
                    </div>
                  </div>

                  {order.manualDelivery && (
                    <p className="mt-3 rounded bg-muted p-2 text-xs text-muted-foreground">
                      Manually delivered by {order.manualDelivery.actor || 'admin'} at{' '}
                      {formatDate(order.manualDelivery.markedAt)}. Reason:{' '}
                      {order.manualDelivery.reason || '—'}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nextStatus === 'delivered'
                ? 'Mark order delivered'
                : 'Update manual fulfillment status'}
            </DialogTitle>
            <DialogDescription>
							{nextStatus === 'delivered'
									? selectedOrder?.isPrintfulOrder
									? 'This is an administrator delivery override for a Printful-managed order. Verify carrier delivery or Printful order status before confirming. This creates held revenue-ledger entries but does not release revenue or initiate a payout.'
									: 'This records delivery and creates held revenue-ledger entries. It does not release revenue, fund a pool, or submit a blockchain transaction.'
									: selectedOrder?.isPrintfulOrder
									? 'This is an administrator override for a Printful-managed order, intended for webhook recovery or verified carrier confirmation. Delivery must use the dedicated Mark delivered action.'
									: 'This records a manual fulfillment-status change. Delivery must use the dedicated Mark delivered action.'}
							</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded bg-muted p-3 text-sm">
              <p className="font-mono">
                {selectedOrder?.orderNumber}
              </p>
              <p className="mt-1 text-muted-foreground">
                Current status: {selectedOrder?.fulfillmentStatus}
              </p>
            </div>

            {!selectedOrder?.isPrintfulOrder &&
              nextStatus !== 'delivered' && (
                <Select
                  value={nextStatus}
                  onValueChange={setNextStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="New fulfillment status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for this fulfillment update"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={submitFulfillmentUpdate}
              disabled={isSaving || !reason.trim()}
            >
              {isSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {nextStatus === 'delivered'
                ? 'Confirm delivery'
                : 'Save status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}