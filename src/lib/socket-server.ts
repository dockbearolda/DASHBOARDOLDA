import type { Server } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var __io: Server | undefined;
}

export function setIO(io: Server) {
  globalThis.__io = io;
}

export function broadcast(event: string, data: unknown) {
  globalThis.__io?.emit(event, data);
}
