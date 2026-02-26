"use client";

/**
 * TshirtOrderCard — Apple Premium · Architecture panier multi-articles
 * ─ Lit les données depuis order.items (colonnes dédiées, plus de JSONB)
 * ─ Bulle fermée : QR + identité + visuels DTF + infos production + prix
 * ─ Accordéon : collection, référence, taille, note, bloc PRT par article
 * ─ Print modal : visuels agrandis, masquage total UI dashboard
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { X, Upload, Printer, Pencil, ChevronDown } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem, OldaArticle } from "@/types/order";

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

function deadlineLabel(deadline: string | Date | null | undefined): string | null {
  if (!deadline) return null;
  try {
    const d = new Date(deadline as string);
    if (isNaN(d.getTime())) return String(deadline);
    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0)   return `⚠️ Retard ${Math.abs(diff)}j`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return format(d, "d MMM", { locale: fr });
  } catch { return String(deadline); }
}

function isDtfCode(s: string | undefined | null): boolean {
  if (!s) return false;
  return !s.startsWith("http") && !s.startsWith("data:");
}

/**
 * Convertit order.items (colonnes DB) en tableau d'articles OldaArticle pour le rendu.
 * Si aucun item, tente un fallback sur les images locales.
 */
function itemsToArticles(items: OrderItem[], fallbackImages: string[]): OldaArticle[] {
  if (items.length > 0) {
    return items.map((item) => ({
      reference:  item.reference  ?? undefined,
      taille:     item.taille     ?? undefined,
      note:       item.noteClient ?? undefined,
      collection: item.collection ?? undefined,
      fiche: {
        visuelAvant:  item.imageAvant   ?? undefined,
        visuelArriere: item.imageArriere ?? undefined,
        tailleDTFAr:  item.tailleDTF    ?? undefined,
        typeProduit:  item.famille      ?? undefined,
        couleur:      item.couleur      ?? undefined,
        positionLogo: item.positionLogo ?? undefined,
      },
      prt: (item.prtRef || item.prtTaille || item.prtQuantite != null) ? {
        refPrt:    item.prtRef    ?? undefined,
        taillePrt: item.prtTaille ?? undefined,
        quantite:  item.prtQuantite ?? undefined,
      } : undefined,
    }));
  }

  // Fallback : images uploadées localement (ancienne commande sans items)
  if (fallbackImages.length > 0) {
    return [{
      fiche: {
        visuelAvant:  fallbackImages[0],
        visuelArriere: fallbackImages[1],
      },
    }];
  }

  return [];
}

// ── Patch payload ─────────────────────────────────────────────────────────────
export interface OrderPatch {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  firstItemTailleDTF?: string;
}

// ── VisualTile — image ou code DTF ───────────────────────────────────────────
function VisualTile({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>
        {label}
      </span>
      {isDtfCode(src) ? (
        <div
          className="w-full flex items-center justify-center bg-gray-50 font-mono text-center px-2"
          style={{ height: 72, fontSize: 12, fontWeight: 700, color: "#3a3a3c", borderRadius: 12, border: "1px solid #E5E5E5", overflow: "hidden" }}
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: paid ? "#34C759" : "#FF3B30" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: paid ? "#34C759" : "#FF3B30", display: "inline-block", flexShrink: 0 }} />
      {paid ? "Payé" : "Non payé"}
    </span>
  );
}

// ── PrintModal ────────────────────────────────────────────────────────────────
function PrintModal({ order, articles, images, addImage, origin, onClose }: {
  order: Order;
  articles: OldaArticle[];
  images: string[];
  addImage: (url: string) => void;
  origin: string;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currency = order.currency ?? "EUR";
  const qrValue = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });
  const deadlineTxt = deadlineLabel(order.deadline);

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

  // Premier article pour infos en-tête
  const firstArticle = articles[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-print-sheet, .olda-print-sheet * { visibility: visible !important; }
          .olda-print-sheet {
            position: fixed !important; inset: 0 !important;
            padding: 1.5cm 2cm !important; background: white !important;
            font-family: ${SF.replace(/'/g, '"')} !important; display: block !important;
          }
          .olda-print-visuals { display: flex !important; gap: 2cm !important; justify-content: center !important; margin: 0.8cm 0 !important; }
          .olda-print-visuals img, .olda-print-visuals .olda-print-dtf { width: 44% !important; max-height: 10cm !important; object-fit: contain !important; border-radius: 8px !important; border: 1px solid #E5E5E5 !important; }
          .olda-print-dtf { display: flex !important; align-items: center !important; justify-content: center !important; background: #f8f8f8 !important; font-size: 18pt !important; font-weight: 700 !important; }
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
              {firstArticle?.reference || order.orderNumber}
            </p>
            {firstArticle?.fiche?.tailleDTFAr && (
              <p style={{ fontSize: 13, color: "#8e8e93", marginTop: 2 }}>{firstArticle.fiche.tailleDTFAr}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Imprimer">
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* ══ Fiche imprimable ═══════════════════════════════════════════════════ */}
        <div className="olda-print-sheet">
          {/* Identité + QR */}
          <div className="px-5 pt-5 flex items-start gap-4">
            {origin && (
              <div className="shrink-0 rounded-xl border border-[#E5E5E5] p-1.5 bg-white">
                <QRCodeSVG value={qrValue} size={88} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              {order.customerName && (
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  {order.customerName}
                </p>
              )}
              {order.customerFirstName && (
                <p style={{ fontSize: 14, color: "#3a3a3c" }}>{order.customerFirstName}</p>
              )}
              {order.customerPhone && (
                <p style={{ fontSize: 13, color: "#8e8e93" }}>{order.customerPhone}</p>
              )}
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

          <div className="mx-5 mt-4 h-px bg-[#E5E5E5]" />

          {/* Articles */}
          {articles.length > 0 ? (
            <div className="flex flex-col gap-4">
              {articles.map((article, i) => {
                const av  = article.fiche?.visuelAvant  ?? null;
                const arr = article.fiche?.visuelArriere ?? null;
                return (
                  <div key={i}>
                    {articles.length > 1 && (
                      <div className="mx-5 flex items-center gap-3 mt-2">
                        <div className="flex-1 h-px bg-[#E5E5E5]" />
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>
                          Article {i + 1} · {article.reference || article.fiche?.typeProduit || ""}
                        </p>
                        <div className="flex-1 h-px bg-[#E5E5E5]" />
                      </div>
                    )}
                    {(article.fiche?.typeProduit || article.fiche?.couleur || article.fiche?.tailleDTFAr || article.taille) && (
                      <div className="px-5 pt-3 flex items-center gap-3 flex-wrap">
                        {[article.fiche?.typeProduit, article.fiche?.couleur, article.fiche?.tailleDTFAr, article.taille]
                          .filter(Boolean)
                          .map((val, j) => (
                            <span key={j} style={{ fontSize: 13, color: "#3a3a3c", fontWeight: 500 }}>{val}</span>
                          ))}
                      </div>
                    )}
                    {(av || arr) ? (
                      <div className="olda-print-visuals px-5 pt-3 flex gap-4">
                        {([{ src: av, label: "Avant" }, { src: arr, label: "Arrière" }] as { src: string | null; label: string }[])
                          .filter(v => v.src)
                          .map(({ src, label }) => (
                            <div key={label} className="flex-1 flex flex-col items-center gap-2">
                              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>{label}</p>
                              {isDtfCode(src!) ? (
                                <div className="olda-print-dtf w-full flex items-center justify-center rounded-2xl border border-[#E5E5E5] bg-gray-50 font-mono text-center px-4" style={{ minHeight: 140, fontSize: 17, fontWeight: 700, color: "#3a3a3c" }}>
                                  {src}
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={src!} alt={label} className="w-full object-contain rounded-2xl border border-[#E5E5E5] bg-white" style={{ maxHeight: 200 }} />
                              )}
                            </div>
                          ))}
                      </div>
                    ) : i === 0 && articles.length === 1 ? (
                      <label className="mx-5 mt-4 flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed border-[#E5E5E5] cursor-pointer hover:bg-gray-50 transition-colors">
                        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span style={{ fontSize: 13, color: "#8e8e93" }}>Ajouter Avant + Arrière</span>
                      </label>
                    ) : null}
                    <div className="px-5 pt-2 flex flex-col gap-1">
                      {article.collection && <p style={{ fontSize: 12, color: "#636366" }}>{article.collection}</p>}
                      {article.reference && articles.length === 1 && (
                        <p style={{ fontSize: 11, color: "#aeaeb2", fontFamily: "monospace" }}>{article.reference}</p>
                      )}
                      {article.note && <p style={{ fontSize: 12, color: "#636366", fontStyle: "italic" }}>{article.note}</p>}
                      {article.prt && Object.values(article.prt).some(v => v) && (
                        <div className="mt-1 rounded-xl bg-gray-50 border border-[#E5E5E5] px-3 py-2 flex items-center gap-3 flex-wrap">
                          {[article.prt.refPrt, article.prt.taillePrt, article.prt.quantite && `×${article.prt.quantite}`]
                            .filter(Boolean)
                            .map((v, j) => (
                              <span key={j} style={{ fontSize: 12, color: "#3a3a3c", fontWeight: 600, fontFamily: "monospace" }}>{v}</span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <label className="mx-5 mt-4 flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed border-[#E5E5E5] cursor-pointer hover:bg-gray-50 transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <Upload className="h-5 w-5 text-gray-400" />
              <span style={{ fontSize: 13, color: "#8e8e93" }}>Ajouter Avant + Arrière</span>
            </label>
          )}

          {order.notes?.trim() && !articles.some(a => a.note) && (
            <div className="px-5 pt-1 pb-1">
              <p style={{ fontSize: 12, color: "#636366", fontStyle: "italic" }}>{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal édition ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-[#E5E5E5] bg-gray-50 px-3 py-2 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors";

function EditOrderModal({ order, firstItemTailleDTF, onClose, onSaved }: {
  order: Order;
  firstItemTailleDTF?: string;
  onClose: () => void;
  onSaved: (patch: OrderPatch) => void;
}) {
  const [name,   setName]   = useState(order.customerName ?? "");
  const [phone,  setPhone]  = useState(order.customerPhone ?? "");
  const [dtf,    setDtf]    = useState(firstItemTailleDTF ?? "");
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
      customerName:      name  || undefined,
      customerPhone:     phone || undefined,
      notes,
      firstItemTailleDTF: dtf || undefined,
    };
    try {
      await fetch(`/api/orders/${order.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onSaved(patch);
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px]" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] border border-[#E5E5E5] overflow-hidden" style={{ fontFamily: SF }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#E5E5E5]">
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1d1d1f" }}>Modifier la commande</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de famille" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 …" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Taille DTF AR (1er article)</label>
            <input value={dtf} onChange={(e) => setDtf(e.target.value)} placeholder="ex : 300 mm" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Note</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire…" rows={3} className={inputCls + " resize-none"} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Annuler</button>
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
  compact?: boolean;
}) {
  const [order, setOrder] = useState(initialOrder);
  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = order.currency ?? "EUR";
  const origin   = useOrigin();

  const { localImages, addImage } = useLocalImages(order.id);
  const articles   = itemsToArticles(items, localImages);
  const hasVisuals = articles.some(a => a.fiche?.visuelAvant || a.fiche?.visuelArriere);

  const [modalOpen,     setModalOpen]     = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [showOrderId,   setShowOrderId]   = useState(false);
  const [accordeonOpen, setAccordeonOpen] = useState(false);

  const qrValue    = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;
  const deadlineTxt = deadlineLabel(order.deadline);
  const qrSize      = compact ? 50 : 60;

  const hasAccordeonContent = articles.some(a =>
    a.collection || a.reference || a.taille || a.note ||
    (a.prt && Object.values(a.prt).some(v => v))
  ) || !!order.notes?.trim();

  const handleSaved = (patch: OrderPatch) => {
    setOrder((prev) => {
      const next = { ...prev };
      if (patch.customerName      !== undefined) next.customerName  = patch.customerName;
      if (patch.customerPhone     !== undefined) next.customerPhone = patch.customerPhone;
      if (patch.notes             !== undefined) next.notes         = patch.notes;
      if (patch.firstItemTailleDTF !== undefined && next.items.length > 0) {
        next.items = next.items.map((item, i) =>
          i === 0 ? { ...item, tailleDTF: patch.firstItemTailleDTF ?? null } : item
        );
      }
      return next;
    });
  };

  // ── Swipe-to-dismiss ──────────────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const opacity   = useTransform(x, [-150, 0, 150], [0.3, 1, 0.3]);
  const bgOpacity = useTransform(x, [-150, -30, 0, 30, 150], [0.15, 0.06, 0, 0.06, 0.15]);

  const handleCardDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    const cardWidth = cardRef.current?.offsetWidth ?? 300;
    const offset = info.offset.x;
    if (onDelete && Math.abs(offset) > cardWidth * 0.5) {
      navigator.vibrate?.(40);
      animate(x, offset > 0 ? 800 : -800, { duration: 0.2 });
      setTimeout(onDelete, 180);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <>
      <div className="relative overflow-hidden" style={{ borderRadius: 18 }}>
        <motion.div className="absolute inset-0 bg-red-500 rounded-[18px]" style={{ opacity: bgOpacity, zIndex: 0 }} />

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
          {/* Action buttons */}
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
            <button onClick={(e) => { e.stopPropagation(); setModalOpen(true); }} title="Imprimer" className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <Printer className="h-2.5 w-2.5 text-gray-400" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setEditOpen(true); }} title="Modifier" className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <Pencil className="h-2.5 w-2.5 text-gray-400" />
            </button>
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Supprimer" className="h-5 w-5 rounded-full flex items-center justify-center bg-white border border-[#E5E5E5] shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors">
                <X className="h-2.5 w-2.5" style={{ color: "#FF3B30" }} />
              </button>
            )}
          </div>

          {/* ══ SECTION 1 : Header — QR + Identité ══════════════════════════════ */}
          <div className={cn("flex items-start gap-3", compact ? "p-2.5" : "p-3")}>
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
                  <p className="font-mono text-center" style={{ fontSize: 7, color: "#aeaeb2", maxWidth: qrSize + 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={order.id}>
                    {order.id}
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
              {order.customerName && (
                <p className="truncate" style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: "#1d1d1f", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.2 }}>
                  {order.customerName}
                </p>
              )}
              {order.customerFirstName && (
                <p className="truncate" style={{ fontSize: compact ? 12 : 13, color: "#3a3a3c", lineHeight: 1.2 }}>
                  {order.customerFirstName}
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

          {/* ══ SECTION 2 : Visuels DTF — un bloc par article ════════════════════ */}
          {hasVisuals && (
            <div className={cn("flex flex-col gap-2.5", compact ? "px-2.5 pb-2" : "px-3 pb-2.5")}>
              {articles.map((article, i) => {
                const av  = article.fiche?.visuelAvant  ?? null;
                const arr = article.fiche?.visuelArriere ?? null;
                if (!av && !arr) return null;
                return (
                  <div key={i}>
                    {articles.length > 1 && (
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2", marginBottom: 4 }}>
                        {article.reference || `Article ${i + 1}`}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {av  && <VisualTile src={av}  label="Avant"   />}
                      {arr && <VisualTile src={arr} label="Arrière" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ SECTION 3 : Infos produit ════════════════════════════════════════ */}
          {articles.some(a => a.fiche?.typeProduit || a.fiche?.couleur || a.fiche?.tailleDTFAr || a.taille) && (
            <div className={cn("flex flex-col", compact ? "px-2.5 pb-1.5 gap-1" : "px-3 pb-2 gap-1.5")}>
              {articles.map((article, i) => {
                const hasInfo = article.fiche?.typeProduit || article.fiche?.couleur || article.fiche?.tailleDTFAr || article.taille;
                if (!hasInfo) return null;
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    {articles.length > 1 && !(article.fiche?.visuelAvant || article.fiche?.visuelArriere) && (
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aeaeb2" }}>
                        {article.reference || `Article ${i + 1}`}
                      </p>
                    )}
                    {article.fiche?.typeProduit && (
                      <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#3a3a3c", fontWeight: 500 }}>{article.fiche.typeProduit}</p>
                    )}
                    {article.fiche?.couleur && (
                      <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#636366" }}>{article.fiche.couleur}</p>
                    )}
                    {article.fiche?.tailleDTFAr && (
                      <p className="truncate font-mono" style={{ fontSize: compact ? 11 : 12, color: "#636366", fontWeight: 600 }}>{article.fiche.tailleDTFAr}</p>
                    )}
                    {article.taille && (
                      <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#636366" }}>{article.taille}</p>
                    )}
                    {articles.length > 1 && i < articles.length - 1 && (
                      <div style={{ height: 1, background: "#F2F2F7", margin: "4px 0" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ SECTION 4 : Footer — Prix total ══════════════════════════════════ */}
          {order.total > 0 && (
            <div className={cn("flex items-center justify-end border-t border-[#E5E5E5]", compact ? "px-2.5 py-1.5" : "px-3 py-2")}>
              <p className="tabular-nums" style={{ fontSize: compact ? 15 : 17, fontWeight: 700, color: order.paymentStatus === "PAID" ? "#34C759" : "#FF3B30" }}>
                {fmtPrice(order.total, currency)}
              </p>
            </div>
          )}

          {/* ══ Chevron accordéon ════════════════════════════════════════════════ */}
          {hasAccordeonContent && (
            <button
              onClick={() => setAccordeonOpen(!accordeonOpen)}
              className="w-full flex items-center justify-center py-1.5 border-t border-[#E5E5E5] hover:bg-gray-50/80 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform duration-300" style={{ transform: accordeonOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
          )}

          {/* ══ Accordéon détaillé ════════════════════════════════════════════════ */}
          <div style={{ maxHeight: accordeonOpen ? "320px" : "0px", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
            <div className={cn("flex flex-col border-t border-[#E5E5E5] divide-y divide-[#F2F2F7]", compact ? "px-2.5 py-2 gap-1" : "px-3 py-2.5 gap-1.5")}>
              {articles.map((article, i) => (
                <div key={i} className={cn("flex flex-col gap-1", i > 0 && "pt-1.5")}>
                  {articles.length > 1 && (
                    <p style={{ fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8e8e93" }}>
                      Article {i + 1}{article.reference ? ` · ${article.reference}` : ""}
                    </p>
                  )}
                  {article.collection && (
                    <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#636366" }}>{article.collection}</p>
                  )}
                  {article.reference && articles.length === 1 && (
                    <p className="truncate font-mono" style={{ fontSize: compact ? 10 : 11, color: "#aeaeb2" }}>{article.reference}</p>
                  )}
                  {article.taille && (
                    <p className="truncate" style={{ fontSize: compact ? 11 : 12, color: "#3a3a3c", fontWeight: 600 }}>{article.taille}</p>
                  )}
                  {article.note && (
                    <p className="truncate italic" style={{ fontSize: compact ? 10 : 11, color: "#636366" }} title={article.note}>{article.note}</p>
                  )}
                  {article.prt && Object.values(article.prt).some(v => v) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {[article.prt.refPrt, article.prt.taillePrt, article.prt.quantite && `×${article.prt.quantite}`]
                        .filter(Boolean)
                        .map((v, j) => (
                          <span key={j} className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono" style={{ fontSize: compact ? 9 : 10, color: "#3a3a3c", fontWeight: 600 }}>
                            {v}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
              {order.notes?.trim() && !articles.some(a => a.note) && (
                <p className="truncate italic pt-1.5" style={{ fontSize: compact ? 10 : 11, color: "#636366" }} title={order.notes ?? ""}>
                  {order.notes}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      {editOpen && (
        <EditOrderModal
          order={order}
          firstItemTailleDTF={items[0]?.tailleDTF ?? undefined}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {modalOpen && (
        <PrintModal
          order={order}
          articles={articles}
          images={localImages}
          addImage={addImage}
          origin={origin}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
