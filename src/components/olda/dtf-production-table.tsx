"use client";

/**
 * DTF Production Table — Gestion des productions DTF pour Loïc
 * Style San Francisco minimaliste
 */

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DTFStatus = "a_produire" | "en_cours" | "termine" | "erreur";

export interface DTFProductionRow {
  id: string;
  name: string;
  status: DTFStatus;
  problem?: string;
}

function newId(): string {
  return `dtf${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

const statusConfig: Record<DTFStatus, { label: string; color: string; bgLight: string }> = {
  a_produire: { label: "À produire", color: "#ff9500", bgLight: "#fff3e0" },
  en_cours: { label: "En cours", color: "#0066ff", bgLight: "#e3f2fd" },
  termine: { label: "Terminé", color: "#28cd41", bgLight: "#e8f5e9" },
  erreur: { label: "Erreur", color: "#ff3b30", bgLight: "#ffebee" },
};

interface DTFProductionTableProps {
  activeUser?: string;
}

export function DTFProductionTable({ activeUser }: DTFProductionTableProps) {
  const [rows, setRows] = useState<DTFProductionRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Charge les données depuis localStorage
  useEffect(() => {
    const key = `dtf_production_${activeUser}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setRows(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [activeUser]);

  // Persiste les changements
  const persist = useCallback((next: DTFProductionRow[]) => {
    const key = `dtf_production_${activeUser}`;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch { /* ignore */ }
  }, [activeUser]);

  const addRow = useCallback(() => {
    const next = [...rows, { id: newId(), name: "", status: "en_cours" as const }];
    setRows(next);
    persist(next);
  }, [rows, persist]);

  const updateRow = useCallback((id: string, updates: Partial<DTFProductionRow>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setRows(next);
    persist(next);
  }, [rows, persist]);

  const deleteRow = useCallback((id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    persist(next);
  }, [rows, persist]);

  const deleteTerminated = useCallback(() => {
    const next = rows.filter((r) => r.status !== "termine");
    setRows(next);
    persist(next);
  }, [rows, persist]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Header + Actions ── */}
      <div className="flex items-center justify-between px-1">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>
          Production DTF
        </h3>
        <div className="flex items-center gap-2">
          {rows.some((r) => r.status === "termine") && (
            <button
              onClick={deleteTerminated}
              disabled={saving}
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

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Headers */}
        <div className="shrink-0 grid grid-cols-2 gap-0 border-b border-gray-100">
          <div className="px-4 py-3 text-[12px] font-semibold uppercase tracking-widest text-gray-500">
            Nom du PRT
          </div>
          <div className="px-4 py-3 text-[12px] font-semibold uppercase tracking-widest text-gray-500">
            Statut
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-gray-300">
              Aucune production
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row) => {
                const statusCfg = statusConfig[row.status];
                return (
                  <div key={row.id}>
                    <div className="grid grid-cols-2 gap-0 px-4 py-3 items-start hover:bg-gray-50 transition-colors">
                      {/* Name */}
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Ex: Commande #123"
                        className="text-[13px] text-gray-900 bg-transparent outline-none placeholder:text-gray-300 font-medium"
                      />

                      {/* Status + Delete */}
                      <div className="flex items-center gap-2">
                        <select
                          value={row.status}
                          onChange={(e) => updateRow(row.id, { status: e.target.value as DTFStatus })}
                          className="flex-1 h-7 rounded-lg px-2.5 text-[12px] font-semibold text-white outline-none cursor-pointer"
                          style={{ backgroundColor: statusCfg.color }}
                        >
                          {Object.entries(statusConfig).map(([key, val]) => (
                            <option key={key} value={key}>
                              {val.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Problem field si erreur */}
                    {row.status === "erreur" && (
                      <div className="px-4 pb-3 pt-0">
                        <input
                          value={row.problem ?? ""}
                          onChange={(e) => updateRow(row.id, { problem: e.target.value })}
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
