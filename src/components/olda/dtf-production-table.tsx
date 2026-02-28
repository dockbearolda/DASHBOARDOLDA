"use client";

/**
 * DTF Production Table — données persistées en base PostgreSQL.
 * Utilise OrderTable (table-shell) pour la carte Apple-style + sticky headers.
 * Chaque utilisateur voit et édite ses propres lignes ; les modifications
 * sont sauvegardées en temps réel via l'API.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

export type DTFStatus = "a_produire" | "en_cours" | "termine" | "erreur";

export interface DTFProductionRow {
  id: string;
  name: string;
  status: DTFStatus;
  problem?: string;
}

const statusConfig: Record<DTFStatus, { label: string; color: string }> = {
  a_produire: { label: "À produire", color: "#ff9500" },
  en_cours:   { label: "En cours",   color: "#0066ff" },
  termine:    { label: "Terminé",    color: "#28cd41" },
  erreur:     { label: "Erreur",     color: "#ff3b30" },
};

interface DTFProductionTableProps {
  activeUser?: string;
}

export function DTFProductionTable({ activeUser }: DTFProductionTableProps) {
  const [rows, setRows]       = useState<DTFProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Debounce timers par row.id pour les champs texte
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeUser) return;
    setLoading(true);
    fetch(`/api/dtf-production?user=${activeUser}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(
          (data.rows ?? []).map((r: DTFProductionRow & { status: string }) => ({
            ...r,
            status: (r.status ?? "en_cours") as DTFStatus,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeUser]);

  // ── Ajouter une ligne ─────────────────────────────────────────────────────
  const addRow = useCallback(async () => {
    if (!activeUser || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dtf-production", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user: activeUser, name: "", status: "en_cours" }),
      });
      if (!res.ok) return;
      const { row } = await res.json();
      setRows((prev) => [...prev, row]);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activeUser, saving]);

  // ── Supprimer une ligne ───────────────────────────────────────────────────
  const deleteRow = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/dtf-production/${id}`, { method: "DELETE" });
    } catch {
      if (!activeUser) return;
      const res  = await fetch(`/api/dtf-production?user=${activeUser}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    }
  }, [activeUser]);

  // ── Mettre à jour statut (immédiat) ──────────────────────────────────────
  const updateStatus = useCallback(async (id: string, status: DTFStatus) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    try {
      await fetch(`/api/dtf-production/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Mettre à jour champ texte (debounce 600 ms) ───────────────────────────
  const updateTextField = useCallback((id: string, field: "name" | "problem", value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));

    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);

    debounceRefs.current[id] = setTimeout(async () => {
      try {
        await fetch(`/api/dtf-production/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ [field]: value }),
        });
      } catch { /* ignore */ }
    }, 600);
  }, []);

  // ── Supprimer les terminés ────────────────────────────────────────────────
  const deleteTerminated = useCallback(async () => {
    if (!activeUser) return;
    setRows((prev) => prev.filter((r) => r.status !== "termine"));
    try {
      await fetch(`/api/dtf-production?user=${activeUser}&status=termine`, {
        method: "DELETE",
      });
    } catch { /* ignore */ }
  }, [activeUser]);

  // Nettoyage des debounce timers au démontage
  useEffect(() => {
    const refs = debounceRefs.current;
    return () => { Object.values(refs).forEach(clearTimeout); };
  }, []);

  // ── Slots OrderTable ──────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Production DTF
        </h3>
        {saving && <Loader2 className="h-3.5 w-3.5 text-slate-300 animate-spin" />}
      </div>
      <div className="flex items-center gap-2">
        {rows.some((r) => r.status === "termine") && (
          <button
            onClick={deleteTerminated}
            className="h-8 px-2.5 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Supprimer les terminés
          </button>
        )}
        <button
          onClick={addRow}
          disabled={saving}
          className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
          title="Ajouter une ligne"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const headers = (
    <div className="grid grid-cols-2 gap-0 px-0">
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Nom du PRT
      </div>
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Statut
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OrderTable
      toolbar={toolbar}
      headers={headers}
      className="h-full"
      bodyClassName="overflow-auto flex-1 min-h-0"
    >
      {loading ? (
        <div className="flex items-center justify-center h-24 gap-2 text-[13px] text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-[13px] text-slate-300">
          Aucune production
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map((row) => {
            const cfg = statusConfig[row.status];
            return (
              <div key={row.id}>
                <div className="grid grid-cols-2 gap-0 px-4 py-3 items-start hover:bg-slate-50/70 transition-colors group">
                  <input
                    value={row.name}
                    onChange={(e) => updateTextField(row.id, "name", e.target.value)}
                    placeholder="Ex: Commande #123"
                    className="text-[13px] text-slate-900 font-medium bg-transparent outline-none placeholder:text-slate-300"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value as DTFStatus)}
                      className="flex-1 h-7 rounded-lg px-2.5 text-[12px] font-semibold text-white outline-none cursor-pointer"
                      style={{ backgroundColor: cfg.color }}
                    >
                      {Object.entries(statusConfig).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {row.status === "erreur" && (
                  <div className="px-4 pb-3 pt-0">
                    <input
                      value={row.problem ?? ""}
                      onChange={(e) => updateTextField(row.id, "problem", e.target.value)}
                      placeholder="Problème rencontré…"
                      className="w-full h-7 rounded-lg px-2.5 text-[12px] bg-red-50 border border-red-100 text-slate-700 outline-none focus:border-red-300 focus:bg-white transition-colors placeholder:text-slate-300"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </OrderTable>
  );
}
