"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  text: string;
  done: boolean;
}

// ── Serialisation ──────────────────────────────────────────────────────────────

function parseTasks(raw: string | null | undefined): Task[] {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Task[];
  } catch {
    // Legacy plain-text note → convert to a single task item
    const trimmed = raw.trim();
    if (trimmed) return [{ id: crypto.randomUUID(), text: trimmed, done: false }];
  }
  return [];
}

function serialize(tasks: Task[]): string {
  return JSON.stringify(tasks);
}

// ── Component ──────────────────────────────────────────────────────────────────

interface OrderTasksProps {
  orderId: string;
  initialNotes?: string | null;
}

export function OrderTasks({ orderId, initialNotes }: OrderTasksProps) {
  const [tasks, setTasks]   = useState<Task[]>(() => parseTasks(initialNotes));
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep in sync if the parent re-renders with fresh data (e.g. after status save)
  useEffect(() => {
    setTasks(parseTasks(initialNotes));
  }, [initialNotes]);

  // Fire-and-forget PATCH — optimistic UI; errors are silently swallowed
  const persist = useCallback(
    (updated: Task[]) => {
      fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: serialize(updated) }),
      }).catch(() => {});
    },
    [orderId]
  );

  const addTask = () => {
    if (!newText.trim()) return;
    const next: Task[] = [
      ...tasks,
      { id: crypto.randomUUID(), text: newText.trim(), done: false },
    ];
    setTasks(next);
    setNewText("");
    persist(next);
    // Keep focus in the input for rapid entry
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const toggle = (id: string) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(next);
    persist(next);
  };

  const remove = (id: string) => {
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);
    persist(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addTask(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-3 pb-2.5 border-b border-[#e5e5ea] dark:border-border/50">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Instructions & tâches
        </p>
      </div>

      {/* ── Task rows ──────────────────────────────────────────────────────── */}
      {tasks.map((task, i) => (
        <div
          key={task.id}
          className={cn(
            "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
            i > 0 && "border-t border-[#e5e5ea] dark:border-border/40"
          )}
        >
          {/* Circle checkbox */}
          <button
            onClick={() => toggle(task.id)}
            aria-label={task.done ? "Marquer comme non fait" : "Marquer comme fait"}
            className={cn(
              "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2",
              "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
              task.done
                ? "border-blue-500 bg-blue-500"
                : "border-[#c7c7cc] dark:border-border hover:border-blue-400"
            )}
          >
            {task.done && (
              <Check className="h-[11px] w-[11px] text-white" strokeWidth={3.5} />
            )}
          </button>

          {/* Task text */}
          <span
            className={cn(
              "flex-1 text-[14px] leading-snug select-text transition-colors duration-200",
              task.done
                ? "line-through text-[#c7c7cc] dark:text-muted-foreground/35"
                : "text-foreground"
            )}
          >
            {task.text}
          </span>

          {/* Trash — visible on row hover */}
          <button
            onClick={() => remove(task.id)}
            aria-label="Supprimer"
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
              "rounded-lg p-1",
              "text-muted-foreground/40 hover:text-red-500",
              "hover:bg-red-50 dark:hover:bg-red-950/30",
              "focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-400/50"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* ── Add-task input row ──────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          tasks.length > 0 && "border-t border-[#e5e5ea] dark:border-border/40"
        )}
      >
        {/* Dashed circle to hint at the checkbox */}
        <div
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#c7c7cc] dark:border-border"
          aria-hidden
        >
          <Plus className="h-3 w-3 text-[#c7c7cc] dark:text-muted-foreground/40" />
        </div>

        <input
          ref={inputRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ajouter une instruction…"
          className={cn(
            "flex-1 bg-transparent text-[14px]",
            "text-foreground placeholder:text-[#c7c7cc] dark:placeholder:text-muted-foreground/30",
            "focus:outline-none"
          )}
        />
      </div>
    </div>
  );
}
