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
 *   • Priorité     : pastille cycle (Gris → Bleu → Orange)
 *   • Couleur      : 5 pastilles de couleur par ligne
 *   • Keep-adding  : après validation, nouvelle ligne vide automatique
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Check, X, ChevronDown } from "lucide-react";
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

// ── Draft (ligne temporaire locale, non encore en BDD) ─────────────────────────

interface Draft {
  priority: "BASSE" | "MOYENNE" | "HAUTE";
  clientName: string;
  quantity: number;
  designation: string;
  note: string;
  unitPrice: number;
  deadline: string;
  status: PlanningStatus;
  responsible: string;
  color: string;
}

const DEFAULT_DRAFT: Draft = {
  priority:    "MOYENNE",
  clientName:  "",
  quantity:    1,
  designation: "",
  note:        "",
  unitPrice:   0,
  deadline:    "",
  status:      "A_DEVISER",
  responsible: "",
  color:       "",
};

// ── Constantes ─────────────────────────────────────────────────────────────────

const PRIORITY_CYCLE = ["BASSE", "MOYENNE", "HAUTE"] as const;

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

const QTY_PRESETS = [1, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500];

// 5 codes couleur de ligne
const COLORS = [
  { key: "rose",   dot: "bg-rose-400",   row: "bg-rose-50",   hover: "hover:bg-rose-100/60"   },
  { key: "orange", dot: "bg-orange-400", row: "bg-orange-50", hover: "hover:bg-orange-100/60" },
  { key: "amber",  dot: "bg-amber-400",  row: "bg-amber-50",  hover: "hover:bg-amber-100/60"  },
  { key: "green",  dot: "bg-green-400",  row: "bg-green-50",  hover: "hover:bg-green-100/60"  },
  { key: "blue",   dot: "bg-blue-400",   row: "bg-blue-50",   hover: "hover:bg-blue-100/60"   },
] as const;

// ── Grille (12 colonnes) ───────────────────────────────────────────────────────
// Priorité | Client | Désignation | Qté | Note | Prix u. | Total | Échéance | État | Interne | Couleur | ×

const GRID = "grid-cols-[110px_150px_minmax(140px,1fr)_70px_150px_78px_90px_120px_minmax(150px,1fr)_116px_82px_50px]";

const COL_HEADERS = [
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
  { label: "Couleur",     align: "center" },
  { label: "",            align: "center" },
] as const;

// ── Styles partagés ────────────────────────────────────────────────────────────

const CELL_DISPLAY =
  "w-full h-8 px-2.5 text-[13px] text-slate-800 rounded-lg cursor-text " +
  "flex items-center hover:bg-black/[0.03] active:bg-black/[0.05] " +
  "transition-colors duration-100 select-none";

const CELL_INPUT =
  "w-full h-8 px-2.5 text-[13px] text-slate-900 bg-white rounded-lg " +
  "border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none";

const DRAFT_INPUT =
  "w-full h-8 px-2.5 text-[13px] text-slate-900 bg-white rounded-lg " +
  "border border-blue-200/50 shadow-sm focus:outline-none " +
  "focus:border-blue-300 focus:ring-2 focus:ring-blue-100/60 " +
  "placeholder:text-slate-300";

const EMPTY_TEXT = "text-slate-300 italic font-normal";
const CELL_WRAP  = "h-full flex items-center px-1.5";

// ── Helpers ────────────────────────────────────────────────────────────────────

function nextPriority(p: "BASSE" | "MOYENNE" | "HAUTE"): "BASSE" | "MOYENNE" | "HAUTE" {
  return PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % 3];
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

// ── Color picker (5 pastilles inline) ─────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {COLORS.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(value === c.key ? "" : c.key)}
          title={c.key}
          className={cn(
            "w-[14px] h-[14px] rounded-full transition-all duration-150 shrink-0",
            c.dot,
            value === c.key
              ? "ring-2 ring-offset-1 ring-slate-500 scale-110"
              : "opacity-35 hover:opacity-70 hover:scale-110"
          )}
        />
      ))}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function PlanningTable({ items, onItemsChange }: PlanningTableProps) {
  const [editing,     setEditing]     = useState<string | null>(null);
  const [draft,       setDraft]       = useState<Draft | null>(null);
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [savingDraft, setSavingDraft] = useState(false);
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

  // ── Draft row ─────────────────────────────────────────────────────────────────

  const changeDraft = useCallback(
    (field: keyof Draft, value: unknown) => {
      setDraft((p) => (p ? { ...p, [field]: value } : p));
    },
    []
  );

  const saveDraft = useCallback(async () => {
    if (!draft || savingDraft) return;
    setSavingDraft(true);
    try {
      const res  = await fetch("/api/planning", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...draft, deadline: draft.deadline || null }),
      });
      const { item } = await res.json();
      if (item) {
        onItemsChange?.([item, ...items]);
        // Keep-adding mode: nouvelle ligne vide immédiatement
        setDraft({ ...DEFAULT_DRAFT });
      } else {
        console.error("Draft save: API returned no item");
      }
    } catch (e) {
      console.error("Failed to save draft row:", e);
    } finally {
      setSavingDraft(false);
    }
  }, [draft, savingDraft, items, onItemsChange]);

  // Ouvre un nouveau draft — si un draft existe déjà, le sauvegarde d'abord
  const showDraft = useCallback(() => {
    if (draft) {
      saveDraft(); // sauvegarde la ligne courante → resets to DEFAULT_DRAFT via keep-adding
    } else {
      setDraft({ ...DEFAULT_DRAFT });
    }
  }, [draft, saveDraft]);

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
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 tracking-tight">
            Planning d&apos;Entreprise
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            {sorted.length} ligne{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={showDraft}
          disabled={savingDraft}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold shadow-sm",
            "transition-all duration-200 active:scale-[0.97] select-none",
            savingDraft
              ? "bg-slate-100 text-slate-400 cursor-default"
              : "bg-blue-500 text-white hover:bg-blue-600 shadow-blue-200"
          )}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          Nouvelle ligne
        </button>
      </div>

      {/* ── Tableau (scroll horizontal) ─────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">

          {/* En-têtes */}
          <div className={cn("grid bg-slate-50/70 border-b border-slate-100", GRID)}>
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

          {/* ── Draft row ─────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {draft && (
              <motion.div
                key="draft"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className={cn("grid h-[44px] border-b-2 border-blue-200/60 bg-blue-50/25", GRID)}>

                  {/* Priorité */}
                  <div className={CELL_WRAP}>
                    <button
                      onClick={() => changeDraft("priority", nextPriority(draft.priority))}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all",
                        PRIORITY_STYLE[draft.priority]
                      )}
                    >
                      {PRIORITY_LABEL[draft.priority]}
                    </button>
                  </div>

                  {/* Client */}
                  <div className={CELL_WRAP}>
                    <input
                      type="text"
                      value={draft.clientName}
                      onChange={(e) => changeDraft("clientName", e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setDraft(null);
                        if (e.key === "Enter") saveDraft();
                      }}
                      className={cn(DRAFT_INPUT, "font-medium uppercase tracking-wide")}
                      placeholder="NOM CLIENT"
                      autoFocus
                    />
                  </div>

                  {/* Désignation — avant Qté */}
                  <div className={CELL_WRAP}>
                    <input
                      type="text"
                      value={draft.designation}
                      onChange={(e) => changeDraft("designation", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveDraft(); }}
                      className={DRAFT_INPUT}
                      placeholder="Description du travail…"
                    />
                  </div>

                  {/* Qté */}
                  <div className={CELL_WRAP}>
                    <input
                      type="number"
                      list="draft-qty-list"
                      value={draft.quantity}
                      onChange={(e) => changeDraft("quantity", parseFloat(e.target.value) || 1)}
                      className={cn(DRAFT_INPUT, "text-center")}
                      placeholder="1"
                      min="1"
                    />
                    <datalist id="draft-qty-list">
                      {QTY_PRESETS.map((v) => <option key={v} value={v} />)}
                    </datalist>
                  </div>

                  {/* Note */}
                  <div className={CELL_WRAP}>
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(e) => changeDraft("note", e.target.value)}
                      className={cn(DRAFT_INPUT, "italic placeholder:not-italic")}
                      placeholder="Précisions…"
                    />
                  </div>

                  {/* Prix unitaire */}
                  <div className={CELL_WRAP}>
                    <input
                      type="number"
                      value={draft.unitPrice || ""}
                      onChange={(e) => changeDraft("unitPrice", parseFloat(e.target.value) || 0)}
                      className={cn(DRAFT_INPUT, "text-right")}
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {/* Total live */}
                  <div className="h-full flex items-center justify-end px-3 text-[13px] font-semibold tabular-nums text-slate-700 whitespace-nowrap">
                    {draft.quantity * draft.unitPrice > 0
                      ? `${(draft.quantity * draft.unitPrice).toFixed(2)} €`
                      : "—"}
                  </div>

                  {/* Échéance */}
                  <div className={CELL_WRAP}>
                    <input
                      type="date"
                      value={draft.deadline}
                      onChange={(e) => changeDraft("deadline", e.target.value)}
                      className={cn(DRAFT_INPUT, "text-[13px] tabular-nums")}
                    />
                  </div>

                  {/* État */}
                  <div className={CELL_WRAP}>
                    <div className="relative w-full">
                      <div className={cn(
                        "flex items-center h-8 gap-1 px-2.5 rounded-lg border",
                        "border-blue-200/50 bg-white text-[13px] text-slate-700 shadow-sm"
                      )}>
                        <span className="truncate flex-1">{STATUS_LABELS[draft.status]}</span>
                        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                      </div>
                      <select
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        value={draft.status}
                        onChange={(e) => changeDraft("status", e.target.value as PlanningStatus)}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Interne */}
                  <div className={CELL_WRAP}>
                    <div className="relative w-full">
                      <div className={cn(
                        "flex items-center h-8 gap-1 px-2.5 rounded-lg border",
                        "border-blue-200/50 bg-white text-[13px] text-slate-700 shadow-sm"
                      )}>
                        <span className="truncate flex-1">
                          {TEAM.find((p) => p.key === draft.responsible)?.name || "—"}
                        </span>
                        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                      </div>
                      <select
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        value={draft.responsible}
                        onChange={(e) => changeDraft("responsible", e.target.value)}
                      >
                        <option value="">—</option>
                        {TEAM.map((p) => (
                          <option key={p.key} value={p.key}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Couleur */}
                  <div className={CELL_WRAP}>
                    <ColorPicker value={draft.color} onChange={(c) => changeDraft("color", c)} />
                  </div>

                  {/* Confirmer / Fermer */}
                  <div className="h-full flex items-center justify-center gap-1.5 px-1.5">
                    <button
                      onClick={saveDraft}
                      disabled={savingDraft}
                      title="Valider et continuer"
                      className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-60"
                    >
                      {savingDraft ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setDraft(null)}
                      title="Fermer"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                </div>{/* end inner grid */}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── État vide ────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {sorted.length === 0 && !draft && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-16 text-center"
              >
                <p className="text-[13px] text-slate-400">
                  Aucune ligne —{" "}
                  <button
                    onClick={showDraft}
                    className="font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 transition-colors"
                  >
                    créer la première
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Lignes ───────────────────────────────────────────────────────── */}
          <Reorder.Group as="div" axis="y" values={sorted} onReorder={handleReorder}>
            <AnimatePresence mode="popLayout" initial={false}>
              {sorted.map((item) => {
                if (!item?.id) return null;
                const isDeleting = deletingIds.has(item.id);
                const isSaving   = savingIds.has(item.id);
                const total      = item.quantity * item.unitPrice;
                const urgent     = isUrgent(item.deadline);

                return (
                  <Reorder.Item key={item.id} value={item} as="div">
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: isDeleting ? 0.25 : 1, y: 0 }}
                      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 42 }}
                      className={cn(
                        "grid h-[44px] border-b border-slate-100 group relative",
                        "transition-colors duration-100",
                        GRID,
                        getRowBg(item.color ?? "", urgent),
                        isDeleting && "pointer-events-none"
                      )}
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

                      {/* 1. Priorité */}
                      <div className={CELL_WRAP}>
                        <button
                          onClick={() => saveNow(item.id, "priority", nextPriority(item.priority))}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold",
                            "transition-all duration-200 hover:opacity-75 active:scale-95 select-none",
                            PRIORITY_STYLE[item.priority]
                          )}
                        >
                          {PRIORITY_LABEL[item.priority]}
                        </button>
                      </div>

                      {/* 2. Client */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "clientName") ? (
                          <input
                            type="text"
                            value={item.clientName}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "clientName", e.target.value.toUpperCase())}
                            onBlur={(e) => handleBlurSave(item.id, "clientName", e.target.value.toUpperCase())}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "clientName")}
                            className={cn(CELL_INPUT, "font-medium uppercase tracking-wide")}
                            placeholder="NOM CLIENT"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "clientName", item.clientName)}
                            className={cn(CELL_DISPLAY, "font-medium uppercase tracking-wide", !item.clientName && EMPTY_TEXT)}
                          >
                            {item.clientName || "NOM CLIENT"}
                          </div>
                        )}
                      </div>

                      {/* 3. Désignation — avant Qté */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "designation") ? (
                          <input
                            type="text"
                            value={item.designation}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "designation", e.target.value)}
                            onBlur={(e) => handleBlurSave(item.id, "designation", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "designation")}
                            className={CELL_INPUT}
                            placeholder="Description du travail…"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "designation", item.designation)}
                            className={cn(CELL_DISPLAY, !item.designation && EMPTY_TEXT)}
                          >
                            {item.designation || "Désignation…"}
                          </div>
                        )}
                      </div>

                      {/* 4. Quantité */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "quantity") ? (
                          <>
                            <input
                              type="number"
                              list={`qty-${item.id}`}
                              value={item.quantity}
                              autoFocus
                              onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                              onBlur={(e) => handleBlurSave(item.id, "quantity", parseFloat(e.target.value) || 1)}
                              onKeyDown={(e) => handleKeyDown(e, item.id, "quantity")}
                              className={cn(CELL_INPUT, "text-center")}
                              placeholder="1"
                              min="1"
                            />
                            <datalist id={`qty-${item.id}`}>
                              {QTY_PRESETS.map((v) => <option key={v} value={v} />)}
                            </datalist>
                          </>
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "quantity", item.quantity)}
                            className={cn(CELL_DISPLAY, "justify-center tabular-nums")}
                          >
                            {item.quantity}
                          </div>
                        )}
                      </div>

                      {/* 5. Note */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "note") ? (
                          <input
                            type="text"
                            value={item.note}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "note", e.target.value)}
                            onBlur={(e) => handleBlurSave(item.id, "note", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "note")}
                            className={cn(CELL_INPUT, "italic text-slate-600")}
                            placeholder="Précisions…"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "note", item.note)}
                            className={cn(CELL_DISPLAY, "italic text-slate-500", !item.note && EMPTY_TEXT)}
                          >
                            {item.note || "Précisions…"}
                          </div>
                        )}
                      </div>

                      {/* 6. Prix unitaire */}
                      <div className={CELL_WRAP}>
                        {isEditingCell(item.id, "unitPrice") ? (
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            autoFocus
                            onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                            onBlur={(e) => handleBlurSave(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleKeyDown(e, item.id, "unitPrice")}
                            className={cn(CELL_INPUT, "text-right")}
                            placeholder="0"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(item.id, "unitPrice", item.unitPrice)}
                            className={cn(CELL_DISPLAY, "justify-end tabular-nums", !item.unitPrice && EMPTY_TEXT)}
                          >
                            {item.unitPrice ? `${item.unitPrice.toFixed(2)}` : "—"}
                          </div>
                        )}
                      </div>

                      {/* 7. Total — lecture seule, no wrap */}
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

                      {/* 9. État */}
                      <div className={CELL_WRAP}>
                        <div className="relative w-full">
                          <div className={cn(
                            "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[13px]",
                            "border-slate-100 bg-white/50 text-slate-800",
                            "hover:bg-white hover:border-slate-200 cursor-pointer transition-all duration-100"
                          )}>
                            <span className="truncate flex-1">{STATUS_LABELS[item.status]}</span>
                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                          </div>
                          <select
                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            value={item.status}
                            onChange={(e) => saveNow(item.id, "status", e.target.value as PlanningStatus)}
                          >
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 10. Interne */}
                      <div className={CELL_WRAP}>
                        <div className="relative w-full">
                          <div className={cn(
                            "flex items-center h-8 gap-1 px-2.5 rounded-lg border text-[13px]",
                            "border-slate-100 bg-white/50 text-slate-800",
                            "hover:bg-white hover:border-slate-200 cursor-pointer transition-all duration-100"
                          )}>
                            <span className="truncate flex-1 font-medium">
                              {TEAM.find((p) => p.key === item.responsible)?.name || "—"}
                            </span>
                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                          </div>
                          <select
                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            value={item.responsible}
                            onChange={(e) => saveNow(item.id, "responsible", e.target.value)}
                          >
                            <option value="">—</option>
                            {TEAM.map((p) => (
                              <option key={p.key} value={p.key}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 11. Couleur */}
                      <div className={CELL_WRAP}>
                        <ColorPicker
                          value={item.color ?? ""}
                          onChange={(c) => saveNow(item.id, "color", c)}
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

          {/* ── Bouton ajout bas de tableau ──────────────────────────────────── */}
          {sorted.length > 0 && (
            <button
              onClick={showDraft}
              disabled={savingDraft}
              className={cn(
                "w-full flex items-center gap-2 px-5 py-3",
                "text-[12px] font-semibold text-blue-500",
                "transition-colors duration-150 border-t border-slate-100",
                "hover:text-blue-700 hover:bg-blue-50/50",
                savingDraft && "opacity-40 cursor-default"
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Ajouter une ligne
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
