"use client";

/**
 * RemindersGrid — Apple Reminders style, 4 inline cards (one per person).
 * Light mode only — zero dark: variants.
 */

import { useState, useRef, useCallback } from "react";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "./person-note-modal";

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
  const [todos, setTodos]           = useState<TodoItem[]>(initialTodos);
  const [editing, setEditing]       = useState(false);
  const [draft, setDraft]           = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const saveTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: TodoItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/notes/${personKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos: next }),
      }).catch(() => {});
    }, 600);
  }, [personKey]);

  const toggle = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      persist(next);
      return next;
    });
  }, [persist]);

  const remove = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
    setSelectedId(null);
  }, [persist]);

  const commitDraft = useCallback(() => {
    const text = draft.trim();
    if (!text) { setEditing(false); setDraft(""); return; }
    setTodos((prev) => {
      const next = [...prev, { id: newId(), text, done: false }];
      persist(next);
      return next;
    });
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [draft, persist]);

  const openEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-3 md:p-4 flex flex-col min-h-[96px] md:min-h-[110px]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-[14px] md:text-[15px] font-semibold tracking-tight text-gray-900">
          {personName}
        </span>
        {/* 44×44 pt touch target (Apple HIG) — negative margin keeps visual size tight */}
        <button
          onClick={openEdit}
          aria-label="Ajouter un rappel"
          className="flex items-center justify-center -mr-1.5 -mt-1 h-[44px] w-[44px] rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Todo list ── */}
      <div className="flex flex-col gap-1.5">
        {todos.length === 0 && !editing && (
          <p className="text-[13px] italic text-gray-300 pl-[22px]">
            Aucun rappel…
          </p>
        )}

        {todos.map((todo) => (
          <div
            key={todo.id}
            onClick={() => setSelectedId((prev) => (prev === todo.id ? null : todo.id))}
            className="flex items-center gap-2 w-full cursor-pointer rounded-md -mx-1 px-1 py-[3px] hover:bg-gray-50 transition-colors"
          >
            {/* Circle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
              className={cn(
                "shrink-0 h-[14px] w-[14px] rounded-full border transition-all duration-200",
                todo.done
                  ? "bg-gray-300 border-gray-300"
                  : "border-gray-300 hover:border-gray-500"
              )}
            />
            {/* Text */}
            <span className={cn(
              "flex-1 text-[14px] leading-snug transition-all duration-200",
              todo.done ? "line-through text-gray-300" : "text-gray-700"
            )}>
              {todo.text}
            </span>
            {/* Delete on click */}
            {selectedId === todo.id && (
              <button
                onClick={(e) => { e.stopPropagation(); remove(todo.id); }}
                aria-label="Supprimer"
                className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}

        {/* Inline add input */}
        {editing && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="shrink-0 h-[14px] w-[14px] rounded-full border border-gray-200" />
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
              className="flex-1 text-[14px] text-gray-700 placeholder:text-gray-300 bg-transparent outline-none"
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
    /*
     * Mobile  (<md): horizontal snap-scroll row — each card is ≈72vw so the
     *   next card peeks on the right, giving a clear affordance to swipe.
     *   Negative margin + matching padding bleeds the scroll container to the
     *   edge while keeping inner content aligned.
     * md+: switch to CSS grid (2-col then 4-col at lg).
     */
    <div className={cn(
      // ── shared ──
      "gap-3",
      // ── mobile: flex snap-scroll row ──
      "flex overflow-x-auto no-scrollbar snap-x snap-mandatory",
      "-mx-4 px-4 sm:-mx-6 sm:px-6 pb-1",
      // ── md+: CSS grid ──
      "md:grid md:grid-cols-2 md:overflow-visible md:snap-none",
      "md:mx-0 md:px-0 md:pb-0",
      // ── lg+: 4 columns ──
      "lg:grid-cols-4",
    )}>
      {PEOPLE.map((p) => (
        // Wrapper gives each card the correct width per breakpoint
        <div
          key={p.key}
          className="snap-start shrink-0 w-[74vw] sm:w-[58vw] md:w-auto"
        >
          <ReminderCard
            personKey={p.key}
            personName={p.name}
            initialTodos={notesMap[p.key] ?? []}
          />
        </div>
      ))}
    </div>
  );
}
