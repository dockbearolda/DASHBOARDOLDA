import { describe, it, expect } from "vitest";
import type { OrderStatus, PaymentStatus, Order } from "@/types/order";

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

describe("Order type (nouveau schéma panier multi-articles)", () => {
  const sampleOrder: Order = {
    id: "c1234567890abc",
    orderNumber: "CMD-001",
    customerName: "DUPONT",
    customerFirstName: "Marie",
    customerEmail: "olda@studio",
    customerPhone: "+33 6 12 34 56 78",
    status: "COMMANDE_A_TRAITER",
    paymentStatus: "PAID",
    total: 149.99,
    subtotal: 149.99,
    shipping: 0,
    tax: 0,
    currency: "EUR",
    notes: null,
    deadline: new Date("2025-03-15").toISOString(),
    items: [
      {
        id: "item1",
        orderId: "c1234567890abc",
        famille: "T-Shirt",
        couleur: "Blanc",
        tailleDTF: "A4",
        reference: "H-001",
        taille: "L",
        collection: "Homme Été",
        imageAvant: "bea-16-av-AV",
        imageArriere: "bea-16-av-AR",
        noteClient: "Pas de logo sur la manche",
        prixUnitaire: 149.99,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("has required fields", () => {
    expect(sampleOrder.id).toBeTruthy();
    expect(sampleOrder.orderNumber).toBeTruthy();
    expect(sampleOrder.customerName).toBeTruthy();
    expect(sampleOrder.total).toBeGreaterThan(0);
  });

  it("has customerFirstName (prénom séparé)", () => {
    expect(sampleOrder.customerFirstName).toBe("Marie");
  });

  it("has deadline field", () => {
    expect(sampleOrder.deadline).toBeTruthy();
  });

  it("items array is non-empty", () => {
    expect(sampleOrder.items.length).toBeGreaterThan(0);
  });

  it("items have new rich fields (famille, couleur, tailleDTF…)", () => {
    const item = sampleOrder.items[0];
    expect(item.famille).toBe("T-Shirt");
    expect(item.couleur).toBe("Blanc");
    expect(item.tailleDTF).toBe("A4");
    expect(item.imageAvant).toBe("bea-16-av-AV");
    expect(item.imageArriere).toBe("bea-16-av-AR");
    expect(item.noteClient).toBe("Pas de logo sur la manche");
    expect(item.prixUnitaire).toBe(149.99);
  });

  it("status is a valid OrderStatus", () => {
    expect(ORDER_STATUSES).toContain(sampleOrder.status);
  });

  it("paymentStatus is a valid PaymentStatus", () => {
    expect(PAYMENT_STATUSES).toContain(sampleOrder.paymentStatus);
  });
});
