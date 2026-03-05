import { createServer } from "http";
import { exec } from "child_process";
import path from "path";
import next from "next";
import { Server } from "socket.io";
import { setIO } from "./src/lib/socket-server";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handler = app.getRequestHandler();

// ── Backup automatique ─────────────────────────────────────────────────────────
// Lance le script shell backup-db.sh toutes les 4 heures.
// Premier backup au démarrage (après 60 s pour laisser la DB se stabiliser).

const BACKUP_SCRIPT = path.join(__dirname, "scripts", "backup-db.sh");
const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 h

function runBackup() {
  const env = {
    ...process.env,
    PGPASSWORD: process.env.PGPASSWORD ?? "dasholda",
    PGUSER:     process.env.PGUSER     ?? "dasholda",
    PGDATABASE: process.env.PGDATABASE ?? "dasholda",
    PGHOST:     process.env.PGHOST     ?? "localhost",
    PGPORT:     process.env.PGPORT     ?? "5432",
  };
  exec(`bash "${BACKUP_SCRIPT}"`, { env }, (err, stdout, stderr) => {
    if (err) {
      console.error("[backup] ❌ Échec :", err.message);
      if (stderr) console.error("[backup]", stderr.trim());
    } else {
      const lines = stdout.trim().split("\n");
      lines.forEach((l) => console.log(l));
    }
  });
}

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

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`> Serveur prêt sur http://0.0.0.0:${port}`);

    // Premier backup 60 s après démarrage
    setTimeout(runBackup, 60_000);

    // Backup toutes les 4 heures
    setInterval(runBackup, BACKUP_INTERVAL_MS);
    console.log("[backup] ⏱️  Backup automatique activé (toutes les 4 h)");
  });
});
