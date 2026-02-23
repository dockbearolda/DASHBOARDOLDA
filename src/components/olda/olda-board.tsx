"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { Order, OrderStatus } from "@/types/order";
import { Inbox, Pencil, Layers, Phone, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteData, TodoItem } from "./person-note-modal";
import { RemindersGrid } from "./reminders-grid";
import { TshirtOrderCard } from "./tshirt-order-card";

// ── Product type detection ─────────────────────────────────────────────────────

type ProductType = "tshirt" | "mug" | "other";

function detectProductType(order: Order): ProductType {
  // 1. Explicit category field (sent by oldastudio — most reliable)
  const cat = (order.category ?? "").toLowerCase().replace(/[-_\s]/g, "");
  if (cat === "tshirt")  return "tshirt";
  if (cat === "mug")     return "mug";

  // 2. Fallback: scan item names (for orders without category field)
  const items = Array.isArray(order.items) ? order.items : [];
  const names = items.map((i) => (i.name ?? "").toLowerCase()).join(" ");
  if (/t[-\s_]?shirt|tee\b/.test(names)) return "tshirt";
  if (/mug|tasse/.test(names))            return "mug";

  return "other";
}

// ── Kanban column definitions ──────────────────────────────────────────────────

type KanbanCol = {
  status: OrderStatus;
  label: string;
  dot: string;
};

const TSHIRT_COLUMNS: KanbanCol[] = [
  { status: "COMMANDE_A_TRAITER",    label: "Commande à traiter",  dot: "bg-blue-400" },
  { status: "COMMANDE_EN_ATTENTE",   label: "Urgence",             dot: "bg-red-400" },
  { status: "MAQUETTE_A_FAIRE",      label: "Maquette à faire",    dot: "bg-violet-400" },
  { status: "EN_ATTENTE_VALIDATION", label: "En attente client",   dot: "bg-amber-400" },
  { status: "PRT_A_FAIRE",           label: "À produire",          dot: "bg-orange-400" },
  { status: "EN_COURS_IMPRESSION",   label: "Production en cours", dot: "bg-indigo-400" },
  { status: "CLIENT_A_CONTACTER",    label: "Client à contacter",  dot: "bg-pink-400" },
  { status: "ARCHIVES",              label: "Archive / terminé",   dot: "bg-slate-300" },
];

const MUG_COLUMNS: KanbanCol[] = [
  { status: "COMMANDE_A_TRAITER",    label: "Commande à traiter",  dot: "bg-blue-400" },
  { status: "COMMANDE_EN_ATTENTE",   label: "Urgence",             dot: "bg-red-400" },
  { status: "MAQUETTE_A_FAIRE",      label: "Maquette à faire",    dot: "bg-violet-400" },
  { status: "EN_ATTENTE_VALIDATION", label: "En attente client",   dot: "bg-amber-400" },
  { status: "COMMANDE_A_PREPARER",   label: "À produire",          dot: "bg-orange-400" },
  { status: "CLIENT_A_CONTACTER",    label: "Client à contacter",  dot: "bg-pink-400" },
  { status: "ARCHIVES",              label: "Archive / terminé",   dot: "bg-slate-300" },
];

// ── People definitions ─────────────────────────────────────────────────────────

const PEOPLE = [
  {
    key:      "loic",
    name:     "Loïc",
    role:     "Nouvelles commandes",
    icon:     Inbox,
    statuses: ["COMMANDE_A_TRAITER", "COMMANDE_EN_ATTENTE"] as OrderStatus[],
  },
  {
    key:      "charlie",
    name:     "Charlie",
    role:     "Maquettes & design",
    icon:     Pencil,
    statuses: ["MAQUETTE_A_FAIRE"] as OrderStatus[],
  },
  {
    key:      "melina",
    name:     "Mélina",
    role:     "Validation & production",
    icon:     Layers,
    statuses: [
      "EN_ATTENTE_VALIDATION",
      "PRT_A_FAIRE",
      "COMMANDE_A_PREPARER",
      "EN_COURS_IMPRESSION",
      "PRESSAGE_A_FAIRE",
    ] as OrderStatus[],
  },
  {
    key:      "amandine",
    name:     "Amandine",
    role:     "Relation client",
    icon:     Phone,
    statuses: ["CLIENT_A_CONTACTER", "CLIENT_PREVENU"] as OrderStatus[],
  },
];

// ── Standard compact order card (all non-COMMANDE_A_TRAITER columns) ──────────

function OrderCard({ order }: { order: Order }) {
  const items    = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const currency = (order.currency as string) ?? "EUR";

  return (
    <div className="rounded-xl border border-border/50 bg-white dark:bg-[#1C1C1E] p-3 hover:border-border/80 hover:shadow-sm transition-all cursor-default">
      <p className="text-[12px] font-bold text-foreground truncate">
        #{order.orderNumber}
      </p>
      <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
        {order.customerName}
      </p>
      <div className="flex items-center justify-between mt-2 gap-1">
        <span className="text-[11px] text-muted-foreground">{totalQty} art.</span>
        <span className="text-[12px] font-semibold tabular-nums">
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

// ── Kanban column ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  orders,
  richCards,
  newOrderIds,
}: {
  col: KanbanCol;
  orders: Order[];
  richCards?: boolean;
  newOrderIds?: Set<string>;
}) {
  // Rich "Commande à traiter" column is wider to fit QR + images
  const colWidth = richCards ? "w-72" : "w-44";

  return (
    <div className={cn("shrink-0 flex flex-col gap-2", colWidth)}>
      <div className="rounded-xl border border-border/50 bg-white/90 dark:bg-[#1C1C1E]/80 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", col.dot)} />
          <span className="text-[12px] font-semibold text-foreground truncate leading-tight">
            {col.label}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {orders.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/30 h-12 flex items-center justify-center">
            <span className="text-[11px] text-muted-foreground/40">vide</span>
          </div>
        ) : richCards ? (
          orders.map((o) => (
            <TshirtOrderCard
              key={o.id}
              order={o}
              isNew={newOrderIds?.has(o.id)}
            />
          ))
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}

// ── Product board ──────────────────────────────────────────────────────────────

function ProductBoard({
  label,
  columns,
  orders,
  richFirstColumn,
  newOrderIds,
}: {
  label: string;
  columns: KanbanCol[];
  orders: Order[];
  richFirstColumn?: boolean;
  newOrderIds?: Set<string>;
}) {
  const ordersByStatus = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const col of columns) map[col.status] = [];
    for (const order of orders) {
      if (map[order.status] !== undefined) {
        map[order.status].push(order);
      } else {
        map[columns[0].status].push(order);
      }
    }
    return map;
  }, [columns, orders]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
          {orders.length} commande{orders.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col, idx) => (
          <KanbanColumn
            key={col.status}
            col={col}
            orders={ordersByStatus[col.status] ?? []}
            // Activate rich cards only on the very first column (Commande à traiter)
            richCards={richFirstColumn && idx === 0}
            newOrderIds={newOrderIds}
          />
        ))}
      </div>
    </section>
  );
}

// ── Real-time status indicator ─────────────────────────────────────────────────

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          connected
            ? "bg-emerald-500 animate-pulse-dot"
            : "bg-muted-foreground/30"
        )}
      />
      <span className="text-[11px] text-muted-foreground/50">
        {connected ? "En direct" : "Hors ligne"}
      </span>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function OldaBoard({ orders: initialOrders }: { orders: Order[] }) {
  const [orders, setOrders]             = useState<Order[]>(initialOrders);
  const [newOrderIds, setNewOrderIds]   = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState(false);
  const [notes, setNotes]           = useState<Record<string, NoteData>>({});
  const [notesReady, setNotesReady] = useState(false);

  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef    = useRef(true);

  // ── Highlight new order IDs for 6 s ───────────────────────────────────────

  const markNew = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewOrderIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 6_000);
  }, []);

  // ── Full refresh: replaces ALL orders so imageUrl / status are always fresh.
  //    Detects truly new IDs (not in previous state) and highlights them.       ──

  const refreshOrders = useCallback(async () => {
    try {
      const res  = await fetch("/api/orders");
      const data = (await res.json()) as { orders: Order[] };
      const incoming = data.orders ?? [];
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const freshIds    = incoming
          .filter((o) => !existingIds.has(o.id))
          .map((o) => o.id);
        if (freshIds.length > 0) markNew(freshIds);
        return incoming; // full replace — keeps imageUrl / status current
      });
    } catch {
      /* ignore transient network errors */
    }
  }, [markNew]);

  // ── Fallback polling every 5 s (used when SSE is unavailable) ────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      if (mountedRef.current) refreshOrders();
    }, 5_000);
  }, [refreshOrders]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── Initial fetch on mount ─────────────────────────────────────────────────
  // Covers the gap between SSR page render and SSE connection establishment.

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // ── Refresh on tab visibility (user returns after being away) ─────────────

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOrders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshOrders]);

  // ── SSE subscription ───────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        es = new EventSource("/api/orders/stream");

        es.addEventListener("connected", () => {
          if (!mountedRef.current) return;
          setSseConnected(true);
          stopPolling(); // SSE is live — polling not needed
          // Catch any orders that arrived while SSE was reconnecting
          refreshOrders();
        });

        es.addEventListener("new-order", (event) => {
          if (!mountedRef.current) return;
          try {
            const order = JSON.parse((event as MessageEvent).data) as Order;
            // Prepend immediately for instant display; full refresh catches rest
            setOrders((prev) => {
              if (prev.find((o) => o.id === order.id)) return prev;
              markNew([order.id]);
              return [order, ...prev];
            });
            // Schedule a full refresh 2 s later to ensure imageUrl etc. are
            // populated (SSE payload already includes them, but this is a
            // safety net for any timing edge-case).
            setTimeout(refreshOrders, 2_000);
          } catch {
            /* malformed SSE payload — ignore */
          }
        });

        es.onerror = () => {
          if (!mountedRef.current) return;
          setSseConnected(false);
          es?.close();
          startPolling(); // fall back until SSE reconnects
          reconnectTimer = setTimeout(connect, 10_000);
        };
      } catch {
        startPolling();
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      es?.close();
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [markNew, refreshOrders, startPolling, stopPolling]);

  // ── Fetch person notes once on mount ──────────────────────────────────────

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, NoteData> = {};
        for (const n of data.notes ?? []) {
          map[n.person] = {
            person:  n.person,
            content: n.content ?? "",
            todos:   Array.isArray(n.todos) ? (n.todos as TodoItem[]) : [],
          };
        }
        setNotes(map);
        setNotesReady(true);
      })
      .catch(() => {});
  }, []);

  // ── Categorise orders ──────────────────────────────────────────────────────

  const { tshirt, mug, other } = useMemo(() => {
    const tshirt: Order[] = [];
    const mug:    Order[] = [];
    const other:  Order[] = [];
    for (const o of orders) {
      const t = detectProductType(o);
      if      (t === "tshirt") tshirt.push(o);
      else if (t === "mug")    mug.push(o);
      else                     other.push(o);
    }
    return { tshirt, mug, other };
  }, [orders]);

  return (
    <div className="p-6 space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Atelier
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard OLDA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d&apos;ensemble de la production par type de produit
          </p>
        </div>
        {/* Live indicator */}
        <div className="shrink-0 pb-1">
          <LiveIndicator connected={sseConnected} />
        </div>
      </div>

      {/* ── Rappels (Apple Reminders) ───────────────────────────────────────── */}
      <RemindersGrid
        key={String(notesReady)}
        notesMap={Object.fromEntries(
          PEOPLE.map((p) => [p.key, notes[p.key]?.todos ?? []])
        )}
      />

      {/* ── Catégories kanban ──────────────────────────────────────────────── */}

      {/*
        T-shirt board — the "Commande à traiter" column (index 0) uses the
        full Carte Totale design: QR code + Avant/Arrière visuals + todo list.
        All other columns keep the compact OrderCard.
      */}
      <ProductBoard
        label="T-shirt"
        columns={TSHIRT_COLUMNS}
        orders={tshirt}
        richFirstColumn
        newOrderIds={newOrderIds}
      />

      <ProductBoard
        label="Mug"
        columns={MUG_COLUMNS}
        orders={mug}
        newOrderIds={newOrderIds}
      />

      {other.length > 0 && (
        <ProductBoard
          label="Autre"
          columns={TSHIRT_COLUMNS}
          orders={other}
          newOrderIds={newOrderIds}
        />
      )}

      {/* ── New-order toast banner ─────────────────────────────────────────── */}
      {newOrderIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-2.5 rounded-2xl border border-blue-300/40 bg-blue-50 dark:bg-blue-950/80 dark:border-blue-700/40 px-4 py-2.5 shadow-lg backdrop-blur-sm">
            <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
              {newOrderIds.size} nouvelle{newOrderIds.size > 1 ? "s" : ""} commande
              {newOrderIds.size > 1 ? "s" : ""} reçue{newOrderIds.size > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
