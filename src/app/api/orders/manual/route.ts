import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderEvents } from "@/lib/events";

// ── POST /api/orders/manual — création manuelle depuis l'UI ──────────────────

export async function POST() {
  const orderNumber = `MAN-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName:  "",
      customerEmail: "",
      status:        "COMMANDE_A_TRAITER",
      paymentStatus: "PENDING",
      total:         0,
      subtotal:      0,
    },
    include: { items: true },
  });

  orderEvents.emit("new-order", order);

  return NextResponse.json({ order }, { status: 201 });
}
