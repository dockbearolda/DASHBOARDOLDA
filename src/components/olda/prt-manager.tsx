"use client";

/**
 * PRTManager — Grid-based Apple-style list for PRT requests
 * ─ Utilise OrderTable (table-shell) pour la carte + en-têtes sticky
 * ─ Strict column alignment avec grid-cols-[40px_1fr_1fr_1fr_1fr_80px_80px]
 * ─ Drag & drop vertical reordering (Framer Motion Reorder)
 * ─ Zéro friction : clic dot → toggle done, clic trash → delete
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Check, FolderOpen, X, Archive, ArchiveRestore, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

interface PRTItem {
  id: string;
  clientName: string;
  dimensions: string;
  design: string;
  taille: string;
  color: string;
  quantity: number;
  done: boolean;
  position: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface PRTManagerProps {
  items: PRTItem[];
  onItemsChange?: (value: PRTItem[] | ((prev: PRTItem[]) => PRTItem[])) => void;
  onNewRequest?: () => void;
  onEditingChange?: (isEditing: boolean) => void;
}

const COULEURS = [
  "Multicolore",
  "Noir", "Kaki", "Bleu Marine", "Bleu Royal", "Lavande", "Rose Bébé",
  "Bleu Clair", "Vert Pastel", "Rouge", "Orange", "Corail", "Vert",
  "Menthe", "Jaune", "Beige", "Blanc",
] as const;

// Grid : [checkbox] [client] [dimensions] [design] [taille] [couleur] [note] [qté] [actions]
const GRID_COLS  = "grid-cols-[40px_1fr_1fr_1fr_100px_1fr_1fr_80px_96px]";
const CELL_CLASS = "px-3 py-3 truncate";

// ── Helpers date ──────────────────────────────────────────────────────────────
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60)        return "à l'instant";
  if (diffSec < 3600)      return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)     return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 86400 * 30) return `il y a ${Math.floor(diffSec / 86400)} j`;
  if (diffSec < 86400 * 365) return `il y a ${Math.floor(diffSec / 86400 / 30)} mois`;
  return `il y a ${Math.floor(diffSec / 86400 / 365)} an`;
}

export function PRTManager({ items, onItemsChange, onNewRequest, onEditingChange }: PRTManagerProps) {
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isDeletingIds, setIsDeletingIds] = useState<Set<string>>(new Set());
  const [isAddingNew,  setIsAddingNew]  = useState(false);
  const [showArchive,  setShowArchive]  = useState(false);
  const [now,          setNow]          = useState(() => Date.now());

  // Rafraîchit le "il y a X..." toutes les 60 s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  void now; // used via timeAgo which re-runs on render

  // ── Inline quick-add ─────────────────────────────────────────────────────
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickDraft,    setQuickDraft]    = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  // File picker — un seul input caché partagé entre toutes les lignes
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const pickingForIdRef = useRef<string | null>(null);

  const handleFilePick = useCallback((itemId: string) => {
    pickingForIdRef.current = itemId;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const id   = pickingForIdRef.current;
      if (!file || !id) return;

      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      onItemsChange?.((prev) => prev.map((i) =>
        i.id === id ? { ...i, design: nameWithoutExt } : i,
      ));

      try {
        await fetch(`/api/prt-requests/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ design: nameWithoutExt }),
        });
      } catch (err) {
        console.error("Failed to update design from file:", err);
      }

      e.target.value        = "";
      pickingForIdRef.current = null;
    },
    [onItemsChange],
  );

  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const filtered = showArchive ? items.filter((i) => i.done) : items.filter((i) => !i.done);
    return [...filtered].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  }, [items, showArchive]);

  const archivedCount = useMemo(() => items.filter((i) => i.done).length, [items]);

  const handleToggleDone = useCallback(
    async (id: string, currentDone: boolean) => {
      const newDone = !currentDone;
      onItemsChange?.((prev) => prev.map((i) => i.id === id ? { ...i, done: newDone } : i));
      try {
        await fetch(`/api/prt-requests/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ done: newDone }),
        });
      } catch (err) {
        console.error("Failed to update PRT:", err);
      }
    },
    [onItemsChange],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeletingIds((prev) => new Set([...prev, id]));
      onItemsChange?.((prev) => prev.filter((i) => i.id !== id));
      try {
        await fetch(`/api/prt-requests/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete PRT:", err);
        const res  = await fetch("/api/prt-requests");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [onItemsChange],
  );

  const handleDeleteSelected = useCallback(async () => {
    const idsToDelete = new Set(selectedIds);
    try {
      await Promise.all(
        Array.from(idsToDelete).map((id) =>
          fetch(`/api/prt-requests/${id}`, { method: "DELETE" }),
        ),
      );
      onItemsChange?.((prev) => prev.filter((i) => !idsToDelete.has(i.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete multiple PRTs:", err);
    }
  }, [selectedIds, onItemsChange]);

  const handleAddNew = useCallback(async (clientName: string = "") => {
    setIsAddingNew(true);
    try {
      const res  = await fetch("/api/prt-requests", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clientName, dimensions: "", design: "", color: "", quantity: 1 }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.item) {
        onItemsChange?.((prev) => [data.item, ...prev]);
      }
      onNewRequest?.();
    } catch (err) {
      console.error("Failed to create PRT:", err);
    } finally {
      setTimeout(() => setIsAddingNew(false), 300);
    }
  }, [onItemsChange, onNewRequest]);

  const handleDuplicate = useCallback(
    async (item: PRTItem) => {
      try {
        const res = await fetch("/api/prt-requests", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            clientName:          item.clientName,
            dimensions:          item.dimensions,
            design:              item.design,
            color:               item.color,
            quantity:            item.quantity,
            note:                item.note,
            insertAfterPosition: item.position,
          }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.item) {
          onItemsChange?.((prev) => {
            // Décaler les positions des items après l'original
            const shifted = prev.map((i) =>
              i.position > item.position ? { ...i, position: i.position + 1 } : i,
            );
            // Insérer juste après l'original
            const idx = shifted.findIndex((i) => i.id === item.id);
            const next = [...shifted];
            next.splice(idx === -1 ? 0 : idx + 1, 0, data.item);
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to duplicate PRT:", err);
      }
    },
    [onItemsChange],
  );

  // ── Toolbar ───────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Input fichier caché — partagé entre toutes les lignes */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      {isQuickAdding ? (
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-white border border-blue-200 ring-1 ring-blue-100 shadow-sm min-w-[200px] shrink-0">
          <Plus className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <input
            ref={quickAddRef}
            value={quickDraft}
            onChange={(e) => setQuickDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const text = quickDraft.trim();
                if (text) {
                  handleAddNew(text);
                  setQuickDraft("");
                  setTimeout(() => quickAddRef.current?.focus(), 0);
                } else {
                  setIsQuickAdding(false);
                  setQuickDraft("");
                }
              }
              if (e.key === "Escape") { setIsQuickAdding(false); setQuickDraft(""); }
            }}
            onBlur={() => {
              const text = quickDraft.trim();
              if (text) handleAddNew(text);
              setIsQuickAdding(false);
              setQuickDraft("");
            }}
            placeholder="Nom du client…"
            className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-500 bg-transparent outline-none"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setIsQuickAdding(false); setQuickDraft(""); }}
            className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setIsQuickAdding(true); setTimeout(() => quickAddRef.current?.focus(), 30); }}
          disabled={isAddingNew || showArchive}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Demande de DTF</span>
        </button>
      )}
      <div className="flex-1" />
      <button
        onClick={() => setShowArchive((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors shrink-0",
          showArchive
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
        )}
      >
        {showArchive ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {showArchive ? "Retour" : `Archive${archivedCount > 0 ? ` (${archivedCount})` : ""}`}
      </button>
    </div>
  );

  // ── Headers ───────────────────────────────────────────────────────────────────

  const headers = (
    <div className={cn("grid gap-0 px-0 py-2.5", GRID_COLS)}>
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={selectedIds.size === sortedItems.length && sortedItems.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set(sortedItems.map((i) => i.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          className="w-4 h-4 rounded cursor-pointer"
        />
      </div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Client</div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Dimensions</div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Design</div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Taille</div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Couleur</div>
      <div className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Note</div>
      <div className="text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3">Qté</div>
      <div className="text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <OrderTable
        toolbar={toolbar}
        headers={headers}
        bgClassName={showArchive ? "bg-amber-50" : "bg-white"}
        minWidth={1150}
      >
        <div className="divide-y divide-slate-50">
          <Reorder.Group
            as="div"
            axis="y"
            values={sortedItems}
            onReorder={(newOrder) => {
              const reorderedItems = newOrder.map((item, idx) => ({
                ...item,
                position: idx,
              }));
              onItemsChange?.((prev) => {
                const reorderedIds = new Set(reorderedItems.map((r) => r.id));
                return [...reorderedItems, ...prev.filter((i) => !reorderedIds.has(i.id))];
              });
              Promise.all(
                reorderedItems.map((item) =>
                  fetch(`/api/prt-requests/${item.id}`, {
                    method:  "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ position: item.position }),
                  }),
                ),
              ).catch((err) => console.error("Failed to save positions:", err));
            }}
            className="flex flex-col"
          >
            <AnimatePresence mode="sync">
              {sortedItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 text-center text-[13px] text-slate-300"
                >
                  {showArchive ? "Archive vide" : "Aucune demande PRT"}
                </motion.div>
              ) : (
                sortedItems.map((item) => {
                  if (!item?.id) return null;
                  return (
                    <Reorder.Item key={item.id} value={item} as="div">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ willChange: "transform, opacity" }}
                        className={cn(
                          "grid gap-0 border-b border-slate-50 transition-colors group hover:bg-slate-50/70",
                          GRID_COLS,
                          showArchive && "opacity-60",
                        )}
                      >
                        {/* Checkbox (40px) */}
                        <div className="flex items-center justify-center py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedIds);
                              if (e.target.checked) {
                                newSelected.add(item.id);
                              } else {
                                newSelected.delete(item.id);
                              }
                              setSelectedIds(newSelected);
                            }}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </div>

                        {/* Client (1fr) */}
                        <input
                          type="text"
                          value={item.clientName}
                          onFocus={() => onEditingChange?.(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            onItemsChange?.((prev) => prev.map((i) =>
                              i.id === item.id ? { ...i, clientName: val } : i,
                            ));
                          }}
                          onBlur={async () => {
                            onEditingChange?.(false);
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ clientName: item.clientName }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-900 font-semibold text-[13px]",
                          )}
                          placeholder="Nom client"
                        />

                        {/* Dimensions (1fr) */}
                        <input
                          type="text"
                          value={item.dimensions}
                          onFocus={() => onEditingChange?.(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            onItemsChange?.((prev) => prev.map((i) =>
                              i.id === item.id ? { ...i, dimensions: val } : i,
                            ));
                          }}
                          onBlur={async () => {
                            onEditingChange?.(false);
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ dimensions: item.dimensions }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-700 text-[13px]",
                          )}
                          placeholder="30x40cm"
                        />

                        {/* Design (1fr) — saisie manuelle OU fichier */}
                        <div className={cn(CELL_CLASS, "flex items-center gap-1 min-w-0")}>
                          <input
                            type="text"
                            value={item.design}
                            onFocus={() => onEditingChange?.(true)}
                            onChange={(e) => {
                              const val = e.target.value;
                              onItemsChange?.((prev) => prev.map((i) =>
                                i.id === item.id ? { ...i, design: val } : i,
                              ));
                            }}
                            onBlur={async () => {
                              onEditingChange?.(false);
                              try {
                                await fetch(`/api/prt-requests/${item.id}`, {
                                  method:  "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body:    JSON.stringify({ design: item.design }),
                                });
                              } catch (err) {
                                console.error("Failed to update:", err);
                              }
                            }}
                            className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-700 text-[13px] truncate text-center"
                            placeholder="Design"
                            title={item.design}
                          />
                          <button
                            onClick={() => handleFilePick(item.id)}
                            className="shrink-0 p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            title="Choisir un fichier"
                            type="button"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Taille (100px) */}
                        <input
                          type="text"
                          value={item.taille ?? ""}
                          onFocus={() => onEditingChange?.(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            onItemsChange?.((prev) => prev.map((i) =>
                              i.id === item.id ? { ...i, taille: val } : i,
                            ));
                          }}
                          onBlur={async () => {
                            onEditingChange?.(false);
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ taille: item.taille }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-700 text-[13px]",
                          )}
                          placeholder=""
                        />

                        {/* Couleur (1fr) */}
                        <div className={CELL_CLASS}>
                          <select
                            value={item.color}
                            onFocus={() => onEditingChange?.(true)}
                            onBlur={() => onEditingChange?.(false)}
                            onChange={(e) => {
                              const val = e.target.value;
                              onItemsChange?.((prev) => prev.map((i) =>
                                i.id === item.id ? { ...i, color: val } : i,
                              ));
                              fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ color: val }),
                              }).catch(() => {});
                            }}
                            className="w-full text-[13px] text-slate-700 bg-transparent outline-none cursor-pointer appearance-none"
                          >
                            <option value="">—</option>
                            {COULEURS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {/* Note (1fr) */}
                        <input
                          type="text"
                          value={item.note ?? ""}
                          onFocus={() => onEditingChange?.(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            onItemsChange?.((prev) => prev.map((i) =>
                              i.id === item.id ? { ...i, note: val } : i,
                            ));
                          }}
                          onBlur={async () => {
                            onEditingChange?.(false);
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ note: item.note }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-500 text-[12px] italic",
                          )}
                          placeholder="Note…"
                        />

                        {/* Quantité (80px) */}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity}
                          onFocus={() => onEditingChange?.(true)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            onItemsChange?.((prev) => prev.map((i) =>
                              i.id === item.id ? { ...i, quantity: parseInt(val) || 1 } : i,
                            ));
                          }}
                          onBlur={async () => {
                            onEditingChange?.(false);
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ quantity: item.quantity }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white text-slate-700 text-[13px] text-right",
                          )}
                        />

                        {/* Actions (96px) — Duplicate + Done + Delete */}
                        <div className="flex items-center justify-end gap-0.5 py-3 pr-2">
                          <motion.button
                            onClick={() => handleDuplicate(item)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-30 group-hover:opacity-100"
                            title="Dupliquer"
                          >
                            <Copy className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => handleToggleDone(item.id, item.done)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                              "p-1.5 rounded-lg transition-[background-color,color]",
                              item?.done
                                ? "text-emerald-600 bg-emerald-50"
                                : "text-slate-300 hover:text-emerald-600 hover:bg-emerald-50",
                            )}
                            title="Marquer comme fait"
                          >
                            <Check className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => handleDelete(item.id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-30 group-hover:opacity-100"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        </div>

                        {/* Date de création — col-span-full pour alignement correct sous le grid */}
                        {item.createdAt && (
                          <div className="col-span-full flex items-center gap-1.5 px-3 pb-1.5">
                            <div className="w-[40px] shrink-0" />
                            <span className="text-[10px] text-slate-400">
                              Créée le {formatDateFR(item.createdAt)}
                            </span>
                            <span className="text-slate-300 text-[10px]">·</span>
                            <span className="text-[10px] text-slate-400 italic">
                              {timeAgo(item.createdAt)}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    </Reorder.Item>
                  );
                })
              )}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      </OrderTable>

      {/* Bouton flottant de suppression multiple */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          >
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer {selectedIds.size}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
