"use client";

/**
 * RemindersGrid — Gestures-first, Apple Reminders style, 4 inline cards.
 *
 * Interactions :
 *   • Clic simple sur un texte  → édition inline (blur = save auto)
 *   • Double-clic sur un texte  → suppression immédiate
 *   • Glisser-déposer           → déplace un item entre les 4 fiches
 *   • Clic sur le cercle        → toggle ✓/⊘
 *   • Crayon en haut à droite   → ouvre l'input d'ajout
 *
 * Pas de bouton poubelle ni de croix — les gestes font tout.
 * Drag & Drop 100 % natif (HTML5 DataTransfer), zéro lib externe.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "./person-note-modal";

// ── Constantes ─────────────────────────────────────────────────────────────────

const PEOPLE = [
  { key: "loic",     name: "Loïc" },
  { key: "charlie",  name: "Charlie" },
  { key: "melina",   name: "Mélina" },
  { key: "amandine", name: "Amandine" },
] as const;

type PersonKey = typeof PEOPLE[number]["key"];

/** Délai (ms) pour distinguer clic simple / double-clic */
const DBL_DELAY = 280;

function newId(): string {
  return `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Persistence (fire-and-forget) ─────────────────────────────────────────────

function apiSave(key: string, todos: TodoItem[]) {
  fetch(`/api/notes/${key}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ todos }),
  }).catch(() => {});
}


// ── ReminderCard ───────────────────────────────────────────────────────────────

function ReminderCard({
  personKey,
  personName,
  todos,
  isActive,
  onUpdate,
  onReceiveTodo,
  onEditingChange,
}: {
  personKey:       PersonKey;
  personName:      string;
  todos:           TodoItem[];
  isActive?:       boolean;
  /** Called when THIS card's todos change */
  onUpdate:        (next: TodoItem[]) => void;
  /** Called when a dragged item is dropped FROM another card */
  onReceiveTodo:   (fromKey: PersonKey, todoId: string) => void;
  /** Called when editing starts/stops so SSE can be paused */
  onEditingChange?:(isEditing: boolean) => void;
}) {
  // ── Local UI state ───────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editText,   setEditText]   = useState("");
  const [isAdding,   setIsAdding]   = useState(false);
  const [draft,      setDraft]      = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef  = useRef<HTMLInputElement>(null);
  const clickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  // Notifier le parent quand la card passe en mode édition / saisie
  useEffect(() => {
    onEditingChange?.(editingId !== null || isAdding);
  }, [editingId, isAdding, onEditingChange]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const toggle = useCallback((id: string) => {
    onUpdate(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, [todos, onUpdate]);

  // ── Inline edit ──────────────────────────────────────────────────────────────

  const startEdit = useCallback((todo: TodoItem) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setTimeout(() => editInputRef.current?.focus(), 20);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const text = editText.trim();
    onUpdate(
      text
        ? todos.map(t => t.id === editingId ? { ...t, text } : t)
        : todos.filter(t => t.id !== editingId)
    );
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, todos, onUpdate]);

  // ── Geste : clic simple → éditer · double-clic → supprimer ───────────────────

  const handleItemClick = useCallback((todo: TodoItem) => {
    // Already editing → ignore
    if (editingId === todo.id) return;

    if (clickTimer.current) {
      // Second click arrives before timer → double-clic → delete
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onUpdate(todos.filter(t => t.id !== todo.id));
      return;
    }

    // First click : wait to see if a second one arrives
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      startEdit(todo);
    }, DBL_DELAY);
  }, [editingId, todos, onUpdate, startEdit]);

  // ── Ajout rapide ─────────────────────────────────────────────────────────────

  const commitDraft = useCallback(() => {
    const text = draft.trim();
    if (text) {
      onUpdate([...todos, { id: newId(), text, done: false }]);
      setDraft("");
      setTimeout(() => addInputRef.current?.focus(), 0);
    } else {
      setIsAdding(false);
      setDraft("");
    }
  }, [draft, todos, onUpdate]);

  const openAdd = () => {
    setIsAdding(true);
    setTimeout(() => addInputRef.current?.focus(), 30);
  };

  // ── Drag & Drop (HTML5 natif) ─────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, todo: TodoItem) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("rd_todoId",  todo.id);
    e.dataTransfer.setData("rd_fromKey", personKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const todoId  = e.dataTransfer.getData("rd_todoId");
    const fromKey = e.dataTransfer.getData("rd_fromKey") as PersonKey;
    if (todoId && fromKey && fromKey !== personKey) {
      onReceiveTodo(fromKey, todoId);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-2xl bg-white border p-3 flex flex-col",
        "transition-colors duration-150",
        isActive   ? "border-blue-300/70 bg-blue-50/30" : "border-gray-100",
        isDragOver ? "border-blue-400 bg-blue-50/50" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        boxShadow: isActive
          ? "0 1px 8px 0 rgba(59,130,246,0.10), 0 0 0 1px rgba(147,197,253,0.5)"
          : isDragOver
            ? "0 2px 12px 0 rgba(59,130,246,0.14)"
            : "0 1px 4px 0 rgba(0,0,0,0.05)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-2.5">
        {isActive && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
        <span className={cn(
          "text-[11px] font-bold text-gray-900 uppercase tracking-wider",
          isActive && "text-blue-600"
        )}>
          {personName}
        </span>
        <span className="text-[11px] font-semibold text-gray-400 ml-auto px-2 py-0.5 rounded-full bg-gray-100/80">
          {todos.length}
        </span>
      </div>

      {/* ── Liste des todos ── */}
      <div className="flex-1 flex flex-col gap-1.5">
        {todos.length === 0 && !isAdding && (
          <p className="text-xs italic text-gray-300 py-4 text-center">Aucune tâche</p>
        )}

        <AnimatePresence mode="sync">
          {todos.map((todo) => (
            <motion.div
              key={todo.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.14, ease: [0.25, 0.1, 0.25, 1] } }}
              draggable={editingId !== todo.id}
              onDragStart={(e) => {
                if (editingId === todo.id) return;
                handleDragStart(e as unknown as React.DragEvent, todo);
              }}
              style={{ willChange: "transform, opacity" }}
              className={cn(
                "flex items-center gap-2 w-full rounded-xl px-2.5 py-2 bg-white border border-gray-100",
                "transition-colors duration-150",
                editingId !== todo.id && "cursor-grab active:cursor-grabbing hover:border-gray-200 group",
              )}
            >
              {/* Dot toggle ✓ */}
              <motion.button
                onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
                whileTap={{ scale: 0.82, transition: { duration: 0.1 } }}
                style={{ willChange: "transform" }}
                className={cn(
                  "shrink-0 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors duration-150",
                  todo.done
                    ? "bg-green-500 border-green-500"
                    : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                )}
              >
                {todo.done && <Check className="h-2.5 w-2.5 text-white" />}
              </motion.button>

              {/* Texte ou input inline */}
              {editingId === todo.id ? (
                <input
                  ref={editInputRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                  }}
                  onBlur={commitEdit}
                  className="flex-1 text-[13px] font-medium text-gray-900 bg-transparent outline-none border-b border-blue-400"
                />
              ) : (
                <span
                  onClick={() => handleItemClick(todo)}
                  className={cn(
                    "flex-1 text-[13px] font-medium select-none cursor-text transition-colors duration-150",
                    todo.done ? "line-through text-gray-400" : "text-gray-900 hover:text-gray-700"
                  )}
                >
                  {todo.text}
                </span>
              )}

              {/* Trash — visible au survol */}
              {editingId !== todo.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(todos.filter(t => t.id !== todo.id));
                  }}
                  className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input ajout rapide */}
      <div className="mt-auto pt-2 border-t border-gray-100">
        {isAdding ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 h-4 w-4 rounded-full border-2 border-gray-200" />
            <input
              ref={addInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); commitDraft(); }
                if (e.key === "Escape") { setIsAdding(false); setDraft(""); }
              }}
              onBlur={() => { commitDraft(); setIsAdding(false); }}
              placeholder="Nouvelle tâche..."
              className="flex-1 text-[13px] text-gray-700 placeholder:text-gray-400 bg-transparent outline-none"
            />
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 w-full text-[12px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        )}
      </div>
    </div>
  );
}

// ── RemindersGrid ──────────────────────────────────────────────────────────────

export function RemindersGrid({
  notesMap,
  activeUser,
}: {
  notesMap:    Record<string, TodoItem[]>;
  activeUser?: string;
}) {
  // State remonté pour les déplacements cross-card
  const [todosMap, setTodosMap] = useState<Record<string, TodoItem[]>>(() => {
    const m: Record<string, TodoItem[]> = {};
    for (const p of PEOPLE) m[p.key] = notesMap[p.key] ?? [];
    return m;
  });

  const saveTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mountedRef    = useRef(true);
  // Clé de la personne dont une card est en cours d'édition (null = aucune)
  const editingKeyRef = useRef<string | null>(null);

  // ── SSE : synchronisation temps réel entre utilisateurs ─────────────────────
  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        es = new EventSource("/api/notes/stream");

        es.addEventListener("note-changed", (event) => {
          if (!mountedRef.current) return;
          try {
            const note = JSON.parse((event as MessageEvent).data) as {
              person: string;
              todos:  TodoItem[] | string;
            };
            // Ne pas écraser la card en cours d'édition
            if (editingKeyRef.current === note.person) return;
            let todos: TodoItem[] = [];
            if (Array.isArray(note.todos))       todos = note.todos;
            else if (typeof note.todos === "string") {
              try { todos = JSON.parse(note.todos); } catch { todos = []; }
            }
            setTodosMap(prev => ({ ...prev, [note.person]: todos }));
          } catch { /* malformed */ }
        });

        es.onerror = () => {
          if (!mountedRef.current) return;
          es?.close();
          reconnectTimer = setTimeout(connect, 10_000);
        };
      } catch { /* SSE not supported — degrade silently */ }
    };

    connect();
    return () => {
      mountedRef.current = false;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []); // stable — ne dépend d'aucune prop/state

  // Mise à jour locale + persist debounced
  const handleUpdate = useCallback((key: string, next: TodoItem[]) => {
    setTodosMap(prev => ({ ...prev, [key]: next }));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => apiSave(key, next), 600);
  }, []);

  // Déplacement cross-card (drag & drop)
  const handleReceiveTodo = useCallback((fromKey: PersonKey, toKey: string, todoId: string) => {
    setTodosMap(prev => {
      const todo = prev[fromKey]?.find(t => t.id === todoId);
      if (!todo) return prev;
      const nextFrom = prev[fromKey].filter(t => t.id !== todoId);
      const nextTo   = [...(prev[toKey] ?? []), { ...todo, done: false }];
      // Persist les deux fiches
      apiSave(fromKey, nextFrom);
      apiSave(toKey,   nextTo);
      return { ...prev, [fromKey]: nextFrom, [toKey]: nextTo };
    });
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {PEOPLE.map((p) => (
        <ReminderCard
          key={p.key}
          personKey={p.key}
          personName={p.name}
          todos={todosMap[p.key] ?? []}
          isActive={p.key === activeUser}
          onUpdate={(next) => handleUpdate(p.key, next)}
          onReceiveTodo={(fromKey, todoId) => handleReceiveTodo(fromKey, p.key, todoId)}
          onEditingChange={(isEditing) => {
            editingKeyRef.current = isEditing ? p.key : null;
          }}
        />
      ))}
    </div>
  );
}
