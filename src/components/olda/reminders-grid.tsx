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
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Pencil } from "lucide-react";
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

// ── SwipeableTodoRow — Apple-style swipe-to-dismiss ──────────────────────────

function SwipeableTodoRow({
  isEditing,
  onDismiss,
  children,
}: {
  isEditing: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  // Opacité progressive (fade to 20% at threshold)
  const opacity = useTransform(x, [-150, 0, 150], [0.2, 1, 0.2]);

  // Fond rouge derrière (progresse jusqu'à 18% opacity)
  const bgOpacity = useTransform(
    x,
    [-150, -30, 0, 30, 150],
    [0.18, 0.08, 0, 0.08, 0.18]
  );

  const handleDragEnd = (_: any, info: any) => {
    const containerWidth = containerRef.current?.offsetWidth ?? 200;
    const threshold = containerWidth * 0.5;
    const offset = info.offset.x;

    if (Math.abs(offset) > threshold) {
      // Threshold atteint → suppression avec animation de sortie
      navigator.vibrate?.(40); // Haptic si supporté
      animate(x, offset > 0 ? 600 : -600, { duration: 0.2 });
      setTimeout(onDismiss, 180);
    } else {
      // Ressort élastique de retour à zéro
      animate(x, 0, {
        type: "spring",
        stiffness: 400,
        damping: 30,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-md"
    >
      {/* Fond rouge derrière la ligne */}
      <motion.div
        className="absolute inset-0 rounded-md bg-red-500"
        style={{ opacity: bgOpacity }}
      />

      {/* Ligne swipeable */}
      <motion.div
        style={{
          x,
          opacity,
          position: "relative",
        }}
        drag={isEditing ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── ReminderCard ───────────────────────────────────────────────────────────────

function ReminderCard({
  personKey,
  personName,
  todos,
  isActive,
  onUpdate,
  onReceiveTodo,
}: {
  personKey:    PersonKey;
  personName:   string;
  todos:        TodoItem[];
  isActive?:    boolean;
  /** Called when THIS card's todos change */
  onUpdate:     (next: TodoItem[]) => void;
  /** Called when a dragged item is dropped FROM another card */
  onReceiveTodo:(fromKey: PersonKey, todoId: string) => void;
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
        "rounded-2xl bg-white border shadow-sm p-3 md:p-4",
        "flex flex-col min-h-[96px] md:min-h-[110px]",
        "transition-all duration-200",
        isActive   ? "border-blue-300/70 shadow-blue-100/60" : "border-gray-200",
        isDragOver ? "border-blue-400 bg-blue-50/30 scale-[1.01] shadow-blue-100" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="flex items-center gap-1.5">
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
          <span className={cn(
            "text-[14px] md:text-[15px] tracking-tight",
            isActive ? "font-bold text-gray-900" : "font-semibold text-gray-900"
          )}>
            {personName}
          </span>
        </span>
        {/* Crayon = ajouter */}
        <button
          onClick={openAdd}
          aria-label="Ajouter un rappel"
          className="flex items-center justify-center -mr-1.5 -mt-1 h-[44px] w-[44px] rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Liste des todos ── */}
      <div className="flex flex-col gap-1.5">
        {todos.length === 0 && !isAdding && (
          <p className="text-[13px] italic text-gray-300 pl-[22px]">Aucun rappel…</p>
        )}

        {todos.map((todo) => (
          <SwipeableTodoRow
            key={todo.id}
            isEditing={editingId === todo.id}
            onDismiss={() => onUpdate(todos.filter(t => t.id !== todo.id))}
          >
            <div
              className={cn(
                "flex items-center gap-2 w-full rounded-md -mx-1 px-1 py-[3px]",
                "transition-colors",
                editingId !== todo.id && "cursor-grab active:cursor-grabbing hover:bg-gray-50",
              )}
              draggable={editingId !== todo.id}
              onDragStart={(e) => handleDragStart(e, todo)}
            >
            {/* Cercle toggle ✓ */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
              className={cn(
                "shrink-0 h-[14px] w-[14px] rounded-full border transition-all duration-200",
                todo.done
                  ? "bg-gray-300 border-gray-300"
                  : "border-gray-300 hover:border-gray-500"
              )}
            />

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
                className="flex-1 text-[14px] text-gray-700 bg-transparent outline-none border-b border-blue-400 pb-px"
              />
            ) : (
              <span
                onClick={() => handleItemClick(todo)}
                className={cn(
                  "flex-1 text-[14px] leading-snug select-none",
                  todo.done ? "line-through text-gray-300" : "text-gray-700"
                )}
                title="Clic → éditer · Double-clic → supprimer · Glisser → déplacer"
              >
                {todo.text}
              </span>
            )}
            </div>
          </SwipeableTodoRow>
        ))}

        {/* Input ajout rapide */}
        {isAdding && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="shrink-0 h-[14px] w-[14px] rounded-full border border-gray-200" />
            <input
              ref={addInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); commitDraft(); }
                if (e.key === "Escape") { setIsAdding(false); setDraft(""); }
              }}
              onBlur={() => { commitDraft(); setIsAdding(false); }}
              placeholder="Nouveau rappel…"
              className="flex-1 text-[14px] text-gray-700 placeholder:text-gray-300 bg-transparent outline-none"
            />
          </div>
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

  const saveTimers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mountedRef  = useRef(true);

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {PEOPLE.map((p) => (
        <ReminderCard
          key={p.key}
          personKey={p.key}
          personName={p.name}
          todos={todosMap[p.key] ?? []}
          isActive={p.key === activeUser}
          onUpdate={(next) => handleUpdate(p.key, next)}
          onReceiveTodo={(fromKey, todoId) => handleReceiveTodo(fromKey, p.key, todoId)}
        />
      ))}
    </div>
  );
}
