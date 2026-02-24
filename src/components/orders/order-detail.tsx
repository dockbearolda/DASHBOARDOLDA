"use client";

/**
 * OrderDetail — Fiche de commande Apple-style dark
 *
 * Structure (de haut en bas) :
 *  1. Header       — récap, ID commande, date, QR + menu gear
 *  2. Visuels      — Face Avant / Dos (DTF codes ou images)
 *  3. CLIENT       — Nom, Téléphone, Limit (deadline)
 *  4. PRODUIT      — Collection, Référence, Coloris, Taille, DTF arrière
 *  5. LOGOS        — Logo avant, Couleur AV, Logo arrière, Couleur AR
 *  6. NOTES        — Texte libre
 *  7. PAIEMENT     — Détail items, Total, Statut paiement
 *  8. Action bar   — Retour  |  Envoyer à l'Atelier (+ Modifier / Supprimer)
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Settings2,
  Pencil,
  Trash2,
  Send,
  Check,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Order, OldaExtraData, OrderStatus, PaymentStatus } from "@/types/order";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readExtra(order: Order): OldaExtraData {
  if (!order.shippingAddress) return {};
  const sa = order.shippingAddress as Record<string, unknown>;
  if (sa._source === "olda_studio") return sa as unknown as OldaExtraData;
  return {};
}

function fmtPrice(n: number, currency = "EUR") {
  return Number(n).toLocaleString("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function fmtDate(d: string | Date) {
  return format(new Date(d), "dd/MM/yyyy", { locale: fr });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status dot (dark-theme)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<OrderStatus, { label: string; color: string }> = {
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

const PAYMENT_DOT: Record<PaymentStatus, { label: string; color: string }> = {
  PENDING:  { label: "En attente", color: "bg-amber-400" },
  PAID:     { label: "Payé",       color: "bg-green-500" },
  FAILED:   { label: "Échoué",     color: "bg-red-500" },
  REFUNDED: { label: "Remboursé",  color: "bg-zinc-500" },
};

function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />
      <span className="text-white text-[12px] font-medium">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color swatch
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_SWATCHES: Record<string, string> = {
  noir:     "#1d1d1f",
  blanc:    "#f5f5f7",
  rouge:    "#ff3b30",
  bleu:     "#0071e3",
  vert:     "#34c759",
  jaune:    "#ffd60a",
  rose:     "#ff6b8e",
  orange:   "#ff9f0a",
  violet:   "#bf5af2",
  gris:     "#8e8e93",
  argent:   "#b0b0b5",
  or:       "#d4a017",
  beige:    "#e8d5b7",
  marron:   "#8b4513",
  kaki:     "#78866b",
  turquoise:"#32ade6",
};

function ColorDot({ color }: { color?: string }) {
  if (!color) return null;
  const key = color.toLowerCase().trim();
  const fill = COLOR_SWATCHES[key] ?? "#8e8e93";
  const needsBorder = fill === "#f5f5f7" || fill === "#ffffff";
  return (
    <span
      className={cn(
        "inline-block h-3 w-3 rounded-full shrink-0",
        needsBorder && "border border-zinc-600"
      )}
      style={{ background: fill }}
      title={color}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives de mise en page (dark)
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 select-none">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="mx-5 border-t border-zinc-800" />;
}

interface DataRowProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  last?: boolean;
}

function DataRow({ label, value, mono = false, last = false }: DataRowProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 px-5 py-[11px]">
        <span className="text-[13px] font-medium text-zinc-400 shrink-0">{label}</span>
        <span
          className={cn(
            "text-[13px] font-semibold text-white text-right truncate max-w-[60%]",
            mono && "font-mono"
          )}
        >
          {value ?? <span className="text-zinc-600 font-normal">—</span>}
        </span>
      </div>
      {!last && <Divider />}
    </>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[18px] bg-zinc-900 overflow-hidden", className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte visuel (DTF code ou image) — dark
// ─────────────────────────────────────────────────────────────────────────────

function VisuelCard({ label, src }: { label: string; src?: string | null }) {
  const isUrl = src && (src.startsWith("http") || src.startsWith("data:"));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">
        {label}
      </p>
      <div className="aspect-square rounded-[14px] bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
        {isUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src!} alt={label} className="w-full h-full object-contain" />
        ) : src ? (
          <span className="text-[12px] font-mono font-semibold text-zinc-300 px-3 text-center break-all leading-snug">
            {src}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600">Pas d&apos;image</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal d'édition
// ─────────────────────────────────────────────────────────────────────────────

interface EditFields {
  customerName: string;
  customerPhone: string;
  deadline: string;
  collection: string;
  reference: string;
  coloris: string;
  taille: string;
  coteLogoAr: string;
  logoAvant: string;
  couleurLogoAvant: string;
  logoArriere: string;
  couleurLogoArriere: string;
  notes: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

function EditModal({
  order,
  extra,
  open,
  onClose,
  onSaved,
}: {
  order: Order;
  extra: OldaExtraData;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Order) => void;
}) {
  const [fields, setFields] = useState<EditFields>({
    customerName:      order.customerName,
    customerPhone:     order.customerPhone ?? "",
    deadline:          extra.deadline ?? "",
    collection:        extra.collection ?? "",
    reference:         extra.reference ?? "",
    coloris:           extra.coloris ?? "",
    taille:            extra.taille ?? "",
    coteLogoAr:        extra.coteLogoAr ?? "",
    logoAvant:         extra.logoAvant ?? "",
    couleurLogoAvant:  extra.couleurLogoAvant ?? "",
    logoArriere:       extra.logoArriere ?? "",
    couleurLogoArriere:extra.couleurLogoArriere ?? "",
    notes:             order.notes ?? "",
    status:            order.status,
    paymentStatus:     order.paymentStatus,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status:        fields.status,
          paymentStatus: fields.paymentStatus,
          notes:         fields.notes || null,
          customerName:  fields.customerName || null,
          customerPhone: fields.customerPhone || null,
          shippingAddressPatch: {
            ...(extra._source ? { _source: extra._source } : {}),
            deadline:           fields.deadline           || undefined,
            collection:         fields.collection         || undefined,
            reference:          fields.reference          || undefined,
            coloris:            fields.coloris            || undefined,
            taille:             fields.taille             || undefined,
            coteLogoAr:         fields.coteLogoAr         || undefined,
            logoAvant:          fields.logoAvant          || undefined,
            couleurLogoAvant:   fields.couleurLogoAvant   || undefined,
            logoArriere:        fields.logoArriere        || undefined,
            couleurLogoArriere: fields.couleurLogoArriere || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onSaved(data.order as Order);
      toast.success("Commande mise à jour");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "h-8 text-sm rounded-lg";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Modifier la commande</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* CLIENT */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Client
            </legend>
            <label className="block space-y-1">
              <span className="text-[12px] text-gray-500 font-medium">Nom</span>
              <Input className={fieldClass} value={fields.customerName} onChange={set("customerName")} placeholder="Prénom Nom" />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-gray-500 font-medium">Téléphone</span>
              <Input className={fieldClass} value={fields.customerPhone} onChange={set("customerPhone")} placeholder="0XXXXXXXXX" />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-gray-500 font-medium">Limit</span>
              <Input className={fieldClass} value={fields.deadline} onChange={set("deadline")} placeholder="2026-03-15 ou texte libre" />
            </label>
          </fieldset>

          <div className="border-t border-gray-100" />

          {/* PRODUIT */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Produit
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Collection</span>
                <Input className={fieldClass} value={fields.collection} onChange={set("collection")} placeholder="Homme" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Référence</span>
                <Input className={fieldClass} value={fields.reference} onChange={set("reference")} placeholder="H-001" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Coloris</span>
                <Input className={fieldClass} value={fields.coloris} onChange={set("coloris")} placeholder="Noir" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Taille</span>
                <Input className={fieldClass} value={fields.taille} onChange={set("taille")} placeholder="M" />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[12px] text-gray-500 font-medium">Taille DTF arrière</span>
              <Input className={fieldClass} value={fields.coteLogoAr} onChange={set("coteLogoAr")} placeholder="270 mm" />
            </label>
          </fieldset>

          <div className="border-t border-gray-100" />

          {/* LOGOS */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Logos
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Logo avant</span>
                <Input className={fieldClass} value={fields.logoAvant} onChange={set("logoAvant")} placeholder="bea-16-ar-AV" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Couleur AV</span>
                <Input className={fieldClass} value={fields.couleurLogoAvant} onChange={set("couleurLogoAvant")} placeholder="Rose" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Logo arrière</span>
                <Input className={fieldClass} value={fields.logoArriere} onChange={set("logoArriere")} placeholder="bea-16-ar-AR" />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Couleur AR</span>
                <Input className={fieldClass} value={fields.couleurLogoArriere} onChange={set("couleurLogoArriere")} placeholder="Argent" />
              </label>
            </div>
          </fieldset>

          <div className="border-t border-gray-100" />

          {/* STATUTS */}
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Statuts
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Commande</span>
                <Select value={fields.status} onValueChange={(v) => setFields((f) => ({ ...f, status: v as OrderStatus }))}>
                  <SelectTrigger className="h-8 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMANDE_A_TRAITER">À traiter</SelectItem>
                    <SelectItem value="COMMANDE_EN_ATTENTE">En attente</SelectItem>
                    <SelectItem value="COMMANDE_A_PREPARER">À préparer</SelectItem>
                    <SelectItem value="MAQUETTE_A_FAIRE">Maquette à faire</SelectItem>
                    <SelectItem value="PRT_A_FAIRE">PRT à faire</SelectItem>
                    <SelectItem value="EN_ATTENTE_VALIDATION">Validation</SelectItem>
                    <SelectItem value="EN_COURS_IMPRESSION">En impression</SelectItem>
                    <SelectItem value="PRESSAGE_A_FAIRE">Pressage</SelectItem>
                    <SelectItem value="CLIENT_A_CONTACTER">À contacter</SelectItem>
                    <SelectItem value="CLIENT_PREVENU">Client prévenu</SelectItem>
                    <SelectItem value="ARCHIVES">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-gray-500 font-medium">Paiement</span>
                <Select value={fields.paymentStatus} onValueChange={(v) => setFields((f) => ({ ...f, paymentStatus: v as PaymentStatus }))}>
                  <SelectTrigger className="h-8 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="PAID">Payé</SelectItem>
                    <SelectItem value="FAILED">Échoué</SelectItem>
                    <SelectItem value="REFUNDED">Remboursé</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </fieldset>

          <div className="border-t border-gray-100" />

          {/* NOTES */}
          <fieldset>
            <legend className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Notes
            </legend>
            <textarea
              value={fields.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Note libre…"
              className={cn(
                "w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring resize-none transition-all"
              )}
            />
          </fieldset>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmation de suppression
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({
  open,
  orderNumber,
  onClose,
  onConfirm,
  deleting,
}: {
  open: boolean;
  orderNumber: string;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Supprimer la commande ?</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          La commande <span className="font-semibold text-gray-800">{orderNumber}</span> sera
          définitivement supprimée. Cette action est irréversible.
        </p>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu gear (dropdown discret — dark)
// ─────────────────────────────────────────────────────────────────────────────

function GearMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-full transition-colors",
          open
            ? "bg-zinc-700 text-white"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
        )}
        aria-label="Options"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute right-0 top-10 z-30 min-w-[148px] rounded-[14px] bg-zinc-900",
              "border border-zinc-700 shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
              "py-1 overflow-hidden"
            )}
          >
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-zinc-400" />
              Modifier
            </button>
            <div className="mx-3 border-t border-zinc-800" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-red-400 hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

interface OrderDetailProps {
  order: Order;
}

export function OrderDetail({ order: initialOrder }: OrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);

  const extra = readExtra(order);
  const createdAt = new Date(order.createdAt);

  const orderDot   = STATUS_DOT[order.status]     ?? { label: order.status,        color: "bg-zinc-500" };
  const paymentDot = PAYMENT_DOT[order.paymentStatus] ?? { label: order.paymentStatus, color: "bg-zinc-500" };

  // ── "Envoyer à l'Atelier" → passe en COMMANDE_A_PREPARER ──────────────────
  const handleSendToAtelier = async () => {
    if (order.status === "COMMANDE_A_PREPARER") {
      toast.info("Commande déjà envoyée à l'atelier");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMMANDE_A_PREPARER" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrder(data.order as Order);
      toast.success("Envoyé à l'atelier !");
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // ── Suppression ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Commande supprimée");
      router.push("/dashboard/olda");
    } catch {
      toast.error("Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  // Items avec prix > 0 pour la section paiement
  const billableItems = order.items.filter((i) => i.price > 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto pb-32 space-y-3"
      >

        {/* ══ 1. HEADER ══════════════════════════════════════════════════════ */}
        <SectionCard>
          <div className="px-5 pt-4 pb-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 mb-1">
                Récapitulatif de commande
              </p>
              {/* ID Commande */}
              <p className="text-[17px] font-bold text-white leading-snug break-all">
                {order.orderNumber}
              </p>
              {/* Date */}
              <p className="text-[12px] text-zinc-400 mt-1">
                {fmtDate(createdAt)}
              </p>
              {/* Statuts */}
              <div className="flex flex-wrap gap-3 mt-3">
                <StatusDot label={orderDot.label}   color={orderDot.color} />
                <StatusDot label={paymentDot.label} color={paymentDot.color} />
              </div>
            </div>

            {/* Droite : gear menu + QR */}
            <div className="flex items-start gap-2 shrink-0">
              <GearMenu
                onEdit={() => setEditOpen(true)}
                onDelete={() => setDeleteOpen(true)}
              />
              <div className="rounded-[10px] border border-zinc-700 p-[5px] bg-zinc-800">
                <QRCodeSVG
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/orders/${order.id}`}
                  size={72}
                  bgColor="transparent"
                  fgColor="#e4e4e7"
                  level="M"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ══ 2. VISUELS TECHNIQUES ══════════════════════════════════════════ */}
        {(extra.logoAvant || extra.logoArriere ||
          order.items.some((i) => i.imageUrl)) && (
          <SectionCard>
            <SectionLabel>Visuels techniques</SectionLabel>
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              <VisuelCard
                label="Face Avant"
                src={
                  order.items.find((i) => /avant|front/i.test(i.name))?.imageUrl
                  ?? extra.logoAvant
                }
              />
              <VisuelCard
                label="Dos"
                src={
                  order.items.find((i) => /arri[eè]re|dos|back/i.test(i.name))?.imageUrl
                  ?? extra.logoArriere
                }
              />
            </div>
          </SectionCard>
        )}

        {/* ══ 3. CLIENT ══════════════════════════════════════════════════════ */}
        <SectionCard>
          <SectionLabel>Client</SectionLabel>
          <DataRow label="Nom"       value={order.customerName} />
          <DataRow label="Téléphone" value={order.customerPhone} />
          <DataRow label="Limit"     value={extra.deadline} last />
        </SectionCard>

        {/* ══ 4. PRODUIT ═════════════════════════════════════════════════════ */}
        <SectionCard>
          <SectionLabel>Produit</SectionLabel>
          <DataRow label="Collection"    value={extra.collection} />
          <DataRow label="Référence"     value={extra.reference} mono />
          <DataRow
            label="Coloris"
            value={
              extra.coloris ? (
                <span className="flex items-center gap-2 justify-end">
                  {extra.coloris}
                  <ColorDot color={extra.coloris} />
                </span>
              ) : undefined
            }
          />
          <DataRow label="Taille"        value={extra.taille} />
          <DataRow label="Taille DTF AR" value={extra.coteLogoAr} last />
        </SectionCard>

        {/* ══ 5. LOGOS ═══════════════════════════════════════════════════════ */}
        {(extra.logoAvant || extra.logoArriere ||
          extra.couleurLogoAvant || extra.couleurLogoArriere) && (
          <SectionCard>
            <SectionLabel>Logos</SectionLabel>
            <DataRow label="Logo avant"   value={extra.logoAvant}   mono />
            <DataRow
              label="Couleur avant"
              value={
                extra.couleurLogoAvant ? (
                  <span className="flex items-center gap-2 justify-end">
                    {extra.couleurLogoAvant}
                    <ColorDot color={extra.couleurLogoAvant} />
                  </span>
                ) : undefined
              }
            />
            <DataRow label="Logo arrière" value={extra.logoArriere} mono />
            <DataRow
              label="Couleur arrière"
              value={
                extra.couleurLogoArriere ? (
                  <span className="flex items-center gap-2 justify-end">
                    {extra.couleurLogoArriere}
                    <ColorDot color={extra.couleurLogoArriere} />
                  </span>
                ) : undefined
              }
              last
            />
          </SectionCard>
        )}

        {/* ══ 6. NOTES ═══════════════════════════════════════════════════════ */}
        {order.notes && (
          <SectionCard>
            <SectionLabel>Notes</SectionLabel>
            <p className="px-5 pb-4 text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {order.notes}
            </p>
          </SectionCard>
        )}

        {/* ══ 7. PAIEMENT ════════════════════════════════════════════════════ */}
        <SectionCard>
          <SectionLabel>Paiement</SectionLabel>

          {/* Détail des articles */}
          {billableItems.length > 0 ? (
            billableItems.map((item, idx) => (
              <DataRow
                key={item.id}
                label={item.name}
                value={fmtPrice(item.price * item.quantity, order.currency)}
                last={idx === billableItems.length - 1}
              />
            ))
          ) : (
            <>
              <DataRow
                label="T-Shirt"
                value={fmtPrice(order.subtotal, order.currency)}
              />
              {order.shipping > 0 && (
                <DataRow
                  label="Livraison"
                  value={fmtPrice(order.shipping, order.currency)}
                />
              )}
            </>
          )}

          {/* Ligne Total */}
          <div className="mx-5 border-t border-zinc-800 mt-1" />
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-[14px] font-bold text-white">Total</span>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-bold text-white tabular-nums">
                {fmtPrice(order.total, order.currency)}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  order.paymentStatus === "PAID"     && "text-emerald-400",
                  order.paymentStatus === "PENDING"  && "text-amber-400",
                  order.paymentStatus === "FAILED"   && "text-red-400",
                  order.paymentStatus === "REFUNDED" && "text-zinc-500"
                )}
              >
                {order.paymentStatus === "PAID"     && "Payé"}
                {order.paymentStatus === "PENDING"  && "En attente"}
                {order.paymentStatus === "FAILED"   && "Échoué"}
                {order.paymentStatus === "REFUNDED" && "Remboursé"}
              </span>
            </div>
          </div>
        </SectionCard>

      </motion.div>

      {/* ══ 8. ACTION BAR (sticky bottom) ═════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:left-64">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe-6">
          {/* Bouton retour */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-11 w-11 rounded-[14px]"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Bouton principal */}
          <Button
            onClick={handleSendToAtelier}
            disabled={sending || order.status === "COMMANDE_A_PREPARER"}
            className={cn(
              "flex-1 h-11 rounded-[14px] text-[14px] font-semibold gap-2",
              "bg-white hover:bg-zinc-100 text-zinc-900",
              "disabled:opacity-60"
            )}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {order.status === "COMMANDE_A_PREPARER"
              ? "Envoyé à l'atelier"
              : "Envoyer à l'Atelier"}
          </Button>
        </div>
      </div>

      {/* ══ Modals ═════════════════════════════════════════════════════════════ */}
      <EditModal
        order={order}
        extra={extra}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setOrder(updated)}
      />

      <DeleteModal
        open={deleteOpen}
        orderNumber={order.orderNumber}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </>
  );
}
