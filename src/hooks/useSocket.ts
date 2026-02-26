"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(handlers: Record<string, (data: unknown) => void>) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
