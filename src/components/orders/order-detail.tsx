"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Order, OrderStatus, PaymentStatus } from "@/types/order";
import { OrderTasks } from "./order-tasks";
import { toast } from "sonner";

// ── Status dot config ─────────────────────────────────────────────────────────

const orderStatusConfig: Record<OrderStatus, { label: string; color: string }> = {
  COMMANDE_A_TRAITER:    { label: "À traiter",            color: "bg-red-500" },
  COMMANDE_EN_ATTENTE:   { label: "En attente",            color: "bg-amber-400" },
  COMMANDE_A_PREPARER:   { label: "À préparer",            color: "bg-blue-500" },
  MAQUETTE_A_FAIRE:      { label: "Maquette à faire",      color: "bg-purple-500" },
  PRT_A_FAIRE:           { label: "PRT à faire",           color: "bg-amber-500" },
  EN_ATTENTE_VALIDATION: { label: "Validation en attente", color: "bg-sky-400" },
  EN_COURS_IMPRESSION:   { label: "En impression",         color: "bg-blue-400" },
  PRESSAGE_A_FAIRE:      { label: "Pressage à faire",      color: "bg-violet-500" },
  CLIENT_A_CONTACTER:    { label: "Client à contacter",    color: "bg-red-400" },
  CLIENT_PREVENU:        { label: "Client prévenu",        color: "bg-green-500" },
  ARCHIVES:              { label: "Archivé",               color: "bg-zinc-500" },
};

const paymentStatusConfig: Record<PaymentStatus, { label: string; color: string }> = {
  PENDING:  { label: "En attente", color: "bg-amber-400" },
  PAID:     { label: "Payé",       color: "bg-green-500" },
  FAILED:   { label: "Échoué",     color: "bg-red-500" },
  REFUNDED: { label: "Remboursé",  color: "bg-zinc-500" },
};

function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />
      <span className="text-white text-sm">{label}</span>
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const orderStatus = orderStatusConfig[order.status] ?? { label: order.status, color: "bg-zinc-500" };
  const paymentStatus = paymentStatusConfig[order.paymentStatus] ?? { label: order.paymentStatus, color: "bg-zinc-500" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="relative bg-zinc-900 rounded-2xl p-6">

        {/* QR code — flottant top-right */}
        <div className="absolute top-5 right-5">
          <QRCodeSVG
            value={order.orderNumber}
            size={72}
            bgColor="transparent"
            fgColor="#e4e4e7"
            level="M"
          />
        </div>

        {/* Retour */}
        <button
          onClick={() => router.back()}
          className="text-zinc-500 text-sm mb-5 hover:text-white transition-colors"
        >
          ← Retour
        </button>

        {/* Infos texte */}
        <div className="space-y-1.5 pr-24">
          <p className="text-base font-bold text-white">ID : {order.orderNumber}</p>
          <p className="text-sm">
            <span className="text-zinc-400">Tel : </span>
            <span className="text-white">{order.customerPhone ?? "—"}</span>
          </p>
          <p className="text-sm">
            <span className="text-zinc-400">Ref : </span>
            <span className="text-white font-mono text-xs">{order.id}</span>
          </p>
          <p className="text-sm">
            <span className="text-zinc-400">Limit : </span>
            <span className="text-white">{formatDate(order.createdAt)}</span>
          </p>
          <p className="text-sm">
            <span className="text-zinc-400">DTF : </span>
            <span className="text-white">{order.category ?? "—"}</span>
          </p>
        </div>

        {/* Statuts — pastilles */}
        <div className="flex flex-wrap gap-4 mt-5">
          <StatusDot label={orderStatus.label} color={orderStatus.color} />
          <StatusDot label={paymentStatus.label} color={paymentStatus.color} />
        </div>

        {/* Total */}
        <p className="mt-4 text-2xl font-bold text-white tabular-nums">
          {formatCurrency(order.total, order.currency)}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">

        {/* ── Colonne gauche ── */}
        <div className="md:col-span-2 space-y-6">

          {/* Articles */}
          <div className="bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Articles ({order.items.length})
              </p>
            </div>

            <div className="divide-y divide-zinc-800">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-10 w-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-zinc-800 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-zinc-400 font-mono">SKU: {item.sku}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-white">
                      {formatCurrency(item.price * item.quantity, order.currency)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {item.quantity} × {formatCurrency(item.price, order.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totaux */}
            <div className="px-5 py-4 border-t border-zinc-800 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Sous-total</span>
                <span className="text-white">{formatCurrency(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Livraison</span>
                <span className="text-white">
                  {order.shipping === 0 ? "Gratuit" : formatCurrency(order.shipping, order.currency)}
                </span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">TVA</span>
                  <span className="text-white">{formatCurrency(order.tax, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1.5 border-t border-zinc-800">
                <span className="text-zinc-400">Total</span>
                <span className="text-white">{formatCurrency(order.total, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Tâches */}
          <OrderTasks orderId={order.id} initialNotes={order.notes} />
        </div>

        {/* ── Colonne droite ── */}
        <div className="space-y-6">

          {/* Gestion des statuts */}
          <div className="bg-zinc-900 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Statuts
            </p>

            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Commande</p>
              <Select
                value={newStatus}
                onValueChange={(v) => {
                  setNewStatus(v as OrderStatus);
                  setEditingStatus(true);
                }}
              >
                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMMANDE_A_TRAITER">À traiter</SelectItem>
                  <SelectItem value="COMMANDE_EN_ATTENTE">En attente</SelectItem>
                  <SelectItem value="COMMANDE_A_PREPARER">À préparer</SelectItem>
                  <SelectItem value="MAQUETTE_A_FAIRE">Maquette à faire</SelectItem>
                  <SelectItem value="PRT_A_FAIRE">PRT à faire</SelectItem>
                  <SelectItem value="EN_ATTENTE_VALIDATION">Validation en attente</SelectItem>
                  <SelectItem value="EN_COURS_IMPRESSION">En impression</SelectItem>
                  <SelectItem value="PRESSAGE_A_FAIRE">Pressage à faire</SelectItem>
                  <SelectItem value="CLIENT_A_CONTACTER">Client à contacter</SelectItem>
                  <SelectItem value="CLIENT_PREVENU">Client prévenu</SelectItem>
                  <SelectItem value="ARCHIVES">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Paiement</p>
              <Select
                value={newPayment}
                onValueChange={(v) => {
                  setNewPayment(v as PaymentStatus);
                  setEditingPayment(true);
                }}
              >
                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
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
                <button
                  onClick={saveStatus}
                  disabled={saving}
                  className="flex-1 h-9 rounded-xl bg-white text-zinc-900 text-sm font-medium disabled:opacity-50 hover:bg-zinc-100 transition-colors"
                >
                  {saving ? "…" : "Enregistrer"}
                </button>
                <button
                  onClick={() => {
                    setNewStatus(order.status);
                    setNewPayment(order.paymentStatus);
                    setEditingStatus(false);
                    setEditingPayment(false);
                  }}
                  className="h-9 px-4 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          {/* Client */}
          <div className="bg-zinc-900 rounded-2xl p-5 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
              Client
            </p>
            <p className="text-sm font-semibold text-white">{order.customerName}</p>
            <p className="text-sm text-zinc-400">{order.customerEmail}</p>
            {order.customerPhone && (
              <p className="text-sm text-zinc-400">{order.customerPhone}</p>
            )}
          </div>

          {/* Adresse de livraison */}
          {shippingAddr && (
            <div className="bg-zinc-900 rounded-2xl p-5 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                Livraison
              </p>
              {shippingAddr.street && (
                <p className="text-sm text-zinc-400">{shippingAddr.street}</p>
              )}
              {(shippingAddr.postalCode || shippingAddr.city) && (
                <p className="text-sm text-zinc-400">
                  {shippingAddr.postalCode} {shippingAddr.city}
                </p>
              )}
              {shippingAddr.country && (
                <p className="text-sm text-zinc-400">{shippingAddr.country}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
