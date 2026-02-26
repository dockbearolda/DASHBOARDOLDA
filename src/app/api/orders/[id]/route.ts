import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentStatus } from "@/types/order";

interface Params {
  params: Promise<{ id: string }>;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function fetchOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return null;
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deadline:  order.deadline?.toISOString() ?? null,
  };
}

// ── GET /api/orders/[id] ──────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const order = await fetchOrder(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH /api/orders/[id] ────────────────────────────────────────────────────
// Gère : status, paymentStatus, notes, customerName, customerPhone,
//        firstItemTailleDTF (mise à jour du 1er article)

const VALID_STATUSES: OrderStatus[] = [
  "COMMANDE_A_TRAITER", "COMMANDE_EN_ATTENTE", "COMMANDE_A_PREPARER",
  "MAQUETTE_A_FAIRE", "PRT_A_FAIRE", "EN_ATTENTE_VALIDATION",
  "EN_COURS_IMPRESSION", "PRESSAGE_A_FAIRE", "CLIENT_A_CONTACTER",
  "CLIENT_PREVENU", "ARCHIVES",
];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    notes?: string;
    customerName?: string;
    customerPhone?: string;
    firstItemTailleDTF?: string; // Mise à jour tailleDTF du 1er article
  };

  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.status && !VALID_STATUSES.includes(body.status))
    return NextResponse.json({ error: "Invalid order status" }, { status: 422 });
  if (body.paymentStatus && !VALID_PAYMENT_STATUSES.includes(body.paymentStatus))
    return NextResponse.json({ error: "Invalid payment status" }, { status: 422 });

  try {
    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(body.status        ? { status:        body.status }        : {}),
        ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}),
        ...(body.notes         !== undefined ? { notes:        body.notes }        : {}),
        ...(body.customerName  ? { customerName:  body.customerName }  : {}),
        ...(body.customerPhone !== undefined ? { customerPhone: body.customerPhone } : {}),
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    // Patch tailleDTF du premier article si demandé
    if (body.firstItemTailleDTF !== undefined && updated.items.length > 0) {
      await prisma.orderItem.update({
        where: { id: updated.items[0].id },
        data:  { tailleDTF: body.firstItemTailleDTF },
      });
    }

    const order = await fetchOrder(id);
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/orders/[id] ───────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    // P2025 = record not found
    const code = (error as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
