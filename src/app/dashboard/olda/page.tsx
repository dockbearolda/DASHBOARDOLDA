export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OldaBoard } from "@/components/olda/olda-board";
import type { Order } from "@/types/order";

async function getOrders(): Promise<Order[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
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

  return rows.map((o: Record<string, unknown>) => {
    // json_agg may arrive as a parsed array or as a raw JSON string depending on
    // the Prisma / pg driver version — normalise to array here.
    let items = o.items;
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) items = [];

    return {
      ...o,
      items,
      createdAt: o.createdAt instanceof Date ? (o.createdAt as Date).toISOString() : String(o.createdAt),
      updatedAt: o.updatedAt instanceof Date ? (o.updatedAt as Date).toISOString() : String(o.updatedAt),
    };
  }) as unknown as Order[];
}

export default async function OldaDashboardPage() {
  let orders: Order[] = [];
  try {
    orders = await getOrders();
  } catch (err) {
    console.error("OldaDashboardPage getOrders error:", err);
  }

  return (
    <div>
      <Header title="Dashboard OLDA" />
      <OldaBoard orders={orders} />
    </div>
  );
}
