/**
 * GET /api/notes/stream
 *
 * Server-Sent Events endpoint.  Clients connect once and receive `note-changed`
 * events whenever any person's notes are updated via PATCH /api/notes/[person].
 *
 * Payload : { person, content, todos }
 *
 * A heartbeat comment (": heartbeat") is sent every 25 s so the connection
 * stays alive through proxies / load-balancers.
 */
import { noteEvents } from "@/lib/events";

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

      // ── Note-changed push ────────────────────────────────────────────────
      const onNoteChanged = (note: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: note-changed\ndata: ${JSON.stringify(note)}\n\n`
            )
          );
        } catch {
          // Connection already closed — ignore.
        }
      };

      noteEvents.on("note-changed", onNoteChanged);

      // ── Cleanup on disconnect ─────────────────────────────────────────────
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        noteEvents.off("note-changed", onNoteChanged);
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
