"use client";

/**
 * TshirtOrderCard — "Carte Totale"
 *
 * Compact kanban card (flex-row: info left / QR right).
 * Click anywhere on the card → OrderDetailModal (front + back visuals).
 * Todo section and footer stop propagation so they don't trigger the modal.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Plus, X, Upload, AlertCircle } from "lucide-react";
import { format } from "date-fns";
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
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* quota */ }
    },
    [key]
  );

  const addTodo    = useCallback((text: string) => {
    if (!text.trim()) return;
    save([...todos, { id: crypto.randomUUID(), text: text.trim(), done: false }]);
  }, [todos, save]);

  const toggleTodo = useCallback(
    (id: string) => save(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    [todos, save]
  );

  const deleteTodo = useCallback(
    (id: string) => save(todos.filter((t) => t.id !== id)),
    [todos, save]
  );

  return { todos, addTodo, toggleTodo, deleteTodo };
}

// ── Local image upload (persisted in localStorage) ─────────────────────────────

function useLocalImages(orderId: string) {
  const key = `olda-images-${orderId}`;

  const [localImages, setLocalImages] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });

  const addImage = useCallback((dataUrl: string) => {
    setLocalImages((prev) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [key]);

  return { localImages, addImage };
}

// ── QR code origin (client-only) ───────────────────────────────────────────────

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}

// ── Order detail modal ──────────────────────────────────────────────────────────

function OrderDetailModal({
  order,
  images,
  addImage,
  onClose,
}: {
  order: Order;
  images: string[];
  addImage: (url: string) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const createdAt = order.createdAt instanceof Date
    ? order.createdAt
    : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });

  // DTF arrière: first item whose name/SKU mentions "arrière/back/dtf"
  const dtfItem  = items.find((i) =>
    /arrière|arriere|back|dtf/i.test(i.name ?? "") ||
    /arrière|arriere|back|dtf/i.test(i.sku ?? "")
  );
  const dtfLabel = dtfItem?.sku || dtfItem?.name || items[0]?.sku || null;
  const limitText = order.notes?.trim() || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { addImage(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const infoRows: { label: string; value: string }[] = [
    { label: "Date",         value: formattedDate },
    { label: "Référence",    value: `#${order.orderNumber}` },
    { label: "Client",       value: order.customerName },
    { label: "Téléphone",    value: order.customerPhone ?? "—" },
    { label: "DTF arrière",  value: dtfLabel ?? "—" },
    { label: "Articles",     value: `${totalQty}` },
    { label: "Total",        value: Number(order.total).toLocaleString("fr-FR", {
        style: "currency", currency, maximumFractionDigits: 0,
      }),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ── */}
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1C1C1E] flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.08]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Bon de Commande · {formattedDate}
            </p>
            <h2 className="text-[19px] font-bold text-gray-900 dark:text-white mt-0.5">
              #{order.orderNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 rounded-full h-7 w-7 flex items-center justify-center bg-gray-100 dark:bg-white/[0.1] hover:bg-gray-200 dark:hover:bg-white/[0.15] transition-colors"
          >
            <X className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* ── Visuals ── */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-black/[0.15]">
          {images.length > 0 ? (
            <div className="flex gap-3">
              {images.map((url, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {idx === 0 ? "Avant" : "Arrière"}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={idx === 0 ? "Visual avant" : "Visual arrière"}
                    className="w-full object-contain rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white"
                    style={{ maxHeight: 220 }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.15] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-[13px] text-gray-400">Ajouter des visuels</span>
            </label>
          )}
        </div>

        {/* ── Info rows ── */}
        <div className="px-5 py-4 space-y-3">
          {infoRows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-gray-400 shrink-0">{label}</span>
              <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 text-right">{value}</span>
            </div>
          ))}

          {/* Priority / Limit */}
          {limitText && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 mt-1">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">{limitText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

  const serverImages = items.filter((i) => i.imageUrl).map((i) => i.imageUrl as string).slice(0, 2);
  const { localImages, addImage } = useLocalImages(order.id);
  const displayImages = serverImages.length > 0 ? serverImages : localImages;

  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(order.id);
  const [newText, setNewText]     = useState("");
  const [todoOpen, setTodoOpen]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const pendingCount = todos.filter((t) => !t.done).length;

  const createdAt = order.createdAt instanceof Date
    ? order.createdAt
    : new Date(order.createdAt as string);

  const formattedDate = format(createdAt, "d MMM yyyy", { locale: fr });

  // Extract DTF arrière size
  const dtfItem  = items.find((i) =>
    /arrière|arriere|back|dtf/i.test(i.name ?? "") ||
    /arrière|arriere|back|dtf/i.test(i.sku ?? "")
  );
  const dtfLabel  = dtfItem?.sku || dtfItem?.name || items[0]?.sku || null;
  const limitText = order.notes?.trim() || null;

  const qrValue = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;

  const handleAddTodo = () => { addTodo(newText); setNewText(""); };
  const handleTodoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddTodo(); }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border bg-white dark:bg-[#1C1C1E] overflow-hidden",
          "transition-all duration-200 cursor-pointer",
          "hover:shadow-md hover:shadow-black/[0.07] hover:border-border",
          isNew
            ? "border-blue-400/60 ring-2 ring-blue-400/30 animate-fade-up"
            : "border-border/50"
        )}
        onClick={() => setModalOpen(true)}
      >
        {/* ── Info + QR row ─────────────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-3 flex gap-3 items-start">

          {/* Left: 6-line info stack */}
          <div className="flex-1 flex flex-col gap-[5px] min-w-0">

            {/* L1 — Date · Bon de Commande */}
            <p className="text-[11px] text-gray-400 truncate">
              {formattedDate}
              <span className="font-medium"> · Bon de Commande</span>
            </p>

            {/* L2 — Référence */}
            <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate leading-tight">
              #{order.orderNumber}
            </p>

            {/* L3 — Client name */}
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-200 truncate">
              {order.customerName}
            </p>

            {/* L4 — Phone */}
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {order.customerPhone ?? "—"}
            </p>

            {/* L5 — Limit (priority highlight) */}
            <p className={cn(
              "text-[12px] font-medium flex items-center gap-1 truncate",
              limitText ? "text-red-500 dark:text-red-400" : "text-gray-300 dark:text-gray-600"
            )}>
              {limitText && <AlertCircle className="h-3 w-3 shrink-0" />}
              {limitText ?? "—"}
            </p>

            {/* L6 — DTF arrière size */}
            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
              DTF arr. : {dtfLabel ?? "—"}
            </p>
          </div>

          {/* Right: QR code */}
          {origin && (
            <div className="shrink-0 h-[84px] w-[84px] rounded-xl bg-white border border-gray-100 dark:border-white/[0.1] flex items-center justify-center p-[5px]">
              <QRCodeSVG
                value={qrValue}
                size={72}
                bgColor="#ffffff"
                fgColor="#1d1d1f"
                level="M"
              />
            </div>
          )}
        </div>

        {/* ── Tâches ────────────────────────────────────────────────────── */}
        <div
          className="border-t border-gray-100 dark:border-white/[0.06] px-3 pt-2 pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setTodoOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-1 group"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
              Tâches
            </span>
            <span className="flex items-center gap-1.5">
              {todos.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  pendingCount > 0
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                )}>
                  {pendingCount}/{todos.length}
                </span>
              )}
              <span className="text-[10px] text-gray-300 dark:text-gray-600">
                {todoOpen ? "▴" : "▾"}
              </span>
            </span>
          </button>

          {todoOpen && (
            <div className="space-y-0.5">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group/item flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
                      todo.done
                        ? "border-amber-500 bg-amber-500"
                        : "border-gray-300 hover:border-amber-400"
                    )}
                  >
                    {todo.done && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                  </button>
                  <span className={cn(
                    "flex-1 text-[12px] leading-relaxed select-text",
                    todo.done ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-700 dark:text-gray-200"
                  )}>
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 text-gray-400" />
                  </button>
                </div>
              ))}

              {/* Add row */}
              <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] transition-colors">
                <button
                  onClick={handleAddTodo}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <Plus className="h-2 w-2 text-gray-400" />
                </button>
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={handleTodoKey}
                  placeholder="Ajouter une tâche…"
                  className="flex-1 bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between border-t border-gray-100 dark:border-white/[0.06] px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] text-gray-400">{totalQty} art.</span>
          <span className="text-[12px] font-semibold tabular-nums text-gray-800 dark:text-gray-200">
            {Number(order.total).toLocaleString("fr-FR", {
              style: "currency",
              currency,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {modalOpen && (
        <OrderDetailModal
          order={order}
          images={displayImages}
          addImage={addImage}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
