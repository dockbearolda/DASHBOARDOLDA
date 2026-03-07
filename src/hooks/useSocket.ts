"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(handlers: Record<string, (data: unknown) => void>) {
  const socketRef = useRef<Socket | null>(null);

  // Toujours pointer vers les handlers les plus récents sans redéconnecter
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // On enregistre des wrappers stables qui délèguent au handler courant
    Object.keys(handlersRef.current).forEach((event) => {
      socket.on(event, (data) => handlersRef.current[event]?.(data));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
