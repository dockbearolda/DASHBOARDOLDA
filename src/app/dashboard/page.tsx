export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
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

type OrderItem = { famille?: string | null; prixUnitaire?: number | null };
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

  // All orders with items — compatible with both SQLite and PostgreSQL
  const ordersWithItems = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const orders = ordersWithItems.map((o: typeof ordersWithItems[0]) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
  }));

  const todayOrders = orders.filter((o: typeof orders[0]) => {
    const createdDate = new Date(o.createdAt);
    return createdDate >= todayStart;
  });

  const yesterdayOrders = orders.filter((o: typeof orders[0]) => {
    const createdDate = new Date(o.createdAt);
    return createdDate >= yesterdayStart && createdDate < todayStart;
  });

  const todayRows = todayOrders.map((o: typeof orders[0]) => ({ total: o.total }));
  const yesterdayRows = yesterdayOrders.map((o: typeof orders[0]) => ({ total: o.total }));

  const totalRevenue = orders.reduce((s: number, o: typeof orders[0]) => s + (Number(o.total) || 0), 0);
  const todayRevenue = todayRows.reduce((s: number, o: typeof todayRows[0]) => s + (Number(o.total) || 0), 0);
  const yesterdayRevenue = yesterdayRows.reduce((s: number, o: typeof yesterdayRows[0]) => s + (Number(o.total) || 0), 0);

  const revenueTrend =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : todayRevenue > 0 ? 100 : 0;

  // Analytics metrics
  const paidRevenue = orders
    .filter((o: typeof orders[0]) => o.paymentStatus === "PAID")
    .reduce((s: number, o: typeof orders[0]) => s + (Number(o.total) || 0), 0);
  const avgOrderValue = orders.length > 0 ? paidRevenue / orders.length : 0;
  const uniqueCustomers = new Set(orders.map((o: typeof orders[0]) => String(o.customerEmail))).size;

  // Top 5 produits par CA (basé sur famille + prixUnitaire)
  const topProducts = orders
    .flatMap((o: typeof orders[0]) => (o.items as OrderItem[]) ?? [])
    .reduce((acc: { name: string; count: number; revenue: number }[], item: OrderItem) => {
      const name = item.famille ?? "T-Shirt";
      const price = Number(item.prixUnitaire) || 0;
      const existing = acc.find((p) => p.name === name);
      if (existing) {
        existing.count += 1;
        existing.revenue += price;
      } else {
        acc.push({ name, count: 1, revenue: price });
      }
      return acc;
    }, [])
    .sort((a: { name: string; count: number; revenue: number }, b: { name: string; count: number; revenue: number }) => b.revenue - a.revenue)
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
      pendingOrders:    orders.filter((o: typeof orders[0]) => o.status === "COMMANDE_A_TRAITER").length,
      shippedOrders:    orders.filter((o: typeof orders[0]) => o.status === "CLIENT_PREVENU").length,
      paidOrders:       orders.filter((o: typeof orders[0]) => o.paymentStatus === "PAID").length,
      revenueTrend,
      avgOrderValue,
      uniqueCustomers,
    },
    chartData,
    topProducts,
  };
}

export default async function DashboardPage() {
  redirect("/dashboard/olda");
}
