"use client";

/**
 * OrderCard — Composant carte de commande atelier (Design Apple)
 *
 * VUE PRINCIPALE (toujours visible) :
 *   Layout flex horizontal : QR Code 100px | Données alignées
 *   - NOM uppercase bold + Prénom medium + Téléphone mono
 *   - Badge deadline coloré + référence commande
 *   - Miniatures visuels Avant/Arrière + indicateur DOS VIERGE
 *   - Note client 📝 toujours visible
 *   - Facturation compacte (T-shirt + Personnalisation + Total coloré)
 *
 * VUE DÉTAILLÉE (accordéon) :
 *   bg-gray-50, p-6, space-y-6, 3 blocs distincts :
 *   [1] INFOS ATELIER     — grid 2 cols + note encart + PRT
 *   [2] LIVRAISON & CONTACT — dl sémantique (email, adresse, deadline)
 *   [3] FACTURATION       — colonnes alignées droite + total coloré
 */

import { useState, useEffect, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, Package, Users, CreditCard, MapPin } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { OldaExtraData, OldaArticle } from "@/types/order";

// ══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════════════════════

function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => {
    setO(typeof window !== "undefined" ? window.location.origin : "");
  }, []);
  return o;
}

function useLocalImages(orderId: string) {
  const key = `olda-images-${orderId}`;
  const [imgs, setImgs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setImgs(JSON.parse(stored) as string[]);
    } catch {
      /* ignore */
    }
  }, [key]);

  const addImage = (dataUrl: string) => {
    setImgs((prev: string[]) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  };

  return { localImages: imgs, addImage };
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function fmtPrice(centimes: number | undefined): string {
  if (centimes === undefined || centimes === null) return "—";
  return (centimes / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isDtfCode(s: string | undefined | null): boolean {
  if (!s) return false;
  return !s.startsWith("http") && !s.startsWith("data:");
}

/**
 * Normalise en tableau d'articles uniforme.
 * — Nouveau format : data.articles[]
 * — Ancien format  : data.fiche / data.prt / data.reference (mono-article)
 */
function normalizeArticles(data: OldaExtraData, fallbackImages: string[]): OldaArticle[] {
  if (data.articles && data.articles.length > 0) return data.articles;

  const hasSingleData = data.fiche || data.reference || data.taille || data.prt;
  if (!hasSingleData && fallbackImages.length === 0) return [];

  return [{
    reference:  data.reference,
    taille:     data.taille,
    collection: data.collection,
    note:       data.note,
    fiche: data.fiche ?? (fallbackImages.length > 0 ? {
      visuelAvant:   fallbackImages[0],
      visuelArriere: fallbackImages[1],
    } : undefined),
    prt:  data.prt,
    prix: data.prix
      ? { tshirt: data.prix.tshirt, personnalisation: data.prix.personnalisation }
      : undefined,
  }];
}

type DeadlineState = "overdue" | "today" | "tomorrow" | "soon" | "normal";

function getDeadlineInfo(
  limit: string | undefined | null
): { label: string; state: DeadlineState; fullDate: string } | null {
  if (!limit) return null;
  try {
    const d = new Date(limit);
    if (isNaN(d.getTime())) return { label: limit, state: "normal", fullDate: limit };
    const diff = differenceInCalendarDays(d, new Date());
    const fullDate = format(d, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
    if (diff < 0)
      return { label: `En retard de ${Math.abs(diff)} jour(s)`, state: "overdue", fullDate };
    if (diff === 0) return { label: "Aujourd'hui !", state: "today", fullDate };
    if (diff === 1) return { label: "Demain", state: "tomorrow", fullDate };
    if (diff <= 3)
      return {
        label: `Dans ${diff} jours`,
        state: "soon",
        fullDate,
      };
    return { label: `Dans ${diff} jours`, state: "normal", fullDate };
  } catch {
    return { label: limit, state: "normal", fullDate: limit };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (Vue principale)
// ══════════════════════════════════════════════════════════════════════════════

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
      {state === "overdue"  && <span>⚠️</span>}
      {state === "today"    && <span className="block w-1.5 h-1.5 rounded-full bg-orange-500" />}
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
        <img
          src={src}
          alt={label}
          className="w-16 h-16 rounded-xl border border-gray-200 object-cover"
        />
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
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider leading-tight">Dos</span>
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider leading-tight">vierge</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (Accordéon)
// ══════════════════════════════════════════════════════════════════════════════

/** Titre de section de l'accordéon */
function SectionHeading({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
      <span className="text-gray-400">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/** Paire label/valeur pour la grille produit */
function InfoCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <span className={cn("text-sm text-gray-900", bold ? "font-bold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

/** Entrée dl (description list) pour le bloc logistique */
function DlEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-sm font-medium text-gray-900">
        {children}
      </dd>
    </div>
  );
}

/** Ligne de prix alignée */
function PriceRow({
  label,
  value,
  total,
  paid,
}: {
  label: string;
  value: string;
  total?: boolean;
  paid?: boolean;
}) {
  if (total) {
    return (
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-200">
        <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Total
        </span>
        <span
          className={cn(
            "text-base font-bold font-mono",
            paid ? "text-green-600" : "text-red-500"
          )}
        >
          {value}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 font-mono">{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderCardProps {
  data: OldaExtraData;
  orderId?: string;
  /** Email du client (depuis Order.customerEmail) */
  customerEmail?: string;
  /** Adresse de livraison formatée (peut être multiline avec \n) */
  customerAddress?: string;
  /** Position du logo sur le vêtement */
  positionLogo?: string;
  onDelete?: () => void;
  onEdit?: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export function OrderCard({
  data,
  orderId = "unknown",
  customerEmail,
  customerAddress,
  positionLogo,
}: OrderCardProps) {
  const origin = useOrigin();
  const { localImages } = useLocalImages(orderId);
  const [isOpen, setIsOpen] = useState(false);

  // ── Extraction des données ────────────────────────────────────────────────
  const commande   = data.commande  ?? "";
  const prenom     = data.prenom    ?? "";
  const nom        = data.nom       ?? "";
  const telephone  = data.telephone ?? "";
  const deadline   = getDeadlineInfo(data.limit);

  // Articles normalisés (multi-articles ou rétrocompat mono-article)
  const articles = normalizeArticles(data, localImages);

  // Premier article pour la vue résumée (référence affichée dans le header)
  const firstArticle = articles[0];
  const reference = firstArticle?.reference ?? data.reference;
  const visuelAvant = firstArticle?.fiche?.visuelAvant ?? data.fiche?.visuelAvant;
  const visuelArriere = firstArticle?.fiche?.visuelArriere ?? data.fiche?.visuelArriere;

  // Paiement & prix
  const isPaid =
    data.paiement?.statut === "OUI" || data.paiement?.statut === "PAID";
  const prix = data.prix;
  const hasBilling =
    prix?.tshirt !== undefined ||
    prix?.personnalisation !== undefined ||
    prix?.total !== undefined;

  // QR Code
  const qrValue =
    origin && commande
      ? `${origin}/dashboard/orders/${orderId}`
      : commande || "olda";

  // Visibilité accordéon
  const hasBlock1 = !!(
    articles.some(a =>
      a.fiche?.typeProduit || a.fiche?.couleur || a.fiche?.tailleDTFAr ||
      a.collection || a.taille || a.note || a.prt?.refPrt
    ) || positionLogo
  );
  const hasBlock2 = !!(customerEmail || customerAddress || telephone || data.limit);
  const hasAccordion = hasBlock1 || hasBlock2 || hasBilling;

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Styles d'impression ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-card-print, .olda-card-print * { visibility: visible !important; }
          .olda-card-print {
            position: fixed !important; inset: 0 !important;
            padding: 1cm !important; background: white !important;
            width: 21cm !important; height: 29.7cm !important;
            display: flex !important; flex-direction: column !important;
            align-items: center !important; justify-content: center !important;
          }
          .olda-card-print img { width: 50% !important; height: auto !important; margin: 1cm auto !important; }
        }
      `}</style>

      {/* ══ MODE PRINT ══════════════════════════════════════════════════════ */}
      <div className="olda-card-print hidden print:block">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{prenom} {nom}</h1>
          {telephone && <p className="text-sm text-gray-600">{telephone}</p>}
          {visuelAvant && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">AVANT</p>
              {isDtfCode(visuelAvant)
                ? <div className="border border-gray-300 p-2 rounded text-sm font-mono">{visuelAvant}</div>
                : <img src={visuelAvant} alt="Avant" className="max-h-40" />
              }
            </div>
          )}
          {visuelArriere && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">ARRIÈRE</p>
              {isDtfCode(visuelArriere)
                ? <div className="border border-gray-300 p-2 rounded text-sm font-mono">{visuelArriere}</div>
                : <img src={visuelArriere} alt="Arrière" className="max-h-40" />
              }
            </div>
          )}
        </div>
      </div>

      {/* ══ MODE ÉCRAN ══════════════════════════════════════════════════════ */}
      <div className="print:hidden">

        {/* ── Carte principale ── */}
        <div
          className={cn(
            "rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200",
            "p-4",
            isOpen && "rounded-b-none border-b-0"
          )}
        >
          {/* Layout flex horizontal : QR Code | Données */}
          <div className="flex gap-4 items-start">

            {/* ▌GAUCHE : QR Code ▌ */}
            {commande && (
              <div className="shrink-0">
                <div className="w-[108px] h-[108px] border border-gray-200 rounded-xl p-1.5 flex items-center justify-center bg-white">
                  <QRCodeSVG
                    value={qrValue}
                    size={92}
                    bgColor="#ffffff"
                    fgColor="#1d1d1f"
                    level="M"
                  />
                </div>
              </div>
            )}

            {/* ▌DROITE : Données ▌ */}
            <div className="flex-1 flex flex-col gap-2.5 min-w-0">

              {/* 1. Identité */}
              <div>
                {nom && (
                  <p className="text-sm font-bold uppercase tracking-wide leading-tight text-gray-900 truncate">
                    {nom}
                  </p>
                )}
                {prenom && (
                  <p className="text-sm font-medium text-gray-600 leading-tight truncate">
                    {prenom}
                  </p>
                )}
                {telephone && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{telephone}</p>
                )}
              </div>

              {/* 2. Deadline + Référence */}
              {(deadline || reference) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {deadline && (
                    <DeadlineBadge label={deadline.label} state={deadline.state} />
                  )}
                  {reference && (
                    <span className="text-[11px] text-gray-400 font-mono">{reference}</span>
                  )}
                </div>
              )}

              {/* 3. Visuels — un bloc par article */}
              {articles.some(a => a.fiche?.visuelAvant || a.fiche?.visuelArriere) && (
                <div className="flex flex-col gap-2">
                  {articles.map((article, i) => {
                    const av  = article.fiche?.visuelAvant  ?? null;
                    const arr = article.fiche?.visuelArriere ?? null;
                    if (!av && !arr) return null;
                    return (
                      <div key={i}>
                        {articles.length > 1 && (
                          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            {article.reference || `Article ${i + 1}`}
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

              {/* 4. Note client (première note disponible) */}
              {(firstArticle?.note ?? data.note) && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-px select-none">📝</span>
                  <p className="text-xs italic text-gray-500 leading-snug break-words min-w-0">
                    {firstArticle?.note ?? data.note}
                  </p>
                </div>
              )}

              {/* 5. Facturation compacte */}
              {hasBilling && (
                <div className="border-t border-gray-100 pt-2 space-y-1">
                  {prix?.tshirt !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">T-shirt</span>
                      <span className="text-xs font-mono text-gray-700">{fmtPrice(prix.tshirt)}</span>
                    </div>
                  )}
                  {prix?.personnalisation !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Personnalisation</span>
                      <span className="text-xs font-mono text-gray-700">{fmtPrice(prix.personnalisation)}</span>
                    </div>
                  )}
                  {prix?.total !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Total</span>
                      <span className={cn("text-sm font-bold font-mono", isPaid ? "text-green-600" : "text-red-500")}>
                        {fmtPrice(prix.total)}
                      </span>
                    </div>
                  )}
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
                <ChevronDown
                  size={13}
                  className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                />
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ACCORDÉON — PANNEAU DÉTAILLÉ
        ══════════════════════════════════════════════════════════════════ */}
        {isOpen && (
          <div className="rounded-b-2xl border border-t-0 border-gray-200 bg-gray-50 p-6 space-y-6">

            {/* ──────────────────────────────────────────────────────────────
                BLOC 1 — INFOS ATELIER
                Grille 2 colonnes + note encart + PRT encart
            ────────────────────────────────────────────────────────────── */}
            {hasBlock1 && (
              <section>
                <SectionHeading
                  icon={<Package size={14} />}
                  label="Infos Atelier"
                />

                {/* Position logo (niveau commande) */}
                {positionLogo && (
                  <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
                    <InfoCell label="Position Logo" value={positionLogo} />
                  </div>
                )}

                {/* Un bloc par article */}
                {articles.map((article, i) => (
                  <div key={i} className={i > 0 ? "mt-5 pt-5 border-t border-gray-200" : "mt-4"}>
                    {/* Label article si multi-articles */}
                    {articles.length > 1 && (
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                        Article {i + 1}{article.reference ? ` · ${article.reference}` : ""}
                      </p>
                    )}

                    {/* Grille label/valeur — 2 colonnes */}
                    {(article.fiche?.typeProduit || article.fiche?.couleur || article.fiche?.tailleDTFAr || article.collection || article.taille) && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {article.fiche?.typeProduit && (
                          <InfoCell label="Famille" value={article.fiche.typeProduit} />
                        )}
                        {article.fiche?.couleur && (
                          <InfoCell label="Couleur" value={article.fiche.couleur} />
                        )}
                        {article.fiche?.tailleDTFAr && (
                          <InfoCell label="Taille DTF" value={article.fiche.tailleDTFAr} bold />
                        )}
                        {article.collection && (
                          <InfoCell label="Collection" value={article.collection} />
                        )}
                        {article.taille && (
                          <InfoCell label="Taille" value={article.taille} />
                        )}
                      </div>
                    )}

                    {/* Note de cet article */}
                    {article.note && (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Note / Message client
                        </p>
                        <p className="text-sm font-medium text-gray-800 italic leading-relaxed break-words">
                          {article.note}
                        </p>
                      </div>
                    )}

                    {/* PRT de cet article */}
                    {(article.prt?.refPrt || article.prt?.taillePrt || article.prt?.quantite !== undefined) && (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Impression (PRT)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {article.prt?.refPrt && (
                            <InfoCell label="Référence" value={article.prt.refPrt} />
                          )}
                          {article.prt?.taillePrt && (
                            <InfoCell label="Taille impression" value={article.prt.taillePrt} />
                          )}
                          {article.prt?.quantite !== undefined && (
                            <InfoCell label="Quantité" value={String(article.prt.quantite)} bold />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* ──────────────────────────────────────────────────────────────
                BLOC 2 — LIVRAISON & CONTACT
                dl sémantique : email, adresse, deadline
            ────────────────────────────────────────────────────────────── */}
            {hasBlock2 && (
              <section>
                <SectionHeading
                  icon={<Users size={14} />}
                  label="Livraison & Contact"
                />

                <dl className="mt-4 space-y-3">
                  {telephone && (
                    <DlEntry label="Téléphone">
                      {telephone}
                    </DlEntry>
                  )}

                  {customerEmail && (
                    <DlEntry label="Email">
                      {customerEmail}
                    </DlEntry>
                  )}

                  {customerAddress && (
                    <DlEntry label="Adresse">
                      <span className="flex items-start gap-1">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-line">{customerAddress}</span>
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

            {/* ──────────────────────────────────────────────────────────────
                BLOC 3 — FACTURATION
                Colonnes alignées droite + total coloré + statut paiement
            ────────────────────────────────────────────────────────────── */}
            {hasBilling && (
              <section>
                <SectionHeading
                  icon={<CreditCard size={14} />}
                  label="Facturation"
                />

                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
                  {prix?.tshirt !== undefined && (
                    <PriceRow label="T-shirt nu" value={fmtPrice(prix.tshirt)} />
                  )}
                  {prix?.personnalisation !== undefined && (
                    <PriceRow label="Personnalisation (DTF / Pressage)" value={fmtPrice(prix.personnalisation)} />
                  )}
                  {prix?.total !== undefined && (
                    <PriceRow
                      label="Total"
                      value={fmtPrice(prix.total)}
                      total
                      paid={isPaid}
                    />
                  )}

                  {/* Statut paiement */}
                  {prix?.total !== undefined && (
                    <div className="flex justify-end pt-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                          isPaid
                            ? "bg-green-50 text-green-600 border-green-200"
                            : "bg-red-50 text-red-500 border-red-200"
                        )}
                      >
                        {isPaid ? "✓ Commande payée" : "✗ Paiement en attente"}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        )}
        {/* ═══════════════════════════════════════════════════════════════ */}
      </div>
    </>
  );
}
