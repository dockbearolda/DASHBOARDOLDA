"use client";

/**
 * PRTRequestPanel — Envoi de demandes PRT vers Loïc
 * ─ Formulaire 4 champs + bouton "Envoyer à Loïc"
 * ─ Liste partagée (localStorage) lisible par tous
 * ─ Loïc peut marquer les demandes comme traitées
 * ─ Style San Francisco / Apple minimaliste
 */

import { useState, useEffect, useCallback } from "react";
import { Send, CheckCheck, Trash2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────────

type PRTStatus = "nouveau" | "vu" | "traite";

interface PRTRequest {
  id: string;
  category: string;
  size: string;
  quantity: number;
  color: string;
  from: string;
  createdAt: string;
  status: PRTStatus;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "prt_requests_v1";

const CATEGORIES = [
  "T-shirt",
  "Polo",
  "Sweat",
  "Casquette",
  "Sac",
  "Accessoire",
  "Autre",
];

const STATUS_CONFIG: Record<PRTStatus, { label: string; color: string; bg: string }> = {
  nouveau:  { label: "Nouveau",  color: "#007aff", bg: "#e8f0fe" },
  vu:       { label: "Vu",       color: "#ff9500", bg: "#fff3e0" },
  traite:   { label: "Traité",   color: "#28cd41", bg: "#e8f5e9" },
};

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif";

// ── Persistence ────────────────────────────────────────────────────────────────

function loadRequests(): PRTRequest[] {
  if (typeof window === "undefined") return [];
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; }
  catch { return []; }
}

function saveRequests(reqs: PRTRequest[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs)); } catch {}
}

function newId(): string {
  return `prt${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
}

// ── Input styles ───────────────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 " +
  "placeholder:text-gray-300 outline-none focus:border-blue-400 focus:bg-white transition-colors";

const labelCls =
  "block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1";

// ── Main component ─────────────────────────────────────────────────────────────

export function PRTRequestPanel({ activeUser }: { activeUser: string }) {
  const [requests, setRequests] = useState<PRTRequest[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [size,     setSize]     = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [color,    setColor]    = useState("");
  const [sent,     setSent]     = useState(false);

  const isLoic = activeUser.toLowerCase() === "loic" || activeUser.toLowerCase() === "loïc";

  // Charge depuis localStorage
  useEffect(() => {
    setRequests(loadRequests());
  }, []);

  // Sync si localStorage change (autre onglet)
  useEffect(() => {
    const handler = () => setRequests(loadRequests());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const persist = useCallback((next: PRTRequest[]) => {
    setRequests(next);
    saveRequests(next);
  }, []);

  // ── Envoi ────────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!size.trim() || !color.trim()) return;
    const req: PRTRequest = {
      id:        newId(),
      category,
      size:      size.trim(),
      quantity,
      color:     color.trim(),
      from:      activeUser,
      createdAt: new Date().toISOString(),
      status:    "nouveau",
    };
    persist([req, ...requests]);
    // Reset form
    setCategory(CATEGORIES[0]);
    setSize("");
    setQuantity(1);
    setColor("");
    // Flash confirmation
    setSent(true);
    setTimeout(() => setSent(false), 2200);
  };

  // ── Actions Loïc ─────────────────────────────────────────────────────────────
  const markVu     = (id: string) => persist(requests.map(r => r.id === id ? { ...r, status: "vu" }    : r));
  const markTraite = (id: string) => persist(requests.map(r => r.id === id ? { ...r, status: "traite" } : r));
  const deleteReq  = (id: string) => persist(requests.filter(r => r.id !== id));
  const clearTraited = () => persist(requests.filter(r => r.status !== "traite"));

  const pendingCount = requests.filter(r => r.status !== "traite").length;

  return (
    <div className="flex flex-col gap-5 pb-6" style={{ fontFamily: SF }}>

      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Header formulaire */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aeaeb2" }}>
              Nouvelle demande
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f", marginTop: 2 }}>
              Envoyer à Loïc
            </p>
          </div>
          {sent && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50 border border-green-100 animate-fade-up">
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#28cd41" }}>Envoyé !</span>
            </div>
          )}
        </div>

        {/* Champs */}
        <div className="px-4 pt-3 pb-4 grid grid-cols-2 gap-3">
          {/* Catégorie */}
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Catégorie</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={fieldCls}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Couleur */}
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Couleur</label>
            <input
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="ex : Blanc, Noir…"
              className={fieldCls}
            />
          </div>

          {/* Taille */}
          <div>
            <label className={labelCls}>Taille</label>
            <input
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder="ex : L, XL, 300mm…"
              className={fieldCls}
            />
          </div>

          {/* Quantité */}
          <div>
            <label className={labelCls}>Quantité</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              className={fieldCls}
            />
          </div>
        </div>

        {/* Bouton envoi */}
        <div className="px-4 pb-4">
          <button
            onClick={handleSend}
            disabled={!size.trim() || !color.trim()}
            className={cn(
              "w-full h-10 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2",
              "transition-all duration-150",
              size.trim() && color.trim()
                ? "bg-gray-900 text-white hover:bg-gray-700 active:scale-[0.98]"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            )}
          >
            <Send className="h-3.5 w-3.5" />
            Envoyer à Loïc
          </button>
        </div>
      </div>

      {/* ── Liste des demandes ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">

        {/* Header liste */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-gray-400" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }}>
              Demandes{pendingCount > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded-full px-1 text-[10px] font-bold"
                  style={{ background: "#007aff", color: "#fff" }}
                >
                  {pendingCount}
                </span>
              )}
            </span>
          </div>
          {isLoic && requests.some(r => r.status === "traite") && (
            <button
              onClick={clearTraited}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Vider les traités
            </button>
          )}
        </div>

        {/* Cartes */}
        {requests.length === 0 ? (
          <div className="flex items-center justify-center h-16 rounded-2xl border border-dashed border-gray-200">
            <span style={{ fontSize: 13, color: "#d1d1d6" }}>Aucune demande</span>
          </div>
        ) : (
          requests.map(req => {
            const sc = STATUS_CONFIG[req.status];
            const date = new Date(req.createdAt);
            return (
              <div
                key={req.id}
                className={cn(
                  "rounded-2xl bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.04)]",
                  "overflow-hidden transition-all duration-200",
                  req.status === "traite" && "opacity-50"
                )}
              >
                {/* Top row */}
                <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                  {/* Badge catégorie */}
                  <span
                    className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "#f5f5f7", color: "#3a3a3c" }}
                  >
                    {req.category}
                  </span>

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1d1d1f" }}>
                      {req.quantity}×
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }} className="truncate">
                      {req.size}
                    </span>
                    <span style={{ fontSize: 13, color: "#8e8e93" }} className="truncate">
                      {req.color}
                    </span>
                  </div>

                  {/* Badge statut */}
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: sc.bg, color: sc.color }}
                  >
                    {sc.label}
                  </span>
                </div>

                {/* Bottom row */}
                <div className="flex items-center gap-2 px-4 pb-2.5 border-t border-gray-50 pt-2">
                  <span style={{ fontSize: 11, color: "#aeaeb2" }}>
                    De <strong style={{ color: "#8e8e93", fontWeight: 600 }}>{req.from}</strong>
                    {" · "}
                    {format(date, "d MMM, HH:mm", { locale: fr })}
                  </span>

                  {/* Actions Loïc */}
                  {isLoic && req.status !== "traite" && (
                    <div className="ml-auto flex items-center gap-1">
                      {req.status === "nouveau" && (
                        <button
                          onClick={() => markVu(req.id)}
                          className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-colors"
                          style={{ background: "#fff3e0", color: "#ff9500" }}
                        >
                          Vu
                        </button>
                      )}
                      <button
                        onClick={() => markTraite(req.id)}
                        className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-colors"
                        style={{ background: "#e8f5e9", color: "#28cd41" }}
                      >
                        Traité ✓
                      </button>
                    </div>
                  )}

                  {/* Suppression (tous) */}
                  {(isLoic || req.from === activeUser) && (
                    <button
                      onClick={() => deleteReq(req.id)}
                      className={cn(
                        "h-6 w-6 flex items-center justify-center rounded-lg",
                        "text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors",
                        !isLoic && req.from !== activeUser && "hidden",
                        isLoic ? "ml-auto" : "ml-auto"
                      )}
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
