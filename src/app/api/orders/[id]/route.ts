import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, PaymentStatus } from "@/types/order";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/orders/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/orders/[id] — update status
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: { status?: OrderStatus; paymentStatus?: PaymentStatus; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validOrderStatuses: OrderStatus[] = [
    "COMMANDE_A_TRAITER", "COMMANDE_EN_ATTENTE", "COMMANDE_A_PREPARER", "MAQUETTE_A_FAIRE",
    "PRT_A_FAIRE", "EN_ATTENTE_VALIDATION", "EN_COURS_IMPRESSION",
    "PRESSAGE_A_FAIRE", "CLIENT_A_CONTACTER", "CLIENT_PREVENU", "ARCHIVES",
  ];
  const validPaymentStatuses: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

  if (body.status && !validOrderStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 422 });
  }

  if (body.paymentStatus && !validPaymentStatuses.includes(body.paymentStatus)) {
    return NextResponse.json({ error: "Invalid payment status" }, { status: 422 });
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.paymentStatus && { paymentStatus: body.paymentStatus }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/orders/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
