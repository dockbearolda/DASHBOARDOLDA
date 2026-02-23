"use client";

/**
 * OldaBoard — Light mode only. Zero dark: variants.
 *
 * Hierarchy:
 *   ┌─ sticky header ─ RemindersGrid (4 person cards) ───────────────┐
 *   ├─ hero (title + live indicator) ────────────────────────────────┤
 *   ├─ tabs: Tshirt | Tasse (soon) | Accessoire (soon) ──────────────┤
 *   └─ workspace: single kanban grid, ALL columns use TshirtOrderCard ┘
 */

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
  const cat = (order.category ?? "").toLowerCase().replace(/[-_\s]/g, "");

  // Explicit mug check first
  if (cat === "mug" || cat === "tasse") return "mug";
  // Explicit tshirt check (covers "t-shirt", "tshirt", "t_shirt" after normalise)
  if (cat === "tshirt") return "tshirt";

  // Safely parse items — Prisma $queryRaw with json_agg may return a raw JSON
  // string instead of a parsed array in some configurations.
  let items: Order["items"] = [];
  if (Array.isArray(order.items)) {
    items = order.items;
  } else if (typeof order.items === "string") {
    try { items = JSON.parse(order.items as unknown as string); } catch { items = []; }
  }

  const names = items.map((i) => (i.name ?? "").toLowerCase()).join(" ");
  if (/mug|tasse/.test(names)) return "mug";

  // Default → tshirt. Every non-mug order on this board is a t-shirt order.
  // (When category is empty and item names are generic, we must not lose orders
  //  into the disabled "other" tab.)
  return "tshirt";
}

// ── Kanban column definitions ──────────────────────────────────────────────────

type KanbanCol = { status: OrderStatus; label: string; dot: string };

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

// ── People (for reminders grid key mapping) ────────────────────────────────────

const PEOPLE = [
  { key: "loic",     icon: Inbox  },
  { key: "charlie",  icon: Pencil },
  { key: "melina",   icon: Layers },
  { key: "amandine", icon: Phone  },
] as const;

// ── Category tabs ──────────────────────────────────────────────────────────────

type BoardTab = "tshirt" | "mug" | "other";

const TABS: { key: BoardTab; label: string; enabled: boolean }[] = [
  { key: "tshirt", label: "Commande Tshirt",    enabled: true  },
  { key: "mug",    label: "Commande Tasse",      enabled: false },
  { key: "other",  label: "Commande accessoire", enabled: false },
];

// ── Kanban column ──────────────────────────────────────────────────────────────
// All columns use TshirtOrderCard (full card with QR, L1-L6, todos).

function KanbanColumn({
  col,
  orders,
  newOrderIds,
}: {
  col: KanbanCol;
  orders: Order[];
  newOrderIds?: Set<string>;
}) {
  return (
    // Mobile: full viewport width with snap point so user swipes column-by-column
    // md+: fixed 272 px column in a free-scrolling horizontal list
    <div className="snap-start shrink-0 w-[88vw] sm:w-[80vw] md:w-[272px] flex flex-col gap-2">

      {/* Status bubble / column header */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", col.dot)} />
          <span className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {col.label}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[12px] font-semibold text-gray-500">
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 h-14 flex items-center justify-center">
            <span className="text-[12px] text-gray-300">vide</span>
          </div>
        ) : (
          orders.map((o) => (
            <TshirtOrderCard key={o.id} order={o} isNew={newOrderIds?.has(o.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Kanban board (single tab workspace) ───────────────────────────────────────

function KanbanBoard({
  columns,
  orders,
  newOrderIds,
}: {
  columns: KanbanCol[];
  orders: Order[];
  newOrderIds?: Set<string>;
}) {
  const ordersByStatus = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const col of columns) map[col.status] = [];
    for (const order of orders) {
      if (map[order.status] !== undefined) map[order.status].push(order);
      else map[columns[0].status].push(order); // fallback → first column
    }
    return map;
  }, [columns, orders]);

  return (
    // Mobile: snap-x mandatory — each full-width column snaps into view
    // md+: free horizontal scroll (snap disabled, normal desktop behaviour)
    <div className={cn(
      "flex gap-3 overflow-x-auto pb-4 no-scrollbar",
      "snap-x snap-mandatory",
      "md:snap-none md:[scrollbar-width:thin]",
    )}>
      {columns.map((col) => (
        <KanbanColumn
          key={col.status}
          col={col}
          orders={ordersByStatus[col.status] ?? []}
          newOrderIds={newOrderIds}
        />
      ))}
    </div>
  );
}

// ── Live indicator ─────────────────────────────────────────────────────────────

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        connected ? "bg-emerald-500 animate-pulse-dot" : "bg-gray-300"
      )} />
      <span className="text-[12px] text-gray-400">
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
  const [notes, setNotes]               = useState<Record<string, NoteData>>({});
  const [notesReady, setNotesReady]     = useState(false);
  const [activeTab, setActiveTab]       = useState<BoardTab>("tshirt");

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef   = useRef(true);

  // ── New-order highlight (6 s) ──────────────────────────────────────────────

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

  // ── Full refresh ───────────────────────────────────────────────────────────

  const refreshOrders = useCallback(async () => {
    try {
      const res  = await fetch("/api/orders");
      const data = (await res.json()) as { orders: Order[] };
      const incoming = data.orders ?? [];
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const freshIds    = incoming.filter((o) => !existingIds.has(o.id)).map((o) => o.id);
        if (freshIds.length > 0) markNew(freshIds);
        return incoming;
      });
    } catch { /* ignore */ }
  }, [markNew]);

  // ── Fallback polling ───────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => { if (mountedRef.current) refreshOrders(); }, 5_000);
  }, [refreshOrders]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refreshOrders(); };
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
          stopPolling();
          refreshOrders();
        });
        es.addEventListener("new-order", (event) => {
          if (!mountedRef.current) return;
          try {
            const order = JSON.parse((event as MessageEvent).data) as Order;
            setOrders((prev) => {
              if (prev.find((o) => o.id === order.id)) return prev;
              markNew([order.id]);
              return [order, ...prev];
            });
            setTimeout(refreshOrders, 2_000);
          } catch { /* malformed */ }
        });
        es.onerror = () => {
          if (!mountedRef.current) return;
          setSseConnected(false);
          es?.close();
          startPolling();
          reconnectTimer = setTimeout(connect, 10_000);
        };
      } catch { startPolling(); }
    };

    connect();
    return () => {
      mountedRef.current = false;
      es?.close();
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [markNew, refreshOrders, startPolling, stopPolling]);

  // ── Person notes ───────────────────────────────────────────────────────────

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
    const tshirt: Order[] = [], mug: Order[] = [], other: Order[] = [];
    for (const o of orders) {
      const t = detectProductType(o);
      if      (t === "tshirt") tshirt.push(o);
      else if (t === "mug")    mug.push(o);
      else                     other.push(o);
    }
    return { tshirt, mug, other };
  }, [orders]);

  const notesMap = Object.fromEntries(PEOPLE.map((p) => [p.key, notes[p.key]?.todos ?? []]));

  // Select orders for active tab
  const activeOrders = activeTab === "tshirt" ? tshirt : activeTab === "mug" ? mug : other;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-white min-h-screen">

      {/* ══ ZONE 1 — Sticky header: 4 person reminder cards ══════════════════ */}
      {/* pt-safe: pushes content below iOS notch / Dynamic Island               */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm pt-safe">
        <div className="px-4 sm:px-6 py-3">
          <RemindersGrid key={String(notesReady)} notesMap={notesMap} />
        </div>
      </div>

      {/* ══ ZONE 2 — Scrollable workspace ════════════════════════════════════ */}
      <div className="px-4 sm:px-6 py-5 md:py-6 space-y-5">

        {/* ── Hero ── */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] md:text-[14px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Atelier
            </p>
            <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-gray-900">
              Dashboard OLDA
            </h1>
            <p className="hidden sm:block text-[15px] text-gray-500 mt-1">
              Vue d&apos;ensemble de la production par type de produit
            </p>
          </div>
          <div className="shrink-0 pb-1">
            <LiveIndicator connected={sseConnected} />
          </div>
        </div>

        {/* ── Navigation tabs — min-h-[44px] = Apple HIG 44 pt touch target ── */}
        <div className="border-b border-gray-200 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              disabled={!tab.enabled}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              className={cn(
                "relative shrink-0 px-4 min-h-[44px] flex items-center",
                "text-[14px] font-medium transition-colors whitespace-nowrap pb-[2px]",
                tab.key === activeTab
                  ? "text-blue-600"
                  : tab.enabled
                  ? "text-gray-500 hover:text-gray-700"
                  : "text-gray-300 cursor-not-allowed"
              )}
            >
              {tab.label}
              {!tab.enabled && (
                <span className="ml-1.5 text-[11px] text-gray-300 font-normal">bientôt</span>
              )}
              {tab.key === activeTab && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── ZONE 3 — Kanban workspace (single board, updates with tab) ── */}
        <KanbanBoard
          columns={TSHIRT_COLUMNS}
          orders={activeOrders}
          newOrderIds={newOrderIds}
        />
      </div>

      {/* ── New-order toast ── */}
      {newOrderIds.size > 0 && (
        <div className="fixed bottom-6 mb-safe-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 shadow-lg">
            <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin" />
            <span className="text-[14px] font-semibold text-blue-700">
              {newOrderIds.size} nouvelle{newOrderIds.size > 1 ? "s" : ""} commande
              {newOrderIds.size > 1 ? "s" : ""} reçue{newOrderIds.size > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
