import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebhookOrderPayload } from "@/types/order";

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // dev mode: allow all

  // Accept x-webhook-secret header
  const xSecret = request.headers.get("x-webhook-secret");
  if (xSecret === secret) return true;

  // Accept Authorization: Bearer <token> header (used by oldastudio)
  const auth = request.headers.get("authorization");
  if (auth) {
    const spaceIdx = auth.indexOf(" ");
    const scheme = spaceIdx !== -1 ? auth.slice(0, spaceIdx).toLowerCase() : "";
    const token = spaceIdx !== -1 ? auth.slice(spaceIdx + 1) : "";
    if (scheme === "bearer" && token === secret) return true;
  }

  return false;
}

type PrismaOrderResult = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

// GET /api/orders — list all orders (for client-side refresh)
export async function GET() {
  try {
    const raw = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    const orders = raw as unknown as PrismaOrderResult[];

    return NextResponse.json({
      orders: orders.map((o: PrismaOrderResult) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders — receive webhook from oldastudio
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

  try {
    const raw = await prisma.order.upsert({
      where: { orderNumber: body.orderNumber },
      create: {
        orderNumber: body.orderNumber,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone ?? null,
        status: body.status ?? "PENDING",
        paymentStatus: body.paymentStatus ?? "PENDING",
        total: body.total,
        subtotal: body.subtotal,
        shipping: body.shipping ?? 0,
        tax: body.tax ?? 0,
        currency: body.currency ?? "EUR",
        notes: body.notes ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingAddress: body.shippingAddress ? (JSON.parse(JSON.stringify(body.shippingAddress)) as any) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        billingAddress: body.billingAddress ? (JSON.parse(JSON.stringify(body.billingAddress)) as any) : undefined,
        items: {
          create: body.items.map((item) => ({
            name: item.name,
            sku: item.sku ?? null,
            quantity: item.quantity,
            price: item.price,
            imageUrl: item.imageUrl ?? null,
          })),
        },
      },
      update: {
        ...(body.status && { status: body.status }),
        ...(body.paymentStatus && { paymentStatus: body.paymentStatus }),
        ...(body.notes && { notes: body.notes }),
      },
      include: { items: true },
    });

    const order = raw as unknown as PrismaOrderResult;

    return NextResponse.json(
      {
        success: true,
        order: {
          ...order,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
