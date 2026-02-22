export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderList } from "@/components/orders/order-list";
import {
  ShoppingBag,
  Euro,
  Clock,
  CheckCircle2,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Order } from "@/types/order";
import { subDays, startOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";

async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));

  // All orders with items — raw SQL, consistent with API routes
  const rawOrders = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT o.*,
      COALESCE(json_agg(
        json_build_object(
          'id', i.id, 'orderId', i."orderId", 'name', i.name,
          'sku', i.sku, 'quantity', i.quantity, 'price', i.price, 'imageUrl', i."imageUrl"
        ) ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
    FROM orders o
    LEFT JOIN order_items i ON i."orderId" = o.id
    GROUP BY o.id
    ORDER BY o."createdAt" DESC
  `;

  const todayRows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT total FROM orders WHERE "createdAt" >= ${todayStart}
  `;

  const yesterdayRows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT total FROM orders WHERE "createdAt" >= ${yesterdayStart} AND "createdAt" < ${todayStart}
  `;

  type RawOrder = Record<string, unknown> & { total: unknown; status: unknown; paymentStatus: unknown };
  const orders = (rawOrders as RawOrder[]).map((o) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? (o.createdAt as Date).toISOString() : String(o.createdAt),
    updatedAt: o.updatedAt instanceof Date ? (o.updatedAt as Date).toISOString() : String(o.updatedAt),
  }));

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const todayRevenue = todayRows.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const yesterdayRevenue = yesterdayRows.reduce((s, o) => s + (Number(o.total) || 0), 0);

  const revenueTrend =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : todayRevenue > 0 ? 100 : 0;

  const chartData = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const date = subDays(now, 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = startOfDay(subDays(date, -1));

      const rows = await prisma.$queryRaw<{ revenue: number; orders: bigint }[]>`
        SELECT
          COALESCE(SUM(total), 0) AS revenue,
          COUNT(*)                AS orders
        FROM orders
        WHERE "createdAt" >= ${dayStart}
          AND "createdAt" <  ${dayEnd}
          AND "paymentStatus" = 'PAID'
      `;

      const row = rows[0];
      return {
        date: format(date, "d MMM", { locale: fr }),
        revenue: Number(row?.revenue ?? 0),
        orders:  Number(row?.orders  ?? 0),
      };
    })
  );

  return {
    orders,
    stats: {
      totalOrders:   orders.length,
      totalRevenue,
      todayRevenue,
      todayOrders:   todayRows.length,
      pendingOrders: orders.filter((o) => o.status === "COMMANDE_A_TRAITER").length,
      shippedOrders: orders.filter((o) => o.status === "CLIENT_PREVENU").length,
      paidOrders:    orders.filter((o) => o.paymentStatus === "PAID").length,
      revenueTrend,
    },
    chartData,
  };
}

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("getDashboardData error:", err);
    data = {
      orders: [],
      stats: { totalOrders: 0, totalRevenue: 0, todayRevenue: 0, todayOrders: 0, pendingOrders: 0, shippedOrders: 0, paidOrders: 0, revenueTrend: 0 },
      chartData: [],
    };
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Bonne nuit" :
    hour < 12 ? "Bonjour" :
    hour < 18 ? "Bon après-midi" :
    "Bonsoir";

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <Header />
      <div className="p-6 space-y-8">

        {/* ── Hero greeting ──────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {todayLabel}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Voici l&apos;état de votre boutique OLDA Studio
            </p>
          </div>
        </div>

        {/* ── Stats cards ────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Commandes totales"
            value={data.stats.totalOrders.toString()}
            subtitle="Toutes commandes confondues"
            icon={ShoppingBag}
            delay={0}
          />
          <StatsCard
            title="Revenu total"
            value={formatCurrency(data.stats.totalRevenue)}
            subtitle="Revenu cumulé"
            icon={Euro}
            delay={0.06}
          />
          <StatsCard
            title="Aujourd'hui"
            value={formatCurrency(data.stats.todayRevenue)}
            subtitle={`${data.stats.todayOrders} commande${data.stats.todayOrders > 1 ? "s" : ""}`}
            icon={TrendingUp}
            trend={data.stats.revenueTrend}
            delay={0.12}
          />
          <StatsCard
            title="À traiter"
            value={data.stats.pendingOrders.toString()}
            subtitle="Nouvelles commandes"
            icon={Clock}
            delay={0.18}
          />
          <StatsCard
            title="Client prévenu"
            value={data.stats.shippedOrders.toString()}
            subtitle="Commandes finalisées"
            icon={CheckCircle2}
            delay={0.24}
          />
          <StatsCard
            title="Payées"
            value={data.stats.paidOrders.toString()}
            subtitle="Paiement confirmé"
            icon={CheckCircle}
            delay={0.30}
          />
        </div>

        {/* ── Revenue chart ──────────────────────────────────────────── */}
        <RevenueChart data={data.chartData} />

        {/* ── Recent orders ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold mb-4">Commandes reçues</h2>
          <OrderList
            initialOrders={data.orders as unknown as Order[]}
            disableNavigation={true}
            refreshInterval={5000}
          />
        </div>
      </div>
    </div>
  );
}
