"use client";

/**
 * PlanningTable — 10-column planning grid
 * ─ Strict column alignment with CSS Grid
 * ─ Optimistic UI: onChange updates state, onBlur persists to API
 * ─ Drag & drop vertical reordering
 * ─ Deadline highlighting: red background if ≤ 1 day remaining
 */

import { useState, useCallback, useMemo } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

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

const PRIORITY_COLORS: Record<string, string> = {
  BASSE: "bg-green-100 text-green-700 border-green-300",
  MOYENNE: "bg-orange-100 text-orange-700 border-orange-300",
  HAUTE: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_LABELS: Record<PlanningStatus, string> = {
  A_DEVISER: "À deviser",
  ATTENTE_VALIDATION: "Attente validation",
  MAQUETTE_A_FAIRE: "Maquette à faire",
  ATTENTE_MARCHANDISE: "Attente marchandise",
  A_PREPARER: "À préparer",
  A_PRODUIRE: "À produire",
  EN_PRODUCTION: "En production",
  A_MONTER_NETTOYER: "À monter/nettoyer",
  MANQUE_INFORMATION: "Manque info",
  TERMINE: "Terminé",
  PREVENIR_CLIENT: "Prévenir client",
  CLIENT_PREVENU: "Client prévenu",
  RELANCE_CLIENT: "Relance client",
  PRODUIT_RECUPERE: "Produit récupéré",
  A_FACTURER: "À facturer",
  FACTURE_FAITE: "Facture faite",
};

const RESPONSIBLE_OPTIONS = [
  { key: "loic", label: "LÖ" },
  { key: "charlie", label: "CH" },
  { key: "melina", label: "MÉ" },
  { key: "amandine", label: "AM" },
  { key: "renaud", label: "RE" },
];

const GRID_COLS =
  "grid-cols-[80px_160px_80px_1fr_120px_90px_80px_110px_180px_130px_40px]";
const CELL_CLASS = "px-3 py-3 truncate";

function isDeadlineSoon(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 1 && diffDays > 0;
}

function cyclePriority(current: PlanningItem["priority"]): PlanningItem["priority"] {
  const cycle: PlanningItem["priority"][] = ["BASSE", "MOYENNE", "HAUTE"];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

export function PlanningTable({ items, onItemsChange }: PlanningTableProps) {
  const [isDeletingIds, setIsDeletingIds] = useState<Set<string>>(new Set());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [notePopover, setNotePopover] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => {
      if (!Array.isArray(items)) return [];
      return [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
    },
    [items]
  );

  const handleAddNew = useCallback(async () => {
    setIsAddingNew(true);
    try {
      const res = await fetch("/api/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: "MOYENNE",
          clientName: "",
          quantity: 1,
          designation: "",
          note: "",
          unitPrice: 0,
          deadline: null,
          status: "A_DEVISER",
          responsible: "",
        }),
      });
      const data = await res.json();
      onItemsChange?.([data.item, ...items]);
    } catch (err) {
      console.error("Failed to create planning item:", err);
    } finally {
      setTimeout(() => setIsAddingNew(false), 300);
    }
  }, [items, onItemsChange]);

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeletingIds((prev) => new Set([...prev, id]));
      onItemsChange?.(items.filter((i) => i.id !== id));

      try {
        await fetch(`/api/planning/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete planning item:", err);
        const res = await fetch("/api/planning");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [items, onItemsChange]
  );

  const handleFieldChange = useCallback(
    (id: string, field: string, value: unknown) => {
      const updated = items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      );
      onItemsChange?.(updated);
    },
    [items, onItemsChange]
  );

  const handleFieldBlur = useCallback(
    async (id: string, field: string, value: unknown) => {
      try {
        await fetch(`/api/planning/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
      } catch (err) {
        console.error("Failed to update planning item:", err);
      }
    },
    []
  );

  const handlePriorityCycle = useCallback(
    async (id: string, current: PlanningItem["priority"]) => {
      const newPriority = cyclePriority(current);
      const updated = items.map((item) =>
        item.id === id ? { ...item, priority: newPriority } : item
      );
      onItemsChange?.(updated);

      try {
        await fetch(`/api/planning/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: newPriority }),
        });
      } catch (err) {
        console.error("Failed to update priority:", err);
      }
    },
    [items, onItemsChange]
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-[18px] bg-white border border-gray-100 shadow-sm p-4"
      style={{
        fontFamily:
          "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          Planning d'Entreprise
        </h2>
        <motion.button
          onClick={handleAddNew}
          whileTap={{ scale: 0.92 }}
          animate={
            isAddingNew
              ? { backgroundColor: "#10b981" }
              : { backgroundColor: "transparent" }
          }
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            isAddingNew
              ? "text-white bg-green-500 shadow-md"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
          )}
        >
          <Plus className="h-4 w-4" />
          {isAddingNew ? "Ajouté ✓" : "Ajouter"}
        </motion.button>
      </div>

      {/* Grid Header */}
      <div className={cn("grid gap-0 border-b border-gray-100 pb-2", GRID_COLS)}>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          Priorité
        </div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          Client
        </div>
        <div className="text-center text-xs font-semibold text-gray-600 px-3">
          Qté
        </div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          Désignation
        </div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          Note
        </div>
        <div className="text-right text-xs font-semibold text-gray-600 px-3">
          Prix unit.
        </div>
        <div className="text-right text-xs font-semibold text-gray-600 px-3">
          Total
        </div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          Date limite
        </div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">
          État
        </div>
        <div className="text-center text-xs font-semibold text-gray-600 px-3">
          Responsable
        </div>
        <div className="text-center text-xs font-semibold text-gray-600"></div>
      </div>

      {/* Grid Items */}
      <div className="flex flex-col gap-0">
        <Reorder.Group
          as="div"
          axis="y"
          values={sortedItems}
          onReorder={(newOrder) => {
            const reorderedItems = newOrder.map((item, idx) => ({
              ...item,
              position: idx,
            }));
            onItemsChange?.(
              items
                .filter((i) => !reorderedItems.some((r) => r.id === i.id))
                .concat(reorderedItems)
            );
            Promise.all(
              reorderedItems.map((item) =>
                fetch(`/api/planning/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ position: item.position }),
                })
              )
            ).catch((err) => console.error("Failed to save positions:", err));
          }}
          className="flex flex-col"
        >
          <AnimatePresence mode="popLayout">
            {sortedItems.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center text-gray-400 text-sm"
              >
                Aucun item de planning
              </motion.div>
            ) : (
              sortedItems.map((item) => {
                if (!item?.id) return null;
                const isDeleting = isDeletingIds.has(item.id);
                const total = item.quantity * item.unitPrice;
                const isDeadlineCritical = isDeadlineSoon(item.deadline);

                return (
                  <Reorder.Item key={item.id} value={item} as="div">
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      className={cn(
                        "grid gap-0 border-b border-gray-100 transition-all group hover:bg-gray-50",
                        GRID_COLS,
                        isDeleting && "opacity-50"
                      )}
                    >
                      {/* Priorité (80px) — Cycling button */}
                      <button
                        onClick={() => handlePriorityCycle(item.id, item.priority)}
                        className={cn(
                          "px-3 py-3 rounded text-xs font-semibold border transition-all",
                          PRIORITY_COLORS[item.priority]
                        )}
                      >
                        {item.priority === "BASSE"
                          ? "Basse"
                          : item.priority === "MOYENNE"
                          ? "Moyenne"
                          : "Haute"}
                      </button>

                      {/* Client (160px) */}
                      <input
                        type="text"
                        value={item.clientName}
                        onChange={(e) =>
                          handleFieldChange(
                            item.id,
                            "clientName",
                            e.target.value.toUpperCase()
                          )
                        }
                        onBlur={() =>
                          handleFieldBlur(item.id, "clientName", item.clientName)
                        }
                        className={cn(
                          CELL_CLASS,
                          "bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 font-medium text-sm uppercase cursor-text hover:border-gray-400 transition-colors"
                        )}
                        placeholder="CLIENT"
                        style={{ textTransform: "uppercase" }}
                      />

                      {/* Qté (80px) */}
                      <div className="flex items-center justify-center px-3 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleFieldChange(
                              item.id,
                              "quantity",
                              parseFloat(e.target.value) || 1
                            )
                          }
                          onBlur={() =>
                            handleFieldBlur(item.id, "quantity", item.quantity)
                          }
                          className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 text-sm text-center cursor-text hover:border-gray-400 transition-colors"
                          placeholder="1"
                        />
                      </div>

                      {/* Désignation (1fr) */}
                      <input
                        type="text"
                        value={item.designation}
                        onChange={(e) =>
                          handleFieldChange(item.id, "designation", e.target.value)
                        }
                        onBlur={() =>
                          handleFieldBlur(item.id, "designation", item.designation)
                        }
                        className={cn(
                          CELL_CLASS,
                          "bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 text-sm cursor-text hover:border-gray-400 transition-colors"
                        )}
                        placeholder="Désignation"
                      />

                      {/* Note (120px) — Icon button + popover */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setNotePopover(
                              notePopover === item.id ? null : item.id
                            )
                          }
                          className="px-3 py-3 text-gray-400 hover:text-gray-600 transition-colors"
                          title={item.note || "Ajouter une note"}
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                        {notePopover === item.id && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-64">
                            <textarea
                              value={item.note}
                              onChange={(e) =>
                                handleFieldChange(item.id, "note", e.target.value)
                              }
                              onBlur={() => {
                                handleFieldBlur(item.id, "note", item.note);
                                setNotePopover(null);
                              }}
                              autoFocus
                              className="w-full p-3 border-none focus:outline-none resize-none text-sm"
                              rows={4}
                              placeholder="Note..."
                            />
                          </div>
                        )}
                      </div>

                      {/* Prix unit. (90px) */}
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleFieldChange(
                            item.id,
                            "unitPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        onBlur={() =>
                          handleFieldBlur(item.id, "unitPrice", item.unitPrice)
                        }
                        className={cn(
                          CELL_CLASS,
                          "bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 text-sm text-right cursor-text hover:border-gray-400 transition-colors"
                        )}
                        placeholder="0.00"
                      />

                      {/* Total (80px) — Read-only */}
                      <div className={cn(CELL_CLASS, "text-right text-gray-700 font-medium text-sm")}>
                        {total.toFixed(2)}€
                      </div>

                      {/* Date limite (110px) */}
                      <input
                        type="date"
                        value={item.deadline ? item.deadline.split("T")[0] : ""}
                        onChange={(e) =>
                          handleFieldChange(item.id, "deadline", e.target.value || null)
                        }
                        onBlur={() =>
                          handleFieldBlur(item.id, "deadline", item.deadline)
                        }
                        className={cn(
                          CELL_CLASS,
                          "bg-white border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 text-sm cursor-text transition-colors",
                          isDeadlineCritical
                            ? "border-red-400 bg-red-50 text-red-900 focus:border-red-400"
                            : "border-gray-300 hover:border-gray-400 focus:border-blue-400"
                        )}
                      />

                      {/* État (180px) — Select */}
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleFieldChange(item.id, "status", e.target.value)
                        }
                        onBlur={() =>
                          handleFieldBlur(item.id, "status", item.status)
                        }
                        className={cn(
                          CELL_CLASS,
                          "bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 text-sm cursor-pointer hover:border-gray-400 transition-colors"
                        )}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>

                      {/* Responsable (130px) — Initials toggles */}
                      <div className="flex items-center px-3 py-3 gap-1">
                        {RESPONSIBLE_OPTIONS.map((person) => (
                          <button
                            key={person.key}
                            onClick={() =>
                              handleFieldChange(
                                item.id,
                                "responsible",
                                item.responsible === person.key ? "" : person.key
                              )
                            }
                            onBlur={() =>
                              handleFieldBlur(
                                item.id,
                                "responsible",
                                item.responsible
                              )
                            }
                            className={cn(
                              "w-7 h-7 rounded-full text-xs font-semibold transition-all",
                              item.responsible === person.key
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {person.label}
                          </button>
                        ))}
                      </div>

                      {/* Delete (40px) */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  </Reorder.Item>
                );
              })
            )}
          </AnimatePresence>
        </Reorder.Group>
      </div>
    </div>
  );
}
