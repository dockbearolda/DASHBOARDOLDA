"use client";

import { useMemo } from "react";
import type { Order, OrderStatus } from "@/types/order";
import { Inbox, Pencil, Layers, Phone } from "lucide-react";

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
  header: string; // full Tailwind classes for the header pill
};

const TSHIRT_COLUMNS: KanbanCol[] = [
  { status: "COMMANDE_A_TRAITER",    label: "Commande à traiter",  header: "bg-blue-50 border-blue-200 text-blue-700" },
  { status: "COMMANDE_EN_ATTENTE",   label: "Urgence",             header: "bg-red-50 border-red-200 text-red-700" },
  { status: "MAQUETTE_A_FAIRE",      label: "Maquette à faire",    header: "bg-violet-50 border-violet-200 text-violet-700" },
  { status: "EN_ATTENTE_VALIDATION", label: "En attente client",   header: "bg-amber-50 border-amber-200 text-amber-700" },
  { status: "PRT_A_FAIRE",           label: "À produire",          header: "bg-orange-50 border-orange-200 text-orange-700" },
  { status: "EN_COURS_IMPRESSION",   label: "Production en cours", header: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  { status: "CLIENT_A_CONTACTER",    label: "Client à contacter",  header: "bg-pink-50 border-pink-200 text-pink-700" },
  { status: "ARCHIVES",              label: "Archive / terminé",   header: "bg-slate-50 border-slate-200 text-slate-500" },
];

const MUG_COLUMNS: KanbanCol[] = [
  { status: "COMMANDE_A_TRAITER",    label: "Commande à traiter",  header: "bg-blue-50 border-blue-200 text-blue-700" },
  { status: "COMMANDE_EN_ATTENTE",   label: "Urgence",             header: "bg-red-50 border-red-200 text-red-700" },
  { status: "MAQUETTE_A_FAIRE",      label: "Maquette à faire",    header: "bg-violet-50 border-violet-200 text-violet-700" },
  { status: "EN_ATTENTE_VALIDATION", label: "En attente client",   header: "bg-amber-50 border-amber-200 text-amber-700" },
  { status: "COMMANDE_A_PREPARER",   label: "À produire",          header: "bg-orange-50 border-orange-200 text-orange-700" },
  { status: "CLIENT_A_CONTACTER",    label: "Client à contacter",  header: "bg-pink-50 border-pink-200 text-pink-700" },
  { status: "ARCHIVES",              label: "Archive / terminé",   header: "bg-slate-50 border-slate-200 text-slate-500" },
];

// ── People info boxes ──────────────────────────────────────────────────────────

const PEOPLE = [
  {
    name: "Loïc",
    role: "Nouvelles commandes",
    icon: Inbox,
    gradient: "from-blue-500 to-indigo-600",
    statuses: ["COMMANDE_A_TRAITER", "COMMANDE_EN_ATTENTE"] as OrderStatus[],
  },
  {
    name: "Charlie",
    role: "Maquettes & design",
    icon: Pencil,
    gradient: "from-violet-500 to-purple-600",
    statuses: ["MAQUETTE_A_FAIRE"] as OrderStatus[],
  },
  {
    name: "Mélina",
    role: "Validation & production",
    icon: Layers,
    gradient: "from-pink-500 to-rose-600",
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
    gradient: "from-amber-500 to-orange-600",
    statuses: ["CLIENT_A_CONTACTER", "CLIENT_PREVENU"] as OrderStatus[],
  },
];

// ── Order card ─────────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
  const currency = (order.currency as string) ?? "EUR";

  return (
    <div className="rounded-lg border border-border/60 bg-background p-2.5 shadow-sm hover:border-border hover:shadow transition-all cursor-default">
      <p className="text-[11px] font-bold text-foreground truncate">
        #{order.orderNumber}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {order.customerName}
      </p>
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <span className="text-[10px] text-muted-foreground">
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

// ── Kanban column ──────────────────────────────────────────────────────────────

function KanbanColumn({ col, orders }: { col: KanbanCol; orders: Order[] }) {
  return (
    <div className="shrink-0 w-44 flex flex-col gap-2">
      <div className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-1 ${col.header}`}>
        <span className="text-[10px] font-bold leading-tight line-clamp-2">
          {col.label}
        </span>
        <span className="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/30 h-12 flex items-center justify-center">
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
  emoji,
  label,
  columns,
  orders,
}: {
  emoji: string;
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
        // Unknown status in this workflow → first column
        map[columns[0].status].push(order);
      }
    }
    return map;
  }, [columns, orders]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{emoji}</span>
        <h2 className="text-sm font-bold tracking-tight">{label}</h2>
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
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          DASHBOARD ATELIER OLDA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de la production par type de produit
        </p>
      </div>

      {/* ── 4 info boxes ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PEOPLE.map((person) => {
          const personOrders = orders.filter((o) =>
            person.statuses.includes(o.status)
          );
          const Icon = person.icon;
          return (
            <div
              key={person.name}
              className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${person.gradient} shadow-sm shrink-0`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
                    Information pour
                  </p>
                  <p className="text-sm font-bold leading-tight">{person.name}</p>
                </div>
              </div>

              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {personOrders.length}
                </p>
                <p className="text-xs text-muted-foreground">{person.role}</p>
              </div>

              {personOrders.length > 0 && (
                <div className="space-y-0.5">
                  {personOrders.slice(0, 3).map((o) => (
                    <p
                      key={o.id}
                      className="text-[11px] text-muted-foreground truncate"
                    >
                      #{o.orderNumber} — {o.customerName}
                    </p>
                  ))}
                  {personOrders.length > 3 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      +{personOrders.length - 3} de plus…
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── T-shirt kanban ────────────────────────────────────────── */}
      <ProductBoard emoji="🎽" label="T-shirt" columns={TSHIRT_COLUMNS} orders={tshirt} />

      {/* ── Mug kanban ────────────────────────────────────────────── */}
      <ProductBoard emoji="☕" label="Mug" columns={MUG_COLUMNS} orders={mug} />

      {/* ── Autre (si présent) ────────────────────────────────────── */}
      {other.length > 0 && (
        <ProductBoard emoji="📦" label="Autre" columns={TSHIRT_COLUMNS} orders={other} />
      )}

      {/* ── Produits non disponibles ──────────────────────────────── */}
      <div className="flex gap-3">
        {["Accessoire", "Goodies"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-dashed border-border/40 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground/60"
          >
            <span>📎</span>
            <span>{label}</span>
            <span className="text-[11px] italic">— non disponible actuellement</span>
          </div>
        ))}
      </div>
    </div>
  );
}
