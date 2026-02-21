import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replicate the webhook secret verification logic from /api/orders/route.ts
function verifyWebhookSecret(
  secret: string | undefined,
  headerValue: string | null
): boolean {
  if (!secret) return true; // dev mode: allow all
  return headerValue === secret;
}

describe("Webhook secret verification", () => {
  it("allows all requests when WEBHOOK_SECRET is not set", () => {
    expect(verifyWebhookSecret(undefined, null)).toBe(true);
    expect(verifyWebhookSecret(undefined, "anything")).toBe(true);
    expect(verifyWebhookSecret("", null)).toBe(true);
  });

  it("rejects request when secret is set but header is missing", () => {
    expect(verifyWebhookSecret("mysecret", null)).toBe(false);
  });

  it("rejects request when header does not match secret", () => {
    expect(verifyWebhookSecret("mysecret", "wrongsecret")).toBe(false);
  });

  it("accepts request when header matches secret exactly", () => {
    expect(verifyWebhookSecret("mysecret", "mysecret")).toBe(true);
  });

  it("is case-sensitive", () => {
    expect(verifyWebhookSecret("MySecret", "mysecret")).toBe(false);
    expect(verifyWebhookSecret("mysecret", "MySecret")).toBe(false);
  });
});

describe("Webhook secret — environment variable simulation", () => {
  const originalEnv = process.env.WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.WEBHOOK_SECRET;
    }
  });

  it("allows all in dev mode (no WEBHOOK_SECRET)", () => {
    const secret = process.env.WEBHOOK_SECRET;
    expect(verifyWebhookSecret(secret, null)).toBe(true);
  });

  it("enforces secret when WEBHOOK_SECRET is set", () => {
    process.env.WEBHOOK_SECRET = "prod-secret-xyz";
    const secret = process.env.WEBHOOK_SECRET;
    expect(verifyWebhookSecret(secret, null)).toBe(false);
    expect(verifyWebhookSecret(secret, "wrong")).toBe(false);
    expect(verifyWebhookSecret(secret, "prod-secret-xyz")).toBe(true);
  });
});
