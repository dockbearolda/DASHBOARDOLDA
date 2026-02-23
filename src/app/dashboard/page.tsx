export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderList } from "@/components/orders/order-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingBag,
  Euro,
  Clock,
  CheckCircle2,
  CheckCircle,
  TrendingUp,
  Users,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Order } from "@/types/order";
import { subDays, startOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";

type OrderItem = { name: string; quantity: number; price: number };
type RawOrder = Record<string, unknown> & {
  total: unknown;
  status: unknown;
  paymentStatus: unknown;
  customerEmail: unknown;
  items: OrderItem[];
};

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

  // Analytics metrics
  const paidRevenue = orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avgOrderValue = orders.length > 0 ? paidRevenue / orders.length : 0;
  const uniqueCustomers = new Set(orders.map((o) => String(o.customerEmail))).size;

  // Top 5 products by revenue
  const topProducts = orders
    .flatMap((o) => (o.items as OrderItem[]) ?? [])
    .reduce((acc: { name: string; count: number; revenue: number }[], item) => {
      const existing = acc.find((p) => p.name === item.name);
      if (existing) {
        existing.count += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        acc.push({ name: item.name, count: item.quantity, revenue: item.price * item.quantity });
      }
      return acc;
    }, [])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 30-day revenue chart
  const chartData = await Promise.all(
    Array.from({ length: 30 }, async (_, i) => {
      const date = subDays(now, 29 - i);
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
      totalOrders:      orders.length,
      totalRevenue,
      todayRevenue,
      todayOrders:      todayRows.length,
      pendingOrders:    orders.filter((o) => o.status === "COMMANDE_A_TRAITER").length,
      shippedOrders:    orders.filter((o) => o.status === "CLIENT_PREVENU").length,
      paidOrders:       orders.filter((o) => o.paymentStatus === "PAID").length,
      revenueTrend,
      avgOrderValue,
      uniqueCustomers,
    },
    chartData,
    topProducts,
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
      stats: {
        totalOrders: 0, totalRevenue: 0, todayRevenue: 0, todayOrders: 0,
        pendingOrders: 0, shippedOrders: 0, paidOrders: 0, revenueTrend: 0,
        avgOrderValue: 0, uniqueCustomers: 0,
      },
      chartData: [],
      topProducts: [],
    };
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? "Bonne nuit" :
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

        {/* ── Stats — activité temps réel ────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            delay={0.05}
          />
          <StatsCard
            title="Panier moyen"
            value={formatCurrency(data.stats.avgOrderValue)}
            subtitle="Par commande (payées)"
            icon={TrendingUp}
            delay={0.10}
          />
          <StatsCard
            title="Clients uniques"
            value={data.stats.uniqueCustomers.toString()}
            subtitle="Adresses e-mail distinctes"
            icon={Users}
            delay={0.15}
          />
        </div>

        {/* ── Stats — état des commandes ─────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Aujourd'hui"
            value={formatCurrency(data.stats.todayRevenue)}
            subtitle={`${data.stats.todayOrders} commande${data.stats.todayOrders > 1 ? "s" : ""}`}
            icon={TrendingUp}
            trend={data.stats.revenueTrend}
            delay={0}
          />
          <StatsCard
            title="À traiter"
            value={data.stats.pendingOrders.toString()}
            subtitle="Nouvelles commandes"
            icon={Clock}
            delay={0.05}
          />
          <StatsCard
            title="Client prévenu"
            value={data.stats.shippedOrders.toString()}
            subtitle="Commandes finalisées"
            icon={CheckCircle2}
            delay={0.10}
          />
          <StatsCard
            title="Payées"
            value={data.stats.paidOrders.toString()}
            subtitle="Paiement confirmé"
            icon={CheckCircle}
            delay={0.15}
          />
        </div>

        {/* ── Revenue chart (30 jours) ───────────────────────────────── */}
        <RevenueChart data={data.chartData} />

        {/* ── Produits les plus vendus ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produits les plus vendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune donnée disponible
              </p>
            ) : (
              <div className="space-y-4">
                {data.topProducts.map(
                  (product: { name: string; count: number; revenue: number }, i: number) => {
                    const maxRevenue = data.topProducts[0]?.revenue || 1;
                    const pct = Math.round((product.revenue / maxRevenue) * 100);
                    return (
                      <div key={product.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground w-4">
                              {i + 1}.
                            </span>
                            <span className="font-medium truncate max-w-[240px]">
                              {product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {product.count} vendu{product.count > 1 ? "s" : ""}
                            </span>
                            <span className="font-semibold text-foreground tabular-nums">
                              {formatCurrency(product.revenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Commandes reçues ──────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold mb-4">Commandes reçues</h2>
          <OrderList
            initialOrders={data.orders as unknown as Order[]}
            refreshInterval={5000}
          />
        </div>

      </div>
    </div>
  );
}
