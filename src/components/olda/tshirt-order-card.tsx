"use client";

/**
 * TshirtOrderCard
 * ─ Bulle Apple (coins 24px, fond blanc, ombre légère, SF Pro)
 * ─ Layout : QR gauche · Identité/Production/Prix droite
 * ─ Section Note sous la carte si order.notes existe
 * ─ Bouton Éditer (Pencil) + Supprimer (X rouge) visibles au hover
 * ─ Light mode only — zero dark: variants
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Upload, AlertCircle, Package, Printer, Pencil } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem, OldaExtraData } from "@/types/order";

// ── Local images ───────────────────────────────────────────────────────────────

function useLocalImages(orderId: string) {
  const key = `olda-images-${orderId}`;
  const [imgs, setImgs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as string[]) : []; }
    catch { return []; }
  });
  const addImage = useCallback((dataUrl: string) => {
    setImgs((prev) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [key]);
  return { localImages: imgs, addImage };
}

// ── QR origin (client-only) ────────────────────────────────────────────────────

function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => { setO(window.location.origin); }, []);
  return o;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

function deadlineLabel(deadline: string | undefined | null): string | null {
  if (!deadline) return null;
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return deadline;
    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0)   return `⚠️ En retard (${Math.abs(diff)}j)`;
    if (diff === 0) return "Aujourd'hui !";
    if (diff === 1) return "Demain";
    return `Dans ${diff} jours · ${format(d, "d MMM", { locale: fr })}`;
  } catch { return deadline; }
}

function readExtra(order: Order): OldaExtraData {
  if (!order.shippingAddress) return {};
  const sa = order.shippingAddress as Record<string, unknown>;
  if (sa._source === "olda_studio") return sa as unknown as OldaExtraData;
  return {};
}

function isDtfCode(s: string | undefined | null): boolean {
  if (!s) return false;
  return !s.startsWith("http") && !s.startsWith("data:");
}

// ── Patch payload ──────────────────────────────────────────────────────────────

export interface OrderPatch {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  coteLogoAr?: string;
}

// ── Pastille paiement ──────────────────────────────────────────────────────────

function PaymentDot({ status }: { status: string }) {
  const paid = status === "PAID";
  return (
    <span
      title={paid ? "Payé ✓" : "Paiement en attente"}
      className={cn(
        "h-2 w-2 rounded-full shrink-0 transition-colors",
        paid ? "bg-emerald-500" : "bg-amber-400"
      )}
    />
  );
}

// ── Modal fiche de commande (impression) ───────────────────────────────────────

function OrderFicheModal({
  order, extra, images, addImage, origin, onClose,
}: {
  order: Order;
  extra: OldaExtraData;
  images: string[];
  addImage: (url: string) => void;
  origin: string;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";

  const qrValue = origin
    ? `${origin}/dashboard/orders/${order.id}`
    : order.orderNumber;

  const createdAt     = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });

  const reference   = extra.reference || order.orderNumber;
  const deadlineTxt = deadlineLabel(extra.deadline ?? order.notes);
  const dtfSize     = extra.coteLogoAr ?? null;

  const logoAvant   = extra.logoAvant   ?? images[0] ?? null;
  const logoArriere = extra.logoArriere ?? images[1] ?? null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { addImage(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-fiche-print, .olda-fiche-print * { visibility: visible !important; }
          .olda-fiche-print {
            position: fixed !important;
            inset: 0 !important;
            padding: 1cm !important;
            background: white !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif !important;
          }
        }
      `}</style>

      <div
        className="w-full max-w-lg bg-white rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] border border-gray-200/80 overflow-hidden max-h-[92svh] overflow-y-auto pb-safe"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Bon de Commande · {formattedDate}
            </p>
            <h2 className="text-[20px] font-bold text-gray-900 mt-0.5 leading-tight">
              {reference}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Imprimer l'autocollant"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* ══ FICHE AUTOCOLLANT ════════════════════════════════════════════════ */}
        <div className="olda-fiche-print px-5 pt-5 pb-4">
          <div className="flex items-start gap-5">
            <div className="flex-1 space-y-[6px] min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bon de Commande</p>
              <p className="text-[14px] font-semibold text-gray-800 truncate">{order.customerName}</p>
              <p className="text-[13px] text-gray-600 truncate">{order.customerPhone ?? "—"}</p>
              <p className={cn(
                "text-[12px] font-medium truncate flex items-center gap-1",
                deadlineTxt?.includes("retard") ? "text-red-500" : "text-gray-700"
              )}>
                {deadlineTxt
                  ? <><AlertCircle className="h-2.5 w-2.5 shrink-0" />{deadlineTxt}</>
                  : <span className="text-gray-300">Limit : —</span>
                }
              </p>
              <p className="text-[12px] text-gray-500 truncate">
                <span className="font-medium text-gray-400">DTF AR : </span>
                {dtfSize ?? "—"}
              </p>
              {order.notes && (
                <p className="text-[12px] text-gray-600 truncate italic">
                  <span className="font-medium text-gray-400">Note : </span>
                  {order.notes}
                </p>
              )}
            </div>

            {origin && (
              <div className="shrink-0 rounded-xl border border-gray-200 p-[5px] bg-white shadow-sm">
                <QRCodeSVG value={qrValue} size={96} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
            <PaymentDot status={order.paymentStatus} />
            <span className="text-[11px] text-gray-400">
              {order.paymentStatus === "PAID" ? "Payé" : "Paiement en attente"}
            </span>
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-gray-700">
              {fmtPrice(order.total, currency)}
            </span>
          </div>
        </div>
        {/* ══ fin fiche ════════════════════════════════════════════════════════ */}

        {/* Visuels */}
        <div className="px-5 pt-3 pb-4 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Visuels</p>
          {(logoAvant || logoArriere) ? (
            <div className="flex gap-3">
              {([
                { src: logoAvant,   label: "Avant" },
                { src: logoArriere, label: "Arrière" },
              ] as { src: string | null; label: string }[]).map(({ src, label }) =>
                src ? (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
                    {isDtfCode(src) ? (
                      <div className="w-full flex items-center justify-center h-16 rounded-2xl border border-gray-200 bg-white font-mono text-[13px] font-semibold text-gray-700 shadow-sm px-2 text-center">
                        {src}
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={`Visual ${label}`} className="w-full object-contain rounded-2xl border border-gray-200 bg-white shadow-sm" style={{ maxHeight: 180 }} />
                    )}
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border border-dashed border-gray-300 cursor-pointer hover:bg-white transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-[13px] text-gray-400">Ajouter Avant + Arrière</span>
            </label>
          )}
        </div>

        {/* Articles */}
        {items.filter(i => i.price > 0).length > 0 && (
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Package className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Articles</p>
            </div>
            <div className="space-y-2">
              {items.map((item: OrderItem) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  {item.imageUrl && !isDtfCode(item.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-gray-200 bg-white shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{item.name}</p>
                    {item.sku && <p className="text-[11px] text-gray-400 font-mono truncate">{item.sku}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">×{item.quantity}</span>
                    <span className="text-[12px] font-semibold tabular-nums text-gray-700">
                      {fmtPrice(item.price * item.quantity, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-[13px] font-semibold text-gray-900">Total</span>
              <span className="text-[15px] font-bold tabular-nums text-gray-900">
                {fmtPrice(order.total, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal édition ──────────────────────────────────────────────────────────────

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif";
const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";

function EditOrderModal({
  order, extra, onClose, onSaved,
}: {
  order: Order;
  extra: OldaExtraData;
  onClose: () => void;
  onSaved: (patch: OrderPatch) => void;
}) {
  const [name,   setName]   = useState(order.customerName ?? "");
  const [phone,  setPhone]  = useState(order.customerPhone ?? "");
  const [dtf,    setDtf]    = useState(extra.coteLogoAr ?? "");
  const [notes,  setNotes]  = useState(order.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const patch: OrderPatch = {
      customerName:  name  || undefined,
      customerPhone: phone || undefined,
      notes,
      coteLogoAr:    dtf   || undefined,
    };
    try {
      await fetch(`/api/orders/${order.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:  patch.customerName,
          customerPhone: patch.customerPhone,
          notes:         patch.notes,
          ...(patch.coteLogoAr ? { shippingAddressPatch: { coteLogoAr: patch.coteLogoAr } } : {}),
        }),
      });
      onSaved(patch);
      onClose();
    } catch { /* ignore — card garde ses valeurs */ } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] border border-gray-200/80 overflow-hidden"
        style={{ fontFamily: SF }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1d1d1f" }}>Modifier la commande</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>

        {/* Champs */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Nom complet</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 …" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Taille DTF AR</label>
            <input value={dtf} onChange={(e) => setDtf(e.target.value)} placeholder="ex : 300 mm" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaire interne…"
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 rounded-xl bg-gray-900 text-[14px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main card — Bulle Apple ───────────────────────────────────────────────────

export function TshirtOrderCard({ order: initialOrder, isNew, onDelete }: {
  order: Order;
  isNew?: boolean;
  onDelete?: () => void;
}) {
  // Local order copy pour refléter les éditions sans attendre le prochain poll SSE
  const [order, setOrder] = useState(initialOrder);

  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";
  const origin   = useOrigin();

  const extra     = readExtra(order);
  const reference = extra.reference || order.orderNumber;

  // Séparation prénom / nom — convention "Prénom NOM"
  const nameParts = (order.customerName ?? "").trim().split(/\s+/);
  const prenom    = nameParts[0] ?? "";
  const nom       = nameParts.slice(1).join(" ") || prenom;

  // DTF Arrière — uniquement la taille (coteLogoAr)
  const dtfSize = extra.coteLogoAr ?? null;

  const serverImages  = items.filter((i) => i.imageUrl && !isDtfCode(i.imageUrl)).map((i) => i.imageUrl as string).slice(0, 2);
  const { localImages, addImage } = useLocalImages(order.id);
  const displayImages = serverImages.length > 0 ? serverImages : localImages;

  const [modalOpen, setModalOpen]       = useState(false);
  const [editOpen,  setEditOpen]        = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);

  const qrValue = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;

  // Applique le patch localement après une édition réussie
  const handleSaved = (patch: OrderPatch) => {
    setOrder((prev) => {
      const next = { ...prev };
      if (patch.customerName  !== undefined) next.customerName  = patch.customerName;
      if (patch.customerPhone !== undefined) next.customerPhone = patch.customerPhone;
      if (patch.notes         !== undefined) next.notes         = patch.notes;
      if (patch.coteLogoAr) {
        const sa = (prev.shippingAddress as Record<string, unknown>) ?? {};
        next.shippingAddress = { ...sa, coteLogoAr: patch.coteLogoAr, _source: "olda_studio" };
      }
      return next;
    });
  };

  // Couleur de bordure subtile selon la catégorie
  const categoryColor = (() => {
    const cat = (order.category ?? "").toLowerCase();
    if (cat.includes("mug") || cat.includes("tasse")) return "border-cyan-100";
    if (cat.includes("polo") || cat.includes("sweat")) return "border-purple-100";
    if (cat.includes("sac") || cat.includes("accessoire")) return "border-orange-100";
    return "border-gray-200/80";
  })();

  return (
    <>
      {/* ── Card shell — Bulle Apple 24px ── */}
      <div
        className={cn(
          "relative group/card rounded-[24px] bg-white border overflow-hidden",
          "transition-all duration-200 select-none [touch-action:manipulation]",
          "shadow-[0_1px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] hover:border-gray-300",
          "h-[120px] flex flex-col",
          isNew
            ? "border-blue-400/60 ring-2 ring-blue-400/30 animate-fade-up"
            : categoryColor
        )}
      >
        {/* ── Boutons d'action — Éditer (bleu) + Supprimer (rouge) ── */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
          {/* Éditer */}
          <button
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            title="Modifier la commande"
            className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Pencil className="h-2.5 w-2.5 text-gray-400" />
          </button>
          {/* Supprimer — confirm avant action */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Supprimer la commande de ${order.customerName} ?\nCette action est irréversible.`)) {
                  onDelete();
                }
              }}
              title="Supprimer la commande"
              className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <X className="h-2.5 w-2.5 text-gray-400" style={{ color: "#ff3b30" }} />
            </button>
          )}
        </div>

        {/* ══ Layout horizontal : QR gauche · Infos droite ═══════════════════ */}
        <div
          className="flex items-stretch cursor-pointer select-none flex-1 min-h-0"
          onClick={() => setModalOpen(true)}
        >
          {/* ─ Colonne gauche : QR Code uniquement ─ */}
          {origin && (
            <div className="shrink-0 flex items-center justify-center p-3 border-r border-gray-100">
              <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-[5px]">
                <QRCodeSVG value={qrValue} size={76} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
            </div>
          )}

          {/* ─ Colonne droite : Identité · Production · Prix ─ */}
          <div className="flex-1 min-w-0 flex flex-col justify-between px-3 py-3 gap-2.5 overflow-hidden">

            {/* Bloc Identité */}
            <div className="flex flex-col gap-[3px]">
              {/* NOM — uppercase semibold */}
              <p className="truncate leading-tight" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.02em", color: "#1d1d1f", textTransform: "uppercase" }}>
                {nom}
              </p>
              {/* Prénom — regular */}
              <p className="truncate leading-tight" style={{ fontSize: 14, fontWeight: 400, color: "#3a3a3c" }}>
                {prenom}
              </p>
              {/* Téléphone */}
              <p className="truncate" style={{ fontSize: 12, color: "#8e8e93" }}>
                {order.customerPhone ?? "—"}
              </p>
              {/* Référence — juste sous le téléphone, monospace discret */}
              <p className="truncate font-mono" style={{ fontSize: 10, color: "#aeaeb2" }}>
                {reference}
              </p>
            </div>

            {/* Bloc Production — DTF AR (le plus important) */}
            <div>
              <p className="truncate mb-0.5" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aeaeb2" }}>
                DTF AR
              </p>
              <p className="truncate" style={{ fontSize: 18, fontWeight: 700, color: "#333333", lineHeight: 1.15 }}>
                {dtfSize ?? "—"}
              </p>
            </div>

            {/* Prix — couleur paiement Apple */}
            <p className="tabular-nums" style={{
              fontSize: 15,
              fontWeight: 700,
              color: order.paymentStatus === "PAID" ? "#28cd41" : "#ff3b30",
            }}>
              {fmtPrice(order.total, currency)}
            </p>

          </div>
        </div>

        {/* ── Section Note — affichée uniquement si order.notes existe et non-vide ── */}
        {order.notes?.trim() && (
          <div
            className="border-t border-gray-100 px-3 py-2 shrink-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aeaeb2", marginBottom: 2 }}>
              Note
            </p>
            <div className="flex items-start gap-1.5">
              <p className="flex-1 text-[11px] text-gray-600 leading-tight" style={{
                display: noteExpanded ? "block" : "-webkit-box",
                WebkitLineClamp: noteExpanded ? undefined : 1,
                WebkitBoxOrient: "vertical",
                overflow: noteExpanded ? "visible" : "hidden"
              }}>
                {order.notes}
              </p>
              {!noteExpanded && order.notes.length > 40 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setNoteExpanded(true); }}
                  className="shrink-0 text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                >
                  …
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Modal édition ── */}
      {editOpen && (
        <EditOrderModal
          order={order}
          extra={extra}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Modal fiche de commande ── */}
      {modalOpen && (
        <OrderFicheModal
          order={order}
          extra={extra}
          images={displayImages}
          addImage={addImage}
          origin={origin}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
