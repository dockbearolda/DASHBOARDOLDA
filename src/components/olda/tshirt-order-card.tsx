"use client";

/**
 * TshirtOrderCard — Apple Premium · Refonte atelier
 * ─ Bulle fermée : QR + identité + visuels DTF + infos production + prix
 * ─ Accordéon : collection, référence, taille, note, bloc PRT
 * ─ Print modal : visuels agrandis, masquage total UI dashboard
 * ─ Zéro label, zéro ligne vide
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { X, Upload, Printer, Pencil, ChevronDown } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem, OldaExtraData } from "@/types/order";

// ── Font stack ────────────────────────────────────────────────────────────────
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', 'Helvetica Neue', sans-serif";

// ── useLocalImages ────────────────────────────────────────────────────────────
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

// ── useOrigin ─────────────────────────────────────────────────────────────────
function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => { setO(window.location.origin); }, []);
  return o;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

function deadlineLabel(deadline: string | undefined | null): string | null {
  if (!deadline) return null;
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return deadline;
    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0)   return `⚠️ Retard ${Math.abs(diff)}j`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return format(d, "d MMM", { locale: fr });
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

// ── Patch payload ─────────────────────────────────────────────────────────────
export interface OrderPatch {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  tailleDTFAr?: string;
}

// ── VisualTile — image ou code DTF ───────────────────────────────────────────
function VisualTile({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "#aeaeb2",
      }}>
        {label}
      </span>
      {isDtfCode(src) ? (
        <div
          className="w-full flex items-center justify-center bg-gray-50 font-mono text-center px-2"
          style={{
            height: 72, fontSize: 12, fontWeight: 700, color: "#3a3a3c",
            borderRadius: 12, border: "1px solid #E5E5E5",
            overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {src}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          className="w-full object-contain bg-white"
          style={{ height: 72, borderRadius: 12, border: "1px solid #E5E5E5" }}
        />
      )}
    </div>
  );
}

// ── PaymentBadge ──────────────────────────────────────────────────────────────
function PaymentBadge({ status }: { status: string }) {
  const paid = status === "PAID";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600,
      color: paid ? "#34C759" : "#FF3B30",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: paid ? "#34C759" : "#FF3B30",
        display: "inline-block", flexShrink: 0,
      }} />
      {paid ? "Payé" : "Non payé"}
    </span>
  );
}

// ── PrintModal ────────────────────────────────────────────────────────────────
function PrintModal({
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
  const currency = (order.currency as string) ?? "EUR";
  const qrValue = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });

  const nameParts = (order.customerName ?? "").trim().split(/\s+/);
  const prenom = nameParts[0] ?? "";
  const nom = nameParts.slice(1).join(" ") || prenom;

  const logoAvant = extra.fiche?.visuelAvant ?? images[0] ?? null;
  const logoArriere = extra.fiche?.visuelArriere ?? images[1] ?? null;
  const deadlineTxt = deadlineLabel(extra.limit);
  const prt = extra.prt;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px]"
      onClick={onClose}
    >
      {/* CSS print : masque tout l'UI, agrandit les visuels */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-print-sheet, .olda-print-sheet * { visibility: visible !important; }
          .olda-print-sheet {
            position: fixed !important;
            inset: 0 !important;
            padding: 1.5cm 2cm !important;
            background: white !important;
            font-family: ${SF.replace(/'/g, '"')} !important;
            display: block !important;
          }
          .olda-print-visuals {
            display: flex !important;
            gap: 2cm !important;
            justify-content: center !important;
            margin: 0.8cm 0 !important;
          }
          .olda-print-visuals img,
          .olda-print-visuals .olda-print-dtf {
            width: 44% !important;
            max-height: 10cm !important;
            object-fit: contain !important;
            border-radius: 8px !important;
            border: 1px solid #E5E5E5 !important;
          }
          .olda-print-dtf {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #f8f8f8 !important;
            font-size: 18pt !important;
            font-weight: 700 !important;
          }
        }
      `}</style>

      <div
        className="w-full max-w-lg bg-white rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.18)] border border-[#E5E5E5] overflow-hidden max-h-[92svh] overflow-y-auto"
        style={{ fontFamily: SF }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-[#E5E5E5]">
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>
              Bon de Commande · {formattedDate}
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", marginTop: 2 }}>
              {extra.reference || order.orderNumber}
            </p>
            {extra.fiche?.tailleDTFAr && (
              <p style={{ fontSize: 13, color: "#8e8e93", marginTop: 2 }}>
                {extra.fiche.tailleDTFAr}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Imprimer"
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

        {/* ══ Fiche imprimable ══════════════════════════════════════════════════ */}
        <div className="olda-print-sheet">
          {/* Identité + QR */}
          <div className="px-5 pt-5 flex items-start gap-4">
            {origin && (
              <div className="shrink-0 rounded-xl border border-[#E5E5E5] p-1.5 bg-white">
                <QRCodeSVG value={qrValue} size={88} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              {nom && <p style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", textTransform: "uppercase", letterSpacing: "0.02em" }}>{nom}</p>}
              {prenom && prenom !== nom && <p style={{ fontSize: 14, color: "#3a3a3c" }}>{prenom}</p>}
              {order.customerPhone && <p style={{ fontSize: 13, color: "#8e8e93" }}>{order.customerPhone}</p>}
              {deadlineTxt && (
                <p style={{ fontSize: 12, fontWeight: 500, color: deadlineTxt.includes("Retard") ? "#FF3B30" : "#636366" }}>
                  {deadlineTxt}
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <PaymentBadge status={order.paymentStatus} />
              {order.total > 0 && (
                <p style={{ fontSize: 22, fontWeight: 700, color: "#1d1d1f" }} className="tabular-nums">
                  {fmtPrice(order.total, currency)}
                </p>
              )}
            </div>
          </div>

          {/* Infos produit */}
          {(extra.fiche?.typeProduit || extra.fiche?.couleur || extra.fiche?.tailleDTFAr || extra.taille) && (
            <div className="px-5 pt-3 flex items-center gap-3 flex-wrap">
              {[extra.fiche?.typeProduit, extra.fiche?.couleur, extra.fiche?.tailleDTFAr, extra.taille]
                .filter(Boolean)
                .map((val, i) => (
                  <span key={i} style={{ fontSize: 13, color: "#3a3a3c", fontWeight: 500 }}>{val}</span>
                ))}
            </div>
          )}

          {/* Séparateur */}
          <div className="mx-5 mt-4 h-px bg-[#E5E5E5]" />

          {/* ── Visuels agrandis pour l'atelier ── */}
          {(logoAvant || logoArriere) ? (
            <div className="olda-print-visuals px-5 pt-4 flex gap-4">
              {([{ src: logoAvant, label: "Avant" }, { src: logoArriere, label: "Arrière" }] as { src: string | null; label: string }[])
                .filter(v => v.src)
                .map(({ src, label }) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-2">
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>
                      {label}
                    </p>
                    {isDtfCode(src!) ? (
                      <div
                        className="olda-print-dtf w-full flex items-center justify-center rounded-2xl border border-[#E5E5E5] bg-gray-50 font-mono text-center px-4"
                        style={{ minHeight: 140, fontSize: 17, fontWeight: 700, color: "#3a3a3c" }}
                      >
                        {src}
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src!}
                        alt={label}
                        className="w-full object-contain rounded-2xl border border-[#E5E5E5] bg-white"
                        style={{ maxHeight: 240 }}
                      />
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <label className="mx-5 mt-4 flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed border-[#E5E5E5] cursor-pointer hover:bg-gray-50 transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <Upload className="h-5 w-5 text-gray-400" />
              <span style={{ fontSize: 13, color: "#8e8e93" }}>Ajouter Avant + Arrière</span>
            </label>
          )}

          {/* Infos secondaires + PRT */}
          <div className="px-5 pt-4 pb-5 flex flex-col gap-1">
            {extra.collection && <p style={{ fontSize: 12, color: "#636366" }}>{extra.collection}</p>}
            {extra.reference && <p style={{ fontSize: 11, color: "#aeaeb2", fontFamily: "monospace" }}>{extra.reference}</p>}
            {order.notes?.trim() && <p style={{ fontSize: 12, color: "#636366", fontStyle: "italic" }}>{order.notes}</p>}
            {prt && Object.values(prt).some(v => v) && (
              <div className="mt-2 rounded-xl bg-gray-50 border border-[#E5E5E5] px-3 py-2 flex items-center gap-3 flex-wrap">
                {[prt.refPrt, prt.taillePrt, prt.quantite && `×${prt.quantite}`]
                  .filter(Boolean)
                  .map((v, i) => (
                    <span key={i} style={{ fontSize: 12, color: "#3a3a3c", fontWeight: 600, fontFamily: "monospace" }}>{v}</span>
                  ))}
              </div>
            )}
          </div>
        </div>
        {/* ══ fin fiche ════════════════════════════════════════════════════════ */}
      </div>
    </div>
  );
}

// ── Modal édition ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-[#E5E5E5] bg-gray-50 px-3 py-2 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";

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
  const [dtf,    setDtf]    = useState(extra.fiche?.tailleDTFAr ?? "");
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
      tailleDTFAr:   dtf   || undefined,
    };
    try {
      await fetch(`/api/orders/${order.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:  patch.customerName,
          customerPhone: patch.customerPhone,
          notes:         patch.notes,
          ...(patch.tailleDTFAr ? { shippingAddressPatch: { tailleDTFAr: patch.tailleDTFAr } } : {}),
        }),
      });
      onSaved(patch);
      onClose();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] border border-[#E5E5E5] overflow-hidden"
        style={{ fontFamily: SF }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#E5E5E5]">
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1d1d1f" }}>Modifier la commande</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire…" rows={3} className={inputCls + " resize-none"} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-10 rounded-xl bg-gray-900 text-[14px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TshirtOrderCard ───────────────────────────────────────────────────────────
export function TshirtOrderCard({ order: initialOrder, isNew, onDelete, compact }: {
  order: Order;
  isNew?: boolean;
  onDelete?: () => void;
  /** Mode compact : réduit padding + fonts ~10% quand colonne dense (>5 items) */
  compact?: boolean;
}) {
  const [order, setOrder] = useState(initialOrder);

  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";
  const origin   = useOrigin();
  const extra    = readExtra(order);

  // Séparation prénom / nom — convention "Prénom NOM"
  const nameParts = (order.customerName ?? "").trim().split(/\s+/);
  const prenom    = nameParts[0] ?? "";
  const nom       = nameParts.slice(1).join(" ") || prenom;

  // Visuels : extra d'abord, fallback images items/locales
  const serverImages  = items.filter((i: OrderItem) => i.imageUrl && !isDtfCode(i.imageUrl)).map((i: OrderItem) => i.imageUrl as string).slice(0, 2);
  const { localImages, addImage } = useLocalImages(order.id);
  const displayImages = serverImages.length > 0 ? serverImages : localImages;

  const visualAvant    = extra.fiche?.visuelAvant   ?? displayImages[0] ?? null;
  const visualArriere  = extra.fiche?.visuelArriere ?? displayImages[1] ?? null;
  const hasVisuals     = !!(visualAvant || visualArriere);

  const [modalOpen,     setModalOpen]     = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [showOrderId,   setShowOrderId]   = useState(false);
  const [accordeonOpen, setAccordeonOpen] = useState(false);

  const qrValue    = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;
  const deadlineTxt = deadlineLabel(extra.limit);
  const prt         = extra.prt;
  const qrSize      = compact ? 50 : 60;

  const hasAccordeonContent = !!(
    extra.collection || extra.reference || extra.taille ||
    order.notes?.trim() || (prt && Object.values(prt).some(v => v))
  );

  const handleSaved = (patch: OrderPatch) => {
    setOrder((prev) => {
      const next = { ...prev };
      if (patch.customerName  !== undefined) next.customerName  = patch.customerName;
      if (patch.customerPhone !== undefined) next.customerPhone = patch.customerPhone;
      if (patch.notes         !== undefined) next.notes         = patch.notes;
      if (patch.tailleDTFAr) {
        const sa = (prev.shippingAddress as Record<string, unknown>) ?? {};
        const prevFiche = (sa.fiche as Record<string, unknown>) ?? {};
        next.shippingAddress = { ...sa, fiche: { ...prevFiche, tailleDTFAr: patch.tailleDTFAr }, _source: "olda_studio" };
      }
      return next;
    });
  };

  // ── Swipe-to-dismiss (Apple-style) ──────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.3, 1, 0.3]);
  const bgOpacity = useTransform(
    x,
    [-150, -30, 0, 30, 150],
    [0.15, 0.06, 0, 0.06, 0.15]
  );

  const handleCardDragEnd = (_: any, info: any) => {
    const cardWidth = cardRef.current?.offsetWidth ?? 300;
    const threshold = cardWidth * 0.5;
    const offset = info.offset.x;

    if (onDelete && Math.abs(offset) > threshold) {
      // Seuil atteint → suppression
      navigator.vibrate?.(40);
      animate(x, offset > 0 ? 800 : -800, { duration: 0.2 });
      setTimeout(onDelete, 180);
    } else {
      // Ressort de retour
      animate(x, 0, {
        type: "spring",
        stiffness: 400,
        damping: 30,
      });
    }
  };

  return (
    <>
      {/* ── Card shell ── */}
      <div className="relative overflow-hidden" style={{ borderRadius: 18 }}>
        {/* Fond rouge derrière (swipe feedback) */}
        <motion.div
          className="absolute inset-0 bg-red-500 rounded-[18px]"
          style={{ opacity: bgOpacity, zIndex: 0 }}
        />

        {/* Carte swipeable */}
        <motion.div
          ref={cardRef}
          className={cn(
            "relative group/card bg-white overflow-hidden flex flex-col z-[1]",
            "transition-shadow duration-200 select-none [touch-action:manipulation]",
            "shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
            isNew
              ? "border border-blue-400/60 ring-2 ring-blue-400/20 animate-fade-up"
              : "border border-[#E5E5E5]",
          )}
          style={{ borderRadius: 18, fontFamily: SF, x, opacity }}
          drag={onDelete ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={handleCardDragEnd}
        >
        {/* ── Action buttons — visibles au hover ── */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
            title="Imprimer"
            className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Printer className="h-2.5 w-2.5 text-gray-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            title="Modifier"
            className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Pencil className="h-2.5 w-2.5 text-gray-400" />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Supprimer"
              className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <X className="h-2.5 w-2.5" style={{ color: "#FF3B30" }} />
            </button>
          )}
        </div>

        {/* ══ SECTION 1 : Header — QR + Identité ══════════════════════════════ */}
        <div className={cn("flex items-start gap-3", compact ? "p-2.5" : "p-3")}>
          {/* QR Code — clic révèle l'ID */}
          {origin && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div
                className="rounded-lg border border-[#E5E5E5] p-[3px] cursor-pointer hover:border-gray-400 transition-colors bg-white"
                onClick={(e) => { e.stopPropagation(); setShowOrderId(!showOrderId); }}
                title="Voir l'ID"
              >
                <QRCodeSVG value={qrValue} size={qrSize} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
              {showOrderId && (
                <p
                  className="font-mono text-center"
                  style={{ fontSize: 7, color: "#aeaeb2", maxWidth: qrSize + 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={order.id}
                >
                  {order.id}
                </p>
              )}
            </div>
          )}

          {/* Identité — zéro label, zéro ligne vide */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
            {nom && (
              <p className="truncate" style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: "#1d1d1f", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.2 }}>
                {nom}
              </p>
            )}
            {prenom && prenom !== nom && (
              <p className="truncate" style={{ fontSize: compact ? 12 : 13, color: "#3a3a3c", lineHeight: 1.2 }}>
                {prenom}
              </p>
            )}
            {order.customerPhone && (
              <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#8e8e93" }}>
                {order.customerPhone}
              </p>
            )}
            {deadlineTxt && (
              <p className="truncate" style={{ fontSize: compact ? 10 : 11, fontWeight: 500, color: deadlineTxt.includes("Retard") ? "#FF3B30" : "#636366" }}>
                {deadlineTxt}
              </p>
            )}
          </div>
        </div>

        {/* ══ SECTION 2 : Visuels DTF côte à côte ══════════════════════════════ */}
        {hasVisuals && (
          <div className={cn("flex gap-2", compact ? "px-2.5 pb-2" : "px-3 pb-2.5")}>
            {visualAvant   && <VisualTile src={visualAvant}   label="Avant"   />}
            {visualArriere && <VisualTile src={visualArriere} label="Arrière" />}
          </div>
        )}

        {/* ══ SECTION 3 : Infos immédiates — typeProduit · couleur · tailleDTFAr ══ */}
        {(extra.fiche?.typeProduit || extra.fiche?.couleur || extra.fiche?.tailleDTFAr) && (
          <div className={cn("flex flex-col", compact ? "px-2.5 pb-1.5 gap-0.5" : "px-3 pb-2 gap-1")}>
            {extra.fiche?.typeProduit && (
              <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#3a3a3c", fontWeight: 500 }}>
                {extra.fiche?.typeProduit}
              </p>
            )}
            {extra.fiche?.couleur && (
              <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#636366" }}>
                {extra.fiche?.couleur}
              </p>
            )}
            {extra.fiche?.tailleDTFAr && (
              <p className="truncate font-mono" style={{ fontSize: compact ? 11 : 12, color: "#636366", fontWeight: 600 }}>
                {extra.fiche?.tailleDTFAr}
              </p>
            )}
          </div>
        )}

        {/* ══ SECTION 4 : Footer — Prix total ══════════════════════════════════ */}
        {order.total > 0 && (
          <div className={cn("flex items-center justify-end border-t border-[#E5E5E5]", compact ? "px-2.5 py-1.5" : "px-3 py-2")}>
            <p className="tabular-nums" style={{
              fontSize: compact ? 15 : 17,
              fontWeight: 700,
              color: order.paymentStatus === "PAID" ? "#34C759" : "#FF3B30",
            }}>
              {fmtPrice(order.total, currency)}
            </p>
          </div>
        )}

        {/* ══ Chevron accordéon — affiché seulement si contenu disponible ══════ */}
        {hasAccordeonContent && (
          <button
            onClick={() => setAccordeonOpen(!accordeonOpen)}
            className="w-full flex items-center justify-center py-1.5 border-t border-[#E5E5E5] hover:bg-gray-50/80 transition-colors"
          >
            <ChevronDown
              className="h-3.5 w-3.5 text-gray-400 transition-transform duration-300"
              style={{ transform: accordeonOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}

        {/* ══ Accordéon CSS natif ═══════════════════════════════════════════════ */}
        <div
          style={{
            maxHeight: accordeonOpen ? "320px" : "0px",
            overflow: "hidden",
            transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div className={cn(
            "flex flex-col border-t border-[#E5E5E5]",
            compact ? "px-2.5 py-2 gap-1" : "px-3 py-2.5 gap-1.5",
          )}>
            {extra.collection && (
              <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#636366" }}>
                {extra.collection}
              </p>
            )}
            {extra.reference && (
              <p className="truncate font-mono" style={{ fontSize: compact ? 10 : 11, color: "#aeaeb2" }}>
                {extra.reference}
              </p>
            )}
            {extra.taille && (
              <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#3a3a3c", fontWeight: 600 }}>
                {extra.taille}
              </p>
            )}
            {order.notes?.trim() && (
              <p className="truncate italic" style={{ fontSize: compact ? 10 : 11, color: "#636366" }} title={order.notes}>
                {order.notes}
              </p>
            )}
            {/* Bloc PRT */}
            {prt && Object.values(prt).some(v => v) && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[prt.refPrt, prt.taillePrt, prt.quantite && `×${prt.quantite}`]
                  .filter(Boolean)
                  .map((v, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono"
                      style={{ fontSize: compact ? 9 : 10, color: "#3a3a3c", fontWeight: 600 }}
                    >
                      {v}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
        </motion.div>
      </div>

      {/* ── Modals ── */}
      {editOpen && (
        <EditOrderModal
          order={order}
          extra={extra}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {modalOpen && (
        <PrintModal
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
