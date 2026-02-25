"use client";

/**
 * WorkflowList — Premium Drag & Drop + Swipe-to-Delete
 * ─ 4 listes indépendantes : Achat, Standard, Atelier, DTF
 * ─ Drag & drop vertical avec sauvegarde position en DB
 * ─ Swipe-to-delete : glisse vers l'extérieur pour supprimer
 * ─ Design Apple : 18px radius, Inter, antialiased, light
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, Reorder, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowItem {
  id: string;
  listType: "ACHAT" | "STANDARD" | "ATELIER" | "DTF";
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

const LIST_CONFIGS = {
  ACHAT: { title: "ACHAT", color: "bg-blue-50", dotColor: "bg-blue-400", borderColor: "border-blue-200" },
  STANDARD: { title: "STANDARD", color: "bg-amber-50", dotColor: "bg-amber-400", borderColor: "border-amber-200" },
  ATELIER: { title: "ATELIER", color: "bg-purple-50", dotColor: "bg-purple-400", borderColor: "border-purple-200" },
  DTF: { title: "DTF", color: "bg-rose-50", dotColor: "bg-rose-400", borderColor: "border-rose-200" },
} as const;

interface WorkflowListProps {
  items: WorkflowItem[];
  onReorder: (items: WorkflowItem[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  listType: WorkflowItem["listType"];
  isLoading?: boolean;
}

function WorkflowItemRow({
  item,
  onDelete,
  isDeleting,
}: {
  item: WorkflowItem;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-120, -60, 0], [0, 0.5, 1]);
  const scale = useTransform(x, [-120, 0], [0.8, 1]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDelete = useCallback(async () => {
    // Animate out before deleting
    await animate(x, -150, { duration: 0.2 });
    await onDelete(item.id);
  }, [item.id, onDelete, x]);

  const handleDragEnd = useCallback(() => {
    const currentX = x.get();
    if (currentX < -60) {
      handleDelete();
    } else {
      // Snap back
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  }, [handleDelete, x]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      <motion.div
        drag="x"
        dragElastic={0.2}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onDragStart={() => setIsDragging(true)}
        x={x}
        style={{ opacity, scale }}
        className="relative z-10"
      >
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-[16px] bg-white border border-gray-200 cursor-grab active:cursor-grabbing",
            "transition-all hover:shadow-md hover:border-gray-300",
            isDeleting && "opacity-50"
          )}
        >
          {/* Drag handle */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <div className="w-1 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Title */}
          <span className="flex-1 text-sm font-medium text-gray-900 truncate" style={{
            fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}>
            {item.title}
          </span>
        </div>
      </motion.div>

      {/* Delete indicator (under the dragging item) */}
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-end px-4 rounded-[16px] bg-red-50 border border-red-200"
        >
          <Trash2 className="h-5 w-5 text-red-500" />
        </motion.div>
      )}
    </motion.div>
  );
}

export function WorkflowListColumn({ items, onReorder, onDelete, listType, isLoading }: WorkflowListProps) {
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

  const handleReorder = useCallback(async (newOrder: WorkflowItem[]) => {
    try {
      await onReorder(newOrder);
    } catch (err) {
      console.error("Failed to reorder items:", err);
    }
  }, [onReorder]);

  return (
    <div className="flex-1 min-w-[280px] flex flex-col gap-3">
      {/* Header */}
      <div className={cn("rounded-[18px] px-4 py-3 flex items-center justify-between", config.color)}>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", config.dotColor)} />
          <span
            className="text-sm font-semibold text-gray-900 uppercase tracking-wide"
            style={{
              fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            }}
          >
            {config.title}
          </span>
        </div>
        <span className="text-xs font-semibold text-gray-500 px-2.5 py-1 rounded-full bg-white/50">
          {items.length}
        </span>
      </div>

      {/* Items */}
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={handleReorder}
        className="flex flex-col gap-2 rounded-[18px] p-3 bg-gray-50/50"
      >
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-12 text-gray-300 text-sm"
            >
              Vide
            </motion.div>
          ) : (
            items.map((item) => (
              <Reorder.Item
                key={item.id}
                value={item}
                className="rounded-[16px]"
              >
                <WorkflowItemRow
                  item={item}
                  onDelete={handleDeleteItem}
                  isDeleting={deletingIds.has(item.id)}
                />
              </Reorder.Item>
            ))
          )}
        </AnimatePresence>
      </Reorder.Group>
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
      // Update positions
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        position: idx,
      }));

      // Update local state
      const allItems = [
        ...updatedItems,
        ...items.filter((i) => i.listType !== listType),
      ];
      onItemsChange?.(allItems);

      // Save to API
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
        // Re-fetch on error
        const res = await fetch("/api/workflow-items");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
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
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
