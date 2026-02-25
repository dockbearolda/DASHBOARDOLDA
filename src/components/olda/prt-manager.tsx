"use client";

/**
 * PRTManager — Grid-based Apple-style list for PRT requests
 * ─ Strict column alignment with grid-cols-[40px_1fr_1fr_1fr_1fr_80px_40px]
 * ─ Zero friction interaction: click dot to toggle, click trash to delete
 * ─ Drag & drop vertical reordering
 * ─ Apple design: Inter font, antialiased, light gray hover
 */

import { useState, useCallback, useMemo } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

// Grid column layout: [checkbox] [client] [dimensions] [design] [color] [quantity] [actions]
const GRID_COLS = "grid-cols-[40px_1fr_1fr_1fr_1fr_80px_40px]";
const CELL_CLASS = "px-3 py-3 truncate";

export function PRTManager({ items, onItemsChange }: PRTManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingIds, setIsDeletingIds] = useState<Set<string>>(new Set());
  const [isAddingNew, setIsAddingNew] = useState(false);

  const sortedItems = useMemo(
    () => {
      if (!Array.isArray(items)) return [];
      return [...items].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
    },
    [items]
  );

  const handleToggleDone = useCallback(
    async (id: string) => {
      const updated = items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      );
      onItemsChange?.(updated);

      try {
        await fetch(`/api/prt-requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: !items.find((i) => i.id === id)?.done }),
        });
      } catch (err) {
        console.error("Failed to update PRT:", err);
      }
    },
    [items, onItemsChange]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeletingIds((prev) => new Set([...prev, id]));
      onItemsChange?.(items.filter((i) => i.id !== id));

      try {
        await fetch(`/api/prt-requests/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete PRT:", err);
        const res = await fetch("/api/prt-requests");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [items, onItemsChange]
  );

  const handleDeleteSelected = useCallback(async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/prt-requests/${id}`, { method: "DELETE" })
        )
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
      const res = await fetch("/api/prt-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "",
          dimensions: "",
          design: "",
          color: "",
          quantity: 1,
        }),
      });
      const data = await res.json();
      onItemsChange?.([data.item, ...items]);
    } catch (err) {
      console.error("Failed to create PRT:", err);
    } finally {
      setTimeout(() => setIsAddingNew(false), 300);
    }
  }, [items, onItemsChange]);

  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-white border border-gray-100 shadow-sm p-4"
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          Demandes PRT
        </h2>
        <motion.button
          onClick={handleAddNew}
          whileTap={{ scale: 0.92 }}
          animate={isAddingNew ? { backgroundColor: "#10b981" } : { backgroundColor: "transparent" }}
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
        <div className="text-left text-xs font-semibold text-gray-600 px-3">Client</div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">Dimensions</div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">Design</div>
        <div className="text-left text-xs font-semibold text-gray-600 px-3">Couleur</div>
        <div className="text-right text-xs font-semibold text-gray-600 px-3">Qté</div>
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
            onItemsChange?.(items.filter((i) => !reorderedItems.some((r) => r.id === i.id)).concat(reorderedItems));
            Promise.all(
              reorderedItems.map((item) =>
                fetch(`/api/prt-requests/${item.id}`, {
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
                Aucune demande PRT
              </motion.div>
            ) : (
              sortedItems.map((item) => {
                if (!item?.id) return null;
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
                      item?.done && "opacity-50"
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
                          i.id === item.id ? { ...i, clientName: e.target.value } : i
                        );
                        onItemsChange?.(updated);
                      }}
                      onBlur={async () => {
                        try {
                          await fetch(`/api/prt-requests/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ clientName: item.clientName }),
                          });
                        } catch (err) {
                          console.error("Failed to update:", err);
                        }
                      }}
                      className={cn(
                        CELL_CLASS,
                        "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-gray-200 text-gray-900 font-medium text-sm"
                      )}
                      placeholder="Nom client"
                    />

                    {/* Dimensions (1fr) */}
                    <input
                      type="text"
                      value={item.dimensions}
                      onChange={(e) => {
                        const updated = items.map((i) =>
                          i.id === item.id ? { ...i, dimensions: e.target.value } : i
                        );
                        onItemsChange?.(updated);
                      }}
                      onBlur={async () => {
                        try {
                          await fetch(`/api/prt-requests/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ dimensions: item.dimensions }),
                          });
                        } catch (err) {
                          console.error("Failed to update:", err);
                        }
                      }}
                      className={cn(
                        CELL_CLASS,
                        "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-gray-200 text-gray-900 text-sm"
                      )}
                      placeholder="30x40cm"
                    />

                    {/* Design (1fr) */}
                    <input
                      type="text"
                      value={item.design}
                      onChange={(e) => {
                        const updated = items.map((i) =>
                          i.id === item.id ? { ...i, design: e.target.value } : i
                        );
                        onItemsChange?.(updated);
                      }}
                      onBlur={async () => {
                        try {
                          await fetch(`/api/prt-requests/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ design: item.design }),
                          });
                        } catch (err) {
                          console.error("Failed to update:", err);
                        }
                      }}
                      className={cn(
                        CELL_CLASS,
                        "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-gray-200 text-gray-900 text-sm"
                      )}
                      placeholder="Design"
                    />

                    {/* Color (1fr) */}
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => {
                        const updated = items.map((i) =>
                          i.id === item.id ? { ...i, color: e.target.value } : i
                        );
                        onItemsChange?.(updated);
                      }}
                      onBlur={async () => {
                        try {
                          await fetch(`/api/prt-requests/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ color: item.color }),
                          });
                        } catch (err) {
                          console.error("Failed to update:", err);
                        }
                      }}
                      className={cn(
                        CELL_CLASS,
                        "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-gray-200 text-gray-900 text-sm"
                      )}
                      placeholder="Blanc"
                    />

                    {/* Quantity (80px) - right aligned */}
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = items.map((i) =>
                          i.id === item.id ? { ...i, quantity: parseInt(e.target.value) || 1 } : i
                        );
                        onItemsChange?.(updated);
                      }}
                      onBlur={async () => {
                        try {
                          await fetch(`/api/prt-requests/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ quantity: item.quantity }),
                          });
                        } catch (err) {
                          console.error("Failed to update:", err);
                        }
                      }}
                      className={cn(
                        CELL_CLASS,
                        "bg-transparent border-none focus:outline-none focus:bg-white focus:border-b border-gray-200 text-gray-900 text-sm text-right"
                      )}
                    />

                    {/* Actions (40px) - Done & Delete */}
                    <div className="flex items-center justify-end gap-0.5 py-3 pr-1">
                      <motion.button
                        onClick={() => handleToggleDone(item.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          item?.done
                            ? "text-green-600 bg-green-50"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        )}
                        title="Marquer comme fait"
                      >
                        <Check className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(item.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
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

      {/* Delete selected button */}
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

    </div>
  );
}
