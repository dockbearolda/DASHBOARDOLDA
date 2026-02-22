"use client";

/**
 * RemindersGrid — Apple Reminders style, 4 inline cards (one per person).
 * • Circle on the left → click strikes through + greys the item (optimistic)
 * • Pencil icon top-right → reveals an invisible input to add a new reminder
 * • Auto-saves to PATCH /api/notes/[person] with 600 ms debounce
 */

import { useState, useRef, useCallback } from "react";
import { Pencil } from "lucide-react";
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
  const [todos, setTodos]     = useState<TodoItem[]>(initialTodos);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);
  const saveTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <span className="text-[13px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
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
          <p className="text-[11px] italic text-gray-300 dark:text-gray-600 pl-[22px]">
            Aucun rappel…
          </p>
        )}

        {todos.map((todo) => (
          <button
            key={todo.id}
            onClick={() => toggle(todo.id)}
            className="group flex items-start gap-2 text-left w-full"
          >
            {/* Circle */}
            <span
              className={cn(
                "mt-[2px] shrink-0 h-[13px] w-[13px] rounded-full border transition-all duration-200",
                todo.done
                  ? "bg-gray-200 border-gray-200 dark:bg-gray-600 dark:border-gray-600"
                  : "border-gray-300 dark:border-gray-500 group-hover:border-gray-500 dark:group-hover:border-gray-300"
              )}
            />
            {/* Text */}
            <span
              className={cn(
                "text-[12px] leading-snug transition-all duration-200",
                todo.done
                  ? "line-through text-gray-300 dark:text-gray-600"
                  : "text-gray-700 dark:text-gray-200"
              )}
            >
              {todo.text}
            </span>
          </button>
        ))}

        {/* ── Inline input (hidden until pencil click) ────────────────────── */}
        {editing && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="mt-[2px] shrink-0 h-[13px] w-[13px] rounded-full border border-gray-200 dark:border-gray-600" />
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
              className="flex-1 text-[12px] text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-transparent outline-none"
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
