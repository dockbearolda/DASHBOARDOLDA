import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebhookOrderPayload } from "@/types/order";
import { orderEvents } from "@/lib/events";

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allows oldastudio to POST webhooks and the dashboard to call GET from any tab.

const ALLOWED_ORIGIN = "https://oldastudio.up.railway.app";

function corsHeaders(request?: NextRequest): Record<string, string> {
  // Mirror the exact origin sent by the client when it is the allowed domain,
  // otherwise fall back to the constant (handles direct server-to-server calls
  // that may not set Origin at all).
  const origin = request?.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Webhook-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

// OPTIONS /api/orders — CORS preflight (browser sends this before POST)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

// ── Webhook secret ────────────────────────────────────────────────────────────

function verifyToken(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_TOKEN;
  if (!secret) return true; // dev mode: allow all

  // Accept Authorization: Bearer <token> header (principal method used by oldastudio)
  const auth = request.headers.get("authorization");
  if (auth) {
    const spaceIdx = auth.indexOf(" ");
    const scheme = spaceIdx !== -1 ? auth.slice(0, spaceIdx).toLowerCase() : "";
    const token = spaceIdx !== -1 ? auth.slice(spaceIdx + 1) : "";
    if (scheme === "bearer" && token === secret) return true;
  }

  // Accept X-Webhook-Secret header as fallback
  const xSecret = request.headers.get("x-webhook-secret");
  if (xSecret === secret) return true;

  return false;
}

function newId(): string {
  return `c${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

// ── GET /api/orders — list all orders (for client-side refresh) ───────────────

export async function GET(request: NextRequest) {
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

    const mapped = orders.map((o: Record<string, unknown>) => {
      // Normalise items — json_agg may arrive as a raw JSON string.
      let items = o.items;
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (!Array.isArray(items)) items = [];

      return {
        ...o,
        items,
        createdAt:
          o.createdAt instanceof Date
            ? (o.createdAt as Date).toISOString()
            : o.createdAt,
        updatedAt:
          o.updatedAt instanceof Date
            ? (o.updatedAt as Date).toISOString()
            : o.updatedAt,
      };
    });

    return NextResponse.json({ orders: mapped }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// ── POST /api/orders — receive webhook from oldastudio ────────────────────────
// Maps legacy English status values to French (oldastudio may still send PENDING etc.)

const LEGACY_STATUS_MAP: Record<string, string> = {
  PENDING:    "COMMANDE_A_TRAITER",
  PROCESSING: "COMMANDE_A_PREPARER",
  SHIPPED:    "ARCHIVES",
  DELIVERED:  "ARCHIVES",
  CANCELLED:  "ARCHIVES",
  REFUNDED:   "ARCHIVES",
};

export async function POST(request: NextRequest) {
  console.log('--- NOUVELLE REQUÊTE REÇUE ---');
  console.log(
    `[OLDA] origin=${request.headers.get("origin") ?? "(none)"} ` +
    `content-type=${request.headers.get("content-type") ?? "(none)"} ` +
    `auth=${request.headers.get("authorization") ? "présent" : "absent"}`
  );

  const cors = corsHeaders(request);

  if (!verifyToken(request)) {
    console.warn("[OLDA] Requête rejetée : DASHBOARD_TOKEN invalide ou manquant.");
    return NextResponse.json(
      { error: "Unauthorized: invalid webhook secret" },
      { status: 401, headers: cors }
    );
  }

  let body: WebhookOrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: cors }
    );
  }

  const required = ["orderNumber", "customerName", "customerEmail", "total", "subtotal", "items"];
  const missing = required.filter((f) => !(f in body));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 422, headers: cors }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "items must be a non-empty array" },
      { status: 422, headers: cors }
    );
  }

  // Guard against NaN/null numeric values that would crash the DB insert
  const safeNum = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // Normalise category: lowercase + trim  (e.g. "T-Shirt" → "t-shirt")
  const category = typeof body.category === "string"
    ? body.category.trim().toLowerCase()
    : "";

  const rawStatus = body.status ?? "COMMANDE_A_TRAITER";
  const mappedStatus = LEGACY_STATUS_MAP[rawStatus] ?? rawStatus;
  // T-shirt orders always start in COMMANDE_A_TRAITER — category field first
  // (reliable), item-name regex as fallback for sites that don't send category.
  const isTshirt =
    category === "t-shirt" || category === "tshirt" ||
    body.items.some((item) =>
      /t[-\s]?shirt|tee\b/i.test(typeof item.name === "string" ? item.name : "")
    );
  const status = isTshirt ? "COMMANDE_A_TRAITER" : mappedStatus;
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
          notes, category, "shippingAddress", "billingAddress", "updatedAt"
        ) VALUES (
          ${orderId},
          ${body.orderNumber},
          ${body.customerName},
          ${body.customerEmail},
          ${body.customerPhone ?? null},
          ${status}::"OrderStatus",
          ${paymentStatus}::"PaymentStatus",
          ${safeNum(body.total)},
          ${safeNum(body.subtotal)},
          ${safeNum(body.shipping)},
          ${safeNum(body.tax)},
          ${body.currency ?? "EUR"},
          ${body.notes ?? null},
          ${category},
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
            ${itemId}, ${orderId}, ${String(item.name ?? "")}, ${item.sku ?? null},
            ${safeNum(item.quantity, 1)}, ${safeNum(item.price)}, ${item.imageUrl ?? null}
          )
        `;
      }
    }

    // Read back the created/updated order — include ALL item fields so SSE
    // clients receive a complete payload (imageUrl needed for Carte Totale visuals).
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT o.*, COALESCE(json_agg(
        json_build_object(
          'id', i.id, 'orderId', i."orderId", 'name', i.name,
          'sku', i.sku, 'quantity', i.quantity, 'price', i.price, 'imageUrl', i."imageUrl"
        ) ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items i ON i."orderId" = o.id
      WHERE o.id = ${orderId}
      GROUP BY o.id
    `;
    const order = rows[0];

    const formattedOrder = {
      ...order,
      createdAt:
        order.createdAt instanceof Date
          ? (order.createdAt as Date).toISOString()
          : order.createdAt,
      updatedAt:
        order.updatedAt instanceof Date
          ? (order.updatedAt as Date).toISOString()
          : order.updatedAt,
    };

    // Push real-time notification to SSE clients only for brand-new orders
    if (existing.length === 0) {
      console.log(`Commande insérée en base ID: ${orderId}`);
      orderEvents.emit("new-order", formattedOrder);
      console.log(`[OLDA] Nouvelle commande créée : #${body.orderNumber} (status=${status}, category="${category || "(none)"}")`);
    } else {
      console.log(`[OLDA] Commande mise à jour : #${body.orderNumber} (id=${orderId})`);
    }

    return NextResponse.json(
      { success: true, order: formattedOrder },
      { status: 200, headers: cors }
    );
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to create order", detail: message },
      { status: 500, headers: cors }
    );
  }
}
