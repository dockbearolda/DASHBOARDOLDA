"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Package,
  CreditCard,
  ExternalLink,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge, PaymentStatusBadge } from "./status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Order, OrderStatus, PaymentStatus } from "@/types/order";
import { toast } from "sonner";

interface OrderDetailProps {
  order: Order;
}

export function OrderDetail({ order: initialOrder }: OrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>(order.status);
  const [newPayment, setNewPayment] = useState<PaymentStatus>(order.paymentStatus);
  const [saving, setSaving] = useState(false);

  const saveStatus = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, paymentStatus: newPayment }),
      });
      const data = await res.json();
      setOrder(data.order);
      setEditingStatus(false);
      setEditingPayment(false);
      toast.success("Statut mis à jour avec succès");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const shippingAddr = order.shippingAddress as Record<string, string> | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold font-mono">
              #{order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">
            {formatCurrency(order.total, order.currency)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Articles commandés ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, i) => (
                <div key={item.id}>
                  {i > 0 && <Separator className="my-3" />}
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-12 w-12 rounded-xl object-cover border border-border"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground font-mono">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(item.price * item.quantity, order.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.price, order.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <Separator />

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  <span>
                    {order.shipping === 0
                      ? "Gratuit"
                      : formatCurrency(order.shipping, order.currency)}
                  </span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatCurrency(order.tax, order.currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status management */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Gérer les statuts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Statut commande
                </label>
                <Select
                  value={newStatus}
                  onValueChange={(v) => {
                    setNewStatus(v as OrderStatus);
                    setEditingStatus(true);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMANDE_EN_ATTENTE">Commande en Attente</SelectItem>
                    <SelectItem value="COMMANDE_A_PREPARER">Commande à préparer</SelectItem>
                    <SelectItem value="MAQUETTE_A_FAIRE">Maquette à faire</SelectItem>
                    <SelectItem value="PRT_A_FAIRE">PRT à faire</SelectItem>
                    <SelectItem value="EN_ATTENTE_VALIDATION">En attente validation</SelectItem>
                    <SelectItem value="EN_COURS_IMPRESSION">En cours d&apos;Impression</SelectItem>
                    <SelectItem value="PRESSAGE_A_FAIRE">Pressage à faire</SelectItem>
                    <SelectItem value="CLIENT_A_CONTACTER">Client à contacter</SelectItem>
                    <SelectItem value="CLIENT_PREVENU">Client prévenu</SelectItem>
                    <SelectItem value="ARCHIVES">Archives</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Statut paiement
                </label>
                <Select
                  value={newPayment}
                  onValueChange={(v) => {
                    setNewPayment(v as PaymentStatus);
                    setEditingPayment(true);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="PAID">Payé</SelectItem>
                    <SelectItem value="FAILED">Échoué</SelectItem>
                    <SelectItem value="REFUNDED">Remboursé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editingStatus || editingPayment) && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveStatus}
                    disabled={saving}
                    className="flex-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewStatus(order.status);
                      setNewPayment(order.paymentStatus);
                      setEditingStatus(false);
                      setEditingPayment(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">{order.customerName}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="hover:text-foreground truncate"
                >
                  {order.customerEmail}
                </a>
              </div>
              {order.customerPhone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="hover:text-foreground"
                  >
                    {order.customerPhone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping address */}
          {shippingAddr && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Adresse de livraison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="text-sm text-muted-foreground not-italic space-y-1">
                  {shippingAddr.street && <p>{shippingAddr.street}</p>}
                  {(shippingAddr.postalCode || shippingAddr.city) && (
                    <p>
                      {shippingAddr.postalCode} {shippingAddr.city}
                    </p>
                  )}
                  {shippingAddr.country && <p>{shippingAddr.country}</p>}
                </address>
              </CardContent>
            </Card>
          )}

          {/* Payment info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentStatusBadge status={order.paymentStatus} />
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
