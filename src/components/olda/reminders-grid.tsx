"use client";

/**
 * RemindersGrid — Apple Reminders style, 4 inline cards (one per person).
 * • Circle on the left → click toggles done state
 * • Click anywhere on a row → reveals X delete button (click again to hide)
 * • Pencil icon top-right → reveals an invisible input to add a new reminder
 * • Auto-saves to PATCH /api/notes/[person] with 600 ms debounce
 */

import { useState, useRef, useCallback } from "react";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "./person-note-modal";

// ── Constants ──────────────────────────────────────────────────────────────────

const PEOPLE = [
  { key: "loic",     name: "Loïc" },
  { key: "charlie",  name: "Charlie" },
  { key: "melina",   name: "Mélina" },
  { key: "amandine", name: "Amandine" },
] as const;

function newId(): string {
  return `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Single card ────────────────────────────────────────────────────────────────

function ReminderCard({
  personKey,
  personName,
  initialTodos,
}: {
  personKey: string;
  personName: string;
  initialTodos: TodoItem[];
}) {
  const [todos, setTodos]         = useState<TodoItem[]>(initialTodos);
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const saveTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced persist — fires 600 ms after last change
  const persist = useCallback(
    (next: TodoItem[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/notes/${personKey}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todos: next }),
        }).catch(() => {});
      }, 600);
    },
    [personKey]
  );

  const toggle = useCallback(
    (id: string) => {
      setTodos((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => {
      setTodos((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persist(next);
        return next;
      });
      setSelectedId(null);
    },
    [persist]
  );

  const commitDraft = useCallback(() => {
    const text = draft.trim();
    if (!text) { setEditing(false); setDraft(""); return; }
    setTodos((prev) => {
      const next = [...prev, { id: newId(), text, done: false }];
      persist(next);
      return next;
    });
    setDraft("");
    // Keep input open for rapid multi-entry
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [draft, persist]);

  const openEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div
      style={{ border: "0.5px solid #d1d5db" }}
      className="rounded-2xl bg-white dark:bg-[#1C1C1E] dark:border-white/[0.08] p-4 flex flex-col min-h-[110px]"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
          {personName}
        </span>
        <button
          onClick={openEdit}
          aria-label="Ajouter un rappel"
          className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <Pencil size={12} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Todo list ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {todos.length === 0 && !editing && (
          <p className="text-[12px] italic text-gray-300 dark:text-gray-600 pl-[22px]">
            Aucun rappel…
          </p>
        )}

        {todos.map((todo) => (
          <div
            key={todo.id}
            onClick={() => setSelectedId((prev) => (prev === todo.id ? null : todo.id))}
            className="group flex items-center gap-2 w-full cursor-pointer rounded-md -mx-1 px-1 py-[3px] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            {/* Circle — stops propagation so it only toggles done */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
              className={cn(
                "shrink-0 h-[14px] w-[14px] rounded-full border transition-all duration-200",
                todo.done
                  ? "bg-gray-200 border-gray-200 dark:bg-gray-600 dark:border-gray-600"
                  : "border-gray-300 dark:border-gray-500 hover:border-gray-500 dark:hover:border-gray-300"
              )}
            />
            {/* Text */}
            <span
              className={cn(
                "flex-1 text-[13px] leading-snug transition-all duration-200",
                todo.done
                  ? "line-through text-gray-300 dark:text-gray-600"
                  : "text-gray-700 dark:text-gray-200"
              )}
            >
              {todo.text}
            </span>
            {/* Delete button — visible when row is selected */}
            {selectedId === todo.id && (
              <button
                onClick={(e) => { e.stopPropagation(); remove(todo.id); }}
                aria-label="Supprimer"
                className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}

        {/* ── Inline input (hidden until pencil click) ────────────────────── */}
        {editing && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="shrink-0 h-[14px] w-[14px] rounded-full border border-gray-200 dark:border-gray-600" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commitDraft();
                if (e.key === "Escape") { setEditing(false); setDraft(""); }
              }}
              onBlur={() => { commitDraft(); setEditing(false); }}
              placeholder="Nouveau rappel…"
              className="flex-1 text-[13px] text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-transparent outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grid export ────────────────────────────────────────────────────────────────

export function RemindersGrid({ notesMap }: { notesMap: Record<string, TodoItem[]> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {PEOPLE.map((p) => (
        <ReminderCard
          key={p.key}
          personKey={p.key}
          personName={p.name}
          initialTodos={notesMap[p.key] ?? []}
        />
      ))}
    </div>
  );
}
