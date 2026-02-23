"use client";

/**
 * TshirtOrderCard
 * ─ Kanban card: flex-row (info stack left / QR right)
 * ─ Click anywhere → OrderDetailModal (visuals + all items + summary)
 * ─ Light mode only — zero dark: variants
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Plus, X, Upload, AlertCircle, Package } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem } from "@/types/order";

// ── Per-card todo ──────────────────────────────────────────────────────────────

interface CardTodo { id: string; text: string; done: boolean; }

function useTodos(orderId: string) {
  const key = `olda-todos-${orderId}`;
  const [todos, setTodos] = useState<CardTodo[]>(() => {
    if (typeof window === "undefined") return [];
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as CardTodo[]) : []; }
    catch { return []; }
  });
  const save = useCallback((u: CardTodo[]) => {
    setTodos(u);
    try { localStorage.setItem(key, JSON.stringify(u)); } catch { /* quota */ }
  }, [key]);
  const addTodo    = useCallback((t: string) => { if (t.trim()) save([...todos, { id: crypto.randomUUID(), text: t.trim(), done: false }]); }, [todos, save]);
  const toggleTodo = useCallback((id: string) => save(todos.map((t) => t.id === id ? { ...t, done: !t.done } : t)), [todos, save]);
  const deleteTodo = useCallback((id: string) => save(todos.filter((t) => t.id !== id)), [todos, save]);
  return { todos, addTodo, toggleTodo, deleteTodo };
}

// ── Local images ───────────────────────────────────────────────────────────────

function useLocalImages(orderId: string) {
  const key = `olda-images-${orderId}`;
  const [imgs, setImgs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as string[]) : []; }
    catch { return []; }
  });
  const addImage = useCallback((dataUrl: string) => {
    setImgs((prev) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [key]);
  return { localImages: imgs, addImage };
}

// ── QR origin (client-only) ────────────────────────────────────────────────────

function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => { setO(window.location.origin); }, []);
  return o;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

// ── Order detail modal ──────────────────────────────────────────────────────────

function OrderDetailModal({
  order, images, addImage, onClose,
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

  const createdAt     = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });

  const dtfItem   = items.find((i) => /arrière|arriere|back|dtf/i.test(i.name ?? "") || /arrière|arriere|back|dtf/i.test(i.sku ?? ""));
  const dtfLabel  = dtfItem?.sku || dtfItem?.name || items[0]?.sku || null;
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
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-black/[0.12] border border-gray-200 overflow-hidden max-h-[92svh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">
              Bon de Commande · {formattedDate}
            </p>
            <h2 className="text-[22px] font-bold text-gray-900 mt-0.5 leading-tight">
              #{order.orderNumber}
            </h2>
            <p className="text-[13px] text-gray-500 mt-0.5">{order.customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 rounded-full h-7 w-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>

        {/* ── Visuals: Avant / Arrière ── */}
        <div className="px-5 pt-4 pb-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Visuels
          </p>
          {images.length > 0 ? (
            <div className="flex gap-3">
              {images.map((url, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {idx === 0 ? "Avant" : "Arrière"}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={idx === 0 ? "Visual avant" : "Visual arrière"}
                    className="w-full object-contain rounded-2xl border border-gray-200 bg-white shadow-sm"
                    style={{ maxHeight: 210 }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl border border-dashed border-gray-300 cursor-pointer hover:bg-white transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-[13px] text-gray-400">Ajouter Avant + Arrière</span>
            </label>
          )}
        </div>

        {/* ── Priority alert ── */}
        {limitText && (
          <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-[13px] font-semibold text-red-600">{limitText}</span>
          </div>
        )}

        {/* ── Summary info ── */}
        <div className="px-5 pt-4 pb-2 space-y-2.5">
          {([
            ["Référence",   `#${order.orderNumber}`],
            ["Client",      order.customerName],
            ["Téléphone",   order.customerPhone ?? "—"],
            ["DTF Arrière", dtfLabel ?? "—"],
            ["Date",        formattedDate],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-gray-400 shrink-0">{label}</span>
              <span className="text-[13px] font-medium text-gray-800 text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* ── All items ── */}
        {items.length > 0 && (
          <div className="px-5 pt-3 pb-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Package className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Articles · {totalQty} pcs
              </p>
            </div>
            <div className="space-y-2">
              {items.map((item: OrderItem) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                >
                  {/* Thumbnail */}
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-gray-200 bg-white shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                      {item.name}
                    </p>
                    {item.sku && (
                      <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">
                        {item.sku}
                      </p>
                    )}
                  </div>
                  {/* Qty + price */}
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600 leading-none">
                      ×{item.quantity}
                    </span>
                    <span className="text-[12px] font-semibold tabular-nums text-gray-700">
                      {fmtPrice(item.price * item.quantity, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Total line */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-[13px] font-semibold text-gray-900">Total</span>
              <span className="text-[15px] font-bold tabular-nums text-gray-900">
                {fmtPrice(order.total, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function TshirtOrderCard({ order, isNew }: { order: Order; isNew?: boolean }) {
  const items    = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const currency = (order.currency as string) ?? "EUR";
  const origin   = useOrigin();

  const serverImages  = items.filter((i) => i.imageUrl).map((i) => i.imageUrl as string).slice(0, 2);
  const { localImages, addImage } = useLocalImages(order.id);
  const displayImages = serverImages.length > 0 ? serverImages : localImages;

  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(order.id);
  const [newText, setNewText]     = useState("");
  const [todoOpen, setTodoOpen]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const pendingCount = todos.filter((t) => !t.done).length;

  const createdAt     = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMM yyyy", { locale: fr });

  const dtfItem  = items.find((i) => /arrière|arriere|back|dtf/i.test(i.name ?? "") || /arrière|arriere|back|dtf/i.test(i.sku ?? ""));
  const dtfLabel  = dtfItem?.sku || dtfItem?.name || items[0]?.sku || null;
  const limitText = order.notes?.trim() || null;
  const qrValue   = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;

  const handleAddTodo = () => { addTodo(newText); setNewText(""); };
  const handleTodoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddTodo(); }
  };

  return (
    <>
      {/* ── Card shell ── */}
      <div
        className={cn(
          "rounded-2xl bg-white border overflow-hidden",
          "transition-all duration-200 cursor-pointer select-none",
          "hover:shadow-md hover:shadow-black/[0.07] hover:border-gray-300",
          isNew
            ? "border-blue-400/60 ring-2 ring-blue-400/30 animate-fade-up"
            : "border-gray-200"
        )}
        onClick={() => setModalOpen(true)}
      >
        {/* ── Info + QR row ── */}
        <div className="px-3 pt-3 pb-2.5 flex gap-3 items-start">

          {/* ─ Left: 6-line stack ─ */}
          <div className="flex-1 flex flex-col gap-[4px] min-w-0">

            {/* L1 — Date — Bon de Commande */}
            <p className="text-[11px] text-gray-400 truncate leading-tight">
              {formattedDate}
              <span className="font-bold text-gray-600"> — Bon de Commande</span>
            </p>

            {/* L2 — Référence */}
            <p className="text-[15px] font-bold text-gray-900 truncate leading-snug">
              <span className="text-gray-400 font-medium text-[12px]">Ref : </span>
              #{order.orderNumber}
            </p>

            {/* L3 — Nom complet */}
            <p className="text-[13px] font-semibold text-gray-800 truncate">
              {order.customerName}
            </p>

            {/* L4 — Téléphone */}
            <p className="text-[12px] text-gray-500 truncate">
              <span className="font-medium text-gray-400">Tel : </span>
              {order.customerPhone ?? "—"}
            </p>

            {/* L5 — Limit / urgence */}
            <p className={cn(
              "text-[12px] font-medium flex items-center gap-1 truncate",
              limitText ? "text-red-500" : "text-gray-300"
            )}>
              <span className={cn("font-medium", limitText ? "text-red-400" : "text-gray-300")}>
                Limit :
              </span>
              {limitText
                ? <><AlertCircle className="h-2.5 w-2.5 shrink-0" />{limitText}</>
                : "—"}
            </p>

            {/* L6 — DTF Arrière */}
            <p className="text-[11px] text-gray-400 truncate">
              <span className="font-medium">DTF Arrière : </span>
              {dtfLabel ?? "—"}
            </p>
          </div>

          {/* ─ Right: QR code ─
               On very narrow screens (<sm) the container shrinks to 68×68 px so
               the 6-line text stack never gets crushed. sm+ restores full 88×88. */}
          {origin && (
            <div className="shrink-0 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center h-[68px] w-[68px] p-[4px] sm:h-[88px] sm:w-[88px] sm:p-[6px]">
              {/* Mobile QR — 58 px */}
              <span className="sm:hidden">
                <QRCodeSVG value={qrValue} size={58} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </span>
              {/* sm+ QR — 74 px */}
              <span className="hidden sm:block">
                <QRCodeSVG value={qrValue} size={74} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </span>
            </div>
          )}
        </div>

        {/* ── Tâches (stops card click) ── */}
        <div
          className="border-t border-gray-100 px-3 pt-2 pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* min-h-[44px] = Apple HIG touch target */}
          <button
            onClick={() => setTodoOpen((v) => !v)}
            className="w-full min-h-[44px] flex items-center justify-between group"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
              Tâches
            </span>
            <span className="flex items-center gap-1.5">
              {todos.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {pendingCount}/{todos.length}
                </span>
              )}
              <span className="text-[10px] text-gray-300">{todoOpen ? "▴" : "▾"}</span>
            </span>
          </button>

          {todoOpen && (
            <div className="space-y-0.5">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group/item flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-50 transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
                      todo.done ? "border-amber-500 bg-amber-500" : "border-gray-300 hover:border-amber-400"
                    )}
                  >
                    {todo.done && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                  </button>
                  <span className={cn(
                    "flex-1 text-[12px] leading-relaxed select-text",
                    todo.done ? "line-through text-gray-300" : "text-gray-700"
                  )}>
                    {todo.text}
                  </span>
                  <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <X className="h-2.5 w-2.5 text-gray-400" />
                  </button>
                </div>
              ))}

              {/* Add row */}
              <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-50 transition-colors">
                <button
                  onClick={handleAddTodo}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Plus className="h-2 w-2 text-gray-400" />
                </button>
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={handleTodoKey}
                  placeholder="Ajouter une tâche…"
                  className="flex-1 bg-transparent text-[12px] text-gray-700 placeholder:text-gray-300 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: qty + total — min-h-[44px] for touch ── */}
        <div
          className="flex items-center justify-between border-t border-gray-100 px-3 min-h-[44px]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] text-gray-400">{totalQty} art.</span>
          <span className="text-[13px] font-bold tabular-nums text-gray-900">
            {fmtPrice(order.total, currency)}
          </span>
        </div>
      </div>

      {/* ── Modal ── */}
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
