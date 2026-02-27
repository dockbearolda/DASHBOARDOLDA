"use client";

/**
 * OldaBoard — Light mode only. Zero dark: variants.
 *
 * Hierarchy:
 *   ┌─ sticky header ─ RemindersGrid (4 person cards) ───────────────┐
 *   ├─ hero (title + live indicator) ────────────────────────────────┤
 *   ├─ tabs: Tshirt | Tasse (soon) | Accessoire (soon) ──────────────┤
 *   └─ workspace: single kanban grid, ALL columns use OrderCard ─────────┘
 */

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { Order, OrderStatus, WorkflowItem } from "@/types/order";
import { Inbox, Pencil, Layers, Phone, RefreshCw, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteData, TodoItem } from "./person-note-modal";
import { RemindersGrid } from "./reminders-grid";
import { OrderCard } from "./order-card";
import { DTFProductionTable } from "./dtf-production-table";
import { WorkflowListsGrid } from "./workflow-list";
import { PRTManager } from "./prt-manager";
import { PlanningTable, type PlanningItem } from "./planning-table";

interface PRTItem {
  id: string;
  clientName: string;
  dimensions: string;
  design: string;
  color: string;
  quantity: number;
  done: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}


// ════════════════════════════════════════════════════════════════════
//  SYSTÈME DE SESSION TEMPORELLE  (Morning & Afternoon Reset)
//
//  La session est enregistrée dans localStorage avec l'heure de connexion.
//  Deux créneaux de travail :
//    · Nuit   : 00h00–06h59  →  expire à 07h00 le même matin
//    · Matin  : 07h00–12h59  →  expire à 13h00 le même jour
//    · Après  : 13h00–23h59  →  expire à 07h00 le lendemain
//
//  Le champ session.name est la clé utilisée par /api/notes/${name}
//  pour l'attribution des tâches — ne pas le modifier sans mettre à
//  jour les routes notes en conséquence.
// ════════════════════════════════════════════════════════════════════

const SESSION_KEY = "olda_session";

interface OldaSession {
  /** Clé de la personne active : "loic" | "charlie" | "melina" | "amandine" */
  name: string;
  /** ISO 8601 — timestamp exact de connexion */
  loginAt: string;
}

/** Retourne le timestamp d'expiration selon le créneau de connexion. */
function getExpiryTs(loginAt: Date): number {
  const h = loginAt.getHours();
  const d = new Date(loginAt);
  if (h < 7) {
    d.setHours(7, 0, 0, 0);          // nuit → expire à 07h00 ce matin
  } else if (h < 13) {
    d.setHours(13, 0, 0, 0);         // matin → expire à 13h00
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);          // après-midi → expire à 07h00 demain
  }
  return d.getTime();
}

function readSession(): OldaSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OldaSession) : null;
  } catch { return null; }
}

function isSessionExpired(s: OldaSession): boolean {
  return Date.now() >= getExpiryTs(new Date(s.loginAt));
}

function saveSession(name: string): OldaSession {
  const s: OldaSession = { name, loginAt: new Date().toISOString() };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* quota */ }
  return s;
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// Noms affichés dans l'écran de connexion (ordre = ordre PEOPLE)
const PERSON_DISPLAY: [string, string][] = [
  ["loic",     "Loïc"],
  ["charlie",  "Charlie"],
  ["melina",   "Mélina"],
  ["amandine", "Amandine"],
];

// ── Écran de connexion glassmorphism ──────────────────────────────────────────

function LoginScreen({ onLogin, wasExpired }: { onLogin: (name: string) => void; wasExpired: boolean }) {
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{
        background: "linear-gradient(160deg, #f5f5f7 0%, #eaeaf0 60%, #dfe3ea 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.85)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.09), 0 1px 0 rgba(255,255,255,0.9) inset",
          borderRadius: 32,
          padding: "36px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo mark */}
        <div style={{
          width: 52, height: 52, borderRadius: 15, flexShrink: 0,
          background: "linear-gradient(145deg, #2c2c2e, #1d1d1f)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.06) inset",
          fontSize: 22, color: "#fff",
        }}>
          ✦
        </div>

        {/* Titre */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "#8e8e93", marginBottom: 8 }}>
            OLDA Studio
          </p>
          <p style={{ fontSize: 17, fontWeight: 600, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 4 }}>
            {wasExpired ? "Nouvelle session de travail." : "Bonjour !"}
          </p>
          <p style={{ fontSize: 15, color: "#6e6e73" }}>
            Quel est votre nom ?
          </p>
        </div>

        {/* Grille 2×2 de noms */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
          {PERSON_DISPLAY.map(([key, label]) => (
            <button
              key={key}
              onClick={() => onLogin(key)}
              style={{
                padding: "14px 8px",
                borderRadius: 16,
                border: "1.5px solid rgba(0,0,0,0.07)",
                background: "rgba(255,255,255,0.9)",
                fontSize: 15, fontWeight: 600, color: "#1d1d1f",
                cursor: "pointer", fontFamily: "inherit",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.04)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Heure discrète */}
        <p style={{ fontSize: 12, color: "#aeaeb2" }}>{now}</p>
      </div>
    </div>
  );
}

// ── Product type detection ─────────────────────────────────────────────────────

type ProductType = "tshirt" | "mug" | "other";

function detectProductType(order: Order): ProductType {
  const cat = (order.category ?? "").toLowerCase().replace(/[-_\s]/g, "");

  // Explicit mug check first
  if (cat === "mug" || cat === "tasse") return "mug";
  // Explicit tshirt check (covers "t-shirt", "tshirt", "t_shirt" after normalise)
  if (cat === "tshirt") return "tshirt";

  // Détection via la famille (typeProduit) des articles
  const items: Order["items"] = Array.isArray(order.items) ? order.items : [];
  const familles = items.map((i) => (i.famille ?? "").toLowerCase()).join(" ");
  if (/mug|tasse/.test(familles)) return "mug";

  // Default → tshirt. Every non-mug order on this board is a t-shirt order.
  // (When category is empty and item names are generic, we must not lose orders
  //  into the disabled "other" tab.)
  return "tshirt";
}

// ── Kanban column definitions ──────────────────────────────────────────────────

type KanbanCol = { status: OrderStatus; label: string; dot: string };

const TSHIRT_COLUMNS: KanbanCol[] = [
  { status: "COMMANDE_A_TRAITER",    label: "Commande à traiter",  dot: "bg-blue-400" },
  { status: "COMMANDE_EN_ATTENTE",   label: "Urgence",             dot: "bg-red-400" },
  { status: "MAQUETTE_A_FAIRE",      label: "Maquette à faire",    dot: "bg-violet-400" },
  { status: "EN_ATTENTE_VALIDATION", label: "En attente client",   dot: "bg-amber-400" },
  { status: "PRT_A_FAIRE",           label: "À produire",          dot: "bg-orange-400" },
  { status: "EN_COURS_IMPRESSION",   label: "Production en cours", dot: "bg-indigo-400" },
  { status: "CLIENT_A_CONTACTER",    label: "Client à contacter",  dot: "bg-pink-400" },
  { status: "ARCHIVES",              label: "Archive / terminé",   dot: "bg-slate-300" },
];

// ── People (for reminders grid key mapping) ────────────────────────────────────

const PEOPLE = [
  { key: "loic",     icon: Inbox  },
  { key: "charlie",  icon: Pencil },
  { key: "melina",   icon: Layers },
  { key: "amandine", icon: Phone  },
] as const;


// ── Kanban column ──────────────────────────────────────────────────────────────
// All columns use OrderCard (QR, customer info, items accordion).

function KanbanColumn({
  col,
  orders,
  newOrderIds,
  onDropOrder,
  onDeleteOrder,
}: {
  col: KanbanCol;
  orders: Order[];
  newOrderIds?: Set<string>;
  onDropOrder?: (orderId: string, newStatus: OrderStatus) => void;
  onDeleteOrder?: (orderId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  // ── Auto-scaling : mode compact si colonne dense ───────────────────────────
  const compact = orders.length > 5;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const orderId = e.dataTransfer.getData("orderId");
    if (orderId && onDropOrder) {
      onDropOrder(orderId, col.status);
    }
  };

  return (
    <div className="snap-start shrink-0 w-[88vw] sm:w-[80vw] md:w-[272px] flex flex-col gap-2">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", col.dot)} />
          <span className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {col.label}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[12px] font-semibold text-gray-500">
          {orders.length}
        </span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col p-2 rounded-xl transition-all",
          compact ? "gap-1.5" : "gap-3",
          isDragOver ? "bg-blue-50 border-2 border-blue-300 shadow-md" : "",
        )}
      >
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 h-14 flex items-center justify-center">
            <span className="text-[12px] text-gray-300">vide</span>
          </div>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("orderId", o.id);
              }}
              className="w-full cursor-grab active:cursor-grabbing"
            >
              <OrderCard
                order={o}
                isNew={newOrderIds?.has(o.id)}
                onDelete={onDeleteOrder ? () => onDeleteOrder(o.id) : undefined}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Kanban board (single tab workspace) ───────────────────────────────────────

function KanbanBoard({
  columns,
  orders,
  newOrderIds,
  onUpdateOrder,
  onDeleteOrder,
}: {
  columns: KanbanCol[];
  orders: Order[];
  newOrderIds?: Set<string>;
  onUpdateOrder?: (orderId: string, newStatus: OrderStatus) => void;
  onDeleteOrder?: (orderId: string) => void;
}) {
  const ordersByStatus = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const col of columns) map[col.status] = [];
    for (const order of orders) {
      if (map[order.status] !== undefined) map[order.status].push(order);
      else map[columns[0].status].push(order);
    }
    return map;
  }, [columns, orders]);

  const handleDropOrder = (orderId: string, newStatus: OrderStatus) => {
    if (onUpdateOrder) {
      onUpdateOrder(orderId, newStatus);
    }
    updateOrderStatus(orderId, newStatus);
  };

  return (
    <div className={cn(
      "w-full overflow-x-auto no-scrollbar pb-safe-6",
      "snap-x snap-mandatory md:snap-none",
    )}>
      <div className="flex gap-3 pb-4 w-max">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            col={col}
            orders={ordersByStatus[col.status] ?? []}
            newOrderIds={newOrderIds}
            onDropOrder={handleDropOrder}
            onDeleteOrder={onDeleteOrder}
          />
        ))}
      </div>
    </div>
  );
}

// ── Live indicator ─────────────────────────────────────────────────────────────

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        connected ? "bg-emerald-500 animate-pulse-dot" : "bg-gray-300"
      )} />
      <span className="text-[12px] text-gray-400">
        {connected ? "En direct" : "Hors ligne"}
      </span>
    </div>
  );
}

// ── Drag & Drop: Update order status ───────────────────────────────────────────

async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  try {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  } catch (err) {
    console.error("Failed to update order status:", err);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function OldaBoard({ orders: initialOrders }: { orders: Order[] }) {
  const [orders, setOrders]             = useState<Order[]>(initialOrders);
  const [newOrderIds, setNewOrderIds]   = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState(false);
  const [notes, setNotes]               = useState<Record<string, NoteData>>({});
  const [notesReady, setNotesReady]     = useState(false);
  const [viewTab, setViewTab] = useState<'flux' | 'commandes' | 'production_dtf' | 'workflow' | 'demande_prt' | 'planning'>('flux');
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [prtItems, setPrtItems] = useState<PRTItem[]>([]);
  const [allPrtItems, setAllPrtItems] = useState<PRTItem[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);

  const addOrder = async () => {
    const res = await fetch("/api/orders/manual", { method: "POST" });
    if (!res.ok) return;
    const { order } = await res.json();
    setOrders((prev) => [order, ...prev]);
    setViewTab("commandes");
  };

  // ── Session temporelle ────────────────────────────────────────────────────
  const [session, setSession]               = useState<OldaSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [wasExpired, setWasExpired]         = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef   = useRef(true);

  // ── New-order highlight (6 s) ──────────────────────────────────────────────

  const markNew = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNewOrderIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 6_000);
  }, []);

  // ── Full refresh ───────────────────────────────────────────────────────────

  const refreshOrders = useCallback(async () => {
    try {
      const res  = await fetch("/api/orders");
      const data = (await res.json()) as { orders: Order[] };
      const incoming = data.orders ?? [];
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const freshIds    = incoming.filter((o) => !existingIds.has(o.id)).map((o) => o.id);
        if (freshIds.length > 0) markNew(freshIds);
        return incoming;
      });
    } catch { /* ignore */ }
  }, [markNew]);

  // ── Fallback polling ───────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => { if (mountedRef.current) refreshOrders(); }, 5_000);
  }, [refreshOrders]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  // Lecture localStorage au montage (côté client uniquement)
  useEffect(() => {
    const s = readSession();
    if (s && !isSessionExpired(s)) {
      setSession(s);
    } else if (s) {
      // Session présente mais expirée → force re-connexion
      clearSession();
      setWasExpired(true);
    }
    setSessionChecked(true);
  }, []); // exécuté une seule fois au montage

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  // Vérification session + rechargement commandes au retour de mise en veille
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Priorité : vérifie l'expiration temporelle avant tout refresh
        const s = readSession();
        if (!s || isSessionExpired(s)) {
          clearSession();
          setWasExpired(true);
          setSession(null);
          return; // ne pas rafraîchir si session invalide
        }
        refreshOrders();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshOrders]);

  // Vérification périodique (60 s) — si l'onglet reste ouvert à cheval sur 07h00 ou 13h00
  useEffect(() => {
    const timer = setInterval(() => {
      const s = readSession();
      if (s && isSessionExpired(s)) {
        clearSession();
        setWasExpired(true);
        setSession(null);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []); // pas de dépendances — stable pour toute la durée du composant

  // ── SSE subscription ───────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        es = new EventSource("/api/orders/stream");
        es.addEventListener("connected", () => {
          if (!mountedRef.current) return;
          setSseConnected(true);
          stopPolling();
          refreshOrders();
        });
        es.addEventListener("new-order", (event) => {
          if (!mountedRef.current) return;
          try {
            const order = JSON.parse((event as MessageEvent).data) as Order;
            setOrders((prev) => {
              if (prev.find((o) => o.id === order.id)) return prev;
              markNew([order.id]);
              return [order, ...prev];
            });
            setTimeout(refreshOrders, 2_000);
          } catch { /* malformed */ }
        });
        es.onerror = () => {
          if (!mountedRef.current) return;
          setSseConnected(false);
          es?.close();
          startPolling();
          reconnectTimer = setTimeout(connect, 10_000);
        };
      } catch { startPolling(); }
    };

    connect();
    return () => {
      mountedRef.current = false;
      es?.close();
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [markNew, refreshOrders, startPolling, stopPolling]);

  // ── Person notes ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, NoteData> = {};
        for (const n of data.notes ?? []) {
          map[n.person] = {
            person:  n.person,
            content: n.content ?? "",
            todos:   Array.isArray(n.todos) ? (n.todos as TodoItem[]) : [],
          };
        }
        setNotes(map);
        setNotesReady(true);
      })
      .catch(() => {});
  }, []);

  // ── Workflow items ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/workflow-items")
      .then((r) => r.json())
      .then((data) => {
        setWorkflowItems(data.items ?? []);
      })
      .catch(() => {});
  }, []);

  // ── PRT items ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/prt-requests")
      .then((r) => r.json())
      .then((data) => {
        const items = data.items ?? [];
        setPrtItems(items);
        setAllPrtItems(items);
      })
      .catch(() => {});
  }, []);

  // ── Planning items ─────────────────────────────────────────────────────────
  // Chargement initial + polling de secours toutes les 10 s.
  // Le polling est suspendu pendant qu'une cellule est en cours d'édition
  // pour ne pas écraser la frappe de l'utilisateur.

  const planningEditingRef = useRef(false);

  const fetchPlanning = useCallback(() => {
    if (planningEditingRef.current) return; // pause while editing
    fetch("/api/planning")
      .then((r) => r.json())
      .then((data) => {
        if (planningEditingRef.current) return; // double-check au retour async
        setPlanningItems(data.items ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPlanning();
    const id = setInterval(fetchPlanning, 10_000);
    return () => clearInterval(id);
  }, [fetchPlanning]);

  // ── Connexion / Déconnexion ────────────────────────────────────────────────
  const handleLogin = useCallback((name: string) => {
    const s = saveSession(name);
    setSession(s);
    setWasExpired(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setWasExpired(false);
  }, []);

  // ── Suppression d'une commande (optimistic) ───────────────────────────────
  const handleDeleteOrder = useCallback(async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    } catch {
      refreshOrders();
    }
  }, [refreshOrders]);

  // ── Categorise orders ──────────────────────────────────────────────────────

  const tshirt = useMemo(
    () => orders.filter((o) => detectProductType(o) === "tshirt"),
    [orders]
  );

  const notesMap = Object.fromEntries(PEOPLE.map((p) => [p.key, notes[p.key]?.todos ?? []]));

  // Handle order status update (optimistic UI)
  const handleUpdateOrder = useCallback((orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Attend la lecture localStorage pour éviter un flash de l'écran de connexion
  if (!sessionChecked) return null;
  // Session absente ou expirée → écran glassmorphism
  if (!session) return <LoginScreen onLogin={handleLogin} wasExpired={wasExpired} />;

  return (
    <div
      className="flex flex-col h-svh w-full overflow-hidden bg-white"
      style={{ fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
    >

      {/* ── Header : tabs centrés · user à gauche · indicateur live à droite ─ */}
      <div className="shrink-0 px-4 sm:px-6 pt-5 pb-3 relative flex items-center justify-center border-b border-gray-100">
        {/* Tabs — centrés */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 overflow-x-auto">
            {(['flux', 'commandes', 'demande_prt', 'production_dtf', 'workflow', 'planning'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewTab(v)}
                className={cn(
                  "px-3.5 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all whitespace-nowrap",
                  "[touch-action:manipulation]",
                  viewTab === v
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {v === 'flux' ? 'Flux' : v === 'commandes' ? 'Commandes' : v === 'demande_prt' ? 'Demande de PRT' : v === 'production_dtf' ? 'Production' : v === 'workflow' ? 'Gestion d\'atelier' : 'Planning'}
              </button>
            ))}
          </div>
          {/* Bouton + commande — visible sur l'onglet commandes */}
          {viewTab === 'commandes' && (
            <button
              onClick={addOrder}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-150 shrink-0"
              aria-label="Ajouter une commande"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Utilisateur + déconnexion — positionné à gauche en absolu */}
        <div className="absolute left-4 sm:left-6">
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100/80 hover:bg-red-50 hover:border-red-100 border border-transparent transition-colors duration-150"
          >
            <span className="h-5 w-5 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-white leading-none select-none">
              {(PERSON_DISPLAY.find(([k]) => k === session.name)?.[1] ?? session.name).charAt(0).toUpperCase()}
            </span>
            <span className="text-[12px] font-semibold text-gray-600 group-hover:text-red-600 transition-colors duration-150 hidden sm:block">
              {PERSON_DISPLAY.find(([k]) => k === session.name)?.[1] ?? session.name}
            </span>
            <LogOut className="h-3 w-3 text-gray-400 group-hover:text-red-500 transition-colors duration-150" />
          </button>
        </div>

        {/* Indicateur live — positionné à droite en absolu */}
        <div className="absolute right-4 sm:right-6">
          <LiveIndicator connected={sseConnected} />
        </div>
      </div>

      {/* ── Contenu principal ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5">

        {/* ══ VUE FLUX — 4 cartes collaborateurs ══════════════════════════════ */}
        <div className={cn(viewTab !== 'flux' && 'hidden')}>
          <RemindersGrid key={String(notesReady)} notesMap={notesMap} activeUser={session.name} />
        </div>

        {/* ══ VUE COMMANDES — Kanban t-shirts uniquement ══════════════════════ */}
        <div className={cn(viewTab !== 'commandes' && 'hidden')}>
          <KanbanBoard
            columns={TSHIRT_COLUMNS}
            orders={tshirt}
            newOrderIds={newOrderIds}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
          />
        </div>

        {/* ══ VUE DEMANDE DE PRT — Tableau indépendant ════════════════════════ */}
        <div className={cn(viewTab !== 'demande_prt' && 'hidden')}>
          <PRTManager items={allPrtItems} onItemsChange={setAllPrtItems} />
        </div>

        {/* ══ VUE PRODUCTION DTF ═════════════════════════════════════════════ */}
        <div className={cn(viewTab !== 'production_dtf' && 'hidden', 'h-full')}>
          <DTFProductionTable activeUser={session.name} />
        </div>

        {/* ══ VUE WORKFLOW — 4 listes de flux ══════════════════════════════════ */}
        <div className={cn(viewTab !== 'workflow' && 'hidden')}>
          <WorkflowListsGrid
            items={workflowItems}
            onItemsChange={setWorkflowItems}
          />
        </div>

        {/* ══ VUE PLANNING — Tableau d'entreprise partagé ════════════════════ */}
        <div className={cn(viewTab !== 'planning' && 'hidden', 'h-full')}>
          <PlanningTable
            items={planningItems}
            onItemsChange={setPlanningItems}
            onEditingChange={(isEditing) => { planningEditingRef.current = isEditing; }}
          />
        </div>

      </div>

      {/* ── New-order toast ── */}
      {newOrderIds.size > 0 && (
        <div className="fixed bottom-6 mb-safe-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 shadow-lg">
            <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin" />
            <span className="text-[14px] font-semibold text-blue-700">
              {newOrderIds.size} nouvelle{newOrderIds.size > 1 ? "s" : ""} commande
              {newOrderIds.size > 1 ? "s" : ""} reçue{newOrderIds.size > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
