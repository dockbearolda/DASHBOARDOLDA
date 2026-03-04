"use client";

/**
 * DTF Production Table — données persistées en base PostgreSQL.
 * Remplace l'ancienne implémentation localStorage.
 * Chaque utilisateur voit et édite ses propres lignes ; les modifications
 * sont sauvegardées en temps réel via l'API.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DTFStatus = "a_produire" | "en_cours" | "termine" | "erreur";
export type DTFClientType = "particulier" | "pro" | "association";

export interface DTFProductionRow {
  id: string;
  name: string;
  clientType: DTFClientType;
  status: DTFStatus;
  problem?: string;
}

const clientTypeConfig: Record<DTFClientType, { label: string; bg: string; text: string }> = {
  particulier: { label: "PART.",  bg: "#f0fdf4", text: "#15803d" },
  pro:         { label: "PRO",    bg: "#eff6ff", text: "#1e40af" },
  association: { label: "ASSO",   bg: "#faf5ff", text: "#7e22ce" },
};

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
          (data.rows ?? []).map((r: DTFProductionRow & { status: string; clientType: string }) => ({
            ...r,
            status:     (r.status     ?? "en_cours")    as DTFStatus,
            clientType: (r.clientType ?? "particulier") as DTFClientType,
          }))
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: activeUser, name: "", clientType: "particulier", status: "en_cours" }),
      });
      if (!res.ok) return;
      const { row } = await res.json();
      setRows((prev) => [...prev, row]);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activeUser, saving]);

  // ── Supprimer une ligne ───────────────────────────────────────────────────
  const deleteRow = useCallback(async (id: string) => {
    // Optimiste : retire immédiatement de l'UI
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/dtf-production/${id}`, { method: "DELETE" });
    } catch {
      // Rollback : recharge depuis le serveur
      if (!activeUser) return;
      const res = await fetch(`/api/dtf-production?user=${activeUser}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    }
  }, [activeUser]);

  // ── Mettre à jour statut (immédiat) ──────────────────────────────────────
  const updateStatus = useCallback(async (id: string, status: DTFStatus) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    try {
      await fetch(`/api/dtf-production/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Mettre à jour type client (immédiat) ──────────────────────────────────
  const updateClientType = useCallback(async (id: string, clientType: DTFClientType) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, clientType } : r));
    try {
      await fetch(`/api/dtf-production/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientType }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Mettre à jour champ texte (debounce 600 ms) ───────────────────────────
  const updateTextField = useCallback((id: string, field: "name" | "problem", value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));

    // Annule le timer précédent pour ce row
    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);

    debounceRefs.current[id] = setTimeout(async () => {
      try {
        await fetch(`/api/dtf-production/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>
            Production DTF
          </h3>
          {saving && <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          {rows.some((r) => r.status === "termine") && (
            <button
              onClick={deleteTerminated}
              className="h-8 px-2.5 rounded-lg text-[12px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Supprimer les terminés
            </button>
          )}
          <button
            onClick={addRow}
            disabled={saving}
            className="h-8 w-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
            title="Ajouter une ligne"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Headers */}
        <div className="shrink-0 grid gap-0 border-b border-gray-100" style={{ gridTemplateColumns: "72px 1fr 160px 32px" }}>
          <div className="px-3 py-3 text-[12px] font-semibold uppercase tracking-widest text-gray-500">
            Type
          </div>
          <div className="px-4 py-3 text-[12px] font-semibold uppercase tracking-widest text-gray-500">
            Nom du PRT
          </div>
          <div className="px-4 py-3 text-[12px] font-semibold uppercase tracking-widest text-gray-500">
            Statut
          </div>
          <div />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 gap-2 text-[13px] text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-gray-300">
              Aucune production
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row) => {
                const cfg    = statusConfig[row.status];
                const ctCfg  = clientTypeConfig[row.clientType ?? "particulier"];
                return (
                  <div key={row.id}>
                    <div className="grid gap-0 px-0 py-0 items-center hover:bg-gray-50 transition-colors" style={{ gridTemplateColumns: "72px 1fr 160px 32px" }}>
                      {/* Type client — clic pour cycler */}
                      <div className="px-3 py-3 flex items-center">
                        <button
                          onClick={() => {
                            const cycle: DTFClientType[] = ["particulier", "pro", "association"];
                            const next = cycle[(cycle.indexOf(row.clientType ?? "particulier") + 1) % cycle.length];
                            updateClientType(row.id, next);
                          }}
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider cursor-pointer select-none"
                          style={{ backgroundColor: ctCfg.bg, color: ctCfg.text }}
                          title="Cliquer pour changer le type"
                        >
                          {ctCfg.label}
                        </button>
                      </div>
                      {/* Nom */}
                      <div className="px-4 py-3">
                        <input
                          value={row.name}
                          onChange={(e) => updateTextField(row.id, "name", e.target.value)}
                          placeholder="Ex: Commande #123"
                          className="w-full text-[13px] text-gray-900 bg-transparent outline-none placeholder:text-gray-300 font-medium"
                        />
                      </div>
                      {/* Statut */}
                      <div className="py-3">
                        <select
                          value={row.status}
                          onChange={(e) => updateStatus(row.id, e.target.value as DTFStatus)}
                          className="w-full h-7 rounded-lg px-2.5 text-[12px] font-semibold text-white outline-none cursor-pointer"
                          style={{ backgroundColor: cfg.color }}
                        >
                          {Object.entries(statusConfig).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* Supprimer */}
                      <div className="flex items-center justify-center py-3">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {row.status === "erreur" && (
                      <div className="px-4 pb-3 pt-0 col-span-4">
                        <input
                          value={row.problem ?? ""}
                          onChange={(e) => updateTextField(row.id, "problem", e.target.value)}
                          placeholder="Problème rencontré…"
                          className="w-full h-7 rounded-lg px-2.5 text-[12px] bg-red-50 border border-red-100 text-gray-700 outline-none focus:border-red-300 focus:bg-white transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
