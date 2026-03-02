"use client";

/**
 * WorkflowList — Ultra-fast Task Lists with Inline Editing
 * ─ 4 listes : Achat, Standard, Atelier, DTF
 * ─ Édition inline : clic sur le texte pour modifier
 * ─ Ajout rapide : champ minimaliste en bas (Enter pour ajouter)
 * ─ Drag & drop vertical fluide via useDragControls (handle dédié)
 * ─ Design Apple : Inter, 18px radius, antialiased, ombres légères
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, Reorder, AnimatePresence, useDragControls } from "framer-motion";
import { Trash2, Plus, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowItem } from "@/types/order";

// Palettes pastel (calquées sur AchatCardsGrid)
const LIST_CONFIGS = {
  ACHAT:    { title: "ACHAT",    from: "#0a84ff", border: "rgba(10,132,255,0.20)" },
  STANDARD: { title: "STANDARD", from: "#ff9f0a", border: "rgba(255,159,10,0.20)" },
  ATELIER:  { title: "ATELIER",  from: "#bf5af2", border: "rgba(191,90,242,0.20)" },
  DTF:      { title: "DTF",      from: "#ff375f", border: "rgba(255,55,95,0.20)"  },
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

/* ─────────────────────────────────────────────
   WorkflowItemRow — contenu pur (sans motion)
───────────────────────────────────────────── */
function WorkflowItemRow({
  item,
  onDelete,
  onUpdate,
  isDeleting,
  onDragHandlePointerDown,
}: {
  item: WorkflowItem;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (title: string) => Promise<void>;
  isDeleting: boolean;
  onDragHandlePointerDown: (e: React.PointerEvent) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEditStart = useCallback(() => {
    setIsEditing(true);
    setEditValue(item.title);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [item.title]);

  const handleEditEnd = useCallback(async () => {
    if (editValue.trim() && editValue !== item.title) {
      try {
        await onUpdate(editValue.trim());
      } catch {
        setEditValue(item.title);
      }
    }
    setIsEditing(false);
  }, [editValue, item.title, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleEditEnd();
      if (e.key === "Escape") setIsEditing(false);
    },
    [handleEditEnd]
  );

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-[18px] bg-white border border-[#E5E5E5]",
          "shadow-[0_1px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)]",
          "transition-all duration-200 select-none",
          isDeleting && "opacity-40 pointer-events-none"
        )}
      >
        {/* Drag handle — seule zone draggable */}
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            onDragHandlePointerDown(e);
          }}
          className={cn(
            "shrink-0 touch-none",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Contenu éditable */}
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
              fontFamily:
                "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              WebkitFontSmoothing: "antialiased",
            }}
          />
        ) : (
          <span
            onClick={handleEditStart}
            className="flex-1 text-sm font-medium text-gray-900 cursor-text hover:text-gray-700 transition-colors truncate"
            style={{
              fontFamily:
                "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {item.title}
          </span>
        )}

        {/* Suppression au hover */}
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DraggableWorkflowItem — Reorder.Item + drag
   useDragControls garantit que seul le handle
   déclenche le drag, le texte reste cliquable.
───────────────────────────────────────────── */
function DraggableWorkflowItem({
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
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      whileDrag={{
        scale: 1.025,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        zIndex: 50,
      }}
      className="list-none"
    >
      <WorkflowItemRow
        item={item}
        onDelete={onDelete}
        onUpdate={onUpdate}
        isDeleting={isDeleting}
        onDragHandlePointerDown={(e) => controls.start(e)}
      />
    </Reorder.Item>
  );
}

/* ─────────────────────────────────────────────
   AddItemInput — pill → inline (style AchatCard)
───────────────────────────────────────────── */
function AddItemInput({
  accentColor,
  onCreate,
}: {
  listType: WorkflowItem["listType"];
  accentColor: string;
  onCreate: (title: string) => Promise<void>;
  isCreating: boolean;
}) {
  const [isAdding, setIsAdding]   = useState(false);
  const [draft,    setDraft]      = useState("");
  const [loading,  setLoading]    = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isAdding) setTimeout(() => inputRef.current?.focus(), 30); }, [isAdding]);

  const commit = useCallback(async () => {
    const text = draft.trim();
    if (!text) { setIsAdding(false); setDraft(""); return; }
    setLoading(true);
    try { await onCreate(text); setDraft(""); } catch { /* ignore */ } finally { setLoading(false); }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [draft, onCreate]);

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Ajouter</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-white/70 border border-white/80">
      <span className="shrink-0 h-4 w-4 rounded-full border-2 border-gray-200" />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setIsAdding(false); setDraft(""); }
        }}
        onBlur={() => { commit(); setIsAdding(false); }}
        disabled={loading}
        placeholder="Nouvelle tâche..."
        className="flex-1 text-[13px] text-gray-700 placeholder:text-gray-400 bg-transparent outline-none disabled:opacity-50"
        style={{ caretColor: accentColor }}
      />
      <button
        onMouseDown={(e) => { e.preventDefault(); setIsAdding(false); setDraft(""); }}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WorkflowListColumn — style AchatCard (carte blanche unifiée)
───────────────────────────────────────────── */
export function WorkflowListColumn({
  items,
  onReorder,
  onDelete,
  onUpdate,
  onCreate,
  listType,
}: WorkflowListProps) {
  const config = LIST_CONFIGS[listType];
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDeleteItem = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => new Set([...prev, id]));
      try {
        await onDelete(id);
      } catch {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [onDelete]
  );

  const handleUpdateItem = useCallback(
    async (id: string, title: string) => {
      try { await onUpdate(id, title); } catch { /* ignore */ }
    },
    [onUpdate]
  );

  const handleCreate = useCallback(
    async (title: string) => {
      try { await onCreate(title, listType); } catch { /* ignore */ }
    },
    [onCreate, listType]
  );

  return (
    /* ── Carte blanche unifiée (AchatCard style) ── */
    <div
      className="flex-1 min-w-[300px] max-w-[400px] rounded-3xl border p-4 flex flex-col gap-0"
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        backgroundColor: "#ffffff",
        borderColor: config.border,
        boxShadow: "0 1px 4px 0 rgba(0,0,0,0.05)",
      }}
    >
      {/* ── En-tête : dot + titre pastel + badge ── */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: config.from }}
          />
          <span
            className="text-[11px] font-bold uppercase tracking-wider truncate"
            style={{ color: config.from, letterSpacing: "0.08em" }}
          >
            {config.title}
          </span>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: config.from + "18",
            color: config.from,
            border: `1px solid ${config.border}`,
          }}
        >
          {items.length}
        </span>
      </div>

      {/* ── Séparateur ── */}
      <div className="h-px mb-3" style={{ backgroundColor: config.border }} />

      {/* ── Bouton Ajouter ── */}
      <div className="mb-3">
        <AddItemInput
          listType={listType}
          accentColor={config.from}
          onCreate={handleCreate}
          isCreating={false}
        />
      </div>

      {/* ── Liste des items ── */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-[120px]">
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={onReorder}
          className="flex flex-col gap-2 flex-1"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-6 text-gray-300 text-xs italic flex-1"
              >
                Aucune tâche
              </motion.div>
            ) : (
              items.map((item) => (
                <DraggableWorkflowItem
                  key={item.id}
                  item={item}
                  onDelete={handleDeleteItem}
                  onUpdate={(title) => handleUpdateItem(item.id, title)}
                  isDeleting={deletingIds.has(item.id)}
                />
              ))
            )}
          </AnimatePresence>
        </Reorder.Group>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WorkflowListsGrid
───────────────────────────────────────────── */
interface WorkflowListsGridProps {
  items: WorkflowItem[];
  onItemsChange?: (value: WorkflowItem[] | ((prev: WorkflowItem[]) => WorkflowItem[])) => void;
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
      if (groups[item.listType]) groups[item.listType].push(item);
    });
    Object.keys(groups).forEach((key) => {
      groups[key as WorkflowItem["listType"]].sort((a, b) => a.position - b.position);
    });
    return groups;
  }, [items]);

  // Functional updates — jamais de snapshot `items` obsolète
  const handleReorder = useCallback(
    async (listType: WorkflowItem["listType"], newItems: WorkflowItem[]) => {
      const updatedItems = newItems.map((item, idx) => ({ ...item, position: idx }));
      onItemsChange?.((prev) => [
        ...updatedItems,
        ...prev.filter((i) => i.listType !== listType),
      ]);
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
    [onItemsChange]
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      onItemsChange?.((prev) => prev.filter((i) => i.id !== itemId));
      try {
        await fetch(`/api/workflow-items/${itemId}`, { method: "DELETE" });
      } catch {
        const res = await fetch("/api/workflow-items");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [onItemsChange]
  );

  const handleUpdate = useCallback(
    async (itemId: string, title: string) => {
      onItemsChange?.((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
      try {
        await fetch(`/api/workflow-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch {
        const res = await fetch("/api/workflow-items");
        const data = await res.json();
        onItemsChange?.(data.items ?? []);
      }
    },
    [onItemsChange]
  );

  const handleCreate = useCallback(
    async (title: string, listType: WorkflowItem["listType"]) => {
      try {
        const res = await fetch("/api/workflow-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listType, title }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.item) {
          // Functional update : plusieurs ajouts simultanés ne se perdent pas
          onItemsChange?.((prev) => [...prev, data.item]);
        }
      } catch (err) {
        console.error("Failed to create item:", err);
      }
    },
    [onItemsChange]
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
