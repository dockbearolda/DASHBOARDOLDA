"use client";

/**
 * AchatTextileTable — Tableau d'achats textile.
 * Colonnes : Client · Fournisseur · Marque · Genre · Désignation ·
 *            Référence · Couleur · Taille · Qté · Livraison · Session · Date
 * Toutes les cellules sont éditables inline ; session + date sont auto-remplis.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AchatTextileRow {
  id:          string;
  client:      string;
  fournisseur: string;
  marque:      string;
  genre:       string;
  designation: string;
  reference:   string;
  couleur:     string;
  taille:      string;
  quantite:    number;
  livraison:   string;
  sessionUser: string;
  createdAt:   string;
  updatedAt:   string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MARQUES  = ["-", "Native", "Kariban", "Pro Act"] as const;
const GENRES   = ["", "H", "F", "E", "B", "P", "L"]   as const;

interface LivraisonOption {
  value: string;
  label: string;
  bg:    string;
  text:  string;
}

const LIVRAISONS: LivraisonOption[] = [
  { value: "",           label: "—",          bg: "#f2f2f7", text: "#8e8e93" },
  { value: "chronopost", label: "Chronopost", bg: "#e8f2ff", text: "#0071e3" },
  { value: "maritime",   label: "Maritime",   bg: "#e8faf0", text: "#1a9e3f" },
  { value: "sas_us",     label: "SAS US",     bg: "#fff3e0", text: "#c4700a" },
];

function getLivraison(value: string): LivraisonOption {
  return LIVRAISONS.find(l => l.value === value) ?? LIVRAISONS[0];
}

// Grid : 12 colonnes données + 1 colonne suppression
const GRID_STYLE = {
  gridTemplateColumns:
    "minmax(110px,1fr) minmax(110px,1fr) 106px 60px minmax(130px,1.5fr) 100px 90px 70px 58px 120px 82px 80px 44px",
};
const MIN_WIDTH = 1260;
const CELL = "px-3 py-2.5";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "2-digit",
  });
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface AchatTextileTableProps {
  activeUser?: string;
}

export function AchatTextileTable({ activeUser }: AchatTextileTableProps) {
  const [rows,    setRows]    = useState<AchatTextileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Chargement ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    fetch("/api/achat-textile")
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const refs = debounceRefs.current;
    return () => { Object.values(refs).forEach(clearTimeout); };
  }, []);

  // ── Ajouter ───────────────────────────────────────────────────────────────

  const addRow = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/achat-textile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionUser: activeUser ?? "" }),
      });
      if (!res.ok) return;
      const { row } = await res.json();
      setRows(prev => [row, ...prev]);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activeUser, saving]);

  // ── Supprimer ─────────────────────────────────────────────────────────────

  const deleteRow = useCallback(async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/achat-textile/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
  }, []);

  // ── Mettre à jour (immédiat) — selects, quantité ──────────────────────────

  const updateField = useCallback(async (id: string, field: string, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    try {
      await fetch(`/api/achat-textile/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ [field]: value }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Mettre à jour (debounce 600 ms) — champs texte ───────────────────────

  const updateText = useCallback((id: string, field: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const key = `${id}_${field}`;
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(async () => {
      try {
        await fetch(`/api/achat-textile/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ [field]: value }),
        });
      } catch { /* ignore */ }
    }, 600);
  }, []);

  // ── Slots OrderTable ──────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={addRow}
        disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0"
      >
        {saving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Plus className="h-3.5 w-3.5" />
        }
        <span>Ajouter une commande</span>
      </button>
    </div>
  );

  const HEADER_LABELS = [
    "Client", "Fournisseur", "Marque", "Genre",
    "Désignation", "Référence", "Couleur", "Taille",
    "Qté", "Livraison", "Session", "Date", "",
  ];

  const headers = (
    <div className="grid" style={{ ...GRID_STYLE, minWidth: MIN_WIDTH }}>
      {HEADER_LABELS.map((h, i) => (
        <div key={i} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {h}
        </div>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OrderTable
      toolbar={toolbar}
      headers={headers}
      className="h-full"
      bodyClassName="overflow-auto flex-1 min-h-0"
      minWidth={MIN_WIDTH}
    >
      {loading ? (
        <div className="flex items-center justify-center h-24 gap-2 text-[13px] text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-[13px] text-slate-300">
          Aucune commande
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map(row => {
            const livr = getLivraison(row.livraison);
            return (
              <div
                key={row.id}
                className="grid items-center hover:bg-slate-50/70 transition-colors group"
                style={{ ...GRID_STYLE, minWidth: MIN_WIDTH }}
              >
                {/* Client */}
                <input
                  value={row.client}
                  onChange={e => updateText(row.id, "client", e.target.value)}
                  placeholder="Client…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full truncate")}
                />

                {/* Fournisseur */}
                <input
                  value={row.fournisseur}
                  onChange={e => updateText(row.id, "fournisseur", e.target.value)}
                  placeholder="Fournisseur…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full truncate")}
                />

                {/* Marque */}
                <div className={CELL}>
                  <select
                    value={row.marque}
                    onChange={e => updateField(row.id, "marque", e.target.value)}
                    className="w-full text-[13px] text-slate-900 bg-transparent outline-none cursor-pointer"
                  >
                    {MARQUES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Genre */}
                <div className={CELL}>
                  <select
                    value={row.genre}
                    onChange={e => updateField(row.id, "genre", e.target.value)}
                    className="w-full text-[13px] text-slate-900 bg-transparent outline-none cursor-pointer"
                  >
                    {GENRES.map(g => <option key={g} value={g}>{g || "—"}</option>)}
                  </select>
                </div>

                {/* Désignation */}
                <input
                  value={row.designation}
                  onChange={e => updateText(row.id, "designation", e.target.value)}
                  placeholder="Désignation…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full truncate")}
                />

                {/* Référence */}
                <input
                  value={row.reference}
                  onChange={e => updateText(row.id, "reference", e.target.value)}
                  placeholder="Réf…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full truncate")}
                />

                {/* Couleur */}
                <input
                  value={row.couleur}
                  onChange={e => updateText(row.id, "couleur", e.target.value)}
                  placeholder="Couleur…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full truncate")}
                />

                {/* Taille */}
                <input
                  value={row.taille}
                  onChange={e => updateText(row.id, "taille", e.target.value)}
                  placeholder="S/M…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-300 w-full")}
                />

                {/* Quantité */}
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.quantite}
                  onChange={e => {
                    const val = parseInt(e.target.value.replace(/\D/g, "")) || 1;
                    updateField(row.id, "quantite", val);
                  }}
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none text-center w-full")}
                />

                {/* Livraison */}
                <div className={CELL}>
                  <select
                    value={row.livraison}
                    onChange={e => updateField(row.id, "livraison", e.target.value)}
                    className="w-full h-6 rounded-md px-2 text-[11px] font-semibold outline-none cursor-pointer border-0 appearance-none"
                    style={{ backgroundColor: livr.bg, color: livr.text }}
                  >
                    {LIVRAISONS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Session (lecture seule) */}
                <div className={cn(CELL, "text-[12px] text-slate-500 capitalize truncate")}>
                  {row.sessionUser || "—"}
                </div>

                {/* Date création (lecture seule) */}
                <div className={cn(CELL, "text-[12px] text-slate-400")}>
                  {row.createdAt ? fmtDate(row.createdAt) : "—"}
                </div>

                {/* Supprimer */}
                <div className="flex items-center justify-center px-2">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OrderTable>
  );
}
