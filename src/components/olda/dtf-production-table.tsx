"use client";

/**
 * DTF Production Table — données persistées en base PostgreSQL.
 * Toutes les lignes de toute l'équipe sont visibles.
 * Un badge coloré indique qui a créé chaque ligne.
 * Colonne "Quantité" : N pastilles cliquables pour suivre N pièces.
 * Polling 10 s pour voir les changements des collègues en temps réel.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

export type DTFStatus = "a_produire" | "en_cours" | "termine" | "erreur";

export interface DTFProductionRow {
  id: string;
  user: string;
  name: string;
  status: DTFStatus;
  problem?: string;
  quantity: number;
  completedItems: boolean[];
}

const USER_COLORS: Record<string, { bg: string; text: string }> = {
  loic:     { bg: "#e8f2ff", text: "#0066ff" },
  charlie:  { bg: "#e8faf0", text: "#1a9e3f" },
  melina:   { bg: "#f2e8fd", text: "#9a42c8" },
  amandine: { bg: "#ffe8ed", text: "#c91f3e" },
};

const statusConfig: Record<DTFStatus, { label: string; color: string }> = {
  a_produire: { label: "À produire", color: "#ff9500" },
  en_cours:   { label: "En cours",   color: "#0066ff" },
  termine:    { label: "Terminé",    color: "#28cd41" },
  erreur:     { label: "Erreur",     color: "#ff3b30" },
};

// Normalise les données brutes de l'API
function normalizeRow(r: Partial<DTFProductionRow> & { status?: string; completedItems?: unknown }): DTFProductionRow {
  const qty = Math.max(1, Number(r.quantity ?? 1));
  let completed: boolean[] = [];
  if (Array.isArray(r.completedItems)) {
    completed = (r.completedItems as unknown[]).map(Boolean);
  }
  // Ajuste la longueur si besoin
  while (completed.length < qty) completed.push(false);
  completed = completed.slice(0, qty);

  return {
    id:             r.id ?? "",
    user:           r.user ?? "",
    name:           r.name ?? "",
    status:         (r.status ?? "en_cours") as DTFStatus,
    problem:        r.problem,
    quantity:       qty,
    completedItems: completed,
  };
}

export function DTFProductionTable() {
  const [rows, setRows]       = useState<DTFProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickDraft,    setQuickDraft]    = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  const debounceRefs  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const editingIdsRef = useRef<Set<string>>(new Set()); // lignes en cours d'édition — pas écrasées par le poll

  // ── Chargement + polling 10 s ────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    fetch("/api/dtf-production")
      .then((r) => r.json())
      .then((data) => {
        const fresh = (data.rows ?? []).map(normalizeRow) as DTFProductionRow[];
        setRows((prev) => {
          // Ne pas écraser les lignes actuellement éditées
          const prevMap = new Map(prev.map((r) => [r.id, r]));
          return fresh.map((r) => editingIdsRef.current.has(r.id) ? (prevMap.get(r.id) ?? r) : r);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/dtf-production")
      .then((r) => r.json())
      .then((data) => setRows((data.rows ?? []).map(normalizeRow)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(fetchAll, 10_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Ajouter une ligne ─────────────────────────────────────────────────────
  const addRow = useCallback(async (name: string = "") => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dtf-production", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user: "", name, status: "en_cours" }),
      });
      if (!res.ok) return;
      const { row } = await res.json();
      setRows((prev) => [...prev, normalizeRow(row)]);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [saving]);

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/dtf-production/${id}`, { method: "DELETE" });
    } catch {
      const res  = await fetch("/api/dtf-production");
      const data = await res.json();
      setRows((data.rows ?? []).map(normalizeRow));
    }
  }, []);

  // ── Statut ────────────────────────────────────────────────────────────────
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

  // ── Champs texte (debounce) ───────────────────────────────────────────────
  const updateTextField = useCallback((id: string, field: "name" | "problem", value: string) => {
    editingIdsRef.current.add(id);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));

    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);
    debounceRefs.current[id] = setTimeout(async () => {
      editingIdsRef.current.delete(id);
      try {
        await fetch(`/api/dtf-production/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ [field]: value }),
        });
      } catch { /* ignore */ }
    }, 600);
  }, []);

  // ── Quantité ──────────────────────────────────────────────────────────────
  const updateQuantity = useCallback((id: string, qty: number) => {
    const q = Math.max(1, Math.min(50, qty));
    let nextItems: boolean[] = [];
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      let items = [...r.completedItems];
      while (items.length < q)  items.push(false);
      items = items.slice(0, q);
      nextItems = items;
      return { ...r, quantity: q, completedItems: items };
    }));

    if (debounceRefs.current[`qty_${id}`]) clearTimeout(debounceRefs.current[`qty_${id}`]);
    debounceRefs.current[`qty_${id}`] = setTimeout(async () => {
      try {
        await fetch(`/api/dtf-production/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ quantity: q, completedItems: nextItems }),
        });
      } catch { /* ignore */ }
    }, 800);
  }, []);

  // ── Pastille (toggle) ─────────────────────────────────────────────────────
  const togglePill = useCallback(async (id: string, index: number) => {
    let nextItems: boolean[] = [];
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      nextItems = r.completedItems.map((v, i) => i === index ? !v : v);
      return { ...r, completedItems: nextItems };
    }));
    try {
      await fetch(`/api/dtf-production/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ completedItems: nextItems }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Supprimer tous les terminés ───────────────────────────────────────────
  const deleteTerminated = useCallback(async () => {
    setRows((prev) => prev.filter((r) => r.status !== "termine"));
    try {
      await fetch(`/api/dtf-production?status=termine`, { method: "DELETE" });
    } catch { /* ignore */ }
  }, []);

  // Nettoyage des debounce timers
  useEffect(() => {
    const refs = debounceRefs.current;
    return () => { Object.values(refs).forEach(clearTimeout); };
  }, []);

  // ── Toolbar ────────────────────────────────────────────────────────────────
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
                if (text) { addRow(text); setQuickDraft(""); setTimeout(() => quickAddRef.current?.focus(), 0); }
                else { setIsQuickAdding(false); setQuickDraft(""); }
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
            className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-500 bg-transparent outline-none"
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
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          <span>Ajouter</span>
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
    </div>
  );

  const headers = (
    <div className="grid grid-cols-[1fr_auto_160px_36px] gap-0 px-0">
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Nom du PRT</div>
      <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Qui</div>
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Statut</div>
      <div />
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
        <div className="flex flex-col items-center justify-center h-24 gap-1 text-[13px] text-slate-300">
          <p>Aucune production en cours</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map((row) => {
            const cfg       = statusConfig[row.status];
            const userColor = USER_COLORS[row.user] ?? { bg: "#f1f5f9", text: "#64748b" };
            const doneCount = row.completedItems.filter(Boolean).length;
            return (
              <div key={row.id}>
                {/* Ligne principale */}
                <div className="grid grid-cols-[1fr_auto_160px_36px] gap-0 px-4 py-2.5 items-center hover:bg-slate-50/70 transition-colors group">
                  <input
                    value={row.name}
                    onChange={(e) => updateTextField(row.id, "name", e.target.value)}
                    placeholder="Ex: Commande #123"
                    className="text-[13px] text-slate-900 font-medium bg-transparent outline-none placeholder:text-slate-500"
                  />
                  <div className="px-3">
                    <span
                      className="text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: userColor.bg, color: userColor.text }}
                    >
                      {row.user}
                    </span>
                  </div>
                  <select
                    value={row.status}
                    onChange={(e) => updateStatus(row.id, e.target.value as DTFStatus)}
                    className="h-7 rounded-lg px-2.5 text-[12px] font-semibold text-white outline-none cursor-pointer"
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

                {/* Pastilles de suivi + quantité */}
                <div className="px-4 pb-2.5 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">Qté</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={row.quantity}
                    onChange={(e) => updateQuantity(row.id, parseInt(e.target.value) || 1)}
                    className="w-11 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 outline-none text-center focus:border-blue-300 focus:bg-white transition-colors"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {Array.from({ length: row.quantity }, (_, i) => {
                      const done = row.completedItems[i] ?? false;
                      return (
                        <button
                          key={i}
                          onClick={() => togglePill(row.id, i)}
                          title={`Pièce ${i + 1}${done ? " — terminée" : ""}`}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 transition-all duration-150 hover:scale-110 active:scale-95",
                            done
                              ? "bg-emerald-500 border-emerald-500 shadow-sm"
                              : "bg-transparent border-slate-300 hover:border-blue-400",
                          )}
                        />
                      );
                    })}
                  </div>
                  {row.quantity > 1 && (
                    <span className="text-[11px] text-slate-400 ml-0.5 shrink-0">
                      {doneCount}/{row.quantity}
                    </span>
                  )}
                </div>

                {/* Champ erreur */}
                {row.status === "erreur" && (
                  <div className="px-4 pb-2.5 pt-0">
                    <input
                      value={row.problem ?? ""}
                      onChange={(e) => updateTextField(row.id, "problem", e.target.value)}
                      placeholder="Problème rencontré…"
                      className="w-full h-7 rounded-lg px-2.5 text-[12px] bg-red-50 border border-red-100 text-slate-700 outline-none focus:border-red-300 focus:bg-white transition-colors placeholder:text-slate-500"
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
