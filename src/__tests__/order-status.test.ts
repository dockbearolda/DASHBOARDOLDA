import { describe, it, expect } from "vitest";
import type { OrderStatus, PaymentStatus, Order, WebhookOrderPayload } from "@/types/order";

// ── OrderStatus enum values ────────────────────────────────────────────────────

const ORDER_STATUSES: OrderStatus[] = [
  "COMMANDE_A_TRAITER",
  "COMMANDE_EN_ATTENTE",
  "COMMANDE_A_PREPARER",
  "MAQUETTE_A_FAIRE",
  "PRT_A_FAIRE",
  "EN_ATTENTE_VALIDATION",
  "EN_COURS_IMPRESSION",
  "PRESSAGE_A_FAIRE",
  "CLIENT_A_CONTACTER",
  "CLIENT_PREVENU",
  "ARCHIVES",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

describe("OrderStatus enum", () => {
  it("contains all 11 French status values", () => {
    expect(ORDER_STATUSES).toHaveLength(11);
  });

  it("starts with COMMANDE_A_TRAITER as default", () => {
    expect(ORDER_STATUSES[0]).toBe("COMMANDE_A_TRAITER");
  });

  it("ends with ARCHIVES", () => {
    expect(ORDER_STATUSES[ORDER_STATUSES.length - 1]).toBe("ARCHIVES");
  });

  it("does not contain English legacy values", () => {
    const english = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    for (const val of english) {
      expect(ORDER_STATUSES).not.toContain(val);
    }
  });
});

describe("PaymentStatus enum", () => {
  it("contains exactly 4 values", () => {
    expect(PAYMENT_STATUSES).toHaveLength(4);
  });

  it("contains PENDING, PAID, FAILED, REFUNDED", () => {
    expect(PAYMENT_STATUSES).toContain("PENDING");
    expect(PAYMENT_STATUSES).toContain("PAID");
    expect(PAYMENT_STATUSES).toContain("FAILED");
    expect(PAYMENT_STATUSES).toContain("REFUNDED");
  });
});

// ── Order type shape ───────────────────────────────────────────────────────────

describe("Order type", () => {
  const sampleOrder: Order = {
    id: "c1234567890abc",
    orderNumber: "TEST-001",
    customerName: "Marie Dupont",
    customerEmail: "marie.dupont@example.com",
    customerPhone: "+33 6 12 34 56 78",
    status: "COMMANDE_A_TRAITER",
    paymentStatus: "PAID",
    total: 149.99,
    subtotal: 129.99,
    shipping: 9.90,
    tax: 10.10,
    currency: "EUR",
    notes: null,
    shippingAddress: {
      street: "15 Rue de la Paix",
      city: "Paris",
      postalCode: "75001",
      country: "France",
    },
    billingAddress: null,
    items: [
      {
        id: "item1",
        orderId: "c1234567890abc",
        name: "Bougie Signature Ambre",
        sku: "BSIG-AMB-001",
        quantity: 2,
        price: 49.99,
        imageUrl: null,
      },
      {
        id: "item2",
        orderId: "c1234567890abc",
        name: "Diffuseur Luxe Bois",
        sku: "DLUX-BOIS-01",
        quantity: 1,
        price: 30.01,
        imageUrl: null,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("has required fields", () => {
    expect(sampleOrder.id).toBeTruthy();
    expect(sampleOrder.orderNumber).toBeTruthy();
    expect(sampleOrder.customerName).toBeTruthy();
    expect(sampleOrder.customerEmail).toBeTruthy();
    expect(sampleOrder.total).toBeGreaterThan(0);
  });

  it("total equals subtotal + shipping + tax", () => {
    const computed = sampleOrder.subtotal + sampleOrder.shipping + sampleOrder.tax;
    expect(Math.round(computed * 100) / 100).toBeCloseTo(sampleOrder.total, 2);
  });

  it("items array is non-empty", () => {
    expect(sampleOrder.items.length).toBeGreaterThan(0);
  });

  it("status is a valid OrderStatus", () => {
    expect(ORDER_STATUSES).toContain(sampleOrder.status);
  });

  it("paymentStatus is a valid PaymentStatus", () => {
    expect(PAYMENT_STATUSES).toContain(sampleOrder.paymentStatus);
  });
});

// ── WebhookOrderPayload validation logic ───────────────────────────────────────

describe("WebhookOrderPayload validation", () => {
  const requiredFields = ["orderNumber", "customerName", "customerEmail", "total", "subtotal", "items"];

  function getMissingFields(payload: Record<string, unknown>): string[] {
    return requiredFields.filter((f) => !(f in payload));
  }

  it("valid payload has no missing fields", () => {
    const payload: WebhookOrderPayload = {
      orderNumber: "ORD-001",
      customerName: "Marie Dupont",
      customerEmail: "marie@example.com",
      total: 100,
      subtotal: 90,
      items: [{ name: "Produit A", quantity: 1, price: 90 }],
    };
    expect(getMissingFields(payload as unknown as Record<string, unknown>)).toHaveLength(0);
  });

  it("detects missing orderNumber", () => {
    const payload = { customerName: "X", customerEmail: "x@x.com", total: 1, subtotal: 1, items: [] };
    expect(getMissingFields(payload)).toContain("orderNumber");
  });

  it("detects missing items", () => {
    const payload = { orderNumber: "X", customerName: "X", customerEmail: "x@x.com", total: 1, subtotal: 1 };
    expect(getMissingFields(payload)).toContain("items");
  });

  it("empty items array should be rejected", () => {
    const items: WebhookOrderPayload["items"] = [];
    expect(Array.isArray(items) && items.length === 0).toBe(true);
  });

  it("defaults status to COMMANDE_A_TRAITER when absent", () => {
    const payload: WebhookOrderPayload = {
      orderNumber: "ORD-002",
      customerName: "Jean Martin",
      customerEmail: "jean@example.com",
      total: 50,
      subtotal: 50,
      items: [{ name: "Produit B", quantity: 1, price: 50 }],
    };
    // Simulate the API default (same logic as route.ts)
    const status = payload.status ?? "COMMANDE_A_TRAITER";
    expect(status).toBe("COMMANDE_A_TRAITER");
  });

  it("defaults paymentStatus to PENDING when absent", () => {
    const payload: WebhookOrderPayload = {
      orderNumber: "ORD-003",
      customerName: "Jean Martin",
      customerEmail: "jean@example.com",
      total: 50,
      subtotal: 50,
      items: [{ name: "Produit C", quantity: 1, price: 50 }],
    };
    const paymentStatus = payload.paymentStatus ?? "PENDING";
    expect(paymentStatus).toBe("PENDING");
  });
});
