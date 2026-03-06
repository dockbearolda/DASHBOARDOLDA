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
import { Inbox, Pencil, Layers, Phone, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteData, TodoItem } from "./person-note-modal";
import { RemindersGrid } from "./reminders-grid";
import { OrderCard } from "./order-card";
import { DTFProductionTable } from "./dtf-production-table";
import { WorkflowListsGrid } from "./workflow-list";
import { PRTManager } from "./prt-manager";
import { PlanningTable, type PlanningItem } from "./planning-table";
import { ThemeSwitcher } from "./theme-switcher";
import { ClientProTable, type ClientItem } from "./client-pro-table";
import { AchatTextileTable } from "./achat-textile-table";
import { AchatCardsGrid } from "./achat-cards-grid";

interface PRTItem {
  id: string;
  clientName: string;
  dimensions: string;
  design: string;
  color: string;
  quantity: number;
  done: boolean;
  position: number;
  note: string;
  createdAt: string;
  updatedAt: string;
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
  const [viewTab, setViewTab] = useState<'flux' | 'planning' | 'clients_pro' | 'demande_prt' | 'production_dtf' | 'workflow' | 'achat' | 'achat_textile'>('flux');
  // Badge de notification sur l'onglet Flux
  const [fluxHasNotif, setFluxHasNotif] = useState(false);
  // Badge de notification sur l'onglet Demande de DTF (uniquement pour loic et charlie)
  const [prtHasNotif, setPrtHasNotif] = useState(false);
  const prtCountRef = useRef<number>(0);
  // Ref pour connaître l'onglet courant dans les callbacks SSE (évite les stale closures)
  const viewTabRef = useRef(viewTab);
  useEffect(() => { viewTabRef.current = viewTab; }, [viewTab]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [prtItems, setPrtItems] = useState<PRTItem[]>([]);
  const [allPrtItems, setAllPrtItems] = useState<PRTItem[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [clientItems, setClientItems] = useState<ClientItem[]>([]);

  const addOrder = async () => {
    const res = await fetch("/api/orders/manual", { method: "POST" });
    if (!res.ok) return;
    const { order } = await res.json();
    setOrders((prev) => [order, ...prev]);
  };

  // ── Achat Textile : trigger refresh + lien depuis Planning ────────────────
  const [achatRefreshTrigger, setAchatRefreshTrigger] = useState(0);

  const handleCreateAchatFromPlanning = useCallback(async (item: PlanningItem) => {
    try {
      await fetch("/api/achat-textile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          client:      item.clientName,
          designation: item.designation,
          quantite:    item.quantity,
          sessionUser: "",
        }),
      });
      setAchatRefreshTrigger((t) => t + 1);
      setViewTab("achat_textile");
    } catch { /* ignore */ }
  }, []);

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

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  // Rechargement commandes au retour de mise en veille
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOrders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshOrders]);

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

  // ── Person notes — polling toutes les 15 s ─────────────────────────────────

  const fetchNotes = useCallback(() => {
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

  useEffect(() => {
    fetchNotes();
    const id = setInterval(fetchNotes, 15_000);
    return () => clearInterval(id);
  }, [fetchNotes]);

  // ── Workflow items : polling toutes les 5 s ────────────────────────────────

  const fetchWorkflowItems = useCallback(() => {
    fetch("/api/workflow-items")
      .then((r) => r.json())
      .then((data) => { setWorkflowItems(data.items ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchWorkflowItems();
    const id = setInterval(fetchWorkflowItems, 5_000);
    return () => clearInterval(id);
  }, [fetchWorkflowItems]);

  // ── PRT items : polling toutes les 5 s, pausé pendant la saisie ─────────────

  const prtEditingRef = useRef(false);

  const fetchPrtItems = useCallback(() => {
    if (prtEditingRef.current) return; // pause while editing
    fetch("/api/prt-requests")
      .then((r) => r.json())
      .then((data) => {
        if (prtEditingRef.current) return; // double-check au retour async
        const newItems = data.items ?? [];
        setAllPrtItems(newItems);
        const count = newItems.length;
        if (count > prtCountRef.current && viewTabRef.current !== "demande_prt") {
          setPrtHasNotif(true);
        }
        prtCountRef.current = count;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPrtItems();
    const id = setInterval(fetchPrtItems, 5_000);
    return () => clearInterval(id);
  }, [fetchPrtItems]);

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

  // ── Client Pro items — polling toutes les 15 s ────────────────────────────
  const fetchClients = useCallback(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => { setClientItems(data.clients ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchClients();
    const id = setInterval(fetchClients, 15_000);
    return () => clearInterval(id);
  }, [fetchClients]);

  // ── Notification badge Flux ────────────────────────────────────────────────
  const handleNoteChangedForNotif = useCallback((_person: string) => {
    if (viewTabRef.current === 'flux') return;
    setFluxHasNotif(true);
  }, []);

  // Changement d'onglet : efface le badge quand l'utilisateur retourne sur l'onglet concerné
  const handleTabChange = useCallback((tab: typeof viewTab) => {
    setViewTab(tab as typeof viewTab);
    if (tab === 'flux') setFluxHasNotif(false);
    if (tab === 'demande_prt') setPrtHasNotif(false);
  }, []);

  // Appelé depuis PRTManager quand une nouvelle demande est créée
  const handleNewPrtRequest = useCallback(() => {
    prtCountRef.current += 1;
    if (viewTabRef.current === "demande_prt") return;
    setPrtHasNotif(true);
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

  return (
    <div
      className="flex flex-col h-svh w-full overflow-hidden bg-background"
      style={{ fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
    >

      {/* ── Header : tabs centrés · user à gauche · indicateur live à droite ─ */}
      <div className="shrink-0 px-4 sm:px-6 pt-5 pb-3 relative flex items-center justify-center border-b border-black/[0.06] dark:border-border bg-white/80 dark:bg-card/80 backdrop-blur-xl">
        {/* Tabs — centrés */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-muted/80 overflow-x-auto">
            {(['flux', 'planning', 'clients_pro', 'demande_prt', 'production_dtf', 'workflow', 'achat', 'achat_textile'] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleTabChange(v)}
                className={cn(
                  "relative px-3.5 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all whitespace-nowrap",
                  "[touch-action:manipulation]",
                  viewTab === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === 'flux' ? 'Tâches'
                  : v === 'achat' ? 'Achat'
                  : v === 'planning' ? 'Planning'
                  : v === 'clients_pro' ? 'Clients Pro'
                  : v === 'demande_prt' ? 'Demande de DTF'
                  : v === 'production_dtf' ? 'Production'
                  : v === 'workflow' ? "Gestion d'atelier"
                  : 'Achat Textile'}
                {v === 'flux' && fluxHasNotif && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-400 border border-white" />
                )}
                {v === 'demande_prt' && prtHasNotif && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-orange-400 border border-white" />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* ThemeSwitcher + Indicateur live — positionnés à droite en absolu */}
        <div className="absolute right-4 sm:right-6 flex items-center gap-2">
          <ThemeSwitcher />
          <LiveIndicator connected={sseConnected} />
        </div>
      </div>

      {/* ── Contenu principal ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-0">

        {/* ══ VUE FLUX — cartes collaborateurs ═══════════════════════════════ */}
        <div className={cn(viewTab !== 'flux' && 'hidden')}>
          <RemindersGrid key={String(notesReady)} notesMap={notesMap} activeUser="" onNoteChanged={handleNoteChangedForNotif} />
        </div>

        {/* ══ VUE DEMANDE DE DTF — Tableau indépendant ════════════════════════ */}
        <div className={cn(viewTab !== 'demande_prt' && 'hidden')}>
          <div className="max-w-5xl mx-auto">
            <PRTManager
              items={allPrtItems}
              onItemsChange={setAllPrtItems}
              onNewRequest={handleNewPrtRequest}
              onEditingChange={(isEditing) => { prtEditingRef.current = isEditing; }}
            />
          </div>
        </div>

        {/* ══ VUE PRODUCTION DTF ═════════════════════════════════════════════ */}
        <div className={cn(viewTab !== 'production_dtf' && 'hidden', 'h-full')}>
          <div className="max-w-2xl mx-auto h-full">
            <DTFProductionTable />
          </div>
        </div>

        {/* ══ VUE WORKFLOW — 4 listes de flux ══════════════════════════════════ */}
        <div className={cn(viewTab !== 'workflow' && 'hidden')}>
          <div className="max-w-6xl mx-auto">
            <WorkflowListsGrid
              items={workflowItems}
              onItemsChange={setWorkflowItems}
            />
          </div>
        </div>

        {/* ══ VUE PLANNING — Tableau d'entreprise partagé ════════════════════ */}
        <div className={cn(viewTab !== 'planning' && 'hidden', 'h-full')}>
          <div className="max-w-screen-2xl mx-auto h-full">
            <PlanningTable
              items={planningItems}
              onItemsChange={setPlanningItems}
              onEditingChange={(isEditing) => { planningEditingRef.current = isEditing; }}
              onCreateAchatFromPlanning={handleCreateAchatFromPlanning}
            />
          </div>
        </div>

        {/* ══ VUE CLIENTS PRO — Base de données clients ═══════════════════════ */}
        <div className={cn(viewTab !== 'clients_pro' && 'hidden', 'h-full')}>
          <div className="max-w-5xl mx-auto h-full">
            <ClientProTable
              clients={clientItems}
              onClientsChange={setClientItems}
            />
          </div>
        </div>

        {/* ══ VUE ACHAT — 3 cartes SXM / Europe / USA ════════════════════════ */}
        <div className={cn(viewTab !== 'achat' && 'hidden')}>
          <div className="max-w-4xl mx-auto">
            <AchatCardsGrid />
          </div>
        </div>

        {/* ══ VUE ACHAT TEXTILE — Tableau des commandes textile ════════════════ */}
        <div className={cn(viewTab !== 'achat_textile' && 'hidden', 'h-full')}>
          <div className="max-w-7xl mx-auto h-full">
            <AchatTextileTable activeUser="" refreshTrigger={achatRefreshTrigger} />
          </div>
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
