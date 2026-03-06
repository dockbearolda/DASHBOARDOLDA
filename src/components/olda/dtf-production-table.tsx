"use client";

/**
 * DTF Production Table — données persistées en base PostgreSQL.
 * Utilise OrderTable (table-shell) pour la carte Apple-style + sticky headers.
 * Chaque utilisateur voit et édite ses propres lignes ; les modifications
 * sont sauvegardées en temps réel via l'API.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

export type DTFStatus = "a_produire" | "en_cours" | "termine" | "erreur";

export interface DTFProductionRow {
  id: string;
  name: string;
  status: DTFStatus;
  problem?: string;
}

const DTF_TEAM = ["loic", "charlie", "melina", "amandine"] as const;
const DTF_USER_KEY = "dtf-active-user";

const statusConfig: Record<DTFStatus, { label: string; color: string }> = {
  a_produire: { label: "À produire", color: "#ff9500" },
  en_cours:   { label: "En cours",   color: "#0066ff" },
  termine:    { label: "Terminé",    color: "#28cd41" },
  erreur:     { label: "Erreur",     color: "#ff3b30" },
};

interface DTFProductionTableProps {
  activeUser?: string;
}

export function DTFProductionTable({ activeUser: activeUserProp }: DTFProductionTableProps) {
  // User management — si le prop est vide, on utilise localStorage
  const [internalUser, setInternalUser] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem(DTF_USER_KEY) ?? "";
    return "";
  });
  const activeUser = activeUserProp || internalUser;

  const [rows, setRows]       = useState<DTFProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // ── Inline quick-add ─────────────────────────────────────────────────────
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickDraft,    setQuickDraft]    = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

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
  const addRow = useCallback(async (name: string = "") => {
    if (!activeUser || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dtf-production", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user: activeUser, name, status: "en_cours" }),
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
    <div className="flex items-center gap-3 px-4 py-3">
      {isQuickAdding ? (
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-white border border-blue-200 ring-1 ring-blue-100 shadow-sm min-w-[200px] shrink-0">
          <Plus className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <input
            ref={quickAddRef}
            value={quickDraft}
            onChange={(e) => setQuickDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const text = quickDraft.trim();
                if (text) {
                  addRow(text);
                  setQuickDraft("");
                  setTimeout(() => quickAddRef.current?.focus(), 0);
                } else {
                  setIsQuickAdding(false);
                  setQuickDraft("");
                }
              }
              if (e.key === "Escape") { setIsQuickAdding(false); setQuickDraft(""); }
            }}
            onBlur={() => {
              const text = quickDraft.trim();
              if (text) addRow(text);
              setIsQuickAdding(false);
              setQuickDraft("");
            }}
            placeholder="Nom de la production…"
            className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-300 bg-transparent outline-none"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setIsQuickAdding(false); setQuickDraft(""); }}
            className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setIsQuickAdding(true); setTimeout(() => quickAddRef.current?.focus(), 30); }}
          disabled={saving}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          <span>Ajouter une production</span>
        </button>
      )}
      <div className="flex-1" />
      {rows.some((r) => r.status === "termine") && (
        <button
          onClick={deleteTerminated}
          className="h-8 px-2.5 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Supprimer les terminés
        </button>
      )}
      {/* Sélecteur d'utilisateur (sans mot de passe) */}
      <div className="relative shrink-0">
        <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 cursor-pointer hover:border-slate-300 transition-colors">
          <span className="capitalize">{activeUser || "—"}</span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </div>
        <select
          value={activeUser}
          onChange={(e) => {
            const val = e.target.value;
            setInternalUser(val);
            try { localStorage.setItem(DTF_USER_KEY, val); } catch {}
          }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
        >
          <option value="">— Choisir —</option>
          {DTF_TEAM.map((u) => (
            <option key={u} value={u} className="capitalize">{u}</option>
          ))}
        </select>
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
      {!activeUser ? (
        <div className="flex flex-col items-center justify-center h-40 gap-4">
          <p className="text-[13px] text-slate-400">Qui êtes-vous ?</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {DTF_TEAM.map((u) => (
              <button
                key={u}
                onClick={() => { setInternalUser(u); try { localStorage.setItem(DTF_USER_KEY, u); } catch {} }}
                className="h-9 px-4 rounded-xl text-[13px] font-semibold capitalize bg-slate-100 hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      ) : loading ? (
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
