"use client";

/**
 * table-cells — Atomes UI partagés entre tous les tableaux Apple-style.
 *
 * Exports :
 *  • STATUS_LABELS        – labels français des états de commande
 *  • STATUS_BADGE_COLORS  – classes Tailwind bg/text/border pour badges
 *  • STATUS_BADGE_DEFAULT – fallback couleur badge
 *  • SECTEUR_CONFIG       – config complète des secteurs (pill + dot)
 *  • SECTEUR_PILL         – map valeur → classes pill (accès O(1))
 *  • StatusBadge          – pastille d'état colorée
 *  • SecteurPill          – pastille de secteur
 *  • DaysChip             – chip « jours restants » tricolore
 *  • TableSearchBar       – barre de recherche glassmorphism
 */

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── STATUS_LABELS ─────────────────────────────────────────────────────────────────

/** Labels français de chaque état de commande — source unique de vérité */
export const STATUS_LABELS: Record<string, string> = {
  A_DEVISER:           "À deviser",
  ATTENTE_VALIDATION:  "Attente validation",
  MAQUETTE_A_FAIRE:    "Maquette à faire",
  ATTENTE_MARCHANDISE: "Attente marchandise",
  A_PREPARER:          "À préparer",
  A_PRODUIRE:          "À produire",
  EN_PRODUCTION:       "En production",
  A_MONTER_NETTOYER:   "À monter/nettoyer",
  MANQUE_INFORMATION:  "Manque information",
  TERMINE:             "Terminé",
  PREVENIR_CLIENT:     "Prévenir client",
  CLIENT_PREVENU:      "Client prévenu",
  RELANCE_CLIENT:      "Relance client",
  PRODUIT_RECUPERE:    "Produit récupéré",
  A_FACTURER:          "À facturer",
  FACTURE_FAITE:       "Facture faite",
};

// ── STATUS_BADGE_COLORS ───────────────────────────────────────────────────────────

/** Classes Tailwind bg / text / border pour chaque état */
export const STATUS_BADGE_COLORS: Record<string, string> = {
  TERMINE:             "bg-emerald-50 text-emerald-700 border-emerald-100",
  FACTURE_FAITE:       "bg-emerald-50 text-emerald-700 border-emerald-100",
  PRODUIT_RECUPERE:    "bg-blue-50 text-blue-700 border-blue-100",
  EN_PRODUCTION:       "bg-indigo-50 text-indigo-700 border-indigo-100",
  A_DEVISER:           "bg-slate-50 text-slate-600 border-slate-100",
  MANQUE_INFORMATION:  "bg-red-50 text-red-600 border-red-100",
  RELANCE_CLIENT:      "bg-orange-50 text-orange-700 border-orange-100",
  CLIENT_PREVENU:      "bg-teal-50 text-teal-700 border-teal-100",
  PREVENIR_CLIENT:     "bg-teal-50 text-teal-600 border-teal-100",
  A_FACTURER:          "bg-amber-50 text-amber-700 border-amber-100",
  A_PREPARER:          "bg-purple-50 text-purple-600 border-purple-100",
  A_PRODUIRE:          "bg-violet-50 text-violet-600 border-violet-100",
  MAQUETTE_A_FAIRE:    "bg-pink-50 text-pink-600 border-pink-100",
  ATTENTE_VALIDATION:  "bg-yellow-50 text-yellow-700 border-yellow-100",
  ATTENTE_MARCHANDISE: "bg-orange-50 text-orange-600 border-orange-100",
  A_MONTER_NETTOYER:   "bg-sky-50 text-sky-600 border-sky-100",
};

/** Couleur par défaut pour les états non listés */
export const STATUS_BADGE_DEFAULT = "bg-slate-50 text-slate-600 border-slate-100";

// ── SECTEUR_CONFIG ────────────────────────────────────────────────────────────────

/** Configuration complète des secteurs : pill Tailwind + dot couleur */
export const SECTEUR_CONFIG = [
  {
    value: "Textiles",
    label: "Textiles",
    pill:  "bg-emerald-50 text-emerald-700 border-emerald-100",
    dot:   "bg-emerald-400",
  },
  {
    value: "Gravure et découpe laser",
    label: "Gravure & Découpe",
    pill:  "bg-violet-50 text-violet-700 border-violet-100",
    dot:   "bg-violet-400",
  },
  {
    value: "Impression UV",
    label: "Impression UV",
    pill:  "bg-cyan-50 text-cyan-700 border-cyan-100",
    dot:   "bg-cyan-400",
  },
  {
    value: "Goodies",
    label: "Goodies",
    pill:  "bg-amber-50 text-amber-700 border-amber-100",
    dot:   "bg-amber-400",
  },
] as const;

/** Map valeur → classes pill pour lookup O(1) */
export const SECTEUR_PILL: Record<string, string> = Object.fromEntries(
  SECTEUR_CONFIG.map((s) => [s.value, s.pill]),
);

// ── StatusBadge ───────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status:     string;
  className?: string;
}

/** Pastille d'état (ex: "Terminé", "En production"…) */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_BADGE_COLORS[status] ?? STATUS_BADGE_DEFAULT;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}

// ── SecteurPill ───────────────────────────────────────────────────────────────────

interface SecteurPillProps {
  secteur:    string;
  className?: string;
}

/** Pastille de secteur (Textiles, Gravure, Impression UV, Goodies) */
export function SecteurPill({ secteur, className }: SecteurPillProps) {
  const color = SECTEUR_PILL[secteur] ?? "bg-slate-50 text-slate-600 border-slate-100";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border truncate",
        color,
        className,
      )}
    >
      {secteur}
    </span>
  );
}

// ── DaysChip ──────────────────────────────────────────────────────────────────────

/** Chip « jours restants » tricolore : rouge ≤1j · orange 2–7j · bleu >7j */
export function DaysChip({ days }: { days: number }) {
  // Rouge : retard, aujourd'hui, demain
  if (days <= 0)
    return (
      <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">
        {days === 0 ? "auj." : `${days}j`}
      </span>
    );
  if (days === 1)
    return (
      <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">
        dem.
      </span>
    );
  // Orange : cette semaine
  if (days <= 7)
    return (
      <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-orange-50 text-orange-500 border border-orange-100">
        +{days}j
      </span>
    );
  // Bleu : long terme
  return (
    <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-50 text-blue-500 border border-blue-100">
      +{days}j
    </span>
  );
}

// ── TableSearchBar ────────────────────────────────────────────────────────────────

interface TableSearchBarProps {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  className?:   string;
}

/** Barre de recherche glassmorphism, compatible avec tous les tableaux */
export function TableSearchBar({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: TableSearchBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 h-9 px-3.5 rounded-xl w-full",
        "bg-white/60 backdrop-blur-md border border-slate-200/80 shadow-sm",
        "transition-all duration-200",
        "focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-blue-50",
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-[13px] text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-300"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-slate-300 hover:text-slate-500 transition-colors duration-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
