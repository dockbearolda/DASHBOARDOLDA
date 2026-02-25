"use client";

/**
 * OrderCard (Vue Principale – Design Apple)
 * ─ Layout horizontal : QR Code (gauche, 100px) + Données alignées (droite)
 * ─ QR Code dans conteneur carré borduré (~100px, padding, bordure fine)
 * ─ Identité : NOM UPPERCASE font-bold + Prénom font-medium + Téléphone discret
 * ─ Logistique : Badge limite de rendu (coloré selon urgence) + Référence commande
 * ─ Visuels : miniatures Avant/Arrière avec badges + indicateur "DOS VIERGE"
 * ─ Note client : italique avec icône 📝 — toujours visible
 * ─ Facturation : T-shirt + Personnalisation + TOTAL coloré (vert payé / rouge impayé)
 * ─ Accordéon pour détails de production secondaires (PRT, collection, taille)
 * ─ Mode print optimisé A4
 */

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { OldaExtraData } from "@/types/order";

// ── Hooks utilitaires ──────────────────────────────────────────────────────────

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
      // ignore
    }
  }, [key]);

  const addImage = (dataUrl: string) => {
    setImgs((prev) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        // quota
      }
      return updated;
    });
  };

  return { localImages: imgs, addImage };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(centimes: number | undefined): string {
  if (!centimes) return "0,00 €";
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

type DeadlineState = "overdue" | "today" | "tomorrow" | "soon" | "normal";

function getDeadlineInfo(
  limit: string | undefined | null
): { label: string; state: DeadlineState } | null {
  if (!limit) return null;
  try {
    const d = new Date(limit);
    if (isNaN(d.getTime())) return { label: limit, state: "normal" };

    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0)
      return { label: `En retard (${Math.abs(diff)}j)`, state: "overdue" };
    if (diff === 0) return { label: "Aujourd'hui !", state: "today" };
    if (diff === 1) return { label: "Demain", state: "tomorrow" };
    if (diff <= 3)
      return {
        label: `Dans ${diff}j · ${format(d, "d MMM", { locale: fr })}`,
        state: "soon",
      };
    return {
      label: `Dans ${diff}j · ${format(d, "d MMM", { locale: fr })}`,
      state: "normal",
    };
  } catch {
    return { label: limit, state: "normal" };
  }
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function DeadlineBadge({
  label,
  state,
}: {
  label: string;
  state: DeadlineState;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none",
        state === "overdue" &&
          "bg-red-50 text-red-600 border border-red-200",
        state === "today" &&
          "bg-orange-50 text-orange-600 border border-orange-200",
        state === "tomorrow" &&
          "bg-amber-50 text-amber-600 border border-amber-200",
        state === "soon" &&
          "bg-blue-50 text-blue-600 border border-blue-200",
        state === "normal" &&
          "bg-gray-50 text-gray-500 border border-gray-200"
      )}
    >
      {state === "overdue" && <span>⚠️</span>}
      {state === "today" && <span className="block w-1.5 h-1.5 rounded-full bg-orange-500" />}
      {label}
    </span>
  );
}

function VisualThumbnail({
  src,
  label,
  isDtf,
}: {
  src: string;
  label: string;
  isDtf: boolean;
}) {
  return (
    <div className="relative pt-3">
      <span className="absolute top-0 left-1 z-10 bg-[#1d1d1f]/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
        {label}
      </span>
      {isDtf ? (
        <div className="w-16 h-16 rounded-xl border border-[#E5E5E5] bg-gray-50 flex items-center justify-center p-1.5 text-[8px] font-mono text-gray-600 text-center overflow-hidden leading-tight">
          {src}
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className="w-16 h-16 rounded-xl border border-[#E5E5E5] object-cover"
        />
      )}
    </div>
  );
}

function EmptyBackIndicator() {
  return (
    <div className="relative pt-3">
      <span className="absolute top-0 left-1 z-10 bg-[#1d1d1f]/75 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
        Arrière
      </span>
      <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 flex flex-col items-center justify-center gap-0.5">
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider leading-tight">
          Dos
        </span>
        <span className="text-gray-300 text-[9px] font-semibold uppercase tracking-wider leading-tight">
          vierge
        </span>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface OrderCardProps {
  data: OldaExtraData;
  orderId?: string;
  onDelete?: () => void;
  onEdit?: () => void;
}

// ── Composant Principal ────────────────────────────────────────────────────────

export function OrderCard({ data, orderId = "unknown" }: OrderCardProps) {
  const origin = useOrigin();
  const { localImages } = useLocalImages(orderId);
  const [isOpen, setIsOpen] = useState(false);

  // ── Extraction des données ──
  const commande = data.commande || "";
  const prenom = data.prenom || "";
  const nom = data.nom || "";
  const telephone = data.telephone || "";
  const deadline = getDeadlineInfo(data.limit);
  const reference = data.reference;

  // Visuels : priorité images locales, puis fiche
  const visuelAvant = localImages[0] || data.fiche?.visuelAvant;
  const visuelArriere = localImages[1] || data.fiche?.visuelArriere;

  // Infos produit (accordéon)
  const typeProduit = data.fiche?.typeProduit;
  const couleur = data.fiche?.couleur;
  const tailleDTF = data.fiche?.tailleDTFAr;

  // Détails secondaires (accordéon)
  const collection = data.collection;
  const taille = data.taille;
  const note = data.note;
  const refPrt = data.prt?.refPrt;
  const taillePrt = data.prt?.taillePrt;
  const quantite = data.prt?.quantite;

  // Paiement & prix
  const isPaid =
    data.paiement?.statut === "OUI" || data.paiement?.statut === "PAID";
  const prix = data.prix;
  const hasBilling =
    prix?.tshirt !== undefined ||
    prix?.personnalisation !== undefined ||
    prix?.total !== undefined;

  // QR Code URL
  const qrValue =
    origin && commande
      ? `${origin}/dashboard/orders/${orderId}`
      : commande || "olda";

  const hasAccordionContent = !!(
    collection ||
    taille ||
    typeProduit ||
    couleur ||
    tailleDTF ||
    refPrt
  );

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Styles d'impression ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-card-print, .olda-card-print * { visibility: visible !important; }
          .olda-card-print {
            position: fixed !important;
            inset: 0 !important;
            padding: 1cm !important;
            background: white !important;
            width: 21cm !important;
            height: 29.7cm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .olda-card-print img {
            width: 50% !important;
            height: auto !important;
            margin: 1cm auto !important;
          }
        }
      `}</style>

      {/* ══ MODE PRINT ══════════════════════════════════════════════════════════ */}
      <div className="olda-card-print hidden print:block">
        <div className="text-center space-y-4">
          <div>
            <h1 className="text-2xl font-bold">
              {prenom} {nom}
            </h1>
            {telephone && <p className="text-sm text-gray-600">{telephone}</p>}
          </div>
          {visuelAvant && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">AVANT</p>
              {isDtfCode(visuelAvant) ? (
                <div className="border border-gray-300 p-2 rounded text-sm font-mono">
                  {visuelAvant}
                </div>
              ) : (
                <img src={visuelAvant} alt="Avant" className="max-h-40" />
              )}
            </div>
          )}
          {visuelArriere && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">ARRIÈRE</p>
              {isDtfCode(visuelArriere) ? (
                <div className="border border-gray-300 p-2 rounded text-sm font-mono">
                  {visuelArriere}
                </div>
              ) : (
                <img src={visuelArriere} alt="Arrière" className="max-h-40" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODE ÉCRAN ══════════════════════════════════════════════════════════ */}
      <div className="print:hidden">

        {/* ── Carte principale ── */}
        <div
          className={cn(
            "rounded-2xl border border-[#E5E5E5] bg-white",
            "shadow-sm hover:shadow-md",
            "transition-shadow duration-200",
            "p-4"
          )}
        >
          {/* Layout flex horizontal : QR Code | Données */}
          <div className="flex gap-4 items-start">

            {/* ▌BLOC GAUCHE : QR Code ▌ */}
            {commande && (
              <div className="shrink-0">
                <div className="w-[108px] h-[108px] border border-[#E5E5E5] rounded-xl p-1.5 flex items-center justify-center bg-white">
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

            {/* ▌BLOC DROITE : Données alignées ▌ */}
            <div className="flex-1 flex flex-col gap-2.5 min-w-0">

              {/* 1. Identité & Contact */}
              <div>
                {(nom || prenom) && (
                  <>
                    <p className="text-sm font-bold uppercase tracking-wide leading-tight text-[#1d1d1f] truncate">
                      {nom}
                    </p>
                    {prenom && (
                      <p className="text-sm font-medium text-[#1d1d1f]/75 leading-tight truncate">
                        {prenom}
                      </p>
                    )}
                  </>
                )}
                {telephone && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {telephone}
                  </p>
                )}
              </div>

              {/* 2. Logistique : Deadline + Référence */}
              {(deadline || reference) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {deadline && (
                    <DeadlineBadge
                      label={deadline.label}
                      state={deadline.state}
                    />
                  )}
                  {reference && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      {reference}
                    </span>
                  )}
                </div>
              )}

              {/* 3. Visuels : miniatures Avant / Arrière */}
              {visuelAvant && (
                <div className="flex items-start gap-2.5">
                  <VisualThumbnail
                    src={visuelAvant}
                    label="Avant"
                    isDtf={isDtfCode(visuelAvant)}
                  />
                  {visuelArriere ? (
                    <VisualThumbnail
                      src={visuelArriere}
                      label="Arrière"
                      isDtf={isDtfCode(visuelArriere)}
                    />
                  ) : (
                    <EmptyBackIndicator />
                  )}
                </div>
              )}
              {!visuelAvant && visuelArriere && (
                <div className="flex items-start gap-2.5">
                  <VisualThumbnail
                    src={visuelArriere}
                    label="Arrière"
                    isDtf={isDtfCode(visuelArriere)}
                  />
                </div>
              )}

              {/* 4. Note client */}
              {note && (
                <div className="flex items-start gap-1.5">
                  <span className="text-xs mt-px select-none">📝</span>
                  <p className="text-xs italic text-gray-500 leading-snug break-words min-w-0">
                    {note}
                  </p>
                </div>
              )}

              {/* 5. Facturation */}
              {hasBilling && (
                <div className="border-t border-[#F0F0F0] pt-2 space-y-1">
                  {prix?.tshirt !== undefined && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>T-shirt</span>
                      <span className="font-mono">{fmtPrice(prix.tshirt)}</span>
                    </div>
                  )}
                  {prix?.personnalisation !== undefined && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Personnalisation</span>
                      <span className="font-mono">
                        {fmtPrice(prix.personnalisation)}
                      </span>
                    </div>
                  )}
                  {prix?.total !== undefined && (
                    <div
                      className={cn(
                        "flex items-center justify-between text-sm font-bold",
                        isPaid ? "text-green-600" : "text-red-500"
                      )}
                    >
                      <span>Total</span>
                      <span className="font-mono">{fmtPrice(prix.total)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bouton accordéon */}
          {hasAccordionContent && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
                aria-expanded={isOpen}
                aria-label="Voir les détails de production"
              >
                <span>{isOpen ? "Réduire" : "Détails production"}</span>
                <ChevronDown
                  size={13}
                  className={cn(
                    "transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        {/* ── Accordéon : détails secondaires ── */}
        {isOpen && (
          <div
            className={cn(
              "rounded-b-2xl border border-t-0 border-[#E5E5E5] bg-[#FAFAFA]",
              "px-4 pb-4 pt-3 space-y-2"
            )}
          >
            {collection && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-400">Collection :</span>{" "}
                {collection}
              </p>
            )}
            {taille && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-400">Taille :</span>{" "}
                {taille}
              </p>
            )}
            {(typeProduit || couleur || tailleDTF) && (
              <p className="text-xs text-gray-500">
                {[typeProduit, couleur, tailleDTF].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* Bloc PRT */}
            {(refPrt || taillePrt || quantite !== undefined) && (
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Impression
                </p>
                <div className="space-y-1 text-xs text-gray-500">
                  {refPrt && (
                    <p>
                      <span className="font-medium text-gray-400">Réf :</span>{" "}
                      {refPrt}
                    </p>
                  )}
                  {taillePrt && (
                    <p>
                      <span className="font-medium text-gray-400">Taille :</span>{" "}
                      {taillePrt}
                    </p>
                  )}
                  {quantite !== undefined && (
                    <p>
                      <span className="font-medium text-gray-400">Qté :</span>{" "}
                      {quantite}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
