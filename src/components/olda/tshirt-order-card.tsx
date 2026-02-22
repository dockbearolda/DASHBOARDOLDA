"use client";

/**
 * TshirtOrderCard — "Carte Totale"
 *
 * Used exclusively in the T-shirt › Commande à traiter column.
 * Features:
 *  • QR code linking to the order detail page
 *  • Front / Back t-shirt visuals (object-contain — never deformed)
 *  • Interactive per-order to-do list (saved in localStorage)
 *  • Apple-style minimal spacing
 */

import { useState, useCallback, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Plus, X, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order } from "@/types/order";

// ── Per-card todo ──────────────────────────────────────────────────────────────

interface CardTodo {
  id: string;
  text: string;
  done: boolean;
}

function useTodos(orderId: string) {
  const key = `olda-todos-${orderId}`;

  const [todos, setTodos] = useState<CardTodo[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as CardTodo[]) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback(
    (updated: CardTodo[]) => {
      setTodos(updated);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        /* quota exceeded — ignore */
      }
    },
    [key]
  );

  const addTodo = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      save([
        ...todos,
        { id: crypto.randomUUID(), text: text.trim(), done: false },
      ]);
    },
    [todos, save]
  );

  const toggleTodo = useCallback(
    (id: string) =>
      save(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    [todos, save]
  );

  const deleteTodo = useCallback(
    (id: string) => save(todos.filter((t) => t.id !== id)),
    [todos, save]
  );

  return { todos, addTodo, toggleTodo, deleteTodo };
}

// ── QR code origin (client-only) ───────────────────────────────────────────────

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TshirtOrderCard({
  order,
  isNew,
}: {
  order: Order;
  isNew?: boolean;
}) {
  const items    = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const currency = (order.currency as string) ?? "EUR";
  const origin   = useOrigin();

  // Up to 2 product images (front = index 0, back = index 1)
  const images = items
    .filter((i) => i.imageUrl)
    .map((i) => i.imageUrl as string)
    .slice(0, 2);

  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(order.id);
  const [newText, setNewText]     = useState("");
  const [todoOpen, setTodoOpen]   = useState(false);

  const pendingCount = todos.filter((t) => !t.done).length;

  const createdAt =
    order.createdAt instanceof Date
      ? order.createdAt
      : new Date(order.createdAt as string);

  const timeAgo = formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: fr,
  });

  const handleAddTodo = () => {
    addTodo(newText);
    setNewText("");
  };

  const handleTodoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTodo();
    }
  };

  const qrValue = origin
    ? `${origin}/dashboard/orders/${order.id}`
    : order.orderNumber;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        "transition-all duration-300 cursor-default",
        "hover:border-border hover:shadow-md hover:shadow-black/[0.06] dark:hover:shadow-black/20",
        isNew
          ? "border-blue-400/60 ring-2 ring-blue-400/30 animate-fade-up"
          : "border-border/50"
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate">
              #{order.orderNumber}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {order.customerName}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-[9px] text-muted-foreground/50">
            <Clock className="h-2.5 w-2.5" />
            <span className="whitespace-nowrap">{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* ── Visuels: QR + Avant/Arrière ────────────────────────────────── */}
      <div className="px-3 pb-2.5 flex gap-2 items-stretch">
        {/* QR code */}
        {origin && (
          <div className="shrink-0 h-[68px] w-[68px] rounded-xl overflow-hidden bg-white dark:bg-white border border-border/20 flex items-center justify-center p-1.5">
            <QRCodeSVG
              value={qrValue}
              size={56}
              bgColor="#ffffff"
              fgColor="#1d1d1f"
              level="M"
            />
          </div>
        )}

        {/* T-shirt visuals */}
        {images.length > 0 ? (
          <div className="flex-1 flex gap-1.5">
            {images.map((url, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-xl overflow-hidden bg-muted/30 border border-border/20 flex flex-col items-center"
              >
                <span className="text-[8px] font-semibold text-muted-foreground/50 pt-1 uppercase tracking-wider leading-none">
                  {idx === 0 ? "Avant" : "Arrière"}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={idx === 0 ? "Visual avant" : "Visual arrière"}
                  className="flex-1 w-full object-contain"
                  style={{ maxHeight: 52 }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : (
          /* No images yet — empty slot */
          <div className="flex-1 h-[68px] rounded-xl border border-dashed border-border/30 bg-muted/10 flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground/30">
              Visuels à venir
            </span>
          </div>
        )}
      </div>

      {/* ── To-Do list ──────────────────────────────────────────────────── */}
      <div className="border-t border-border/30 px-3 pt-2 pb-2">
        {/* Section header — click to expand/collapse */}
        <button
          onClick={() => setTodoOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-1 group"
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors">
            Tâches
          </span>
          <span className="flex items-center gap-1.5">
            {todos.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                  pendingCount > 0
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                )}
              >
                {pendingCount}/{todos.length}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/30">
              {todoOpen ? "▴" : "▾"}
            </span>
          </span>
        </button>

        {todoOpen && (
          <div className="space-y-0.5">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="group/item flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-muted/30 transition-colors"
              >
                {/* Circle checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
                    todo.done
                      ? "border-amber-500 bg-amber-500"
                      : "border-border/60 hover:border-amber-400"
                  )}
                >
                  {todo.done && (
                    <Check className="h-2 w-2 text-white" strokeWidth={3.5} />
                  )}
                </button>

                {/* Text */}
                <span
                  className={cn(
                    "flex-1 text-[11px] leading-relaxed select-text",
                    todo.done
                      ? "line-through text-muted-foreground/40"
                      : "text-foreground/80"
                  )}
                >
                  {todo.text}
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5 text-muted-foreground/40" />
                </button>
              </div>
            ))}

            {/* Add row */}
            <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-muted/30 transition-colors">
              <button
                onClick={handleAddTodo}
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-border/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <Plus className="h-2 w-2 text-muted-foreground/50" />
              </button>
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={handleTodoKey}
                placeholder="Ajouter une tâche…"
                className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: qty + total ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border/20 px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground/60">
          {totalQty} art.
        </span>
        <span className="text-[11px] font-semibold tabular-nums">
          {Number(order.total).toLocaleString("fr-FR", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          })}
        </span>
      </div>
    </div>
  );
}
