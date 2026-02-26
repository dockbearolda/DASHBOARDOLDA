"use client";

/**
 * WorkflowList — Ultra-fast Task Lists with Inline Editing
 * ─ 4 listes : Achat, Standard, Atelier, DTF
 * ─ Édition inline : clic sur le texte pour modifier
 * ─ Ajout rapide : champ minimaliste en bas (Enter pour ajouter)
 * ─ Drag & drop vertical avec position sauvegardée en DB
 * ─ Swipe-to-delete : glisse vers l'extérieur, animation rouge fluide
 * ─ Design Apple : Inter, 18px radius, antialiased, ombres légères
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, Reorder, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowItem } from "@/types/order";

const LIST_CONFIGS = {
  ACHAT: { title: "ACHAT", color: "bg-blue-50", dotColor: "bg-blue-500", borderColor: "border-blue-100" },
  STANDARD: { title: "STANDARD", color: "bg-amber-50", dotColor: "bg-amber-500", borderColor: "border-amber-100" },
  ATELIER: { title: "ATELIER", color: "bg-purple-50", dotColor: "bg-purple-500", borderColor: "border-purple-100" },
  DTF: { title: "DTF", color: "bg-rose-50", dotColor: "bg-rose-500", borderColor: "border-rose-100" },
} as const;

interface WorkflowListProps {
  items: WorkflowItem[];
  onReorder: (items: WorkflowItem[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, title: string) => Promise<void>;
  onCreate: (title: string, listType: WorkflowItem["listType"]) => Promise<void>;
  listType: WorkflowItem["listType"];
  isLoading?: boolean;
}

function WorkflowItemRow({
  item,
  onDelete,
  onUpdate,
  isDeleting,
}: {
  item: WorkflowItem;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (title: string) => Promise<void>;
  isDeleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDelete = useCallback(async () => {
    await onDelete(item.id);
  }, [item.id, onDelete]);

  const handleEditStart = useCallback(() => {
    setIsEditing(true);
    setEditValue(item.title);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [item.title]);

  const handleEditEnd = useCallback(async () => {
    if (editValue.trim() && editValue !== item.title) {
      try {
        await onUpdate(editValue.trim());
      } catch (err) {
        console.error("Failed to update title:", err);
        setEditValue(item.title);
      }
    }
    setIsEditing(false);
  }, [editValue, item.title, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleEditEnd();
    if (e.key === "Escape") setIsEditing(false);
  }, [handleEditEnd]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {/* Item row */}
      <div className="relative z-10 group">
        <div
          className={cn(
            "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] bg-white border border-gray-100",
            "transition-all hover:border-gray-200 hover:shadow-sm",
            "cursor-grab active:cursor-grabbing",
            isDeleting && "opacity-50"
          )}
        >
          {/* Drag handle */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <div className="w-0.5 h-0.5 rounded-full bg-gray-300" />
            <div className="w-0.5 h-0.5 rounded-full bg-gray-300" />
            <div className="w-0.5 h-0.5 rounded-full bg-gray-300" />
          </div>

          {/* Content */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditEnd}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-0"
              style={{
                fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
              }}
            />
          ) : (
            <span
              onClick={handleEditStart}
              className="flex-1 text-sm font-medium text-gray-900 cursor-text hover:text-gray-700 transition-colors truncate"
              style={{
                fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
              }}
            >
              {item.title}
            </span>
          )}

          {/* Trash icon - visible on hover */}
          {!isEditing && (
            <motion.button
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AddItemInput({
  listType,
  onCreate,
  isCreating,
}: {
  listType: WorkflowItem["listType"];
  onCreate: (title: string) => Promise<void>;
  isCreating: boolean;
}) {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!value.trim()) return;
    setIsLoading(true);
    try {
      await onCreate(value.trim());
      setValue("");
    } catch (err) {
      console.error("Failed to create item:", err);
    } finally {
      setIsLoading(false);
    }
  }, [value, onCreate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleCreate();
    }
  }, [handleCreate, isLoading]);

  return (
    <div className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
      <Plus className="h-4 w-4 text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ajouter une tâche..."
        disabled={isLoading}
        className="flex-1 text-sm text-gray-700 bg-transparent border-none focus:outline-none placeholder-gray-400 disabled:opacity-50"
        style={{
          fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      />
    </div>
  );
}

export function WorkflowListColumn({
  items,
  onReorder,
  onDelete,
  onUpdate,
  onCreate,
  listType,
  isLoading,
}: WorkflowListProps) {
  const config = LIST_CONFIGS[listType];
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDeleteItem = useCallback(async (id: string) => {
    setDeletingIds((prev) => new Set([...prev, id]));
    try {
      await onDelete(id);
    } catch (err) {
      console.error("Failed to delete item:", err);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onDelete]);

  const handleUpdateItem = useCallback(async (id: string, title: string) => {
    try {
      await onUpdate(id, title);
    } catch (err) {
      console.error("Failed to update item:", err);
    }
  }, [onUpdate]);

  const handleReorder = useCallback(async (newOrder: WorkflowItem[]) => {
    try {
      await onReorder(newOrder);
    } catch (err) {
      console.error("Failed to reorder items:", err);
    }
  }, [onReorder]);

  const handleCreate = useCallback(async (title: string) => {
    try {
      await onCreate(title, listType);
    } catch (err) {
      console.error("Failed to create item:", err);
    }
  }, [onCreate, listType]);

  return (
    <div className="flex-1 min-w-[300px] max-w-[400px] flex flex-col gap-3">
      {/* Header */}
      <div className={cn("rounded-[18px] px-4 py-3 flex items-center justify-between", config.color)}>
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
          <span
            className="text-xs font-bold text-gray-900 uppercase tracking-wider"
            style={{
              fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              letterSpacing: "0.05em",
            }}
          >
            {config.title}
          </span>
        </div>
        <span className="text-xs font-semibold text-gray-600 px-2.5 py-1 rounded-full bg-white/40">
          {items.length}
        </span>
      </div>

      {/* Items container */}
      <div className="flex-1 flex flex-col gap-2 rounded-[18px] p-3 bg-white/50 border border-gray-100 min-h-[200px]">
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={handleReorder}
          className="flex flex-col gap-2 flex-1"
        >
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-8 text-gray-300 text-sm flex-1"
              >
                Aucune tâche
              </motion.div>
            ) : (
              items.map((item) => (
                <Reorder.Item key={item.id} value={item}>
                  <WorkflowItemRow
                    item={item}
                    onDelete={(id) => handleDeleteItem(id)}
                    onUpdate={(title) => handleUpdateItem(item.id, title)}
                    isDeleting={deletingIds.has(item.id)}
                  />
                </Reorder.Item>
              ))
            )}
          </AnimatePresence>
        </Reorder.Group>

        {/* Add item input at bottom */}
        <AddItemInput
          listType={listType}
          onCreate={handleCreate}
          isCreating={false}
        />
      </div>
    </div>
  );
}

interface WorkflowListsGridProps {
  items: WorkflowItem[];
  onItemsChange?: (items: WorkflowItem[]) => void;
  isLoading?: boolean;
}

export function WorkflowListsGrid({ items, onItemsChange, isLoading }: WorkflowListsGridProps) {
  const groupedItems = useMemo(() => {
    const groups: Record<WorkflowItem["listType"], WorkflowItem[]> = {
      ACHAT: [],
      STANDARD: [],
      ATELIER: [],
      DTF: [],
    };
    items.forEach((item) => {
      if (groups[item.listType]) {
        groups[item.listType].push(item);
      }
    });
    // Sort by position
    Object.keys(groups).forEach((key) => {
      groups[key as WorkflowItem["listType"]].sort((a, b) => a.position - b.position);
    });
    return groups;
  }, [items]);

  const handleReorder = useCallback(
    async (listType: WorkflowItem["listType"], newItems: WorkflowItem[]) => {
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        position: idx,
      }));

      const allItems = [
        ...updatedItems,
        ...items.filter((i) => i.listType !== listType),
      ];
      onItemsChange?.(allItems);

      try {
        await Promise.all(
          updatedItems.map((item) =>
            fetch(`/api/workflow-items/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ position: item.position }),
            })
          )
        );
      } catch (err) {
        console.error("Failed to save positions:", err);
      }
    },
    [items, onItemsChange]
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      onItemsChange?.(items.filter((i) => i.id !== itemId));
      try {
        await fetch(`/api/workflow-items/${itemId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete item:", err);
        const res = await fetch("/api/workflow-items");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [items, onItemsChange]
  );

  const handleUpdate = useCallback(
    async (itemId: string, title: string) => {
      onItemsChange?.(
        items.map((i) => (i.id === itemId ? { ...i, title } : i))
      );
      try {
        await fetch(`/api/workflow-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch (err) {
        console.error("Failed to update item:", err);
        const res = await fetch("/api/workflow-items");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [items, onItemsChange]
  );

  const handleCreate = useCallback(
    async (title: string, listType: WorkflowItem["listType"]) => {
      try {
        const res = await fetch("/api/workflow-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listType, title }),
        });
        const data = await res.json();
        onItemsChange?.([...items, data.item]);
      } catch (err) {
        console.error("Failed to create item:", err);
      }
    },
    [items, onItemsChange]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
      {(["ACHAT", "STANDARD", "ATELIER", "DTF"] as const).map((listType) => (
        <WorkflowListColumn
          key={listType}
          listType={listType}
          items={groupedItems[listType]}
          onReorder={(newItems) => handleReorder(listType, newItems)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onCreate={handleCreate}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
