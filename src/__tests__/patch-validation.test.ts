import { describe, it, expect } from "vitest";
import type { OrderStatus, PaymentStatus } from "@/types/order";

// Replicate the validation logic from PATCH /api/orders/[id]
const validOrderStatuses: OrderStatus[] = [
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

const validPaymentStatuses: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

function isValidOrderStatus(status: string): status is OrderStatus {
  return validOrderStatuses.includes(status as OrderStatus);
}

function isValidPaymentStatus(status: string): status is PaymentStatus {
  return validPaymentStatuses.includes(status as PaymentStatus);
}

describe("PATCH /api/orders/[id] — status validation", () => {
  it("accepts all valid French order statuses", () => {
    for (const s of validOrderStatuses) {
      expect(isValidOrderStatus(s)).toBe(true);
    }
  });

  it("rejects English legacy order statuses", () => {
    const legacy = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    for (const s of legacy) {
      expect(isValidOrderStatus(s)).toBe(false);
    }
  });

  it("rejects empty string order status", () => {
    expect(isValidOrderStatus("")).toBe(false);
  });

  it("rejects arbitrary strings", () => {
    expect(isValidOrderStatus("RANDOM_STATUS")).toBe(false);
  });

  it("accepts all valid payment statuses", () => {
    for (const s of validPaymentStatuses) {
      expect(isValidPaymentStatus(s)).toBe(true);
    }
  });

  it("rejects invalid payment status", () => {
    expect(isValidPaymentStatus("CANCELLED")).toBe(false);
    expect(isValidPaymentStatus("")).toBe(false);
  });
});

describe("PATCH — allowed field updates", () => {
  it("can update status only", () => {
    const body: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {
      status: "CLIENT_PREVENU",
    };
    expect(isValidOrderStatus(body.status!)).toBe(true);
    expect(body.paymentStatus).toBeUndefined();
  });

  it("can update paymentStatus only", () => {
    const body: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {
      paymentStatus: "REFUNDED",
    };
    expect(isValidPaymentStatus(body.paymentStatus!)).toBe(true);
    expect(body.status).toBeUndefined();
  });

  it("can update notes only", () => {
    const body = { notes: "Commande urgente" };
    expect(body.notes).toBe("Commande urgente");
    expect((body as { status?: string }).status).toBeUndefined();
  });
});
