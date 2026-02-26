/**
 * Global in-memory event emitters for real-time notifications via SSE.
 *
 * Uses global singletons to survive hot-reloads in development.
 * Works correctly on a single-instance deployment (Railway).
 *
 *  orderEvents — new-order     : new Shopify order received via webhook
 *  noteEvents  — note-changed  : a person-note was updated (PATCH /api/notes/[person])
 */
import { EventEmitter } from "events";

declare global {
  // eslint-disable-next-line no-var
  var __orderEvents: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __noteEvents:  EventEmitter | undefined;
}

// ── Orders ────────────────────────────────────────────────────────────────────
const orders = globalThis.__orderEvents ?? new EventEmitter();
orders.setMaxListeners(200);
globalThis.__orderEvents = orders;

export const orderEvents = orders;

// ── Notes ─────────────────────────────────────────────────────────────────────
const notes = globalThis.__noteEvents ?? new EventEmitter();
notes.setMaxListeners(200);
globalThis.__noteEvents = notes;

export const noteEvents = notes;
