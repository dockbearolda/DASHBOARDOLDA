"use client";

/**
 * ClientProTable — Base de données clients professionnels.
 * Utilise OrderTable (table-shell) + atomes de table-cells.
 *
 * Features :
 *  1. Recherche glassmorphism par nom / téléphone  (TableSearchBar)
 *  2. Tableau : Avatar | Nom | Téléphone | Nb commandes | Date ajout
 *  3. Ligne cliquable → expand fiche avec historique planning
 *  4. Ajout / édition inline / suppression
 *  5. Badges d'état unifiés via StatusBadge + SecteurPill
 */

import {
  useState, useCallback, useRef, useEffect, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Trash2, Phone, ChevronDown, ChevronUp, User, Edit2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";
import {
  STATUS_LABELS, StatusBadge, SecteurPill, TableSearchBar,
} from "@/components/ui/table-cells";

// ── Types ─────────────────────────────────────────────────────────────────────────

interface PlanningHistoryItem {
  id:          string;
  designation: string;
  status:      string;
  deadline:    string | null;
  quantity:    number;
  color:       string;
  createdAt:   string;
}

export interface ClientItem {
  id:            string;
  nom:           string;
  telephone:     string;
  createdAt:     string;
  planningItems: PlanningHistoryItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso);
}

// ── History row ───────────────────────────────────────────────────────────────────

function HistoryRow({ item }: { item: PlanningHistoryItem }) {
  return (
    <div
      className="grid gap-2 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors duration-100"
      style={{ gridTemplateColumns: "1fr 90px 90px 80px 100px" }}
    >
      <span className="text-[12px] text-slate-700 font-medium truncate">
        {item.designation || <span className="text-slate-300 italic">Sans désignation</span>}
      </span>
      <span className="text-[11px] tabular-nums text-slate-500 text-center">
        {item.quantity} unité{item.quantity > 1 ? "s" : ""}
      </span>
      {item.color ? (
        <SecteurPill secteur={item.color} className="self-center justify-center" />
      ) : (
        <span />
      )}
      <span className="text-[11px] text-slate-400 text-center self-center tabular-nums">
        {formatDeadline(item.deadline)}
      </span>
      <StatusBadge status={item.status} className="self-center justify-center" />
    </div>
  );
}

// ── Client row ────────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  onUpdate,
  onDelete,
}: {
  client:   ClientItem;
  onUpdate: (id: string, nom: string, telephone: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [nomVal,   setNomVal]   = useState(client.nom);
  const [telVal,   setTelVal]   = useState(client.telephone);
  const [saving,   setSaving]   = useState(false);

  const count = client.planningItems.length;

  const handleSave = async () => {
    if (!nomVal.trim()) return;
    setSaving(true);
    await onUpdate(client.id, nomVal.trim(), telVal.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Main row */}
      <div
        className={cn(
          "grid items-center px-4 py-3 gap-2 group transition-colors duration-100",
          expanded ? "bg-blue-50/40" : "hover:bg-slate-50/70",
        )}
        style={{ gridTemplateColumns: "32px 1fr 140px 80px 100px 36px" }}
      >
        {/* Avatar */}
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-white">
            {client.nom.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Nom */}
        {editing ? (
          <input
            autoFocus
            value={nomVal}
            onChange={(e) => setNomVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8 px-2.5 text-[13px] font-semibold text-slate-900 bg-white rounded-lg border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-left font-semibold text-[13px] text-slate-900 truncate hover:text-blue-600 transition-colors duration-100"
          >
            {client.nom}
          </button>
        )}

        {/* Téléphone */}
        {editing ? (
          <input
            value={telVal}
            onChange={(e) => setTelVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="06 00 00 00 00"
            className="h-8 px-2.5 text-[13px] text-slate-700 bg-white rounded-lg border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            {client.telephone ? (
              <>
                <Phone className="h-3 w-3 text-slate-300 shrink-0" />
                <a
                  href={`tel:${client.telephone.replace(/\s/g, "")}`}
                  className="text-[13px] text-slate-600 hover:text-blue-500 transition-colors duration-100 truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {client.telephone}
                </a>
              </>
            ) : (
              <span className="text-[12px] text-slate-300 italic">Pas de téléphone</span>
            )}
          </div>
        )}

        {/* Nb commandes */}
        <div className="text-center">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold",
              count > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400",
            )}
          >
            {count} cmd{count !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Date ajout */}
        <span className="text-[12px] text-slate-400 text-center tabular-nums">
          {formatDate(client.createdAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 justify-end">
          {editing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors duration-100"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-150">
              <button
                onClick={() => {
                  setEditing(true);
                  setNomVal(client.nom);
                  setTelVal(client.telephone);
                }}
                className="p-1.5 rounded-md text-slate-300 hover:text-blue-400 hover:bg-blue-50 transition-colors duration-100"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(client.id)}
                className="p-1.5 rounded-md text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors duration-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors duration-100"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded history */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              {/* History header */}
              <div
                className="grid px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                style={{ gridTemplateColumns: "1fr 90px 90px 80px 100px" }}
              >
                <span>Désignation</span>
                <span className="text-center">Qté</span>
                <span className="text-center">Secteur</span>
                <span className="text-center">Échéance</span>
                <span className="text-center">État</span>
              </div>
              {client.planningItems.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-slate-300 italic">
                  Aucune commande dans le planning pour ce client
                </div>
              ) : (
                client.planningItems.map((item) => (
                  <HistoryRow key={item.id} item={item} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────────

function AddClientForm({
  onAdd,
  onCancel,
}: {
  onAdd:    (nom: string, telephone: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [nom,    setNom]    = useState("");
  const [tel,    setTel]    = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);
    await onAdd(nom.trim(), tel.trim());
    setSaving(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 bg-blue-50/60 border-b border-blue-100"
    >
      <div className="h-7 w-7 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
        <User className="h-3.5 w-3.5 text-blue-500" />
      </div>
      <input
        autoFocus
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom du client *"
        required
        className="h-8 px-2.5 text-[13px] font-semibold text-slate-900 bg-white rounded-lg border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none flex-1"
      />
      <input
        value={tel}
        onChange={(e) => setTel(e.target.value)}
        placeholder="06 00 00 00 00"
        className="h-8 px-2.5 text-[13px] text-slate-700 bg-white rounded-lg border border-slate-200 shadow-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100/70 w-[150px]"
      />
      <button
        type="submit"
        disabled={saving || !nom.trim()}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium shrink-0",
          "bg-blue-500 text-white hover:bg-blue-600 active:scale-95",
          "transition-all duration-150 shadow-sm shadow-blue-200",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <Check className="h-3.5 w-3.5" />
        Ajouter
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-100"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────────

interface ClientProTableProps {
  clients:         ClientItem[];
  onClientsChange: (clients: ClientItem[]) => void;
}

export function ClientProTable({ clients, onClientsChange }: ClientProTableProps) {
  const [search,      setSearch]      = useState("");
  const [showAdd,     setShowAdd]     = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const displayClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.nom.toLowerCase().includes(q) ||
        c.telephone.toLowerCase().includes(q),
    );
  }, [clients, search]);

  // ── API ───────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (nom: string, telephone: string) => {
    try {
      const res = await fetch("/api/clients", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom, telephone }),
      });
      if (!res.ok) return;
      const { client } = await res.json();
      onClientsChange([{ ...client, planningItems: [] }, ...clients]);
      setShowAdd(false);
    } catch (e) {
      console.error("Failed to add client:", e);
    }
  }, [clients, onClientsChange]);

  const handleUpdate = useCallback(async (id: string, nom: string, telephone: string) => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom, telephone }),
      });
      if (!res.ok) return;
      onClientsChange(
        clients.map((c) => c.id === id ? { ...c, nom, telephone } : c),
      );
    } catch (e) {
      console.error("Failed to update client:", e);
    }
  }, [clients, onClientsChange]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds((p) => new Set([...p, id]));
    onClientsChange(clients.filter((c) => c.id !== id));
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
    } catch {
      const res  = await fetch("/api/clients");
      const data = await res.json();
      onClientsChange(data.clients ?? []);
    } finally {
      setDeletingIds((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }, [clients, onClientsChange]);

  // ── Slots OrderTable ──────────────────────────────────────────────────────

  const toolbar = (
    <>
      {/* Barre d'actions */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium shrink-0",
            "bg-blue-500 text-white hover:bg-blue-600 active:scale-95",
            "transition-all duration-150 shadow-sm shadow-blue-200",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Ajouter un client</span>
        </button>
        <span className="text-[12px] text-slate-400 font-medium tabular-nums">
          {clients.length} client{clients.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Barre de recherche */}
      <div className="px-4 py-2.5 border-b border-black/[0.04]">
        <TableSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par nom, téléphone…"
        />
      </div>

      {/* Formulaire d'ajout */}
      <AnimatePresence initial={false}>
        {showAdd && (
          <AddClientForm
            onAdd={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>
    </>
  );

  const headers = (
    <div
      className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
      style={{ gridTemplateColumns: "32px 1fr 140px 80px 100px 36px" }}
    >
      <span />
      <span>Nom</span>
      <span>Téléphone</span>
      <span className="text-center">Commandes</span>
      <span className="text-center">Ajouté le</span>
      <span />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OrderTable toolbar={toolbar} headers={headers}>
      <AnimatePresence mode="popLayout" initial={false}>
        {displayClients.map((client) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: deletingIds.has(client.id) ? 0.25 : 1, y: 0 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            className={cn(deletingIds.has(client.id) && "pointer-events-none")}
          >
            <ClientRow
              client={client}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty state */}
      {displayClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center select-none">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
            <User className="h-5 w-5 text-slate-200" />
          </div>
          <p className="text-[13px] text-slate-400">
            {search
              ? `Aucun résultat pour « ${search} »`
              : "Aucun client pro enregistré"}
          </p>
          {!search && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-[12px] text-blue-500 hover:underline transition-colors"
            >
              Ajouter le premier client
            </button>
          )}
        </div>
      )}
    </OrderTable>
  );
}
