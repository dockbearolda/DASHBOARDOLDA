import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/orders/test — create a test order from the dashboard (no secret needed)
export async function POST() {
  const orderNumber = `TEST-${Date.now()}`;

  try {
    const raw = await prisma.order.create({
      data: {
        orderNumber,
        customerName: "Marie Dupont",
        customerEmail: "marie.dupont@example.com",
        customerPhone: "+33 6 12 34 56 78",
        total: 149.99,
        subtotal: 129.99,
        shipping: 9.9,
        tax: 10.1,
        currency: "EUR",
        shippingAddress: {
          street: "15 Rue de la Paix",
          city: "Paris",
          postalCode: "75001",
          country: "France",
        },
        items: {
          create: [
            { name: "Bougie Signature Ambre", sku: "BSIG-AMB-001", quantity: 2, price: 49.99 },
            { name: "Diffuseur Luxe Bois", sku: "DLUX-BOIS-01", quantity: 1, price: 30.01 },
          ],
        },
      },
      include: { items: true },
    });

    return NextResponse.json(
      {
        success: true,
        order: {
          ...raw,
          createdAt: raw.createdAt.toISOString(),
          updatedAt: raw.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders/test error:", error);
    return NextResponse.json({ error: "Failed to create test order" }, { status: 500 });
  }
}
