"use client";

/**
 * PRTManager — Grid-based Apple-style list for PRT requests
 * ─ Utilise OrderTable (table-shell) pour la carte + en-têtes sticky
 * ─ Strict column alignment avec grid-cols-[40px_1fr_1fr_1fr_1fr_80px_80px]
 * ─ Drag & drop vertical reordering (Framer Motion Reorder)
 * ─ Zéro friction : clic dot → toggle done, clic trash → delete
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Check, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

interface PRTItem {
  id: string;
  clientName: string;
  dimensions: string;
  design: string;
  color: string;
  quantity: number;
  done: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface PRTManagerProps {
  items: PRTItem[];
  onItemsChange?: (items: PRTItem[]) => void;
  onNewRequest?: () => void;
}

// Grid : [checkbox] [client] [dimensions] [design] [couleur] [qté] [actions]
const GRID_COLS  = "grid-cols-[40px_1fr_1fr_1fr_1fr_80px_80px]";
const CELL_CLASS = "px-3 py-3 truncate";

export function PRTManager({ items, onItemsChange, onNewRequest }: PRTManagerProps) {
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isDeletingIds, setIsDeletingIds] = useState<Set<string>>(new Set());
  const [isAddingNew,  setIsAddingNew]  = useState(false);

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
      const updated = items.map((i) =>
        i.id === id ? { ...i, design: nameWithoutExt } : i,
      );
      onItemsChange?.(updated);

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
    [items, onItemsChange],
  );

  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  }, [items]);

  const handleToggleDone = useCallback(
    async (id: string) => {
      const updated = items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      );
      onItemsChange?.(updated);
      try {
        await fetch(`/api/prt-requests/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ done: !items.find((i) => i.id === id)?.done }),
        });
      } catch (err) {
        console.error("Failed to update PRT:", err);
      }
    },
    [items, onItemsChange],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeletingIds((prev) => new Set([...prev, id]));
      onItemsChange?.(items.filter((i) => i.id !== id));
      try {
        await fetch(`/api/prt-requests/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete PRT:", err);
        const res  = await fetch("/api/prt-requests");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [items, onItemsChange],
  );

  const handleDeleteSelected = useCallback(async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/prt-requests/${id}`, { method: "DELETE" }),
        ),
      );
      onItemsChange?.(items.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete multiple PRTs:", err);
    }
  }, [selectedIds, items, onItemsChange]);

  const handleAddNew = useCallback(async () => {
    setIsAddingNew(true);
    try {
      const res  = await fetch("/api/prt-requests", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clientName: "", dimensions: "", design: "", color: "", quantity: 1 }),
      });
      const data = await res.json();
      onItemsChange?.([data.item, ...items]);
      onNewRequest?.();
    } catch (err) {
      console.error("Failed to create PRT:", err);
    } finally {
      setTimeout(() => setIsAddingNew(false), 300);
    }
  }, [items, onItemsChange, onNewRequest]);

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
      <button
        onClick={handleAddNew}
        disabled={isAddingNew}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Demande de DTF</span>
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
      <div className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3">Client</div>
      <div className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3">Dimensions</div>
      <div className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3">Design</div>
      <div className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3">Couleur</div>
      <div className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3">Qté</div>
      <div className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <OrderTable toolbar={toolbar} headers={headers}>
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
              onItemsChange?.(
                items
                  .filter((i) => !reorderedItems.some((r) => r.id === i.id))
                  .concat(reorderedItems),
              );
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
            <AnimatePresence mode="popLayout">
              {sortedItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 text-center text-[13px] text-slate-300"
                >
                  Aucune demande PRT
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
                          item?.done && "opacity-40",
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
                          onChange={(e) => {
                            const updated = items.map((i) =>
                              i.id === item.id ? { ...i, clientName: e.target.value } : i,
                            );
                            onItemsChange?.(updated);
                          }}
                          onBlur={async () => {
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
                          onChange={(e) => {
                            const updated = items.map((i) =>
                              i.id === item.id ? { ...i, dimensions: e.target.value } : i,
                            );
                            onItemsChange?.(updated);
                          }}
                          onBlur={async () => {
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
                            onChange={(e) => {
                              const updated = items.map((i) =>
                                i.id === item.id ? { ...i, design: e.target.value } : i,
                              );
                              onItemsChange?.(updated);
                            }}
                            onBlur={async () => {
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
                            className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-700 text-[13px] truncate"
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

                        {/* Couleur (1fr) */}
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => {
                            const updated = items.map((i) =>
                              i.id === item.id ? { ...i, color: e.target.value } : i,
                            );
                            onItemsChange?.(updated);
                          }}
                          onBlur={async () => {
                            try {
                              await fetch(`/api/prt-requests/${item.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ color: item.color }),
                              });
                            } catch (err) {
                              console.error("Failed to update:", err);
                            }
                          }}
                          className={cn(
                            CELL_CLASS,
                            "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-slate-200 text-slate-700 text-[13px]",
                          )}
                          placeholder="Blanc"
                        />

                        {/* Quantité (80px) */}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            const updated = items.map((i) =>
                              i.id === item.id
                                ? { ...i, quantity: parseInt(val) || 1 }
                                : i,
                            );
                            onItemsChange?.(updated);
                          }}
                          onBlur={async () => {
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

                        {/* Actions (80px) — Done + Delete */}
                        <div className="flex items-center justify-end gap-0.5 py-3 pr-2">
                          <motion.button
                            onClick={() => handleToggleDone(item.id)}
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
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        </div>
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
