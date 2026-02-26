import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/orders/test — create a test order from the dashboard (no secret needed)
export async function POST() {
  const orderNumber = `TEST-${Date.now()}`;

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName:      "Dupont",
        customerFirstName: "Marie",
        customerEmail:     "marie.dupont@example.com",
        customerPhone:     "+33 6 12 34 56 78",
        status:            "COMMANDE_A_TRAITER",
        paymentStatus:     "PAID",
        total:             149.99,
        subtotal:          129.99,
        shipping:          9.90,
        tax:               10.10,
        currency:          "EUR",
        category:          "t-shirt",
        items: {
          create: [
            {
              famille:      "T-Shirt",
              couleur:      "Blanc",
              tailleDTF:    "A4",
              reference:    "TEST-001",
              taille:       "L",
              collection:   "Été 2025",
              imageAvant:   "bea-16-av-AV",
              imageArriere: "bea-16-av-AR",
              noteClient:   "Commande de test",
              prixUnitaire: 149.99,
            },
          ],
        },
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        deadline:  order.deadline?.toISOString() ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders/test error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create test order", detail: message }, { status: 500 });
  }
}
