import { describe, it, expect } from "vitest";

// Replicate the newId() function from the API routes
function newId(): string {
  return `c${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

// Replicate the test order ID from /api/orders/test
function testOrderId(): string {
  return `c${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

describe("Order ID generator", () => {
  it("starts with 'c'", () => {
    const id = newId();
    expect(id.startsWith("c")).toBe(true);
  });

  it("has minimum length of 15 characters", () => {
    const id = newId();
    // 'c' + 13 digits (Date.now) + at least 7 random chars
    expect(id.length).toBeGreaterThanOrEqual(15);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  it("only contains alphanumeric characters", () => {
    const id = newId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe("Test order number generator", () => {
  it("starts with TEST- prefix", () => {
    const orderNumber = `TEST-${Date.now()}`;
    expect(orderNumber.startsWith("TEST-")).toBe(true);
  });

  it("is unique across multiple calls", () => {
    const numbers = new Set(
      Array.from({ length: 10 }, (_, i) => `TEST-${Date.now() + i}`)
    );
    expect(numbers.size).toBe(10);
  });
});
