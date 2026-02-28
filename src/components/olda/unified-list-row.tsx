"use client";

/**
 * UnifiedListRow — Standard row component for all lists
 * ─ Dot (left): Toggle done
 * ─ Content (center): Inline editable
 * ─ Trash (right): Delete instantly
 * ─ Drag & drop ready (use with Reorder)
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnifiedListItemData {
  id: string;
  done?: boolean;
  [key: string]: any;
}

interface UnifiedListRowProps<T extends UnifiedListItemData> {
  item: T;
  onUpdate: (item: T) => void;
  onDelete: (id: string) => void;
  renderContent: (item: T, isEditing: boolean, onEdit: (item: T) => void) => React.ReactNode;
  isAltBackground?: boolean;
}

export function UnifiedListRow<T extends UnifiedListItemData>({
  item,
  onUpdate,
  onDelete,
  renderContent,
  isAltBackground,
}: UnifiedListRowProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleToggleDone = useCallback(() => {
    onUpdate({ ...item, done: !item.done });
  }, [item, onUpdate]);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  const handleEdit = useCallback((updated: T) => {
    onUpdate(updated);
    setIsEditing(false);
  }, [onUpdate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      ref={rowRef}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] border border-gray-100",
        "transition-[border-color] group hover:border-gray-200",
        isAltBackground ? "bg-gray-50/50" : "bg-white",
        item.done && "opacity-50"
      )}
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        willChange: "transform, opacity",
      }}
    >
      {/* DOT — Toggle Done (LEFT) */}
      <motion.button
        onClick={handleToggleDone}
        whileTap={{ scale: 0.85 }}
        className={cn(
          "shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          item.done
            ? "bg-green-500 border-green-500"
            : "border-gray-300 hover:border-green-500 hover:bg-green-50"
        )}
        title="Click to mark as done"
      >
        {item.done && <Check className="h-3 w-3 text-white" />}
      </motion.button>

      {/* CONTENT — Inline Editable (CENTER) */}
      <div className={cn("flex-1", item.done && "line-through text-gray-400")}>
        {renderContent(item, isEditing, handleEdit)}
      </div>

      {/* TRASH — Delete (RIGHT) */}
      <motion.button
        onClick={handleDelete}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete this item"
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}
