export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { OldaBoard } from "@/components/olda/olda-board";
import type { Order } from "@/types/order";
import { startOfDay, subDays } from "date-fns";

// ── Typage interne ─────────────────────────────────────────────────────────────

type OrderItem = { famille?: string | null; prixUnitaire?: number | null };

// ── Récupération & calcul des données du dashboard ────────────────────────────
//
//  Centralise ICI toute la logique Prisma :
//    · commandes + articles (pour OldaBoard)
//    · statistiques du jour / globales (pour future vue analytics)
//
//  Les chartData sur 30 jours sont omis intentionnellement : 30 requêtes raw-SQL
//  séquentielles sont trop lentes pour un affichage atelier. À ré-activer si une
//  vue "Statistiques" est ajoutée avec un cache approprié.

async function getDashboardData() {
  const now        = new Date();
  const todayStart = startOfDay(now);
  const yestStart  = startOfDay(subDays(now, 1));

  // Requête unique — commandes + articles
  const raw = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  // Sérialisation des dates pour le client (évite l'erreur de serialisation Next.js)
  const orders = raw.map((o) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
  })) as unknown as Order[];

  // ── Stats calculées côté serveur depuis le tableau déjà chargé ───────────

  const todayOrders     = orders.filter((o) => new Date(String(o.createdAt)) >= todayStart);
  const yestOrders      = orders.filter((o) => {
    const d = new Date(String(o.createdAt));
    return d >= yestStart && d < todayStart;
  });

  const totalRevenue    = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const todayRevenue    = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const yestRevenue     = yestOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const revenueTrend    = yestRevenue > 0
    ? Math.round(((todayRevenue - yestRevenue) / yestRevenue) * 100)
    : todayRevenue > 0 ? 100 : 0;

  const paidRevenue     = orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avgOrderValue   = orders.length > 0 ? paidRevenue / orders.length : 0;
  const uniqueCustomers = new Set(orders.map((o) => String(o.customerEmail))).size;

  // Top 5 produits par CA
  const topProducts = orders
    .flatMap((o) => (o.items as OrderItem[]) ?? [])
    .reduce((acc: { name: string; count: number; revenue: number }[], item: OrderItem) => {
      const name  = item.famille ?? "T-Shirt";
      const price = Number(item.prixUnitaire) || 0;
      const found = acc.find((p) => p.name === name);
      if (found) { found.count += 1; found.revenue += price; }
      else acc.push({ name, count: 1, revenue: price });
      return acc;
    }, [])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const stats = {
    totalOrders:    orders.length,
    totalRevenue,
    todayRevenue,
    todayOrders:    todayOrders.length,
    pendingOrders:  orders.filter((o) => o.status === "COMMANDE_A_TRAITER").length,
    shippedOrders:  orders.filter((o) => o.status === "CLIENT_PREVENU").length,
    paidOrders:     orders.filter((o) => o.paymentStatus === "PAID").length,
    revenueTrend,
    avgOrderValue,
    uniqueCustomers,
  };

  return { orders, stats, topProducts };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OldaDashboardPage() {
  let orders: Order[] = [];

  try {
    const data = await getDashboardData();
    orders = data.orders;
  } catch (err) {
    console.error("[OldaDashboardPage] Erreur récupération données :", err);
  }

  return <OldaBoard orders={orders} />;
}
