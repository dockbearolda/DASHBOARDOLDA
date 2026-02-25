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

  const totalRevenue = orders.reduce((s: number, o: typeof orders[0]) => s + (Number(o.total) || 0), 0);
  const todayRevenue = todayRows.reduce((s: number, o: typeof todayRows[0]) => s + (Number(o.total) || 0), 0);
  const yesterdayRevenue = yesterdayRows.reduce((s: number, o: typeof yesterdayRows[0]) => s + (Number(o.total) || 0), 0);

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
  redirect("/dashboard/olda");
}
