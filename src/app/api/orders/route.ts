import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebhookOrderPayload } from "@/types/order";

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // dev mode: allow all
  const provided = request.headers.get("x-webhook-secret");
  return provided === secret;
}

function newId(): string {
  return `c${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

// GET /api/orders — list all orders (for client-side refresh)
export async function GET() {
  try {
    const orders = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT o.*, COALESCE(json_agg(
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

    return NextResponse.json({
      orders: orders.map((o: Record<string, unknown>) => ({
        ...o,
        createdAt: o.createdAt instanceof Date ? (o.createdAt as Date).toISOString() : o.createdAt,
        updatedAt: o.updatedAt instanceof Date ? (o.updatedAt as Date).toISOString() : o.updatedAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders — receive webhook from oldastudio
// Uses raw SQL to bypass the stale Prisma client that has French enum defaults
// (COMMANDE_A_TRAITER) baked in while the DB has English values (PENDING...).
export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized: invalid webhook secret" }, { status: 401 });
  }

  let body: WebhookOrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const required = ["orderNumber", "customerName", "customerEmail", "total", "subtotal", "items"];
  const missing = required.filter((f) => !(f in body));
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 422 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 422 });
  }

  const status = body.status ?? "PENDING";
  const paymentStatus = body.paymentStatus ?? "PENDING";
  const shippingAddr = body.shippingAddress ? JSON.stringify(body.shippingAddress) : null;
  const billingAddr = body.billingAddress ? JSON.stringify(body.billingAddress) : null;

  try {
    // Check if order already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM orders WHERE "orderNumber" = ${body.orderNumber} LIMIT 1
    `;

    let orderId: string;

    if (existing.length > 0) {
      orderId = existing[0].id;
      // Update only the mutable fields that were provided
      await prisma.$executeRaw`
        UPDATE orders SET
          status = COALESCE(${body.status ?? null}::"OrderStatus", status),
          "paymentStatus" = COALESCE(${body.paymentStatus ?? null}::"PaymentStatus", "paymentStatus"),
          notes = COALESCE(${body.notes ?? null}, notes),
          "updatedAt" = NOW()
        WHERE id = ${orderId}
      `;
    } else {
      orderId = newId();
      await prisma.$executeRaw`
        INSERT INTO orders (
          id, "orderNumber", "customerName", "customerEmail", "customerPhone",
          status, "paymentStatus", total, subtotal, shipping, tax, currency,
          notes, "shippingAddress", "billingAddress", "updatedAt"
        ) VALUES (
          ${orderId},
          ${body.orderNumber},
          ${body.customerName},
          ${body.customerEmail},
          ${body.customerPhone ?? null},
          ${status}::"OrderStatus",
          ${paymentStatus}::"PaymentStatus",
          ${body.total},
          ${body.subtotal},
          ${body.shipping ?? 0},
          ${body.tax ?? 0},
          ${body.currency ?? "EUR"},
          ${body.notes ?? null},
          ${shippingAddr}::jsonb,
          ${billingAddr}::jsonb,
          NOW()
        )
      `;

      for (const item of body.items) {
        const itemId = newId();
        await prisma.$executeRaw`
          INSERT INTO order_items (id, "orderId", name, sku, quantity, price, "imageUrl")
          VALUES (
            ${itemId}, ${orderId}, ${item.name}, ${item.sku ?? null},
            ${item.quantity}, ${item.price}, ${item.imageUrl ?? null}
          )
        `;
      }
    }

    // Read back the created/updated order
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT o.*, COALESCE(json_agg(
        json_build_object('id', i.id, 'name', i.name, 'quantity', i.quantity, 'price', i.price)
        ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items i ON i."orderId" = o.id
      WHERE o.id = ${orderId}
      GROUP BY o.id
    `;
    const order = rows[0];

    return NextResponse.json(
      {
        success: true,
        order: {
          ...order,
          createdAt: order.createdAt instanceof Date ? (order.createdAt as Date).toISOString() : order.createdAt,
          updatedAt: order.updatedAt instanceof Date ? (order.updatedAt as Date).toISOString() : order.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create order", detail: message }, { status: 500 });
  }
}
