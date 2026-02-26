export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { OldaBoard } from "@/components/olda/olda-board";
import type { Order } from "@/types/order";

async function getOrders(): Promise<Order[]> {
  const ordersWithItems = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return ordersWithItems.map((o: typeof ordersWithItems[0]) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt),
  })) as unknown as Order[];
}

export default async function OldaDashboardPage() {
  let orders: Order[] = [];
  try {
    orders = await getOrders();
  } catch (err) {
    console.error("OldaDashboardPage getOrders error:", err);
  }

  return (
    <OldaBoard orders={orders} />
  );
}
