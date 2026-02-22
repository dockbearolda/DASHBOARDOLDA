"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { Order, OrderStatus } from "@/types/order";
import { Inbox, Pencil, Layers, Phone, FileText, CheckSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonNoteModal, type NoteData, type TodoItem } from "./person-note-modal";
import { TshirtOrderCard } from "./tshirt-order-card";

// ── Product type detection ─────────────────────────────────────────────────────

type ProductType = "tshirt" | "mug" | "other";

function detectProductType(order: Order): ProductType {
  const items = Array.isArray(order.items) ? order.items : [];
  const names = items.map((i) => (i.name ?? "").toLowerCase()).join(" ");
  if (/t[-\s]?shirt|tee\b/.test(names)) return "tshirt";
  if (/mug|tasse/.test(names)) return "mug";
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
    <div className="rounded-xl border border-border/50 bg-card p-3 hover:border-border/80 hover:shadow-sm transition-all cursor-default">
      <p className="text-[11px] font-bold text-foreground truncate">
        #{order.orderNumber}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {order.customerName}
      </p>
      <div className="flex items-center justify-between mt-2 gap-1">
        <span className="text-[10px] text-muted-foreground">{totalQty} art.</span>
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
      <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", col.dot)} />
          <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
            {col.label}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {orders.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/30 h-12 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/40">vide</span>
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
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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

// ── Person note card ───────────────────────────────────────────────────────────

function PersonNoteCard({
  person,
  orderCount,
  note,
  onClick,
  index,
}: {
  person: typeof PEOPLE[number];
  orderCount: number;
  note: NoteData | null;
  onClick: () => void;
  index: number;
}) {
  const Icon    = person.icon;
  const pending = (note?.todos ?? []).filter((t: TodoItem) => !t.done).length;
  const total   = (note?.todos ?? []).length;

  const preview = note?.content
    ?.split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0)
    ?.slice(0, 80) ?? null;

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden text-left rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 hover:border-border hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 transition-all duration-300 animate-fade-up cursor-pointer"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {person.role}
          </p>
          <p className="text-2xl font-bold tracking-tight">{orderCount}</p>
          <p className="text-xs text-muted-foreground">{person.name}</p>
        </div>
        <div className="rounded-xl p-2.5 bg-muted/70 ring-1 ring-border/40 text-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="border-t border-border/40 pt-3 space-y-2">
        {preview ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2 italic">
            {preview}
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground/30 italic">
            Aucune note…
          </p>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {note?.content && note.content.trim().length > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <FileText className="h-2.5 w-2.5" />
              Note
            </span>
          )}
          {total > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              <CheckSquare className="h-2.5 w-2.5" />
              {pending}/{total}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
            Ouvrir
          </span>
        </div>
      </div>
    </button>
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
      <span className="text-[10px] text-muted-foreground/50">
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
  const [activePerson, setActivePerson] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const markNew = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewOrderIds((prev) => new Set([...prev, ...ids]));
    // Remove the highlight after 6 seconds
    setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 6_000);
  }, []);

  const mergeOrders = useCallback(
    (incoming: Order[]) => {
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const fresh = incoming.filter((o) => !existingIds.has(o.id));
        if (fresh.length === 0) return prev;
        markNew(fresh.map((o) => o.id));
        return [...fresh, ...prev];
      });
    },
    [markNew]
  );

  // ── Fallback polling (every 15 s) ──────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return; // already running
    pollTimerRef.current = setInterval(async () => {
      try {
        const res  = await fetch("/api/orders");
        const data = await res.json() as { orders: Order[] };
        mergeOrders(data.orders ?? []);
      } catch {
        /* ignore transient network errors */
      }
    }, 15_000);
  }, [mergeOrders]);

  // ── SSE subscription ───────────────────────────────────────────────────────

  useEffect(() => {
    let es: EventSource | null = null;

    const connect = () => {
      try {
        es = new EventSource("/api/orders/stream");

        es.addEventListener("connected", () => {
          setSseConnected(true);
          // SSE is live → stop polling if it was running
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        });

        es.addEventListener("new-order", (event) => {
          try {
            const order = JSON.parse((event as MessageEvent).data) as Order;
            setOrders((prev) => {
              if (prev.find((o) => o.id === order.id)) return prev;
              markNew([order.id]);
              return [order, ...prev];
            });
          } catch {
            /* malformed payload — ignore */
          }
        });

        es.onerror = () => {
          setSseConnected(false);
          es?.close();
          // Fall back to polling until SSE recovers
          startPolling();
          // Attempt SSE reconnect after 10 s
          setTimeout(connect, 10_000);
        };
      } catch {
        // EventSource not supported or blocked — use polling
        startPolling();
      }
    };

    connect();

    return () => {
      es?.close();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [markNew, startPolling]);

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
      })
      .catch(() => {});
  }, []);

  const handleSave = (note: NoteData) => {
    setNotes((prev) => ({ ...prev, [note.person]: note }));
  };

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

  const activePersonData = activePerson
    ? PEOPLE.find((p) => p.key === activePerson) ?? null
    : null;

  return (
    <div className="p-6 space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
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

      {/* ── Person note cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PEOPLE.map((person, i) => {
          const personOrders = orders.filter((o) =>
            person.statuses.includes(o.status)
          );
          return (
            <PersonNoteCard
              key={person.key}
              person={person}
              orderCount={personOrders.length}
              note={notes[person.key] ?? null}
              onClick={() => setActivePerson(person.key)}
              index={i}
            />
          );
        })}
      </div>

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
            <span className="text-[12px] font-semibold text-blue-700 dark:text-blue-300">
              {newOrderIds.size} nouvelle{newOrderIds.size > 1 ? "s" : ""} commande
              {newOrderIds.size > 1 ? "s" : ""} reçue{newOrderIds.size > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* ── Apple Notes modal ──────────────────────────────────────────────── */}
      {activePersonData && (
        <PersonNoteModal
          open={activePerson !== null}
          onOpenChange={(o) => { if (!o) setActivePerson(null); }}
          personKey={activePersonData.key}
          personName={activePersonData.name}
          personRole={activePersonData.role}
          initialNote={notes[activePersonData.key] ?? null}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
