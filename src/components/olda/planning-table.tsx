"use client";

/**
 * PlanningTable — Apple-grade Premium Rewrite
 *
 * Features:
 *  1. Recherche globale Glassmorphism (client, famille, note)
 *  2. Colonne "Famille" (Textiles, Tasses, Découpe et Gravure, Goodies)
 *  3. Notes truncate + tooltip au survol + expansion au clic
 *  4. Suppression des colonnes Prix unitaire et Total
 *  5. Quantités = input direct sans flèches step
 *  6. Échéance hybride : frappe JJ/MM + icône calendrier (popover natif)
 *  7. Secteur pastels, placé juste après Client
 *  8. Onglets filtrés (Général / Textiles / Gravure & Découpe / Impression UV / Goodies)
 *  9. Tri intelligent HAUTE → haut, DnD manuel
 * 10. Indicateur Type PRO / PERSO / OLDA (bordure gauche colorée + badge)
 */

import {
  useState, useCallback, useMemo, useRef, useEffect, type CSSProperties,
} from "react";
import {
  Trash2, Plus, ChevronDown, GripVertical, Search, Calendar, X, User, Eye,
  AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Package, Shirt, Scissors, Printer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface PlanningItem {
  id: string;
  priority:    "BASSE" | "MOYENNE" | "HAUTE";
  clientName:  string;
  clientId:    string | null;
  designation: string;   // mapped to « Famille » in UI
  quantity:    number;
  note:        string;
  unitPrice:   number;   // kept for backward-compat, not displayed
  deadline:    string | null;
  status:      PlanningStatus;
  responsible: string;
  color:       string;   // stores secteur value
  position:    number;
}

export interface ClientSuggestion {
  id: string;
  nom: string;
  telephone: string;
}

export type PlanningStatus =
  | "A_DEVISER"
  | "ATTENTE_VALIDATION"
  | "MAQUETTE_A_FAIRE"
  | "ATTENTE_MARCHANDISE"
  | "A_PREPARER"
  | "A_PRODUIRE"
  | "EN_PRODUCTION"
  | "A_MONTER_NETTOYER"
  | "MANQUE_INFORMATION"
  | "TERMINE"
  | "PREVENIR_CLIENT"
  | "CLIENT_PREVENU"
  | "RELANCE_CLIENT"
  | "PRODUIT_RECUPERE"
  | "A_FACTURER"
  | "FACTURE_FAITE";

interface PlanningTableProps {
  items:            PlanningItem[];
  onItemsChange?:   (items: PlanningItem[]) => void;
  /** Appelé quand l'état d'édition change (true = en cours, false = terminé) */
  onEditingChange?: (isEditing: boolean) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────────

const PRIORITY_RANK = { HAUTE: 2, MOYENNE: 1, BASSE: 0 } as const;

type SortableCol = "priority" | "clientName" | "deadline" | "status";

const PRIORITY_CONFIG: Record<string, { label: string; style: string }> = {
  BASSE:   { label: "Basse",   style: "bg-slate-100 text-slate-500"  },
  MOYENNE: { label: "Moyenne", style: "bg-blue-50 text-blue-600"      },
  HAUTE:   { label: "Haute",   style: "bg-orange-50 text-orange-600" },
};

const STATUS_LABELS: Record<PlanningStatus, string> = {
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

const TEAM = [
  { key: "loic",     name: "Loïc"     },
  { key: "charlie",  name: "Charlie"  },
  { key: "melina",   name: "Mélina"   },
  { key: "amandine", name: "Amandine" },
  { key: "renaud",   name: "Renaud"   },
] as const;

// Famille options (feature 2)
const FAMILLE_OPTIONS = [
  "Textiles",
  "Tasses",
  "Découpe et Gravure",
  "Goodies",
] as const;

// Secteur options with pastel pills (feature 7)
const SECTEUR_CONFIG = [
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

// Type indicator config (feature 10)
const TYPE_CONFIG = {
  PRO:   { label: "PRO",   badge: "bg-blue-500 text-white",     border: "border-l-blue-400"    },
  PERSO: { label: "PERSO", badge: "bg-emerald-500 text-white",  border: "border-l-emerald-400" },
  OLDA:  { label: "OLDA",  badge: "bg-amber-400 text-white",    border: "border-l-amber-400"   },
  "":    { label: "·",     badge: "bg-slate-100 text-slate-400", border: "border-l-transparent" },
} as const;
type ItemType = keyof typeof TYPE_CONFIG;

// Tabs (feature 8)
type TabKey = "general" | "textiles" | "gravure" | "impression-uv" | "goodies";
const TABS: { key: TabKey; label: string; secteur: string | null }[] = [
  { key: "general",       label: "Général",           secteur: null                        },
  { key: "textiles",      label: "Textiles",           secteur: "Textiles"                  },
  { key: "gravure",       label: "Gravure & Découpe",  secteur: "Gravure et découpe laser"  },
  { key: "impression-uv", label: "Impression UV",      secteur: "Impression UV"             },
  { key: "goodies",       label: "Goodies",            secteur: "Goodies"                   },
];

// ── Grid layout (11 columns) ────────────────────────────────────────────────────
// Grip | Type | Priorité | Client | Secteur | Qté | Note | Échéance | État | Interne | ×
// Note prend le 1fr → toutes les notes visibles ; Client capé à 190px

const GRID_COLS =
  "32px 76px 94px minmax(100px,190px) 155px 56px minmax(108px,1fr) 165px 168px 100px 40px";
const GRID_STYLE: CSSProperties = { gridTemplateColumns: GRID_COLS };

const COL_HEADERS: Array<{ label: string; align: string; sortKey?: SortableCol }> = [
  { label: "",         align: "center" },
  { label: "Type",     align: "center" },
  { label: "Priorité", align: "center", sortKey: "priority"   },
  { label: "Client",   align: "left",   sortKey: "clientName" },
  { label: "Secteur",  align: "left"   },
  { label: "Qté",      align: "center" },
  { label: "Note",     align: "left"   },
  { label: "Échéance", align: "left",   sortKey: "deadline"   },
  { label: "État",     align: "left",   sortKey: "status"     },
  { label: "Interne",  align: "left"   },
  { label: "",         align: "center" },
];

// ── Shared styles ───────────────────────────────────────────────────────────────

const CELL_INPUT =
  "w-full h-8 px-2.5 text-[12px] text-slate-900 bg-white rounded-lg " +
  "border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none";

const EMPTY_CLS  = "text-slate-300 italic font-normal";
const CELL_WRAP  = "h-full flex items-center px-1.5 overflow-hidden min-w-0";

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:…" sans conversion UTC */
function parseISODate(date: string): { year: number; month: number; day: number } | null {
  const iso   = date.split("T")[0];
  const parts = iso.split("-");
  if (parts.length < 3) return null;
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day   = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/** Nombre de jours jusqu'à l'échéance (négatif si dépassée), sans décalage UTC */
function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const parsed = parseISODate(deadline);
  if (!parsed) return null;
  const now      = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target   = new Date(parsed.year, parsed.month - 1, parsed.day).getTime();
  return Math.round((target - today) / 86_400_000);
}

function isUrgent(deadline: string | null): boolean {
  const d = daysUntil(deadline);
  return d !== null && d <= 1;
}

/** Affiche "DD/MM/YY" sans passer par UTC — corrige le bug "jour -1" en UTC+x */
function formatDDMM(date: string | null): string {
  if (!date) return "";
  const parsed = parseISODate(date);
  if (!parsed) return "";
  const yy = String(parsed.year).slice(-2);
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${yy}`;
}

function parseDDMM(text: string): string | null {
  const clean = text.trim().replace(/[.\-\s]/g, "/");
  const parts  = clean.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const day   = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return null;
  let year: number;
  if (parts.length >= 3 && parts[2]) {
    year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
  } else {
    const now   = new Date();
    year        = now.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (new Date(year, month - 1, day) < today) year++;
  }
  // Validation (ex: 31/02 → mois incorrect)
  const check = new Date(year, month - 1, day);
  if (isNaN(check.getTime()) || check.getMonth() !== month - 1) return null;
  // Format YYYY-MM-DD sans toISOString() pour éviter le décalage UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

// ── Sub-components ──────────────────────────────────────────────────────────────

// Search bar glassmorphism (feature 1)
function SearchBar({ value, onChange, maxWidth, className }: { value: string; onChange: (v: string) => void; maxWidth?: string; className?: string }) {
  return (
    <div
      style={{ maxWidth }}
      className={cn(
        "flex items-center gap-2.5 h-9 px-3.5 rounded-xl w-full",
        className,
        "bg-white/60 backdrop-blur-md border border-slate-200/80 shadow-sm",
        "transition-[background-color,border-color,box-shadow] duration-200",
        "focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-blue-50",
      )}>
      <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher par client, famille, note…"
        className="flex-1 text-[13px] text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-300"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-slate-300 hover:text-slate-500 transition-colors duration-100"
          aria-label="Effacer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// Type badge — click to cycle PRO → PERSO → OLDA → · (feature 10)
function TypePicker({ value, onChange }: { value: ItemType; onChange: (v: ItemType) => void }) {
  const CYCLE: ItemType[] = ["", "PRO", "PERSO", "OLDA"];
  const cycle = () => onChange(CYCLE[(CYCLE.indexOf(value) + 1) % CYCLE.length]);
  const cfg   = TYPE_CONFIG[value];
  return (
    <button
      onClick={cycle}
      title="Cliquer pour changer le type"
      className={cn(
        "px-2 py-0.5 rounded-md text-[11px] font-bold tracking-widest",
        "transition-[background-color,color,transform] duration-150 active:scale-95 select-none whitespace-nowrap",
        cfg.badge,
      )}
    >
      {cfg.label}
    </button>
  );
}

// Note cell — expansion verticale au clic, affichage multi-ligne en lecture
function NoteCell({
  note,
  isEditing,
  onStartEdit,
  onUpdate,
  onBlurSave,
  onCancel,
}: {
  note:        string;
  isEditing:   boolean;
  onStartEdit: () => void;
  onUpdate:    (v: string) => void;
  onBlurSave:  (v: string) => void;
  onCancel:    () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines       = Math.max(2, note.split("\n").length);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={note}
        autoFocus
        rows={lines}
        onChange={(e) => onUpdate(e.target.value)}
        onBlur={(e)   => onBlurSave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab")    { e.preventDefault(); textareaRef.current?.blur(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        className={cn(
          "w-full px-2 py-1 text-[12px] italic text-slate-600 bg-white rounded-xl",
          "border border-blue-300 ring-2 ring-blue-100/70 shadow-lg focus:outline-none resize-none",
        )}
        placeholder="Précisions…"
      />
    );
  }

  // Lecture : affiche tout le texte, multi-ligne → agrandit la ligne
  return (
    <div
      onClick={onStartEdit}
      className={cn(
        "w-full px-2 text-[12px] rounded-lg cursor-text leading-snug",
        "hover:bg-black/[0.03] transition-colors duration-100 select-none",
        "whitespace-pre-wrap break-words",
        note ? "text-slate-500 italic" : EMPTY_CLS,
      )}
    >
      {note || "Précisions…"}
    </div>
  );
}

// Secteur picker with pastel pills (feature 7)
function SecteurPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cfg = SECTEUR_CONFIG.find((s) => s.value === value);
  return (
    <div className="relative w-full">
      <div className={cn(
        "flex items-center h-8 gap-1.5 px-2.5 rounded-lg border text-[12px] font-medium cursor-pointer",
        "transition-[background-color,border-color] duration-100",
        "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200",
        cfg ? "text-slate-700" : "text-slate-400",
      )}>
        {cfg && <span className={cn("w-2 h-2 rounded-full flex-shrink-0 shrink-0", cfg.dot)} />}
        <span className="truncate flex-1">{cfg?.label ?? "—"}</span>
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </div>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {SECTEUR_CONFIG.map((s) => (
          <option key={s.value} value={s.value}>{s.value}</option>
        ))}
      </select>
    </div>
  );
}

// Apple-style select wrapper
function AppleSelect({
  value, displayLabel, onChange, children, pillStyle,
}: {
  value:        string;
  displayLabel: string;
  onChange:     (v: string) => void;
  children:     React.ReactNode;
  pillStyle?:   string;
}) {
  return (
    <div className="relative w-full">
      <div className={cn(
        "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[12px]",
        "border-slate-100 bg-white/50 text-slate-800",
        "hover:bg-white hover:border-slate-200 cursor-pointer transition-[background-color,border-color] duration-100",
        pillStyle,
      )}>
        <span className="truncate flex-1">{displayLabel}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
      </div>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

// Status config — point coloré par état
const STATUS_CONFIG: Record<PlanningStatus, string> = {
  A_DEVISER:           "bg-slate-300",
  ATTENTE_VALIDATION:  "bg-amber-400",
  MAQUETTE_A_FAIRE:    "bg-purple-400",
  ATTENTE_MARCHANDISE: "bg-orange-400",
  A_PREPARER:          "bg-blue-400",
  A_PRODUIRE:          "bg-blue-500",
  EN_PRODUCTION:       "bg-indigo-500",
  A_MONTER_NETTOYER:   "bg-cyan-500",
  MANQUE_INFORMATION:  "bg-red-400",
  TERMINE:             "bg-green-500",
  PREVENIR_CLIENT:     "bg-yellow-500",
  CLIENT_PREVENU:      "bg-yellow-400",
  RELANCE_CLIENT:      "bg-orange-500",
  PRODUIT_RECUPERE:    "bg-teal-500",
  A_FACTURER:          "bg-emerald-500",
  FACTURE_FAITE:       "bg-green-600",
};

function StatusPicker({ value, onChange }: { value: PlanningStatus; onChange: (v: PlanningStatus) => void }) {
  return (
    <div className="relative w-full">
      <div className={cn(
        "flex items-center h-8 gap-2 px-2.5 rounded-lg border text-[12px]",
        "border-slate-100 bg-white/50 text-slate-800",
        "hover:bg-white hover:border-slate-200 cursor-pointer transition-[background-color,border-color] duration-[80ms]",
      )}>
        <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", STATUS_CONFIG[value] ?? "bg-slate-300")} />
        <span className="truncate flex-1 font-medium">{STATUS_LABELS[value]}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
      </div>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={(e) => onChange(e.target.value as PlanningStatus)}
      >
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
}

// Jours restants — chip coloré (feature « jours restants »)
function DaysChip({ days }: { days: number }) {
  // Rouge  : retard ou aujourd'hui ou demain
  if (days <= 0)   return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">{days === 0 ? "auj." : `${days}j`}</span>;
  if (days === 1)  return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">dem.</span>;
  // Orange : cette semaine (2–7 j)
  if (days <= 7)   return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-orange-50 text-orange-500 border border-orange-100">+{days}j</span>;
  // Bleu   : long terme (> 7 j)
  return               <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-50 text-blue-500 border border-blue-100">+{days}j</span>;
}

// Hybrid date input — text JJ/MM + calendar icon (feature 6)
function HybridDateInput({
  value, onChange, urgent,
}: {
  value:    string | null;
  onChange: (v: string | null) => void;
  urgent:   boolean;
}) {
  const [text, setText]     = useState(formatDDMM(value));
  const [focused, setFocus] = useState(false);
  const hiddenRef           = useRef<HTMLInputElement>(null);

  // Sync text when external value changes
  useEffect(() => { setText(formatDDMM(value)); }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Garder uniquement les chiffres et reformater avec les /
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) formatted += "/" + digits.slice(2, 4);
    if (digits.length >= 5) formatted += "/" + digits.slice(4, 6);
    setText(formatted);
    // Auto-parse quand les 6 chiffres sont saisis (JJ/MM/AA)
    if (digits.length === 6) {
      const parsed = parseDDMM(formatted);
      if (parsed) onChange(parsed);
    }
  };

  const handleTextBlur = () => {
    setFocus(false);
    if (!text.trim()) { onChange(null); setText(""); return; }
    const parsed = parseDDMM(text);
    if (parsed) { onChange(parsed); setText(formatDDMM(parsed)); }
    else        { setText(formatDDMM(value)); }
  };

  const openCalendar = () => {
    try   { hiddenRef.current?.showPicker(); }
    catch { hiddenRef.current?.click();      }
  };

  const days = daysUntil(value);

  return (
    <div className="flex items-center gap-1 w-full">
      <input
        type="text"
        value={text}
        onChange={handleTextChange}
        onFocus={() => setFocus(true)}
        onBlur={handleTextBlur}
        placeholder="—"
        maxLength={8}
        className={cn(
          "w-[82px] shrink-0 h-8 px-2 text-[12px] rounded-lg border bg-transparent",
          "focus:outline-none focus:ring-2 focus:border-blue-300 focus:ring-blue-100/70 focus:bg-white",
          "transition-[border-color,box-shadow] duration-100 tabular-nums",
          urgent
            ? "text-red-600 font-semibold border-transparent hover:border-red-200"
            : text
              ? "text-slate-800 border-transparent hover:border-slate-200"
              : cn(EMPTY_CLS, "border-transparent hover:border-slate-200"),
        )}
      />
      {/* Jours restants — visible quand non focalisé et date définie */}
      {!focused && days !== null && (
        <DaysChip days={days} />
      )}
      <button
        onClick={openCalendar}
        className="ml-auto shrink-0 p-1 rounded-md text-slate-300 hover:text-blue-400 hover:bg-blue-50 transition-colors duration-100"
        title="Ouvrir le calendrier"
        type="button"
      >
        <Calendar className="h-3.5 w-3.5" />
      </button>
      {/* Hidden native date input for calendar popover */}
      <input
        ref={hiddenRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
        value={value ? value.split("T")[0] : ""}
        onChange={(e) => {
          onChange(e.target.value || null);
          setText(formatDDMM(e.target.value || null));
        }}
      />
    </div>
  );
}

// ── Client name cell with autocomplete ─────────────────────────────────────────
function ClientNameCell({
  value,
  clientId,
  isEditing,
  onStartEdit,
  onChange,
  onBlurSave,
  onKeyDown,
  onSelectClient,
}: {
  value:          string;
  clientId:       string | null;
  isEditing:      boolean;
  onStartEdit:    () => void;
  onChange:       (v: string) => void;
  onBlurSave:     (v: string) => void;
  onKeyDown:      (e: React.KeyboardEvent) => void;
  onSelectClient: (client: ClientSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showDrop, setShowDrop]       = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/clients?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        const list: ClientSuggestion[] = (data.clients ?? []).map((c: ClientSuggestion) => ({
          id:        c.id,
          nom:       c.nom,
          telephone: c.telephone,
        }));
        setSuggestions(list);
        setShowDrop(list.length > 0);
        setActiveIdx(-1);
      } catch { /* ignore */ }
    }, 180);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    fetchSuggestions(v);
  };

  const handleSelect = (client: ClientSuggestion) => {
    setShowDrop(false);
    setSuggestions([]);
    onSelectClient(client);
  };

  const handleKeyDownWrapper = (e: React.KeyboardEvent) => {
    if (showDrop && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setShowDrop(false);
        setSuggestions([]);
      }
    }
    onKeyDown(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay blur so click on suggestion fires first
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDrop(false);
        onBlurSave(e.target.value);
      }
    }, 150);
  };

  if (!isEditing) {
    return (
      <div
        onClick={onStartEdit}
        className={cn(
          "w-full h-8 px-2.5 text-[12px] rounded-lg cursor-text font-medium",
          "flex items-center gap-1.5 hover:bg-black/[0.03] transition-colors duration-100 select-none truncate",
          value ? "text-slate-800" : EMPTY_CLS,
        )}
      >
        {clientId && (
          <User className="h-3 w-3 text-blue-400 shrink-0" />
        )}
        {value || "Nom Prénom"}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => handleChange(toTitleCase(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownWrapper}
        className={cn(CELL_INPUT, "font-medium")}
        placeholder="Nom Prénom"
      />
      {showDrop && (
        <div
          className={cn(
            "absolute z-50 top-full left-0 mt-1 min-w-[220px] w-max max-w-[320px]",
            "bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden",
          )}
        >
          {suggestions.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-left",
                "transition-colors duration-75",
                idx === activeIdx
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-blue-500">
                  {s.nom.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{s.nom}</p>
                {s.telephone && (
                  <p className="text-[11px] text-slate-400 truncate">{s.telephone}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export function PlanningTable({ items, onItemsChange, onEditingChange }: PlanningTableProps) {
  const [editing,         setEditing]         = useState<string | null>(null);
  const [savingIds,       setSavingIds]       = useState<Set<string>>(new Set());
  const [deletingIds,     setDeletingIds]     = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailId,        setDetailId]        = useState<string | null>(null);
  const [sortConfig,      setSortConfig]      = useState<{ col: SortableCol; dir: "asc" | "desc" } | null>(null);
  const [filterUrgent,    setFilterUrgent]    = useState(false);
  const [newRowId,        setNewRowId]        = useState<string | null>(null);
  const confirmDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref vers l'état d'édition courant, accessible dans les handlers socket/polling
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Notifier le parent dès que editing change (pour suspendre le polling)
  useEffect(() => {
    onEditingChange?.(editing !== null);
  }, [editing, onEditingChange]);

  // ── Temps réel : écoute les changements des autres utilisateurs ────────────
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useSocket({
    "planning:created": (data) => {
      const newItem = data as PlanningItem;
      if (itemsRef.current.some((i) => i.id === newItem.id)) return;
      onItemsChange?.([...itemsRef.current, newItem]);
    },
    "planning:updated": (data) => {
      const updated = data as PlanningItem;
      // Ne pas écraser la cellule actuellement en cours d'édition
      const editingItemId = editingRef.current?.split(":")[0];
      if (editingItemId === updated.id) return;
      onItemsChange?.(
        itemsRef.current.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
      );
    },
    "planning:deleted": (data) => {
      const { id } = data as { id: string };
      onItemsChange?.(itemsRef.current.filter((i) => i.id !== id));
    },
  });
  const [search,        setSearch]        = useState("");
  const [filterPerson,  setFilterPerson]  = useState("");
  const [activeTab,     setActiveTab]     = useState<TabKey>("general");
  // Feature 10: type stored in localStorage (no DB migration needed)
  const [types, setTypes] = useState<Record<string, ItemType>>(() => {
    if (typeof window === "undefined") return {};
    try   { return JSON.parse(localStorage.getItem("planning-item-types") || "{}"); }
    catch { return {}; }
  });
  const preEdit = useRef<unknown>(null);

  // ── Sorted base ──────────────────────────────────────────────────────────────

  const sorted = useMemo(
    () =>
      !Array.isArray(items)
        ? []
        : [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0)),
    [items],
  );

  // Feature 9: Smart sort for Général — HAUTE first, then position
  const generalSorted = useMemo(
    () =>
      [...sorted].sort((a, b) => {
        const pDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        return pDiff !== 0 ? pDiff : (a.position ?? 0) - (b.position ?? 0);
      }),
    [sorted],
  );

  // Tab items (before search filter)
  const tabItems = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab?.secteur) return generalSorted;
    return sorted.filter((i) => i.color === tab.secteur);
  }, [activeTab, generalSorted, sorted]);

  // Search + person + urgent filter + column sort
  const displayItems = useMemo(() => {
    let result = tabItems;
    if (filterPerson) result = result.filter((i) => i.responsible === filterPerson);
    if (filterUrgent) result = result.filter((i) => isUrgent(i.deadline) || i.priority === "HAUTE");
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.clientName.toLowerCase().includes(q) ||
          i.designation.toLowerCase().includes(q) ||
          i.note.toLowerCase().includes(q),
      );
    }
    if (sortConfig) {
      const dir = sortConfig.dir === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        switch (sortConfig.col) {
          case "priority":   return dir * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
          case "clientName": return dir * a.clientName.localeCompare(b.clientName, "fr");
          case "deadline": {
            const aD = a.deadline ?? "9999"; const bD = b.deadline ?? "9999";
            return dir * aD.localeCompare(bD);
          }
          case "status": return dir * a.status.localeCompare(b.status);
          default: return 0;
        }
      });
    }
    return result;
  }, [tabItems, search, filterPerson, filterUrgent, sortConfig]);

  // Tab counts — filtré par personne si un filtre est actif
  const tabCounts = useMemo((): Record<TabKey, number> => {
    const base = filterPerson ? sorted.filter((i) => i.responsible === filterPerson) : sorted;
    return {
      general:         base.length,
      textiles:        base.filter((i) => i.color === "Textiles").length,
      gravure:         base.filter((i) => i.color === "Gravure et découpe laser").length,
      "impression-uv": base.filter((i) => i.color === "Impression UV").length,
      goodies:         base.filter((i) => i.color === "Goodies").length,
    };
  }, [sorted, filterPerson]);

  // ── API helpers ──────────────────────────────────────────────────────────────

  const persist = useCallback(async (id: string, patch: Record<string, unknown>) => {
    setSavingIds((p) => new Set([...p, id]));
    try {
      await fetch(`/api/planning/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
    } catch (e) {
      console.error("Planning save failed:", e);
    } finally {
      setSavingIds((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }, []);

  const updateItem = useCallback(
    (id: string, field: string, value: unknown) =>
      onItemsChange?.(items.map((it) => (it.id === id ? { ...it, [field]: value } : it))),
    [items, onItemsChange],
  );

  const saveNow = useCallback(
    (id: string, field: string, value: unknown) => {
      updateItem(id, field, value);
      persist(id, { [field]: value });
    },
    [updateItem, persist],
  );

  // ── Edit helpers ─────────────────────────────────────────────────────────────

  const startEdit = useCallback((id: string, field: string, currentValue: unknown) => {
    preEdit.current = currentValue;
    setEditing(`${id}:${field}`);
  }, []);

  const isEditingCell = useCallback(
    (id: string, field: string) => editing === `${id}:${field}`,
    [editing],
  );

  const handleBlurSave = useCallback(
    (id: string, field: string, value: unknown) => {
      setEditing(null);
      persist(id, { [field]: value });
    },
    [persist],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string, field: string) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      } else if (e.key === "Escape") {
        updateItem(id, field, preEdit.current);
        setEditing(null);
      }
    },
    [updateItem],
  );

  // ── Type (localStorage) ───────────────────────────────────────────────────────

  const setType = useCallback((id: string, type: ItemType) => {
    setTypes((prev) => {
      const next = { ...prev, [id]: type };
      try { localStorage.setItem("planning-item-types", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addRow = useCallback(() => {
    const newId  = `r${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    // Insérer EN HAUT : position = minPos - 1 (ou -1 si liste vide)
    const minPos   = sorted.length > 0 ? Math.min(...sorted.map((s) => s.position)) : 0;
    const position = minPos - 1;
    // Pré-remplir l'onglet actif et la personne filtrée
    const tab     = TABS.find((t) => t.key === activeTab);
    const newItem: PlanningItem = {
      id: newId, priority: "MOYENNE", clientName: "", clientId: null, quantity: 1,
      designation: "", note: "", unitPrice: 0, deadline: null,
      status: "A_DEVISER",
      responsible: filterPerson || "",
      color: tab?.secteur ?? "",
      position,
    };
    onItemsChange?.([...items, newItem]);
    setEditing(`${newId}:clientName`);
    setNewRowId(newId);
    setTimeout(() => setNewRowId(null), 1400);
    fetch("/api/planning", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...newItem, deadline: null }),
    }).catch((e) => console.error("Failed to save new row:", e));
  }, [items, sorted, activeTab, filterPerson, onItemsChange]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingIds((p) => new Set([...p, id]));
      onItemsChange?.(items.filter((it) => it.id !== id));
      try {
        await fetch(`/api/planning/${id}`, { method: "DELETE" });
      } catch {
        const res  = await fetch("/api/planning");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      } finally {
        setDeletingIds((p) => { const n = new Set(p); n.delete(id); return n; });
      }
    },
    [items, onItemsChange],
  );

  const handleReorder = useCallback(
    (newOrder: PlanningItem[]) => {
      const reordered = newOrder.map((it, idx) => ({ ...it, position: idx }));
      onItemsChange?.(
        items.filter((i) => !reordered.some((r) => r.id === i.id)).concat(reordered),
      );
      Promise.all(
        reordered.map((it) =>
          fetch(`/api/planning/${it.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ position: it.position }),
          }),
        ),
      ).catch(console.error);
    },
    [items, onItemsChange],
  );

  // ── Drag-to-reorder fluide (indicateur de position + animation layout) ────────

  const [dragId,     setDragId]     = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: "before" | "after" } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos  = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget((prev) =>
      prev?.id === id && prev.pos === pos ? prev : { id, pos }
    );
  }, []);

  const onDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const fromId = dragIdRef.current;
    const pos    = dropTarget?.pos ?? "after";
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
    if (!fromId || fromId === targetId) return;
    const fromIdx = displayItems.findIndex((i) => i.id === fromId);
    if (fromIdx === -1) return;
    const newOrder = [...displayItems];
    const [moved]  = newOrder.splice(fromIdx, 1);
    const targetIdx = newOrder.findIndex((i) => i.id === targetId);
    if (targetIdx === -1) return;
    newOrder.splice(pos === "before" ? targetIdx : targetIdx + 1, 0, moved);
    handleReorder(newOrder);
  }, [displayItems, handleReorder, dropTarget]);

  const onDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl bg-white overflow-hidden h-full"
      style={{
        fontFamily:          "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)",
      }}
    >

      {/* ── Toolbar unifiée ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-black/[0.06] bg-white/80 backdrop-blur-sm">
        <button
          onClick={addRow}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold shrink-0",
            "bg-blue-500 text-white hover:bg-blue-600 active:scale-95",
            "transition-[background-color,transform] duration-[80ms] shadow-sm shadow-blue-200/60",
          )}
          aria-label="Ajouter une ligne"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Ajouter</span>
        </button>

        <div className="h-4 w-px bg-slate-200 shrink-0" />
        <SearchBar value={search} onChange={setSearch} className="flex-1 min-w-0 max-w-[240px]" />
        <div className="h-4 w-px bg-slate-200 shrink-0" />

        {/* Avatars équipe — filtre rapide */}
        <div className="flex items-center gap-1 shrink-0">
          {TEAM.map((person) => (
            <button
              key={person.key}
              onClick={() => setFilterPerson((p) => p === person.key ? "" : person.key)}
              title={person.name}
              className={cn(
                "h-6 w-6 rounded-full text-[10px] font-bold transition-all duration-[80ms]",
                filterPerson === person.key
                  ? "bg-blue-500 text-white scale-110 shadow-sm shadow-blue-300/60"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              {person.name[0]}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        {/* Bouton urgences */}
        <button
          onClick={() => setFilterUrgent((p) => !p)}
          title="Filtrer les urgences (HAUTE + deadline proche)"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold shrink-0 transition-all duration-[80ms]",
            filterUrgent
              ? "bg-orange-50 text-orange-600 border border-orange-200"
              : "bg-slate-100/80 text-slate-500 hover:bg-orange-50 hover:text-orange-500 border border-transparent",
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          Urgences
        </button>

        {/* Indicateur de sauvegarde global */}
        <AnimatePresence>
          {savingIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-[11px] text-amber-500 font-medium ml-auto shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Sauvegarde…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="border-b border-black/[0.06] bg-white overflow-x-auto">
        <div className="flex justify-start items-stretch gap-0 px-4 min-w-max">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count  = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2.5 text-[13px]",
                  "whitespace-nowrap transition-[color] duration-[80ms]",
                  active
                    ? "text-blue-600 font-semibold"
                    : "text-slate-500 font-medium hover:text-slate-800",
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[11px] font-semibold transition-[background-color,color] duration-[80ms]",
                    active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
                  )}>
                    {count}
                  </span>
                )}
                {/* Trait bleu animé en bas de l'onglet actif */}
                {active && (
                  <motion.div
                    layoutId="tab-active-line"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-t-full"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1">
        <div style={{ minWidth: "1050px" }}>

          {/* Column headers — sticky */}
          <div className="grid bg-[#f9f9fb] border-b border-black/[0.06] border-l-4 border-l-transparent sticky top-0 z-10" style={GRID_STYLE}>
            {COL_HEADERS.map(({ label, align, sortKey }, i) => {
              const isSorted = sortConfig?.col === sortKey;
              return (
                <div
                  key={i}
                  onClick={sortKey ? () => setSortConfig((prev) =>
                    prev?.col === sortKey
                      ? prev.dir === "asc" ? { col: sortKey, dir: "desc" } : null
                      : { col: sortKey, dir: "asc" }
                  ) : undefined}
                  className={cn(
                    "px-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    "flex items-center gap-1",
                    align === "center" ? "justify-center" : "",
                    sortKey ? "cursor-pointer select-none hover:text-slate-600 transition-colors duration-[80ms]" : "",
                    isSorted ? "text-blue-500" : "text-slate-500",
                  )}
                >
                  {label}
                  {sortKey && (
                    isSorted
                      ? sortConfig?.dir === "asc"
                        ? <ArrowUp className="h-2.5 w-2.5" />
                        : <ArrowDown className="h-2.5 w-2.5" />
                      : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Rows — layout animé + indicateur de position fluide */}
          <div
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
            }}
          >
              {displayItems.map((item) => {
                if (!item?.id) return null;
                const isDeleting  = deletingIds.has(item.id);
                const urgent      = isUrgent(item.deadline);
                const itemType    = (types[item.id] ?? "") as ItemType;
                const typeConfig  = TYPE_CONFIG[itemType] ?? TYPE_CONFIG[""];
                const isDone      = item.status === "TERMINE" || item.status === "FACTURE_FAITE";
                const isNew       = newRowId === item.id;
                const rowBg = isDone
                  ? "bg-[#fafafa] hover:bg-[#f7f7f7]"
                  : urgent
                  ? "bg-red-50/70 hover:bg-red-50"
                  : "bg-white hover:bg-[#f5f5f7]/60";
                const isDragging = dragId === item.id;
                const isTarget   = dropTarget?.id === item.id;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={isNew ? { opacity: 0, y: -6 } : false}
                    animate={{ opacity: isDragging ? 0.38 : 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.85 }}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, item.id)}
                    onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, item.id)}
                    onDrop={(e) => onDrop(e as unknown as React.DragEvent, item.id)}
                    onDragEnd={onDragEnd}
                    className="relative"
                  >
                    {/* Ligne indicatrice de dépôt — avant */}
                    <AnimatePresence>
                      {isTarget && dropTarget?.pos === "before" && (
                        <motion.div
                          layoutId="dnd-drop-line"
                          className="absolute top-0 left-0 right-0 h-[2.5px] rounded-full bg-blue-500 z-20 pointer-events-none"
                          initial={{ opacity: 0, scaleX: 0.6 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </AnimatePresence>
                    {/* Ligne indicatrice de dépôt — après */}
                    <AnimatePresence>
                      {isTarget && dropTarget?.pos === "after" && (
                        <motion.div
                          layoutId="dnd-drop-line"
                          className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-blue-500 z-20 pointer-events-none"
                          initial={{ opacity: 0, scaleX: 0.6 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </AnimatePresence>
                    <div
                      className={cn(
                        "grid w-full border-b border-black/[0.04] group relative",
                        "transition-[background-color,opacity,filter] duration-[80ms]",
                        "border-l-4", isDone ? "border-l-slate-200" : typeConfig.border,
                        "min-h-[52px]",
                        rowBg,
                        isDone && "saturate-[0.4]",
                        isNew && "ring-1 ring-inset ring-blue-300/40",
                        isDeleting && "pointer-events-none",
                      )}
                      style={{
                        ...GRID_STYLE,
                        opacity: isDeleting ? 0.25 : isDone ? 0.6 : 1,
                        transition: "opacity 0.1s, background-color 0.08s, filter 0.08s",
                      }}
                    >


                      {/* 0 · Grip */}
                      <div className="h-full flex items-center justify-center cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                      </div>

                      {/* 1 · Type (feature 10) */}
                      <div className="h-full flex items-center justify-center px-1">
                        <TypePicker value={itemType} onChange={(v) => setType(item.id, v)} />
                      </div>

                      {/* 2 · Priorité */}
                      <div className={CELL_WRAP}>
                        <div className="relative w-full">
                          <span className={cn(
                            "flex items-center justify-center gap-1 h-7 px-2.5 rounded-full",
                            "text-[12px] font-semibold cursor-pointer select-none w-full",
                            "transition-[opacity,transform] duration-150 hover:opacity-75 active:scale-95",
                            PRIORITY_CONFIG[item.priority].style,
                          )}>
                            {PRIORITY_CONFIG[item.priority].label}
                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                          </span>
                          <select
                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            value={item.priority}
                            onChange={(e) => saveNow(item.id, "priority", e.target.value)}
                          >
                            <option value="BASSE">Basse</option>
                            <option value="MOYENNE">Moyenne</option>
                            <option value="HAUTE">Haute</option>
                          </select>
                        </div>
                      </div>

                      {/* 3 · Client */}
                      <div className={CELL_WRAP}>
                        <ClientNameCell
                          value={item.clientName}
                          clientId={item.clientId ?? null}
                          isEditing={isEditingCell(item.id, "clientName")}
                          onStartEdit={() => startEdit(item.id, "clientName", item.clientName)}
                          onChange={(v) => updateItem(item.id, "clientName", v)}
                          onBlurSave={(v) => handleBlurSave(item.id, "clientName", toTitleCase(v))}
                          onKeyDown={(e) => handleKeyDown(e, item.id, "clientName")}
                          onSelectClient={(client) => {
                            // Save both clientName and clientId atomically
                            onItemsChange?.(
                              items.map((it) =>
                                it.id === item.id
                                  ? { ...it, clientName: client.nom, clientId: client.id }
                                  : it
                              )
                            );
                            persist(item.id, { clientName: client.nom, clientId: client.id });
                            setEditing(null);
                          }}
                        />
                      </div>

                      {/* 4 · Secteur (feature 7 — juste après Client) */}
                      <div className={CELL_WRAP}>
                        <SecteurPicker
                          value={item.color ?? ""}
                          onChange={(v) => saveNow(item.id, "color", v)}
                        />
                      </div>

                      {/* 5 · Quantité — input direct sans flèches (feature 5) */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "quantity") ? (
                          <input
                            type="number"
                            value={item.quantity}
                            autoFocus
                            min="1"
                            onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                            onBlur={(e)   => handleBlurSave(item.id, "quantity", parseFloat(e.target.value) || 1)}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "quantity")}
                            className={cn(
                              CELL_INPUT, "text-center",
                              "[appearance:textfield]",
                              "[&::-webkit-outer-spin-button]:appearance-none",
                              "[&::-webkit-inner-spin-button]:appearance-none",
                            )}
                            placeholder="1"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "quantity", item.quantity)}
                            className={cn(
                              "w-full h-8 px-2.5 text-[12px] text-slate-800 rounded-lg cursor-text",
                              "flex items-center justify-center font-semibold tabular-nums",
                              "hover:bg-black/[0.03] transition-colors duration-100 select-none",
                            )}
                          >
                            {item.quantity}
                          </div>
                        )}
                      </div>

                      {/* 6 · Note — textarea auto-expand, toutes les notes visibles */}
                      <div className="py-1 px-1.5 min-w-0 flex items-start">
                        <textarea
                          value={item.note}
                          onChange={(e) => updateItem(item.id, "note", e.target.value)}
                          onFocus={() => startEdit(item.id, "note", item.note)}
                          onBlur={(e) => handleBlurSave(item.id, "note", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, item.id, "note")}
                          placeholder="Note…"
                          rows={1}
                          className={cn(
                            "w-full px-2 py-1 text-[12px] italic bg-transparent rounded-lg resize-none overflow-hidden leading-snug",
                            "border border-transparent hover:border-slate-200",
                            "focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100/70 focus:outline-none",
                            "transition-[border-color,background-color,box-shadow] duration-100 placeholder:text-slate-300",
                            item.note ? "text-slate-500" : "text-slate-300",
                          )}
                          style={{ fieldSizing: "content", minHeight: "2rem" } as React.CSSProperties}
                        />
                      </div>

                      {/* 7 · Échéance hybride JJ/MM + calendrier (feature 6) */}
                      <div className={CELL_WRAP}>
                        <HybridDateInput
                          value={item.deadline}
                          onChange={(v) => saveNow(item.id, "deadline", v)}
                          urgent={urgent}
                        />
                      </div>

                      {/* 8 · État */}
                      <div className={CELL_WRAP}>
                        <StatusPicker
                          value={item.status}
                          onChange={(v) => saveNow(item.id, "status", v)}
                        />
                      </div>

                      {/* 9 · Interne — clic droit sur le nom = filtre rapide */}
                      <div className={CELL_WRAP}>
                        <div className="relative flex items-center gap-1">
                          <AppleSelect
                            value={item.responsible}
                            displayLabel={TEAM.find((p) => p.key === item.responsible)?.name ?? "—"}
                            onChange={(v) => saveNow(item.id, "responsible", v)}
                            pillStyle="font-medium"
                          >
                            <option value="">—</option>
                            {TEAM.map((p) => (
                              <option key={p.key} value={p.key}>{p.name}</option>
                            ))}
                          </AppleSelect>
                        </div>
                      </div>

                      {/* 9b · Détails — bouton overlay visible au hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailId(item.id); }}
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 right-[48px] z-10",
                          "opacity-0 group-hover:opacity-100",
                          "p-1 rounded-md text-slate-300 hover:text-blue-500 hover:bg-blue-50",
                          "transition-[opacity,color,background-color] duration-100",
                        )}
                        title="Voir les détails"
                        type="button"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {/* 10 · Supprimer (2 clics pour confirmer) */}
                      <div className="h-full flex items-center justify-center">
                        <button
                          onClick={() => {
                            if (confirmDeleteId === item.id) {
                              if (confirmDeleteTimer.current) clearTimeout(confirmDeleteTimer.current);
                              setConfirmDeleteId(null);
                              handleDelete(item.id);
                            } else {
                              setConfirmDeleteId(item.id);
                              if (confirmDeleteTimer.current) clearTimeout(confirmDeleteTimer.current);
                              confirmDeleteTimer.current = setTimeout(() => setConfirmDeleteId(null), 3000);
                            }
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-[color,box-shadow] duration-150",
                            "opacity-0 group-hover:opacity-100",
                            confirmDeleteId === item.id
                              ? "text-red-500 ring-1 ring-red-300"
                              : "text-slate-300 hover:text-red-400",
                          )}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
          </div>

          {/* Ghost row — ajouter rapidement en bas de liste */}
          {displayItems.length > 0 && !search && !filterPerson && (
            <button
              onClick={addRow}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium",
                "text-slate-300 hover:text-blue-400 hover:bg-blue-50/40",
                "border-t border-dashed border-slate-100 hover:border-blue-200",
                "transition-[background-color,color,border-color] duration-150 group/ghost",
              )}
            >
              <Plus className="h-3.5 w-3.5 opacity-50 group-hover/ghost:opacity-100 transition-opacity" />
              Ajouter une ligne
            </button>
          )}

          {/* Empty state — contextualisé par onglet */}
          {displayItems.length === 0 && (() => {
            const TAB_EMPTY: Record<TabKey, { icon: React.ReactNode; label: string }> = {
              general:          { icon: <Package className="h-5 w-5 text-slate-300" />,  label: "Aucune commande" },
              textiles:         { icon: <Shirt className="h-5 w-5 text-emerald-200" />,  label: "Aucune commande Textiles" },
              gravure:          { icon: <Scissors className="h-5 w-5 text-violet-200" />, label: "Aucune commande Gravure & Découpe" },
              "impression-uv":  { icon: <Printer className="h-5 w-5 text-cyan-200" />,   label: "Aucune commande Impression UV" },
              goodies:          { icon: <Package className="h-5 w-5 text-amber-200" />,  label: "Aucune commande Goodies" },
            };
            const ctx = search ? null : TAB_EMPTY[activeTab];
            return (
              <div className="flex flex-col items-center justify-center py-16 text-center select-none gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                  {search ? <Search className="h-5 w-5 text-slate-200" /> : ctx?.icon}
                </div>
                <p className="text-[13px] text-slate-400">
                  {search ? `Aucun résultat pour « ${search} »` : (filterUrgent ? "Aucune urgence pour cette vue" : ctx?.label)}
                </p>
                {search && (
                  <button onClick={() => setSearch("")} className="text-[12px] text-blue-500 hover:underline transition-colors">
                    Effacer la recherche
                  </button>
                )}
                {!search && !filterUrgent && (
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-[80ms]"
                  >
                    <Plus className="h-3 w-3" /> Ajouter une commande
                  </button>
                )}
              </div>
            );
          })()}

          {/* Footer stats */}
          {displayItems.length > 0 && (() => {
            const urgentCount = displayItems.filter((i) => isUrgent(i.deadline) || i.priority === "HAUTE").length;
            const doneCount   = displayItems.filter((i) => i.status === "TERMINE" || i.status === "FACTURE_FAITE").length;
            return (
              <div className="flex items-center gap-4 px-4 py-2 border-t border-black/[0.04] bg-[#f9f9fb]">
                <span className="text-[11px] text-slate-400 font-medium">
                  {displayItems.length} commande{displayItems.length > 1 ? "s" : ""}
                </span>
                {urgentCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-orange-500 font-medium">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
                  </span>
                )}
                {doneCount > 0 && (
                  <span className="text-[11px] text-green-600 font-medium">
                    {doneCount} terminée{doneCount > 1 ? "s" : ""}
                  </span>
                )}
                {sortConfig && (
                  <button
                    onClick={() => setSortConfig(null)}
                    className="ml-auto text-[11px] text-blue-500 hover:text-blue-700 hover:underline transition-colors duration-[80ms]"
                  >
                    Réinitialiser le tri
                  </button>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ── Slide-over détails ───────────────────────────────────────────────── */}
      <PlanningDetailPanel
        item={items.find((i) => i.id === detailId) ?? null}
        itemType={detailId ? (types[detailId] ?? "") : ""}
        onClose={() => setDetailId(null)}
      />

    </div>
  );
}

// ── PlanningDetailPanel — panneau latéral Apple-style ────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</span>
      <div className="text-[13px] text-slate-700">{children}</div>
    </div>
  );
}

function PlanningDetailPanel({
  item,
  itemType,
  onClose,
}: {
  item:      PlanningItem | null;
  itemType?: string;
  onClose:   () => void;
}) {
  // Fermer sur Escape
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const secteurCfg  = SECTEUR_CONFIG.find((s) => s.value === item?.color);
  const priorityCfg = PRIORITY_CONFIG[item?.priority ?? "MOYENNE"];
  const statusLabel = item ? STATUS_LABELS[item.status] : "";
  const statusDot   = item ? STATUS_CONFIG[item.status] : "bg-slate-300";
  const days        = daysUntil(item?.deadline ?? null);
  const responsible = TEAM.find((p) => p.key === item?.responsible);

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Panneau */}
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.9 }}
            className="fixed right-0 top-0 h-full w-[400px] max-w-[96vw] bg-white z-50 flex flex-col"
            style={{ boxShadow: "-2px 0 32px rgba(0,0,0,0.12), -1px 0 0 rgba(0,0,0,0.04)" }}
          >
            {/* Header panneau */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot)} />
                <h2 className="text-[14px] font-semibold text-slate-800 truncate max-w-[280px]">
                  {item.clientName || "Nouvelle commande"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Client */}
              <DetailRow label="Client">
                <div className="flex items-center gap-1.5">
                  {item.clientId && <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                  <span className="font-semibold text-slate-800">{item.clientName || "—"}</span>
                </div>
              </DetailRow>

              {/* Type + Priorité */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Type">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", (TYPE_CONFIG[itemType as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG[""]).badge)}>
                    {(TYPE_CONFIG[itemType as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG[""]).label}
                  </span>
                </DetailRow>
                <DetailRow label="Priorité">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", priorityCfg.style)}>
                    {priorityCfg.label}
                  </span>
                </DetailRow>
              </div>

              {/* Secteur + Quantité */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Secteur">
                  {secteurCfg ? (
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", secteurCfg.pill)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", secteurCfg.dot)} />
                      {secteurCfg.label}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </DetailRow>
                <DetailRow label="Quantité">
                  <span className="font-semibold tabular-nums">{item.quantity ?? "—"}</span>
                </DetailRow>
              </div>

              {/* Échéance */}
              <DetailRow label="Échéance">
                <div className="flex items-center gap-2">
                  <span className={cn("tabular-nums font-medium", item.deadline ? "text-slate-800" : "text-slate-300")}>
                    {item.deadline ? formatDDMM(item.deadline) : "—"}
                  </span>
                  {days !== null && <DaysChip days={days} />}
                </div>
              </DetailRow>

              {/* État */}
              <DetailRow label="État">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot)} />
                  <span>{statusLabel}</span>
                </div>
              </DetailRow>

              {/* Responsable */}
              <DetailRow label="Responsable interne">
                {responsible ? (
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {responsible.name[0]}
                    </span>
                    <span className="font-medium">{responsible.name}</span>
                  </div>
                ) : <span className="text-slate-300">—</span>}
              </DetailRow>

              {/* Note */}
              <DetailRow label="Note / Précisions">
                {item.note ? (
                  <p className="whitespace-pre-wrap text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-2.5 text-[13px]">
                    {item.note}
                  </p>
                ) : (
                  <span className="text-slate-300 italic">Aucune note</span>
                )}
              </DetailRow>

            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-black/[0.06] flex items-center justify-between bg-slate-50/70">
              <span className="text-[11px] text-slate-400 font-mono truncate">#{item.id.slice(-8)}</span>
              <button
                onClick={onClose}
                className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
