"use client";

/**
 * AchatTextileTable — Tableau d'achats textile.
 * Colonnes : Client · Fournisseur · Marque · Genre · Désignation ·
 *            Référence · Couleur · Taille · Qté · Livraison · Session · Date
 * Toutes les cellules sont éditables inline ; session + date sont auto-remplis.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, Copy, X, Archive, RotateCcw } from "lucide-react";
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

const FOURNISSEURS = ["-", "Toptex", "S&S Activewear"] as const;
const MARQUES      = ["-", "Native", "Kariban", "Pro Act"]        as const;
const GENRES       = ["", "H", "F", "E", "B", "P", "L"]          as const;

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

// Grid : 12 colonnes données + 1 colonne actions (dupliquer + supprimer)
const GRID_STYLE = {
  gridTemplateColumns:
    "minmax(110px,1fr) minmax(110px,1fr) 106px 60px minmax(130px,1.5fr) 100px 90px 70px 58px 120px 82px 80px 80px",
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
  activeUser?:     string;
  refreshTrigger?: number;
}

export function AchatTextileTable({ activeUser, refreshTrigger }: AchatTextileTableProps) {
  const [rows,    setRows]    = useState<AchatTextileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // ── Inline quick-add ─────────────────────────────────────────────────────
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickDraft,    setQuickDraft]    = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  // ── Archive ───────────────────────────────────────────────────────────────
  const [showArchived,   setShowArchived]   = useState(false);
  const [archiveRows,    setArchiveRows]    = useState<AchatTextileRow[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const fetchArchived = useCallback(async () => {
    setLoadingArchive(true);
    try {
      const res  = await fetch("/api/achat-textile?archived=true");
      const data = await res.json();
      setArchiveRows(data.rows ?? []);
    } catch { /* ignore */ }
    finally { setLoadingArchive(false); }
  }, []);

  const archiveRow = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/achat-textile/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ archived: true }),
      });
    } catch { /* ignore */ }
  }, []);

  const restoreRow = useCallback(async (id: string) => {
    setArchiveRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const res  = await fetch(`/api/achat-textile/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ archived: false }),
      });
      const data = await res.json();
      if (data.row) setRows((prev) => [data.row, ...prev]);
    } catch { /* ignore */ }
  }, []);

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

  // Rafraîchir quand refreshTrigger change (ex: création depuis Planning)
  useEffect(() => {
    if (!refreshTrigger) return;
    fetch("/api/achat-textile")
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    const refs = debounceRefs.current;
    return () => { Object.values(refs).forEach(clearTimeout); };
  }, []);

  // ── Ajouter ───────────────────────────────────────────────────────────────

  const addRow = useCallback(async (client: string = "") => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/achat-textile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionUser: activeUser ?? "", client }),
      });
      if (!res.ok) return;
      const { row } = await res.json();
      setRows(prev => [row, ...prev]);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activeUser, saving]);

  // ── Dupliquer ─────────────────────────────────────────────────────────────

  const duplicateRow = useCallback(async (row: AchatTextileRow) => {
    try {
      const res = await fetch("/api/achat-textile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sessionUser: activeUser ?? "",
          client:      row.client,
          fournisseur: row.fournisseur,
          marque:      row.marque,
          genre:       row.genre,
          designation: row.designation,
          reference:   row.reference,
          couleur:     row.couleur,
          taille:      row.taille,
          quantite:    row.quantite,
          livraison:   row.livraison,
        }),
      });
      if (!res.ok) return;
      const { row: newRow } = await res.json();
      setRows(prev => {
        const idx = prev.findIndex(r => r.id === row.id);
        const next = [...prev];
        next.splice(idx + 1, 0, newRow);
        return next;
      });
    } catch { /* ignore */ }
  }, [activeUser]);

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
            placeholder="Nom du client…"
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
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm shrink-0"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Plus className="h-3.5 w-3.5" />
          }
          <span>Ajouter une commande</span>
        </button>
      )}

      <div className="flex-1" />

      {/* Bouton Archives */}
      <button
        onClick={() => {
          if (showArchived) {
            setShowArchived(false);
          } else {
            setShowArchived(true);
            fetchArchived();
          }
        }}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold shrink-0 transition-all duration-[80ms]",
          showArchived
            ? "bg-amber-50 text-amber-600 border border-amber-200"
            : "bg-slate-100/80 text-slate-500 hover:bg-amber-50 hover:text-amber-500 border border-transparent",
        )}
      >
        <Archive className="h-3 w-3" />
        Archives
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
      {/* ── Vue Archives ─────────────────────────────────────────────────── */}
      {showArchived ? (
        loadingArchive ? (
          <div className="flex items-center justify-center h-24 gap-2 text-[13px] text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : archiveRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center select-none">
            <Archive className="h-8 w-8 text-slate-200" />
            <p className="text-[13px] text-slate-400">Aucune commande archivée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {archiveRows.map(row => {
              const livr = getLivraison(row.livraison);
              return (
                <div
                  key={row.id}
                  className="grid items-center bg-amber-50/30 hover:bg-amber-50/60 transition-colors group"
                  style={{ ...GRID_STYLE, minWidth: MIN_WIDTH }}
                >
                  <div className={cn(CELL, "text-[13px] text-slate-500 truncate")}>{row.client || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400 truncate")}>{row.fournisseur || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400")}>{row.marque}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400")}>{row.genre || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400 truncate")}>{row.designation || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400 truncate")}>{row.reference || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400 truncate")}>{row.couleur || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400")}>{row.taille || "—"}</div>
                  <div className={cn(CELL, "text-[13px] text-slate-400 text-center")}>{row.quantite}</div>
                  <div className={CELL}>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: livr.bg, color: livr.text }}>
                      {livr.label}
                    </span>
                  </div>
                  <div className={cn(CELL, "text-[12px] text-slate-400 capitalize")}>{row.sessionUser || "—"}</div>
                  <div className={cn(CELL, "text-[12px] text-slate-400")}>{row.createdAt ? fmtDate(row.createdAt) : "—"}</div>
                  <div className="flex items-center justify-center gap-1 px-2">
                    <button
                      onClick={() => restoreRow(row.id)}
                      className="flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold text-amber-600 hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Restaurer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restaurer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
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
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-500 w-full truncate")}
                />

                {/* Fournisseur */}
                <div className={CELL}>
                  <select
                    value={FOURNISSEURS.includes(row.fournisseur as typeof FOURNISSEURS[number]) ? row.fournisseur : "-"}
                    onChange={e => updateField(row.id, "fournisseur", e.target.value)}
                    className="w-full text-[13px] text-slate-900 bg-transparent outline-none cursor-pointer"
                  >
                    {FOURNISSEURS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

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
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-500 w-full truncate")}
                />

                {/* Référence */}
                <input
                  value={row.reference}
                  onChange={e => updateText(row.id, "reference", e.target.value)}
                  placeholder="Réf…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-500 w-full truncate")}
                />

                {/* Couleur */}
                <input
                  value={row.couleur}
                  onChange={e => updateText(row.id, "couleur", e.target.value)}
                  placeholder="Couleur…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-500 w-full truncate")}
                />

                {/* Taille */}
                <input
                  value={row.taille}
                  onChange={e => updateText(row.id, "taille", e.target.value)}
                  placeholder="S/M…"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none placeholder:text-slate-500 w-full")}
                />

                {/* Quantité */}
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.quantite === 0 ? "" : row.quantite}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const val = raw === "" ? 0 : parseInt(raw);
                    updateField(row.id, "quantite", val);
                  }}
                  placeholder="Qté"
                  className={cn(CELL, "text-[13px] text-slate-900 bg-transparent outline-none text-center w-full placeholder:text-slate-500")}
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

                {/* Actions : dupliquer + archiver + supprimer */}
                <div className="flex items-center justify-center gap-0.5 px-1">
                  <button
                    onClick={() => duplicateRow(row)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Dupliquer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => archiveRow(row.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Archiver"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
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
