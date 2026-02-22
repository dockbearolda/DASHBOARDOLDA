"use client";

import { useMemo } from "react";
import type { Order, OrderStatus } from "@/types/order";
import { Inbox, Pencil, Layers, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

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
  dot: string; // accent dot color
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

// ── People info boxes ──────────────────────────────────────────────────────────

const PEOPLE = [
  {
    name: "Loïc",
    role: "Nouvelles commandes",
    icon: Inbox,
    statuses: ["COMMANDE_A_TRAITER", "COMMANDE_EN_ATTENTE"] as OrderStatus[],
  },
  {
    name: "Charlie",
    role: "Maquettes & design",
    icon: Pencil,
    statuses: ["MAQUETTE_A_FAIRE"] as OrderStatus[],
  },
  {
    name: "Mélina",
    role: "Validation & production",
    icon: Layers,
    statuses: [
      "EN_ATTENTE_VALIDATION",
      "PRT_A_FAIRE",
      "COMMANDE_A_PREPARER",
      "EN_COURS_IMPRESSION",
      "PRESSAGE_A_FAIRE",
    ] as OrderStatus[],
  },
  {
    name: "Amandine",
    role: "Relation client",
    icon: Phone,
    statuses: ["CLIENT_A_CONTACTER", "CLIENT_PREVENU"] as OrderStatus[],
  },
];

// ── Order card ─────────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const items = Array.isArray(order.items) ? order.items : [];
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

function KanbanColumn({ col, orders }: { col: KanbanCol; orders: Order[] }) {
  return (
    <div className="shrink-0 w-44 flex flex-col gap-2">
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
}: {
  label: string;
  columns: KanbanCol[];
  orders: Order[];
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
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            col={col}
            orders={ordersByStatus[col.status] ?? []}
          />
        ))}
      </div>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function OldaBoard({ orders }: { orders: Order[] }) {
  const { tshirt, mug, other } = useMemo(() => {
    const tshirt: Order[] = [];
    const mug: Order[] = [];
    const other: Order[] = [];
    for (const o of orders) {
      const t = detectProductType(o);
      if (t === "tshirt") tshirt.push(o);
      else if (t === "mug") mug.push(o);
      else other.push(o);
    }
    return { tshirt, mug, other };
  }, [orders]);

  return (
    <div className="p-6 space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Atelier
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard OLDA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de la production par type de produit
        </p>
      </div>

      {/* ── People cards — même structure exacte que StatsCard ────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PEOPLE.map((person, i) => {
          const personOrders = orders.filter((o) =>
            person.statuses.includes(o.status)
          );
          const Icon = person.icon;
          return (
            <div
              key={person.name}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 hover:border-border hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {/* Top-edge glint on hover */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {person.role}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {personOrders.length}
                  </p>
                  <p className="text-xs text-muted-foreground">{person.name}</p>
                </div>
                <div className="rounded-xl p-2.5 bg-muted/70 ring-1 ring-border/40 text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {personOrders.length > 0 && (
                <div className="mt-4 space-y-0.5">
                  {personOrders.slice(0, 2).map((o) => (
                    <p key={o.id} className="text-[11px] text-muted-foreground truncate">
                      #{o.orderNumber} — {o.customerName}
                    </p>
                  ))}
                  {personOrders.length > 2 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      +{personOrders.length - 2} de plus
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Catégories ────────────────────────────────────────────────────── */}
      <ProductBoard label="T-shirt" columns={TSHIRT_COLUMNS} orders={tshirt} />
      <ProductBoard label="Mug"     columns={MUG_COLUMNS}    orders={mug} />
      {other.length > 0 && (
        <ProductBoard label="Autre" columns={TSHIRT_COLUMNS} orders={other} />
      )}

    </div>
  );
}
