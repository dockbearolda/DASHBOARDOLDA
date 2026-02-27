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
import { motion, Reorder, AnimatePresence } from "framer-motion";
import {
  Trash2, Plus, ChevronDown, GripVertical, Search, Calendar, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface PlanningItem {
  id: string;
  priority:    "BASSE" | "MOYENNE" | "HAUTE";
  clientName:  string;
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

const GRID_COLS =
  "32px 76px 94px 175px 158px 64px minmax(78px,1fr) 165px 172px 108px 40px";
const GRID_STYLE: CSSProperties = { gridTemplateColumns: GRID_COLS };

const COL_HEADERS = [
  { label: "",         align: "center" },
  { label: "Type",     align: "center" },
  { label: "Priorité", align: "left"   },
  { label: "Client",   align: "left"   },
  { label: "Secteur",  align: "left"   },
  { label: "Qté",      align: "center" },
  { label: "Note",     align: "left"   },
  { label: "Échéance", align: "left"   },
  { label: "État",     align: "left"   },
  { label: "Interne",  align: "center" },
  { label: "",         align: "center" },
] as const;

// ── Shared styles ───────────────────────────────────────────────────────────────

const CELL_INPUT =
  "w-full h-8 px-2.5 text-[13px] text-slate-900 bg-white rounded-lg " +
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
function SearchBar({ value, onChange, maxWidth }: { value: string; onChange: (v: string) => void; maxWidth?: string }) {
  return (
    <div
      style={{ maxWidth }}
      className={cn(
        "flex items-center gap-2.5 h-9 px-3.5 rounded-xl w-full",
        "bg-white/60 backdrop-blur-md border border-slate-200/80 shadow-sm",
        "transition-all duration-200",
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
        "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest",
        "transition-all duration-150 active:scale-95 select-none whitespace-nowrap",
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
          "w-full px-2.5 py-1.5 text-[13px] italic text-slate-600 bg-white rounded-xl",
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
        "w-full px-2.5 text-[13px] rounded-lg cursor-text leading-snug",
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
        "transition-all duration-100",
        cfg
          ? cn(cfg.pill, "hover:opacity-80")
          : "bg-white/50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200",
      )}>
        {cfg && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />}
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
        "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[13px]",
        "border-slate-100 bg-white/50 text-slate-800",
        "hover:bg-white hover:border-slate-200 cursor-pointer transition-all duration-100",
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

// Jours restants — chip coloré (feature « jours restants »)
function DaysChip({ days }: { days: number }) {
  if (days === 0)  return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">auj.</span>;
  if (days === 1)  return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-100">dem.</span>;
  if (days > 0)    return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-50 text-blue-500 border border-blue-100">+{days}j</span>;
  /* dépassée */   return <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">{days}j</span>;
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
        placeholder="JJ/MM/AA"
        maxLength={8}
        className={cn(
          "w-[82px] shrink-0 h-8 px-2 text-[13px] rounded-lg border bg-transparent",
          "focus:outline-none focus:ring-2 focus:border-blue-300 focus:ring-blue-100/70 focus:bg-white",
          "transition-all duration-100 tabular-nums",
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

// ── Main component ──────────────────────────────────────────────────────────────

export function PlanningTable({ items, onItemsChange, onEditingChange }: PlanningTableProps) {
  const [editing,     setEditing]     = useState<string | null>(null);
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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

  // Search + person filter
  const displayItems = useMemo(() => {
    let result = tabItems;
    if (filterPerson) result = result.filter((i) => i.responsible === filterPerson);
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(
      (i) =>
        i.clientName.toLowerCase().includes(q) ||
        i.designation.toLowerCase().includes(q) ||
        i.note.toLowerCase().includes(q),
    );
  }, [tabItems, search, filterPerson]);

  // Tab counts
  const tabCounts = useMemo((): Record<TabKey, number> => ({
    general:        sorted.length,
    textiles:       sorted.filter((i) => i.color === "Textiles").length,
    gravure:        sorted.filter((i) => i.color === "Gravure et découpe laser").length,
    "impression-uv":sorted.filter((i) => i.color === "Impression UV").length,
    goodies:        sorted.filter((i) => i.color === "Goodies").length,
  }), [sorted]);

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
    const newId    = `r${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const maxPos   = sorted.length > 0 ? Math.max(...sorted.map((s) => s.position)) : 0;
    const position = maxPos + 1;
    const newItem: PlanningItem = {
      id: newId, priority: "MOYENNE", clientName: "", quantity: 1,
      designation: "", note: "", unitPrice: 0, deadline: null,
      status: "A_DEVISER", responsible: "", color: "", position,
    };
    onItemsChange?.([...items, newItem]);
    setEditing(`${newId}:clientName`);
    fetch("/api/planning", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...newItem, deadline: null }),
    }).catch((e) => console.error("Failed to save new row:", e));
  }, [items, sorted, onItemsChange]);

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden"
      style={{
        fontFamily:          "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white">
        <button
          onClick={addRow}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium",
            "bg-blue-500 text-white hover:bg-blue-600 active:scale-95",
            "transition-all duration-150 shadow-sm shadow-blue-200 shrink-0",
          )}
          aria-label="Ajouter une ligne"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Ajouter</span>
        </button>

        {/* Compteur total */}
        <span className="text-[12px] text-slate-400 font-medium tabular-nums">
          {sorted.length} ligne{sorted.length !== 1 ? "s" : ""}
        </span>

        {/* Filtre par personne */}
        {filterPerson && (
          <button
            onClick={() => setFilterPerson("")}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold",
              "bg-blue-50 text-blue-600 border border-blue-200",
              "hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors duration-150",
            )}
          >
            {TEAM.find((p) => p.key === filterPerson)?.name}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
        <SearchBar value={search} onChange={setSearch} maxWidth="60%" />
      </div>

      {/* ── Tabs (feature 8) ────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
        <div className="flex justify-start items-end gap-1 px-4 min-w-max">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count  = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium",
                  "whitespace-nowrap transition-colors duration-150 rounded-t-lg",
                  "border border-b-0",
                  active
                    ? "text-blue-600 bg-white border-slate-200 shadow-sm"
                    : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100/60",
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[11px] font-semibold",
                    active ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: "1200px" }}>

          {/* Column headers */}
          <div className="grid bg-slate-50/70 border-b border-slate-100" style={GRID_STYLE}>
            {COL_HEADERS.map(({ label, align }, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400",
                  align === "center" && "text-center",
                  (align as string) === "right" && "text-right",
                )}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}
          <Reorder.Group as="div" axis="y" values={displayItems} onReorder={handleReorder}>
            <AnimatePresence mode="popLayout" initial={false}>
              {displayItems.map((item) => {
                if (!item?.id) return null;
                const isDeleting  = deletingIds.has(item.id);
                const isSaving    = savingIds.has(item.id);
                const urgent      = isUrgent(item.deadline);
                const itemType    = (types[item.id] ?? "") as ItemType;
                const typeConfig  = TYPE_CONFIG[itemType] ?? TYPE_CONFIG[""];
                const isNoteEdit  = isEditingCell(item.id, "note");

                const rowBg = urgent
                  ? "bg-red-50 hover:bg-red-100/40"
                  : "bg-white hover:bg-slate-50/70";

                return (
                  <Reorder.Item key={item.id} value={item} as="div">
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: isDeleting ? 0.25 : 1, y: 0 }}
                      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 42 }}
                      className={cn(
                        "grid w-full border-b border-slate-100 group relative",
                        "transition-colors duration-100",
                        "border-l-4", typeConfig.border,
                        "min-h-[44px]",
                        rowBg,
                        isDeleting && "pointer-events-none",
                      )}
                      style={GRID_STYLE}
                    >

                      {/* Save indicator */}
                      <AnimatePresence>
                        {isSaving && (
                          <motion.span
                            key="dot"
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse z-10 pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

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
                            "text-[11px] font-semibold cursor-pointer select-none w-full",
                            "transition-all duration-150 hover:opacity-75 active:scale-95",
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
                        {isEditingCell(item.id, "clientName") ? (
                          <input
                            type="text"
                            value={item.clientName}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "clientName", toTitleCase(e.target.value))}
                            onBlur={(e)   => handleBlurSave(item.id, "clientName", toTitleCase(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "clientName")}
                            className={cn(CELL_INPUT, "font-medium")}
                            placeholder="Nom Prénom"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "clientName", item.clientName)}
                            className={cn(
                              "w-full h-8 px-2.5 text-[13px] rounded-lg cursor-text font-medium",
                              "flex items-center hover:bg-black/[0.03] transition-colors duration-100 select-none truncate",
                              item.clientName ? "text-slate-800" : EMPTY_CLS,
                            )}
                          >
                            {item.clientName || "Nom Prénom"}
                          </div>
                        )}
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
                              "w-full h-8 px-2.5 text-[13px] text-slate-800 rounded-lg cursor-text",
                              "flex items-center justify-center font-semibold tabular-nums",
                              "hover:bg-black/[0.03] transition-colors duration-100 select-none",
                            )}
                          >
                            {item.quantity}
                          </div>
                        )}
                      </div>

                      {/* 6 · Note — multi-ligne → agrandit la ligne verticalement */}
                      <div className="px-1.5 py-[13px] min-w-0 overflow-visible">
                        <NoteCell
                          note={item.note}
                          isEditing={isNoteEdit}
                          onStartEdit={() => startEdit(item.id, "note", item.note)}
                          onUpdate={(v) => updateItem(item.id, "note", v)}
                          onBlurSave={(v) => handleBlurSave(item.id, "note", v)}
                          onCancel={() => { updateItem(item.id, "note", preEdit.current); setEditing(null); }}
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
                        <AppleSelect
                          value={item.status}
                          displayLabel={STATUS_LABELS[item.status]}
                          onChange={(v) => saveNow(item.id, "status", v as PlanningStatus)}
                        >
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </AppleSelect>
                      </div>

                      {/* 9 · Interne — clic droit sur le nom = filtre rapide */}
                      <div className={CELL_WRAP}>
                        <div className="relative flex items-center gap-1">
                          {item.responsible && (
                            <button
                              title={`Filtrer : ${TEAM.find((p) => p.key === item.responsible)?.name}`}
                              onClick={() => setFilterPerson(
                                filterPerson === item.responsible ? "" : item.responsible
                              )}
                              className={cn(
                                "shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors duration-150",
                                filterPerson === item.responsible
                                  ? "bg-blue-500 text-white"
                                  : "bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-500",
                              )}
                            >
                              {TEAM.find((p) => p.key === item.responsible)?.name?.[0] ?? "?"}
                            </button>
                          )}
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

                      {/* 10 · Supprimer */}
                      <div className="h-full flex items-center justify-center">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className={cn(
                            "p-1.5 rounded-md transition-all duration-150",
                            "opacity-0 group-hover:opacity-100",
                            "text-slate-300 hover:text-red-400 hover:bg-red-50",
                          )}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>

          {/* Ghost row — ajouter rapidement en bas de liste */}
          {displayItems.length > 0 && !search && !filterPerson && (
            <button
              onClick={addRow}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium",
                "text-slate-300 hover:text-blue-400 hover:bg-blue-50/40",
                "border-t border-dashed border-slate-100 hover:border-blue-200",
                "transition-all duration-150 group/ghost",
              )}
            >
              <Plus className="h-3.5 w-3.5 opacity-50 group-hover/ghost:opacity-100 transition-opacity" />
              Ajouter une ligne
            </button>
          )}

          {/* Empty state */}
          {displayItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center select-none">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                <Search className="h-5 w-5 text-slate-200" />
              </div>
              <p className="text-[13px] text-slate-400">
                {search
                  ? `Aucun résultat pour « ${search} »`
                  : "Aucune commande dans cette vue"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-[12px] text-blue-500 hover:underline transition-colors"
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
