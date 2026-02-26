import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setIO } from "./src/lib/socket-server";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  setIO(io);

  io.on("connection", (socket) => {
    console.log("[Socket.io] Client connecté:", socket.id);
    socket.on("disconnect", () =>
      console.log("[Socket.io] Client déconnecté:", socket.id)
    );
  });

  httpServer.listen(port, "0.0.0.0", () =>
    console.log(`> Serveur prêt sur http://0.0.0.0:${port}`)
  );
});
