import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/orders/test — create a test order from the dashboard (no secret needed)
export async function POST() {
  const orderNumber = `TEST-${Date.now()}`;

  // Diagnostic: try a raw SQL insert first to verify DB schema
  try {
    await prisma.$executeRaw`
      INSERT INTO orders (id, "orderNumber", "customerName", "customerEmail", total, subtotal, "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${orderNumber + "-RAW"},
        'Test Raw',
        'test@test.com',
        1.0,
        1.0,
        NOW()
      )
    `;
    // Raw insert worked — clean it up
    await prisma.$executeRaw`DELETE FROM orders WHERE "orderNumber" = ${orderNumber + "-RAW"}`;
  } catch (rawError) {
    const rawMsg = rawError instanceof Error ? rawError.message : String(rawError);
    return NextResponse.json(
      { error: "DB raw insert failed — schema mismatch", detail: rawMsg },
      { status: 500 }
    );
  }

  // Now try Prisma ORM create
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Prisma ORM create failed (raw SQL worked)", detail: message },
      { status: 500 }
    );
  }
}
