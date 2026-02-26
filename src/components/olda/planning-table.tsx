"use client";

/**
 * PlanningTable — Planning opérationnel, Apple Design Language
 *
 * Architecture :
 *   • Pastilles priorité douces : Gris (Basse) · Bleu (Moyenne) · Orange (Haute)
 *   • Note inline visible (zone texte secondaire dans la ligne)
 *   • Auto-save debounce 400 ms pour les champs texte
 *   • Sauvegarde immédiate pour les selects, dates et priorité
 *   • Ligne rouge (bg-red-50) si échéance ≤ 1 jour ou dépassée
 *   • Drag & drop vertical (framer-motion Reorder)
 *   • border-slate-100 · hover:bg-slate-50 · Inter
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus } from "lucide-react";
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

// ── Config priorité — pastilles douces (Gris / Bleu / Orange) ─────────────────

const PRIORITY = {
  BASSE:   {
    label:    "Basse",
    active:   "bg-slate-200/90 text-slate-600 border-slate-300/60",
    inactive: "text-slate-300 hover:bg-slate-100/80 hover:text-slate-500",
  },
  MOYENNE: {
    label:    "Moy.",
    active:   "bg-blue-100 text-blue-600 border-blue-200/70",
    inactive: "text-slate-300 hover:bg-blue-50 hover:text-blue-500",
  },
  HAUTE:   {
    label:    "Haute",
    active:   "bg-orange-100 text-orange-600 border-orange-200/70",
    inactive: "text-slate-300 hover:bg-orange-50 hover:text-orange-500",
  },
} as const;

// ── Statuts commande ───────────────────────────────────────────────────────────

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

// ── Équipe interne ─────────────────────────────────────────────────────────────

const TEAM = [
  { key: "loic",     initials: "LO", name: "Loïc"     },
  { key: "charlie",  initials: "CH", name: "Charlie"   },
  { key: "melina",   initials: "ME", name: "Mélina"    },
  { key: "amandine", initials: "AM", name: "Amandine"  },
  { key: "renaud",   initials: "RE", name: "Renaud"    },
] as const;

// ── Suggestions quantités ──────────────────────────────────────────────────────

const QTY_PRESETS = [1, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500];

// ── Grille CSS (11 colonnes) ───────────────────────────────────────────────────
// Priorité | Client | Qté | Désignation | Note | Prix u. | Total | Échéance | État | Interne | ×

const GRID = "grid-cols-[138px_150px_74px_minmax(140px,1fr)_minmax(130px,0.7fr)_80px_72px_108px_170px_116px_34px]";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  return (new Date(deadline).getTime() - Date.now()) / 86_400_000 <= 1;
}

// Style commun des champs éditables (sans bordure visible au repos)
const field =
  "w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-300 " +
  "px-2.5 py-[7px] rounded-lg border border-transparent transition-all duration-150 " +
  "hover:border-slate-200 focus:outline-none focus:border-blue-300 " +
  "focus:bg-white focus:ring-2 focus:ring-blue-100/80 focus:shadow-sm";

// ── Composant ──────────────────────────────────────────────────────────────────

export function PlanningTable({ items, onItemsChange }: PlanningTableProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isAdding,    setIsAdding]    = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sorted = useMemo(
    () => (!Array.isArray(items) ? [] : [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))),
    [items]
  );

  // ── Auto-save avec debounce 400 ms ─────────────────────────────────────────

  const persist = useCallback((id: string, patch: Record<string, unknown>) => {
    fetch(`/api/planning/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch((e) => console.error("Planning save failed:", e));
  }, []);

  /** Met à jour l'état local immédiatement. Pour les champs texte : debounce 400 ms avant API. */
  const update = useCallback(
    (id: string, field: string, value: unknown, immediate = false) => {
      onItemsChange?.(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

      if (immediate) {
        persist(id, { [field]: value });
      } else {
        const key = `${id}::${field}`;
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => persist(id, { [field]: value }), 400);
      }
    },
    [items, onItemsChange, persist]
  );

  // ── Ajout ──────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const res  = await fetch("/api/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: "MOYENNE", clientName: "", quantity: 1,
          designation: "", note: "", unitPrice: 0,
          deadline: null, status: "A_DEVISER", responsible: "",
        }),
      });
      const { item } = await res.json();
      if (item) onItemsChange?.([item, ...items]);
    } catch (e) {
      console.error("Failed to add row:", e);
    } finally {
      setTimeout(() => setIsAdding(false), 700);
    }
  }, [isAdding, items, onItemsChange]);

  // ── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => new Set([...prev, id]));
      onItemsChange?.(items.filter((it) => it.id !== id));
      try {
        await fetch(`/api/planning/${id}`, { method: "DELETE" });
      } catch {
        const res  = await fetch("/api/planning");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      } finally {
        setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    },
    [items, onItemsChange]
  );

  // ── Réordonnancement ────────────────────────────────────────────────────────

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
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: it.position }),
          })
        )
      ).catch(console.error);
    },
    [items, onItemsChange]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden"
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
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
          onClick={handleAdd}
          disabled={isAdding}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold",
            "transition-all duration-200 active:scale-95 select-none",
            isAdding
              ? "bg-emerald-500 text-white cursor-default"
              : "bg-slate-900 text-white hover:bg-slate-700"
          )}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          {isAdding ? "Ajoutée ✓" : "Nouvelle ligne"}
        </button>
      </div>

      {/* ── Tableau (scroll horizontal) ─────────────────────────────────────── */}
      <div className="overflow-x-auto">

        {/* En-têtes */}
        <div className={cn("grid min-w-max bg-slate-50/70 border-b border-slate-100", GRID)}>
          {[
            { t: "Priorité",    a: "left"   },
            { t: "Client",      a: "left"   },
            { t: "Qté",         a: "center" },
            { t: "Désignation", a: "left"   },
            { t: "Note",        a: "left"   },
            { t: "Prix u.",     a: "right"  },
            { t: "Total",       a: "right"  },
            { t: "Échéance",    a: "left"   },
            { t: "État",        a: "left"   },
            { t: "Interne",     a: "center" },
            { t: "",            a: "center" },
          ].map(({ t, a }, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400",
                a === "center" && "text-center",
                a === "right"  && "text-right",
              )}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Lignes */}
        <Reorder.Group
          as="div"
          axis="y"
          values={sorted}
          onReorder={handleReorder}
          className="min-w-max"
        >
          <AnimatePresence mode="popLayout" initial={false}>

            {/* État vide */}
            {sorted.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center"
              >
                <p className="text-[13px] text-slate-400">
                  Aucune ligne —{" "}
                  <button
                    onClick={handleAdd}
                    className="font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 transition-colors"
                  >
                    créer la première
                  </button>
                </p>
              </motion.div>
            )}

            {sorted.map((item) => {
              if (!item?.id) return null;
              const isDeleting = deletingIds.has(item.id);
              const total      = item.quantity * item.unitPrice;
              const urgent     = isUrgent(item.deadline);

              return (
                <Reorder.Item key={item.id} value={item} as="div">
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: isDeleting ? 0.25 : 1, y: 0 }}
                    exit={{ opacity: 0, x: 30, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    className={cn(
                      "grid min-w-max border-b border-slate-100 group transition-colors duration-100",
                      GRID,
                      urgent
                        ? "bg-red-50 hover:bg-red-100/60"
                        : "bg-white hover:bg-slate-50",
                      isDeleting && "pointer-events-none"
                    )}
                  >

                    {/* ── 1. Priorité — pastilles sélecteur ─────────────────── */}
                    <div className="flex items-center gap-0.5 px-2 py-2">
                      {(["BASSE", "MOYENNE", "HAUTE"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => update(item.id, "priority", p, true)}
                          className={cn(
                            "flex-1 py-[5px] rounded-[6px] text-[10px] font-semibold",
                            "border transition-all duration-150 select-none",
                            item.priority === p
                              ? PRIORITY[p].active
                              : `border-transparent ${PRIORITY[p].inactive}`
                          )}
                        >
                          {PRIORITY[p].label}
                        </button>
                      ))}
                    </div>

                    {/* ── 2. Client — majuscule auto ────────────────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="text"
                        value={item.clientName}
                        onChange={(e) =>
                          update(item.id, "clientName", e.target.value.toUpperCase())
                        }
                        className={cn(field, "font-medium uppercase tracking-wide")}
                        placeholder="NOM CLIENT"
                      />
                    </div>

                    {/* ── 3. Quantité — datalist + saisie libre ─────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="number"
                        list={`qty-${item.id}`}
                        value={item.quantity}
                        onChange={(e) =>
                          update(item.id, "quantity", parseFloat(e.target.value) || 1)
                        }
                        className={cn(field, "text-center")}
                        placeholder="1"
                        min="1"
                      />
                      <datalist id={`qty-${item.id}`}>
                        {QTY_PRESETS.map((v) => <option key={v} value={v} />)}
                      </datalist>
                    </div>

                    {/* ── 4. Désignation — champ large ──────────────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="text"
                        value={item.designation}
                        onChange={(e) =>
                          update(item.id, "designation", e.target.value)
                        }
                        className={field}
                        placeholder="Description du travail…"
                      />
                    </div>

                    {/* ── 5. Note — zone texte secondaire inline ─────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => update(item.id, "note", e.target.value)}
                        className={cn(field, "italic text-slate-500 placeholder:not-italic")}
                        placeholder="Précisions…"
                      />
                    </div>

                    {/* ── 6. Prix unitaire ──────────────────────────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="number"
                        value={item.unitPrice === 0 ? "" : item.unitPrice}
                        onChange={(e) =>
                          update(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className={cn(field, "text-right")}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* ── 7. Total — lecture seule, calculé ─────────────────── */}
                    <div
                      className={cn(
                        "flex items-center justify-end px-3 py-2",
                        "text-[13px] font-semibold tabular-nums",
                        total > 0 ? "text-slate-800" : "text-slate-200"
                      )}
                    >
                      {total > 0 ? `${total.toFixed(2)} €` : "—"}
                    </div>

                    {/* ── 8. Date limite — rouge si critique ────────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <input
                        type="date"
                        value={item.deadline ? item.deadline.split("T")[0] : ""}
                        onChange={(e) =>
                          update(item.id, "deadline", e.target.value || null, true)
                        }
                        className={cn(
                          "w-full bg-transparent text-[13px] px-2.5 py-[7px] rounded-lg border",
                          "transition-all duration-150 focus:outline-none",
                          urgent
                            ? "border-red-200 text-red-600 font-semibold focus:ring-2 focus:ring-red-100"
                            : "border-transparent text-slate-900 hover:border-slate-200 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100/80"
                        )}
                      />
                    </div>

                    {/* ── 9. État — menu déroulant 16 statuts ───────────────── */}
                    <div className="flex items-center px-1 py-1">
                      <select
                        value={item.status}
                        onChange={(e) => update(item.id, "status", e.target.value, true)}
                        className={cn(
                          "w-full bg-transparent text-[13px] text-slate-900 px-2.5 py-[7px]",
                          "rounded-lg border border-transparent cursor-pointer",
                          "transition-all duration-150 focus:outline-none",
                          "hover:border-slate-200 focus:border-blue-300 focus:bg-white",
                          "focus:ring-2 focus:ring-blue-100/80 focus:shadow-sm"
                        )}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* ── 10. Interne — pastilles équipe ────────────────────── */}
                    <div className="flex items-center justify-center gap-1 px-1 py-2">
                      {TEAM.map((person) => {
                        const active = item.responsible === person.key;
                        return (
                          <button
                            key={person.key}
                            onClick={() =>
                              update(item.id, "responsible", active ? "" : person.key, true)
                            }
                            title={person.name}
                            className={cn(
                              "w-[22px] h-[22px] rounded-full text-[8px] font-bold",
                              "transition-all duration-150 select-none",
                              active
                                ? "bg-blue-500 text-white scale-110 shadow-sm"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            )}
                          >
                            {person.initials}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Supprimer ─────────────────────────────────────────── */}
                    <div className="flex items-center justify-center">
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

        {/* ── Pied — ajout rapide ─────────────────────────────────────────── */}
        {sorted.length > 0 && (
          <button
            onClick={handleAdd}
            disabled={isAdding}
            className={cn(
              "min-w-max w-full flex items-center gap-2 px-5 py-3",
              "text-[12px] font-medium text-slate-400",
              "hover:text-slate-600 hover:bg-slate-50 transition-colors duration-150",
              "border-t border-slate-50"
            )}
          >
            <Plus className="h-3 w-3 shrink-0" />
            Ajouter une ligne
          </button>
        )}

      </div>
    </div>
  );
}
