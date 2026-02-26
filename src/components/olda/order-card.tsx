"use client";

/**
 * OrderCard — Composant carte de commande atelier (Design Apple)
 * Architecture panier multi-articles : lit depuis order.items (colonnes DB dédiées).
 *
 * VUE PRINCIPALE (toujours visible) :
 *   QR Code | Identité client | Deadline | Visuels Avant/Arrière par article
 *   Note client | Facturation compacte
 *
 * VUE DÉTAILLÉE (accordéon, divide-y) :
 *   [1] Infos Atelier   — .map() sur order.items avec séparateurs
 *   [2] Contact         — email, téléphone, adresse, deadline
 *   [3] Facturation     — total coloré + statut paiement
 */

import { useState, useEffect, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, Package, Users, CreditCard, MapPin } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem } from "@/types/order";

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => {
    setO(typeof window !== "undefined" ? window.location.origin : "");
  }, []);
  return o;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number | undefined | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function isDtfCode(s: string | undefined | null): boolean {
  if (!s) return false;
  return !s.startsWith("http") && !s.startsWith("data:");
}

type DeadlineState = "overdue" | "today" | "tomorrow" | "soon" | "normal";

function getDeadlineInfo(
  limit: string | Date | undefined | null
): { label: string; state: DeadlineState; fullDate: string } | null {
  if (!limit) return null;
  try {
    const d = new Date(limit as string);
    if (isNaN(d.getTime())) return { label: String(limit), state: "normal", fullDate: String(limit) };
    const diff = differenceInCalendarDays(d, new Date());
    const fullDate = format(d, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    if (diff < 0) return { label: `En retard de ${Math.abs(diff)} jour(s)`, state: "overdue", fullDate };
    if (diff === 0) return { label: "Aujourd'hui !", state: "today", fullDate };
    if (diff === 1) return { label: "Demain", state: "tomorrow", fullDate };
    if (diff <= 3) return { label: `Dans ${diff} jours`, state: "soon", fullDate };
    return { label: `Dans ${diff} jours`, state: "normal", fullDate };
  } catch {
    return { label: String(limit), state: "normal", fullDate: String(limit) };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeadlineBadge({ label, state }: { label: string; state: DeadlineState }) {
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none border";
  const styles: Record<DeadlineState, string> = {
    overdue:  "bg-red-50 text-red-600 border-red-200",
    today:    "bg-orange-50 text-orange-600 border-orange-200",
    tomorrow: "bg-amber-50 text-amber-600 border-amber-200",
    soon:     "bg-blue-50 text-blue-600 border-blue-200",
    normal:   "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <span className={`${base} ${styles[state]}`}>
      {state === "overdue" && <span>⚠️</span>}
      {state === "today"   && <span className="block w-1.5 h-1.5 rounded-full bg-orange-500" />}
      {label}
    </span>
  );
}

function VisualThumbnail({ src, label, isDtf }: { src: string; label: string; isDtf: boolean }) {
  return (
    <div className="relative pt-3">
      <span className="absolute top-0 left-1 z-10 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
        {label}
      </span>
      {isDtf ? (
        <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center p-1.5 text-[8px] font-mono text-gray-600 text-center overflow-hidden leading-tight">
          {src}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="w-16 h-16 rounded-xl border border-gray-200 object-cover" />
      )}
    </div>
  );
}

function EmptyBackIndicator() {
  return (
    <div className="relative pt-3">
      <span className="absolute top-0 left-1 z-10 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
        Arrière
      </span>
      <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 flex flex-col items-center justify-center gap-0.5">
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider">Dos</span>
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider">vierge</span>
      </div>
    </div>
  );
}

function SectionHeading({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
      <span className="text-gray-400">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function InfoCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm text-gray-900", bold ? "font-bold" : "font-medium")}>{value}</span>
    </div>
  );
}

function DlEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function PriceRow({ label, value, total, paid }: { label: string; value: string; total?: boolean; paid?: boolean }) {
  if (total) {
    return (
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-200">
        <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Total</span>
        <span className={cn("text-base font-bold font-mono", paid ? "text-green-600" : "text-red-500")}>{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-gray-900 font-mono">{value}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OrderCardProps {
  order: Order;
  isNew?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function OrderCard({ order, isNew }: OrderCardProps) {
  const origin = useOrigin();
  const [isOpen, setIsOpen] = useState(false);

  const items    = Array.isArray(order.items) ? order.items : [];
  const isPaid   = order.paymentStatus === "PAID";
  const deadline = getDeadlineInfo(order.deadline);

  // QR code value
  const qrValue = origin && order.id
    ? `${origin}/dashboard/orders/${order.id}`
    : order.orderNumber || "olda";

  // Premier article pour visuels résumé
  const firstItem = items[0] ?? null;

  // Visibilité accordéon
  const hasBlock1 = items.some(item =>
    item.famille || item.couleur || item.tailleDTF || item.collection || item.taille || item.noteClient || item.prtRef
  );
  const hasBlock2 = !!(order.customerEmail || order.customerAddress || order.customerPhone || order.deadline);
  const hasBlock3 = order.total > 0;
  const hasAccordion = hasBlock1 || hasBlock2 || hasBlock3;

  return (
    <>
      {/* ── Print ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-card-print, .olda-card-print * { visibility: visible !important; }
          .olda-card-print {
            position: fixed !important; inset: 0 !important; padding: 1cm !important;
            background: white !important; width: 21cm !important; height: 29.7cm !important;
            display: flex !important; flex-direction: column !important;
            align-items: center !important; justify-content: center !important;
          }
          .olda-card-print img { width: 50% !important; height: auto !important; margin: 1cm auto !important; }
        }
      `}</style>

      <div className="olda-card-print hidden print:block">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{order.customerFirstName} {order.customerName}</h1>
          {order.customerPhone && <p className="text-sm text-gray-600">{order.customerPhone}</p>}
          {firstItem?.imageAvant && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">AVANT</p>
              {isDtfCode(firstItem.imageAvant)
                ? <div className="border border-gray-300 p-2 rounded text-sm font-mono">{firstItem.imageAvant}</div>
                : <img src={firstItem.imageAvant} alt="Avant" className="max-h-40" />
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Écran ── */}
      <div className="print:hidden">
        <div className={cn(
          "rounded-[18px] border bg-white p-4",
          "shadow-[0_1px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)]",
          "transition-all duration-200",
          isNew ? "border-blue-400 ring-2 ring-blue-100" : "border-[#E5E5E5]",
        )}>
          {/* Badge nouveau */}
          {isNew && (
            <div className="flex justify-end mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Nouveau
              </span>
            </div>
          )}

          {/* Header: QR + Identité */}
          <div className="flex gap-4 items-start">
            {order.orderNumber && (
              <div className="shrink-0">
                <div className="w-[108px] h-[108px] border border-gray-200 rounded-xl p-1.5 flex items-center justify-center bg-white">
                  <QRCodeSVG value={qrValue} size={92} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
              {/* Identité */}
              <div>
                {order.customerName && (
                  <p className="text-sm font-bold uppercase tracking-wide leading-tight text-gray-900 truncate">
                    {order.customerName}
                  </p>
                )}
                {order.customerFirstName && (
                  <p className="text-sm font-medium text-gray-600 leading-tight truncate">
                    {order.customerFirstName}
                  </p>
                )}
                {order.customerPhone && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{order.customerPhone}</p>
                )}
              </div>

              {/* Deadline + N° commande */}
              {(deadline || order.orderNumber) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {deadline && <DeadlineBadge label={deadline.label} state={deadline.state} />}
                  {order.orderNumber && (
                    <span className="text-[11px] text-gray-400 font-mono">{order.orderNumber}</span>
                  )}
                </div>
              )}

              {/* Visuels — un bloc par article, avec séparateurs */}
              {items.some(item => item.imageAvant || item.imageArriere) && (
                <div className="flex flex-col gap-2">
                  {items.map((item, i) => {
                    const av  = item.imageAvant  ?? null;
                    const arr = item.imageArriere ?? null;
                    if (!av && !arr) return null;
                    return (
                      <div key={item.id ?? i}>
                        {items.length > 1 && (
                          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            {item.reference || `Article ${i + 1}`}
                          </p>
                        )}
                        <div className="flex items-start gap-2.5">
                          {av
                            ? <VisualThumbnail src={av} label="Avant" isDtf={isDtfCode(av)} />
                            : <EmptyBackIndicator />
                          }
                          {arr
                            ? <VisualThumbnail src={arr} label="Arrière" isDtf={isDtfCode(arr)} />
                            : av ? <EmptyBackIndicator /> : null
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Note (premier article) */}
              {firstItem?.noteClient && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-px select-none">📝</span>
                  <p className="text-xs italic text-gray-500 leading-snug break-words min-w-0">
                    {firstItem.noteClient}
                  </p>
                </div>
              )}

              {/* Facturation compacte */}
              {order.total > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Total</span>
                    <span className={cn("text-sm font-bold font-mono", isPaid ? "text-green-600" : "text-red-500")}>
                      {order.total.toLocaleString("fr-FR", { style: "currency", currency: order.currency ?? "EUR", minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bouton accordéon */}
          {hasAccordion && (
            <div className="flex justify-center mt-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5 px-2 rounded-full hover:bg-gray-50"
                aria-expanded={isOpen}
              >
                <span className="font-medium">{isOpen ? "Réduire" : "Détails production"}</span>
                <ChevronDown size={13} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
              </button>
            </div>
          )}
        </div>

        {/* ══ ACCORDÉON ═══════════════════════════════════════════════════════ */}
        {isOpen && (
          <div className="rounded-b-2xl border border-t-0 border-gray-200 bg-gray-50 p-6 space-y-6">

            {/* BLOC 1 — INFOS ATELIER : .map() sur order.items avec divide-y */}
            {hasBlock1 && (
              <section>
                <SectionHeading icon={<Package size={14} />} label="Infos Atelier" />
                <div className="mt-4 divide-y divide-gray-100">
                  {items.map((item: OrderItem, i) => (
                    <div key={item.id ?? i} className={i > 0 ? "pt-4 pb-2" : "pb-2"}>
                      {items.length > 1 && (
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                          Article {i + 1}{item.reference ? ` · ${item.reference}` : ""}
                        </p>
                      )}

                      {/* Grille 2 colonnes */}
                      {(item.famille || item.couleur || item.tailleDTF || item.collection || item.taille) && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {item.famille    && <InfoCell label="Famille"    value={item.famille} />}
                          {item.couleur    && <InfoCell label="Couleur"    value={item.couleur} />}
                          {item.tailleDTF  && <InfoCell label="Taille DTF" value={item.tailleDTF} bold />}
                          {item.collection && <InfoCell label="Collection" value={item.collection} />}
                          {item.taille     && <InfoCell label="Taille"     value={item.taille} />}
                          {item.positionLogo && <InfoCell label="Position Logo" value={item.positionLogo} />}
                        </div>
                      )}

                      {/* Note client */}
                      {item.noteClient && (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Note client</p>
                          <p className="text-sm font-medium text-gray-800 italic leading-relaxed break-words">{item.noteClient}</p>
                        </div>
                      )}

                      {/* PRT */}
                      {(item.prtRef || item.prtTaille || item.prtQuantite != null) && (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Impression (PRT)</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {item.prtRef     && <InfoCell label="Référence"        value={item.prtRef} />}
                            {item.prtTaille  && <InfoCell label="Taille impression" value={item.prtTaille} />}
                            {item.prtQuantite != null && <InfoCell label="Quantité" value={String(item.prtQuantite)} bold />}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* BLOC 2 — CONTACT */}
            {hasBlock2 && (
              <section>
                <SectionHeading icon={<Users size={14} />} label="Livraison & Contact" />
                <dl className="mt-4 space-y-3">
                  {order.customerPhone && <DlEntry label="Téléphone">{order.customerPhone}</DlEntry>}
                  {order.customerEmail && order.customerEmail !== "olda@studio" && (
                    <DlEntry label="Email">{order.customerEmail}</DlEntry>
                  )}
                  {order.customerAddress && (
                    <DlEntry label="Adresse">
                      <span className="flex items-start gap-1">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-line">{order.customerAddress}</span>
                      </span>
                    </DlEntry>
                  )}
                  {deadline && (
                    <DlEntry label="Date limite">
                      <div className="flex flex-col gap-1">
                        <DeadlineBadge label={deadline.label} state={deadline.state} />
                        <span className="text-xs text-gray-400 mt-0.5">{deadline.fullDate}</span>
                      </div>
                    </DlEntry>
                  )}
                </dl>
              </section>
            )}

            {/* BLOC 3 — FACTURATION */}
            {hasBlock3 && (
              <section>
                <SectionHeading icon={<CreditCard size={14} />} label="Facturation" />
                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
                  {order.subtotal > 0 && order.subtotal !== order.total && (
                    <PriceRow label="Sous-total" value={fmtPrice(order.subtotal * 100)} />
                  )}
                  <PriceRow label="Total" value={
                    order.total.toLocaleString("fr-FR", { style: "currency", currency: order.currency ?? "EUR", minimumFractionDigits: 2 })
                  } total paid={isPaid} />
                  <div className="flex justify-end pt-1">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                      isPaid
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-red-50 text-red-500 border-red-200"
                    )}>
                      {isPaid ? "✓ Commande payée" : "✗ Paiement en attente"}
                    </span>
                  </div>
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </>
  );
}
