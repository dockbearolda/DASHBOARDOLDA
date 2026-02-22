/**
 * Global in-memory event emitter for real-time order notifications via SSE.
 *
 * Uses a global singleton to survive hot-reloads in development.
 * Works correctly on a single-instance deployment (Railway).
 */
import { EventEmitter } from "events";

declare global {
  // eslint-disable-next-line no-var
  var __orderEvents: EventEmitter | undefined;
}

const emitter = globalThis.__orderEvents ?? new EventEmitter();
emitter.setMaxListeners(200); // support many concurrent SSE clients
globalThis.__orderEvents = emitter;

export const orderEvents = emitter;
