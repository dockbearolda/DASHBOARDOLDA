"use client";

/**
 * PlanningTable — Inline-editable, Apple Design Language
 *
 * Architecture :
 *   • Draft row    : ligne locale (useState) créée avant tout write en BDD
 *   • Click-to-edit: cellule = texte au repos → input/select au clic
 *   • Auto-save    : sauvegarde onBlur pour textes/nombres, immédiate pour selects
 *   • Save dot     : indicateur bleu pulsant (iOS style) pendant le PATCH
 *   • Total live   : recalcul en temps réel dès frappe sur qté ou prix
 *   • Urgence      : fond rouge si échéance ≤ 1 jour ou dépassée
 *   • Priorité     : menu déroulant Apple (Basse / Moyenne / Haute)
 *   • Désignation  : menu déroulant sélectif (Tshirt, Mug, Textile, Accessoire, Autre)
 *   • Note         : auto-expand hauteur quand le texte va à la ligne
 *   • Couleur      : 5 pastilles de couleur par ligne
 *   • Drag-reorder : poignée de glissement visible pour réordonner les lignes
 *   • Keep-adding  : nouvelles lignes ajoutées en bas
 */

import { useState, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlanningItem {
  id: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE";
  clientName: string;
  quantity: number;
  designation: string;
  note: string;
  unitPrice: number;
  deadline: string | null;
  status: PlanningStatus;
  responsible: string;
  color: string;
  position: number;
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
  items: PlanningItem[];
  onItemsChange?: (items: PlanningItem[]) => void;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  BASSE:   "bg-slate-200/80 text-slate-600",
  MOYENNE: "bg-blue-100 text-blue-600",
  HAUTE:   "bg-orange-100 text-orange-600",
};

const PRIORITY_LABEL: Record<string, string> = {
  BASSE:   "Basse",
  MOYENNE: "Moyenne",
  HAUTE:   "Haute",
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

const QTY_PRESETS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500];

const PRICE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500];

const DESIGNATION_OPTIONS = [
  { value: "Tshirt",     label: "Tshirt" },
  { value: "Mug",        label: "Mug" },
  { value: "Textile",    label: "Textile" },
  { value: "Accessoire", label: "Accessoire", needsPrecision: true },
  { value: "Autre",      label: "Autre",      needsPrecision: true },
] as const;

// 5 codes couleur de ligne
const COLORS = [
  { key: "rose",   dot: "bg-rose-400",   row: "bg-rose-50",   hover: "hover:bg-rose-100/60"   },
  { key: "orange", dot: "bg-orange-400", row: "bg-orange-50", hover: "hover:bg-orange-100/60" },
  { key: "amber",  dot: "bg-amber-400",  row: "bg-amber-50",  hover: "hover:bg-amber-100/60"  },
  { key: "green",  dot: "bg-green-400",  row: "bg-green-50",  hover: "hover:bg-green-100/60"  },
  { key: "blue",   dot: "bg-blue-400",   row: "bg-blue-50",   hover: "hover:bg-blue-100/60"   },
] as const;

// ── Grille (13 colonnes) ───────────────────────────────────────────────────────
// Grip | Priorité | Client | Désignation | Qté | Note | Prix u. | Total | Échéance | État | Interne | Secteur | ×

const GRID_COLS = "32px 90px 190px 165px 70px 90px 90px 90px 120px 175px 110px 130px 44px";
const GRID_STYLE: CSSProperties = { gridTemplateColumns: GRID_COLS };

const COL_HEADERS = [
  { label: "",            align: "center" },
  { label: "Priorité",    align: "left"   },
  { label: "Client",      align: "left"   },
  { label: "Désignation", align: "left"   },
  { label: "Qté",         align: "center" },
  { label: "Note",        align: "left"   },
  { label: "Prix u.",     align: "right"  },
  { label: "Total",       align: "right"  },
  { label: "Échéance",    align: "left"   },
  { label: "État",        align: "left"   },
  { label: "Interne",     align: "center" },
  { label: "Secteur",     align: "left"   },
  { label: "",            align: "center" },
] as const;

// ── Styles partagés ────────────────────────────────────────────────────────────

const CELL_DISPLAY =
  "w-full h-8 px-2.5 text-[13px] text-slate-800 rounded-lg cursor-text " +
  "flex items-center hover:bg-black/[0.03] active:bg-black/[0.05] " +
  "transition-colors duration-100 select-none overflow-hidden whitespace-nowrap";

const CELL_INPUT =
  "w-full h-8 px-2.5 text-[13px] text-slate-900 bg-white rounded-lg " +
  "border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none";

const EMPTY_TEXT = "text-slate-300 italic font-normal";
const CELL_WRAP  = "h-full flex items-center px-1.5 overflow-hidden min-w-0";

// ── Apple-style select wrapper ─────────────────────────────────────────────────

function AppleSelect({
  value,
  displayLabel,
  onChange,
  children,
  className,
  pillStyle,
}: {
  value: string;
  displayLabel: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  pillStyle?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <div className={cn(
        "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[13px]",
        "border-slate-100 bg-white/50 text-slate-800",
        "hover:bg-white hover:border-slate-200 cursor-pointer transition-all duration-100",
        pillStyle
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function parseDesignation(d: string): { category: string; precision: string } {
  if (!d) return { category: "", precision: "" };
  for (const opt of DESIGNATION_OPTIONS) {
    if ("needsPrecision" in opt && opt.needsPrecision && d.startsWith(opt.value + ": ")) {
      return { category: opt.value, precision: d.slice(opt.value.length + 2) };
    }
    if (d === opt.value) return { category: opt.value, precision: "" };
  }
  return { category: d, precision: "" };
}

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  return (new Date(deadline).getTime() - Date.now()) / 86_400_000 <= 1;
}

function formatDateFR(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getRowBg(color: string, urgent: boolean): string {
  if (urgent) return "bg-red-50 hover:bg-red-100/60";
  const c = COLORS.find((c) => c.key === color);
  return c ? `${c.row} ${c.hover}` : "bg-white hover:bg-slate-50";
}

const SECTEUR_OPTIONS = [
  { value: "Impression DTF", label: "Impression DTF",  color: "bg-pink-100 text-pink-700"    },
  { value: "Gravure",        label: "Gravure",          color: "bg-violet-100 text-violet-700"},
  { value: "Impression UV",  label: "Impression UV",   color: "bg-cyan-100 text-cyan-700"    },
  { value: "Autre",          label: "Autre",            color: "bg-slate-100 text-slate-600"  },
] as const;

// ── Secteur picker ─────────────────────────────────────────────────────────────

function SecteurPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opt = SECTEUR_OPTIONS.find((o) => o.value === value);
  return (
    <div className="relative w-full">
      <div className={cn(
        "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[12px] font-medium",
        "border-slate-100 hover:bg-white hover:border-slate-200 cursor-pointer transition-all duration-100",
        opt ? opt.color : "bg-white/50 text-slate-400"
      )}>
        <span className="truncate flex-1">{opt?.label ?? "—"}</span>
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </div>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {SECTEUR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function PlanningTable({ items, onItemsChange }: PlanningTableProps) {
  const [editing,     setEditing]     = useState<string | null>(null);
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const preEdit = useRef<unknown>(null);

  const sorted = useMemo(
    () =>
      !Array.isArray(items)
        ? []
        : [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0)),
    [items]
  );

  // ── API persist ───────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
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
    },
    []
  );

  const updateItem = useCallback(
    (id: string, field: string, value: unknown) => {
      onItemsChange?.(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    },
    [items, onItemsChange]
  );

  const saveNow = useCallback(
    (id: string, field: string, value: unknown) => {
      updateItem(id, field, value);
      persist(id, { [field]: value });
    },
    [updateItem, persist]
  );

  // ── Click-to-edit ─────────────────────────────────────────────────────────────

  const startEdit = useCallback((id: string, field: string, currentValue: unknown) => {
    preEdit.current = currentValue;
    setEditing(`${id}:${field}`);
  }, []);

  const isEditingCell = useCallback(
    (id: string, field: string) => editing === `${id}:${field}`,
    [editing]
  );

  const handleBlurSave = useCallback(
    (id: string, field: string, value: unknown) => {
      setEditing(null);
      persist(id, { [field]: value });
    },
    [persist]
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
    [updateItem]
  );

  // ── Ajouter une ligne (en bas) ──────────────────────────────────────────────

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

  // ── Delete ────────────────────────────────────────────────────────────────────

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
    [items, onItemsChange]
  );

  // ── Reorder ───────────────────────────────────────────────────────────────────

  const handleReorder = useCallback(
    (newOrder: PlanningItem[]) => {
      const reordered = newOrder.map((it, idx) => ({ ...it, position: idx }));
      onItemsChange?.(
        items
          .filter((i) => !reordered.some((r) => r.id === i.id))
          .concat(reordered)
      );
      Promise.all(
        reordered.map((it) =>
          fetch(`/api/planning/${it.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ position: it.position }),
          })
        )
      ).catch(console.error);
    },
    [items, onItemsChange]
  );

  // ── Designation handler ────────────────────────────────────────────────────────

  const handleDesignationSelect = useCallback(
    (id: string, category: string) => {
      const opt = DESIGNATION_OPTIONS.find((o) => o.value === category);
      if (opt && "needsPrecision" in opt && opt.needsPrecision) {
        updateItem(id, "designation", category);
        setEditing(`${id}:designationPrecision`);
      } else {
        saveNow(id, "designation", category);
        setEditing(null);
      }
    },
    [saveNow, updateItem]
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden"
      style={{
        fontFamily:          "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >

      {/* ── Barre d'outils ──────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-2 border-b border-slate-100">
        <button
          onClick={addRow}
          className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-150"
          aria-label="Ajouter une ligne"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Tableau (scroll horizontal) ─────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="min-w-[1300px]">

          {/* En-têtes */}
          <div
            className="grid bg-slate-50/70 border-b border-slate-100"
            style={GRID_STYLE}
          >
            {COL_HEADERS.map(({ label, align }, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400",
                  align === "center" && "text-center",
                  align === "right"  && "text-right"
                )}
              >
                {label}
              </div>
            ))}
          </div>


          {/* ── Lignes ───────────────────────────────────────────────────────── */}
          <Reorder.Group as="div" axis="y" values={sorted} onReorder={handleReorder}>
            <AnimatePresence mode="popLayout" initial={false}>
              {sorted.map((item) => {
                if (!item?.id) return null;
                const isDeleting = deletingIds.has(item.id);
                const isSaving   = savingIds.has(item.id);
                const total      = item.quantity * item.unitPrice;
                const urgent     = isUrgent(item.deadline);
                const { category: desigCategory } = parseDesignation(item.designation);
                const noteHasLines = item.note.includes("\n");

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
                        noteHasLines ? "min-h-[44px]" : "h-[44px]",
                        getRowBg(item.color ?? "", urgent),
                        isDeleting && "pointer-events-none"
                      )}
                      style={GRID_STYLE}
                    >

                      {/* Indicateur de sauvegarde */}
                      <AnimatePresence>
                        {isSaving && (
                          <motion.span
                            key="saving-dot"
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse z-10 pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

                      {/* 0. Grip handle (drag) */}
                      <div className="h-full flex items-center justify-center cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                      </div>

                      {/* 1. Priorité — menu déroulant Apple */}
                      <div className={CELL_WRAP}>
                        <div className="relative">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer",
                              "transition-all duration-200 hover:opacity-75 active:scale-95 select-none",
                              PRIORITY_STYLE[item.priority]
                            )}
                          >
                            {PRIORITY_LABEL[item.priority]}
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

                      {/* 2. Client — Nom Prénom */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "clientName") ? (
                          <input
                            type="text"
                            value={item.clientName}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "clientName", toTitleCase(e.target.value))}
                            onBlur={(e) => handleBlurSave(item.id, "clientName", toTitleCase(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "clientName")}
                            className={cn(CELL_INPUT, "font-medium")}
                            placeholder="Nom Prénom"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "clientName", item.clientName)}
                            className={cn(CELL_DISPLAY, "font-medium", !item.clientName && EMPTY_TEXT)}
                          >
                            {item.clientName || "Nom Prénom"}
                          </div>
                        )}
                      </div>

                      {/* 3. Désignation — menu déroulant sélectif */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "designationPrecision") ? (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Préciser…"
                            defaultValue={parseDesignation(item.designation).precision}
                            onBlur={(e) => {
                              const precision = e.target.value.trim();
                              const val = precision
                                ? `${desigCategory}: ${precision}`
                                : desigCategory;
                              saveNow(item.id, "designation", val);
                              setEditing(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).blur();
                              } else if (e.key === "Escape") {
                                setEditing(null);
                              }
                            }}
                            className={cn(CELL_INPUT, "text-[12px]")}
                          />
                        ) : (
                          <AppleSelect
                            value={desigCategory}
                            displayLabel={item.designation || "Choisir…"}
                            onChange={(v) => handleDesignationSelect(item.id, v)}
                          >
                            <option value="" disabled>Choisir…</option>
                            {DESIGNATION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </AppleSelect>
                        )}
                      </div>

                      {/* 4. Quantité — menu déroulant Apple */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "quantityCustom") ? (
                          <input
                            type="number"
                            value={item.quantity}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                            onBlur={(e) => {
                              handleBlurSave(item.id, "quantity", parseFloat(e.target.value) || 1);
                            }}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "quantity")}
                            className={cn(CELL_INPUT, "text-center")}
                            placeholder="1"
                            min="1"
                          />
                        ) : (
                          <AppleSelect
                            value={QTY_PRESETS.includes(item.quantity) ? String(item.quantity) : "custom"}
                            displayLabel={String(item.quantity)}
                            onChange={(v) => {
                              if (v === "custom") {
                                preEdit.current = item.quantity;
                                setEditing(`${item.id}:quantityCustom`);
                              } else {
                                saveNow(item.id, "quantity", Number(v));
                              }
                            }}
                          >
                            {QTY_PRESETS.map((q) => (
                              <option key={q} value={String(q)}>{q}</option>
                            ))}
                            <option value="custom">Autre…</option>
                          </AppleSelect>
                        )}
                      </div>

                      {/* 5. Note — auto-expand */}
                      <div className={cn(CELL_WRAP, "items-start py-1.5")}>
                        {isEditingCell(item.id, "note") ? (
                          <textarea
                            value={item.note}
                            autoFocus
                            rows={Math.max(1, item.note.split("\n").length)}
                            onChange={(e) => updateItem(item.id, "note", e.target.value)}
                            onBlur={(e) => handleBlurSave(item.id, "note", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Tab") {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).blur();
                              } else if (e.key === "Escape") {
                                updateItem(item.id, "note", preEdit.current);
                                setEditing(null);
                              }
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 text-[13px] text-slate-900 bg-white rounded-lg",
                              "border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none",
                              "italic text-slate-600 resize-none"
                            )}
                            placeholder="Précisions…"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "note", item.note)}
                            className={cn(
                              "w-full px-2.5 py-1.5 text-[13px] text-slate-500 rounded-lg cursor-text",
                              "hover:bg-black/[0.03] active:bg-black/[0.05]",
                              "transition-colors duration-100 select-none italic",
                              "whitespace-pre-wrap break-words",
                              !item.note && EMPTY_TEXT
                            )}
                          >
                            {item.note || "Précisions…"}
                          </div>
                        )}
                      </div>

                      {/* 6. Prix unitaire — menu déroulant Apple */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "unitPriceCustom") ? (
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              handleBlurSave(item.id, "unitPrice", parseFloat(e.target.value) || 0);
                            }}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "unitPrice")}
                            className={cn(CELL_INPUT, "text-right")}
                            placeholder="0"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          <AppleSelect
                            value={PRICE_PRESETS.includes(item.unitPrice) ? String(item.unitPrice) : "custom"}
                            displayLabel={item.unitPrice ? `${item.unitPrice.toFixed(2)} €` : "—"}
                            onChange={(v) => {
                              if (v === "custom") {
                                preEdit.current = item.unitPrice;
                                setEditing(`${item.id}:unitPriceCustom`);
                              } else {
                                saveNow(item.id, "unitPrice", Number(v));
                              }
                            }}
                          >
                            {PRICE_PRESETS.map((p) => (
                              <option key={p} value={String(p)}>
                                {p === 0 ? "—" : `${p.toFixed(2)} €`}
                              </option>
                            ))}
                            <option value="custom">Autre…</option>
                          </AppleSelect>
                        )}
                      </div>

                      {/* 7. Total — lecture seule */}
                      <div
                        className={cn(
                          "h-full flex items-center justify-end px-3",
                          "text-[13px] font-semibold tabular-nums whitespace-nowrap",
                          total > 0 ? "text-slate-800" : "text-slate-200"
                        )}
                      >
                        {total > 0 ? `${total.toFixed(2)} €` : "—"}
                      </div>

                      {/* 8. Échéance */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "deadline") ? (
                          <input
                            type="date"
                            value={item.deadline ? item.deadline.split("T")[0] : ""}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "deadline", e.target.value || null)}
                            onBlur={(e) => handleBlurSave(item.id, "deadline", e.target.value || null)}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
                            className={cn(
                              "w-full px-2.5 py-[7px] text-[13px] tabular-nums rounded-lg border shadow-sm focus:outline-none focus:ring-2",
                              urgent
                                ? "border-red-300 text-red-700 ring-red-100 bg-white"
                                : "border-blue-300 text-slate-900 ring-blue-100 bg-white"
                            )}
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "deadline", item.deadline)}
                            className={cn(
                              CELL_DISPLAY,
                              "whitespace-nowrap tabular-nums",
                              urgent && "text-red-600 font-semibold not-italic",
                              !item.deadline && EMPTY_TEXT
                            )}
                          >
                            {item.deadline ? formatDateFR(item.deadline) : "—"}
                          </div>
                        )}
                      </div>

                      {/* 9. État — réduit */}
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

                      {/* 10. Interne */}
                      <div className={CELL_WRAP}>
                        <AppleSelect
                          value={item.responsible}
                          displayLabel={TEAM.find((p) => p.key === item.responsible)?.name || "—"}
                          onChange={(v) => saveNow(item.id, "responsible", v)}
                          pillStyle="font-medium"
                        >
                          <option value="">—</option>
                          {TEAM.map((p) => (
                            <option key={p.key} value={p.key}>{p.name}</option>
                          ))}
                        </AppleSelect>
                      </div>

                      {/* 11. Secteur */}
                      <div className={CELL_WRAP}>
                        <SecteurPicker
                          value={item.color ?? ""}
                          onChange={(v) => saveNow(item.id, "color", v)}
                        />
                      </div>

                      {/* Supprimer */}
                      <div className="h-full flex items-center justify-center">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className={cn(
                            "p-1.5 rounded-md transition-all duration-150",
                            "opacity-0 group-hover:opacity-100",
                            "text-slate-300 hover:text-red-400 hover:bg-red-50"
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


        </div>
      </div>
    </div>
  );
}
