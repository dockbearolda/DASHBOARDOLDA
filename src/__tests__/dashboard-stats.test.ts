import { describe, it, expect } from "vitest";
import type { Order, OrderStatus, PaymentStatus } from "@/types/order";

// Replicate the stats computation from /app/dashboard/page.tsx
function computeStats(orders: Pick<Order, "status" | "paymentStatus" | "total">[]) {
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === "COMMANDE_A_TRAITER").length;
  const shippedOrders = orders.filter((o) => o.status === "CLIENT_PREVENU").length;
  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID").length;
  return { totalRevenue, pendingOrders, shippedOrders, paidOrders };
}

function makeOrder(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  total = 100
): Pick<Order, "status" | "paymentStatus" | "total"> {
  return { status, paymentStatus, total };
}

describe("Dashboard stats computation", () => {
  it("returns zero stats for empty order list", () => {
    const stats = computeStats([]);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.pendingOrders).toBe(0);
    expect(stats.shippedOrders).toBe(0);
    expect(stats.paidOrders).toBe(0);
  });

  it("counts COMMANDE_A_TRAITER as pending orders", () => {
    const orders = [
      makeOrder("COMMANDE_A_TRAITER", "PENDING"),
      makeOrder("COMMANDE_A_TRAITER", "PAID"),
      makeOrder("EN_COURS_IMPRESSION", "PAID"),
    ];
    const stats = computeStats(orders);
    expect(stats.pendingOrders).toBe(2);
  });

  it("does NOT count PENDING (English) as pending orders", () => {
    // Ensures we don't regress to old English enum values
    const orders = [makeOrder("COMMANDE_EN_ATTENTE", "PENDING")];
    const stats = computeStats(orders);
    expect(stats.pendingOrders).toBe(0); // COMMANDE_EN_ATTENTE is not COMMANDE_A_TRAITER
  });

  it("counts CLIENT_PREVENU as shipped orders", () => {
    const orders = [
      makeOrder("CLIENT_PREVENU", "PAID"),
      makeOrder("CLIENT_PREVENU", "PAID"),
      makeOrder("COMMANDE_A_TRAITER", "PENDING"),
    ];
    const stats = computeStats(orders);
    expect(stats.shippedOrders).toBe(2);
  });

  it("counts PAID payment status correctly", () => {
    const orders = [
      makeOrder("COMMANDE_A_TRAITER", "PAID", 50),
      makeOrder("EN_COURS_IMPRESSION", "PAID", 75),
      makeOrder("ARCHIVES", "PENDING", 30),
    ];
    const stats = computeStats(orders);
    expect(stats.paidOrders).toBe(2);
  });

  it("sums total revenue across all orders", () => {
    const orders = [
      makeOrder("COMMANDE_A_TRAITER", "PAID", 149.99),
      makeOrder("EN_COURS_IMPRESSION", "PAID", 89.50),
      makeOrder("ARCHIVES", "REFUNDED", 0),
    ];
    const stats = computeStats(orders);
    expect(stats.totalRevenue).toBeCloseTo(239.49, 2);
  });

  it("all status types are counted correctly", () => {
    const allStatuses: OrderStatus[] = [
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
    const orders = allStatuses.map((s) => makeOrder(s, "PENDING", 10));
    const stats = computeStats(orders);
    expect(stats.totalRevenue).toBeCloseTo(allStatuses.length * 10, 2);
    expect(stats.pendingOrders).toBe(1); // only COMMANDE_A_TRAITER
    expect(stats.shippedOrders).toBe(1); // only CLIENT_PREVENU
    expect(stats.paidOrders).toBe(0);    // all PENDING payment
  });
});
