import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderList } from "@/components/orders/order-list";
import {
  ShoppingBag,
  Euro,
  Clock,
  Truck,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Order } from "@/types/order";
import { subDays, startOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";

type PrismaOrder = {
  id: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  subtotal: number;
  shipping: number;
  tax: number;
  currency: string;
  notes: string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  items: {
    id: string;
    orderId: string;
    name: string;
    sku: string | null;
    quantity: number;
    price: number;
    imageUrl: string | null;
  }[];
};

async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));

  const [rawOrders, todayRaw, yesterdayRaw] = await Promise.all([
    prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),
  ]);

  const orders = rawOrders as unknown as PrismaOrder[];
  const todayOrders = todayRaw as unknown as { total: number }[];
  const yesterdayOrders = yesterdayRaw as unknown as { total: number }[];

  const totalRevenue = orders.reduce((s: number, o: PrismaOrder) => s + o.total, 0);
  const todayRevenue = todayOrders.reduce((s: number, o: { total: number }) => s + o.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s: number, o: { total: number }) => s + o.total, 0);

  const revenueTrend =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : todayRevenue > 0 ? 100 : 0;

  const chartData = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      return prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfDay(date), lt: startOfDay(subDays(date, -1)) },
          paymentStatus: "PAID",
        },
        _sum: { total: true },
        _count: true,
      }).then((r: { _sum: { total: number | null }; _count: number }) => ({
        date: format(date, "d MMM", { locale: fr }),
        revenue: r._sum.total ?? 0,
        orders: r._count,
      }));
    })
  );

  return {
    orders: orders.map((o: PrismaOrder) => ({
      ...o,
      shippingAddress: o.shippingAddress as Record<string, string> | null,
      billingAddress: o.billingAddress as Record<string, string> | null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    stats: {
      totalOrders: orders.length,
      totalRevenue,
      todayRevenue,
      todayOrders: todayRaw.length,
      pendingOrders: orders.filter((o: PrismaOrder) => o.status === "PENDING").length,
      shippedOrders: orders.filter((o: PrismaOrder) => o.status === "SHIPPED").length,
      paidOrders: orders.filter((o: PrismaOrder) => o.paymentStatus === "PAID").length,
      revenueTrend,
    },
    chartData,
  };
}

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch {
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
            title="En attente"
            value={data.stats.pendingOrders.toString()}
            subtitle="À traiter"
            icon={Clock}
            delay={0.18}
          />
          <StatsCard
            title="Expédiées"
            value={data.stats.shippedOrders.toString()}
            subtitle="En transit"
            icon={Truck}
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
