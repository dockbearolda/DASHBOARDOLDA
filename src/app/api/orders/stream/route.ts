/**
 * GET /api/orders/stream
 *
 * Server-Sent Events endpoint.  Clients connect once and receive `new-order`
 * events whenever a webhook creates a fresh order, without polling.
 *
 * A heartbeat comment (": heartbeat") is sent every 25 s so the connection
 * stays alive through proxies / load-balancers.
 */
import { orderEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // ── Initial "connected" event ────────────────────────────────────────
      controller.enqueue(
        encoder.encode("event: connected\ndata: {}\n\n")
      );

      // ── Heartbeat every 25 s ─────────────────────────────────────────────
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // ── New-order push ───────────────────────────────────────────────────
      const onNewOrder = (order: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: new-order\ndata: ${JSON.stringify(order)}\n\n`
            )
          );
        } catch {
          // Connection already closed — ignore.
        }
      };

      orderEvents.on("new-order", onNewOrder);

      // ── Cleanup on disconnect ─────────────────────────────────────────────
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        orderEvents.off("new-order", onNewOrder);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx / Railway buffering
    },
  });
}
