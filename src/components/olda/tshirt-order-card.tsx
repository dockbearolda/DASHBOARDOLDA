"use client";

/**
 * TshirtOrderCard
 * ─ Bulle Apple (coins 24px, fond blanc, ombre légère, SF Pro)
 * ─ Supporte les deux formats : webhook legacy + nouveau format Olda Studio JSON
 * ─ Click → Fiche de commande (modal) avec @media print format autocollant
 * ─ Attribution utilisateur : chaque tâche ajoutée est préfixée [prenom]
 * ─ Light mode only — zero dark: variants
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Plus, X, Upload, AlertCircle, Package, Printer } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Order, OrderItem, OldaExtraData } from "@/types/order";

// ── Utilisateur connecté (session 07h/13h) ────────────────────────────────────
// Lit le nom depuis localStorage sans prop drilling — utilisé pour attribuer les tâches.

function useActiveUser(): string {
  const [user, setUser] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("olda_session");
      if (!raw) return;
      const s = JSON.parse(raw) as { name?: string };
      setUser(s.name ?? "");
    } catch { /* ignore */ }
  }, []);
  return user;
}

// ── Per-card todo ──────────────────────────────────────────────────────────────

interface CardTodo { id: string; text: string; done: boolean; }

function useTodos(orderId: string) {
  const key = `olda-todos-${orderId}`;
  const [todos, setTodos] = useState<CardTodo[]>(() => {
    if (typeof window === "undefined") return [];
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as CardTodo[]) : []; }
    catch { return []; }
  });
  const save = useCallback((u: CardTodo[]) => {
    setTodos(u);
    try { localStorage.setItem(key, JSON.stringify(u)); } catch { /* quota */ }
  }, [key]);
  // Le texte est déjà préfixé [utilisateur] par l'appelant si nécessaire
  const addTodo    = useCallback((t: string) => { if (t.trim()) save([...todos, { id: crypto.randomUUID(), text: t.trim(), done: false }]); }, [todos, save]);
  const toggleTodo = useCallback((id: string) => save(todos.map((t) => t.id === id ? { ...t, done: !t.done } : t)), [todos, save]);
  const deleteTodo = useCallback((id: string) => save(todos.filter((t) => t.id !== id)), [todos, save]);
  return { todos, addTodo, toggleTodo, deleteTodo };
}

// ── Local images ───────────────────────────────────────────────────────────────

function useLocalImages(orderId: string) {
  const key = `olda-images-${orderId}`;
  const [imgs, setImgs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as string[]) : []; }
    catch { return []; }
  });
  const addImage = useCallback((dataUrl: string) => {
    setImgs((prev) => {
      const updated = [...prev, dataUrl].slice(0, 2);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [key]);
  return { localImages: imgs, addImage };
}

// ── QR origin (client-only) ────────────────────────────────────────────────────

function useOrigin() {
  const [o, setO] = useState("");
  useEffect(() => { setO(window.location.origin); }, []);
  return o;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

/** Deadline → "Dans 3 jours · 15 janv." | "Aujourd'hui !" | "⚠️ En retard (2j)" */
function deadlineLabel(deadline: string | undefined | null): string | null {
  if (!deadline) return null;
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return deadline; // texte brut non parseable → affiché tel quel
    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0)   return `⚠️ En retard (${Math.abs(diff)}j)`;
    if (diff === 0) return "Aujourd'hui !";
    if (diff === 1) return "Demain";
    return `Dans ${diff} jours · ${format(d, "d MMM", { locale: fr })}`;
  } catch { return deadline; }
}

/** Lit les données extra Olda Studio depuis shippingAddress (JSONB) */
function readExtra(order: Order): OldaExtraData {
  if (!order.shippingAddress) return {};
  const sa = order.shippingAddress as Record<string, unknown>;
  if (sa._source === "olda_studio") return sa as unknown as OldaExtraData;
  return {};
}

/** Vérifie si une chaîne est un code DTF (pas une URL ni un data URL) */
function isDtfCode(s: string | undefined | null): boolean {
  if (!s) return false;
  return !s.startsWith("http") && !s.startsWith("data:");
}

// ── Pastille de paiement ───────────────────────────────────────────────────────

function PaymentDot({ status }: { status: string }) {
  const paid = status === "PAID";
  return (
    <span
      title={paid ? "Payé ✓" : "Paiement en attente"}
      className={cn(
        "h-2 w-2 rounded-full shrink-0 transition-colors",
        paid ? "bg-emerald-500" : "bg-amber-400"
      )}
    />
  );
}

// ── Fiche de commande (modal + impression) ─────────────────────────────────────

function OrderFicheModal({
  order, extra, images, addImage, origin, onClose,
}: {
  order: Order;
  extra: OldaExtraData;
  images: string[];
  addImage: (url: string) => void;
  origin: string;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";

  // QR Code : URL vers la fiche complète dans le dashboard
  const qrValue = origin
    ? `${origin}/dashboard/orders/${order.id}`
    : order.orderNumber;

  const createdAt     = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt as string);
  const formattedDate = format(createdAt, "d MMMM yyyy", { locale: fr });

  // ── Données de la fiche — Olda Studio en priorité, fallback legacy ──────────
  const reference   = extra.reference || order.orderNumber;
  const deadlineTxt = deadlineLabel(extra.deadline ?? order.notes);
  const dtfSize     = extra.coteLogoAr ?? null;

  // Visuels : codes DTF ou images uploadées localement
  const logoAvant   = extra.logoAvant   ?? images[0] ?? null;
  const logoArriere = extra.logoArriere ?? images[1] ?? null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { addImage(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[3px]"
      onClick={onClose}
    >
      {/*
        CSS @media print — isole uniquement la fiche autocollant.
        "visibility: hidden" sur body masque tout sauf .olda-fiche-print
        sans retirer les éléments du flux (évite les sauts de mise en page).
      */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .olda-fiche-print, .olda-fiche-print * { visibility: visible !important; }
          .olda-fiche-print {
            position: fixed !important;
            inset: 0 !important;
            padding: 1cm !important;
            background: white !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif !important;
          }
        }
      `}</style>

      <div
        className="w-full max-w-lg bg-white rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] border border-gray-200/80 overflow-hidden max-h-[92svh] overflow-y-auto pb-safe"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Toolbar ── */}
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Bon de Commande · {formattedDate}
            </p>
            <h2 className="text-[20px] font-bold text-gray-900 mt-0.5 leading-tight">
              {reference}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Bouton impression */}
            <button
              onClick={() => window.print()}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Imprimer l'autocollant"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* ══ FICHE AUTOCOLLANT — seul ce bloc est imprimé (@media print) ══════ */}
        <div className="olda-fiche-print px-5 pt-5 pb-4">
          <div className="flex items-start gap-5">

            {/* ─ Gauche : 6 lignes dans l'ordre exact ─ */}
            <div className="flex-1 space-y-[6px] min-w-0">

              {/* L1 — "Bon de Commande" */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Bon de Commande
              </p>

              {/* L2 — Référence produit */}
              <p className="text-[17px] font-bold text-gray-900 truncate leading-tight">
                {reference}
              </p>

              {/* L3 — Prénom Nom */}
              <p className="text-[14px] font-semibold text-gray-800 truncate">
                {order.customerName}
              </p>

              {/* L4 — Téléphone */}
              <p className="text-[13px] text-gray-600 truncate">
                {order.customerPhone ?? "—"}
              </p>

              {/* L5 — Deadline + jours restants */}
              <p className={cn(
                "text-[12px] font-medium truncate flex items-center gap-1",
                deadlineTxt?.includes("retard") ? "text-red-500" : "text-gray-700"
              )}>
                {deadlineTxt
                  ? <><AlertCircle className="h-2.5 w-2.5 shrink-0" />{deadlineTxt}</>
                  : <span className="text-gray-300">Deadline : —</span>
                }
              </p>

              {/* L6 — Taille DTF Arrière (fiche.coteLogoAr) */}
              <p className="text-[12px] text-gray-500 truncate">
                <span className="font-medium text-gray-400">DTF AR : </span>
                {dtfSize ?? (isDtfCode(logoArriere) ? logoArriere : "—")}
              </p>
            </div>

            {/* ─ Droite : QR Code ─ */}
            {origin && (
              <div className="shrink-0 rounded-xl border border-gray-200 p-[5px] bg-white shadow-sm">
                <QRCodeSVG
                  value={qrValue}
                  size={96}
                  bgColor="#ffffff"
                  fgColor="#1d1d1f"
                  level="M"
                />
              </div>
            )}
          </div>

          {/* Pastille paiement dans la fiche */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
            <PaymentDot status={order.paymentStatus} />
            <span className="text-[11px] text-gray-400">
              {order.paymentStatus === "PAID" ? "Payé" : "Paiement en attente"}
            </span>
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-gray-700">
              {fmtPrice(order.total, currency)}
            </span>
          </div>
        </div>
        {/* ══ fin bloc @media print ═════════════════════════════════════════════ */}

        {/* ── Visuels (logos DTF) ── */}
        <div className="px-5 pt-3 pb-4 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
            Visuels
          </p>
          {(logoAvant || logoArriere) ? (
            <div className="flex gap-3">
              {([
                { src: logoAvant,   label: "Avant" },
                { src: logoArriere, label: "Arrière" },
              ] as { src: string | null; label: string }[]).map(({ src, label }) =>
                src ? (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {label}
                    </span>
                    {isDtfCode(src) ? (
                      /* Code DTF référence — affiché comme tag monospace */
                      <div className="w-full flex items-center justify-center h-16 rounded-2xl border border-gray-200 bg-white font-mono text-[13px] font-semibold text-gray-700 shadow-sm px-2 text-center">
                        {src}
                      </div>
                    ) : (
                      /* Image uploadée localement ou URL */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`Visual ${label}`}
                        className="w-full object-contain rounded-2xl border border-gray-200 bg-white shadow-sm"
                        style={{ maxHeight: 180 }}
                      />
                    )}
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border border-dashed border-gray-300 cursor-pointer hover:bg-white transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-[13px] text-gray-400">Ajouter Avant + Arrière</span>
            </label>
          )}
        </div>

        {/* ── Articles (format legacy avec prix > 0) ── */}
        {items.filter(i => i.price > 0).length > 0 && (
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Package className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Articles
              </p>
            </div>
            <div className="space-y-2">
              {items.map((item: OrderItem) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  {item.imageUrl && !isDtfCode(item.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-gray-200 bg-white shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{item.name}</p>
                    {item.sku && <p className="text-[11px] text-gray-400 font-mono truncate">{item.sku}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">×{item.quantity}</span>
                    <span className="text-[12px] font-semibold tabular-nums text-gray-700">
                      {fmtPrice(item.price * item.quantity, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-[13px] font-semibold text-gray-900">Total</span>
              <span className="text-[15px] font-bold tabular-nums text-gray-900">
                {fmtPrice(order.total, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main card — Bulle Apple ───────────────────────────────────────────────────

export function TshirtOrderCard({ order, isNew, onDelete }: { order: Order; isNew?: boolean; onDelete?: () => void }) {
  const items    = Array.isArray(order.items) ? order.items : [];
  const currency = (order.currency as string) ?? "EUR";
  const origin     = useOrigin();
  const activeUser = useActiveUser(); // utilisateur connecté (session 07h/13h)

  // ── Données Olda Studio (extra data) ──────────────────────────────────────
  const extra = readExtra(order);

  // Séparation prénom / nom — convention "Prénom NOM" (1er mot = prénom)
  const nameParts = (order.customerName ?? "").trim().split(/\s+/);
  const prenom    = nameParts[0] ?? "";
  const nom       = nameParts.slice(1).join(" ") || prenom;

  // DTF Arrière : coteLogoAr > logoArriere (code) > détection legacy depuis items
  const dtfItem  = items.find((i) => /arrière|arriere|back|dtf/i.test(i.name ?? "") || /arrière|arriere|back|dtf/i.test(i.sku ?? ""));
  const dtfLabel = extra.coteLogoAr ?? extra.logoArriere ?? dtfItem?.sku ?? dtfItem?.name ?? items[0]?.sku ?? null;

  const serverImages  = items.filter((i) => i.imageUrl && !isDtfCode(i.imageUrl)).map((i) => i.imageUrl as string).slice(0, 2);
  const { localImages, addImage } = useLocalImages(order.id);
  const displayImages = serverImages.length > 0 ? serverImages : localImages;

  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(order.id);
  const [newText, setNewText]     = useState("");
  const [todoOpen, setTodoOpen]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const pendingCount = todos.filter((t) => !t.done).length;

  const qrValue = origin ? `${origin}/dashboard/orders/${order.id}` : order.orderNumber;

  // Attribution utilisateur : [prenom] texte — trace qui a créé la tâche
  const handleAddTodo = () => {
    if (!newText.trim()) return;
    const prefix = activeUser ? `[${activeUser}] ` : "";
    addTodo(prefix + newText.trim());
    setNewText("");
  };
  const handleTodoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddTodo(); }
  };

  return (
    <>
      {/* ── Card shell — Bulle Apple 24px ── */}
      <div
        className={cn(
          "relative group/card rounded-[24px] bg-white border overflow-hidden",
          "transition-all duration-200 cursor-pointer select-none [touch-action:manipulation]",
          "shadow-[0_1px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] hover:border-gray-300",
          isNew
            ? "border-blue-400/60 ring-2 ring-blue-400/30 animate-fade-up"
            : "border-gray-200/80"
        )}
        onClick={() => setModalOpen(true)}
      >
        {/* ── Croix de suppression — discrète, visible au hover, Apple style ── */}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Supprimer cette commande"
            className={cn(
              "absolute top-2.5 right-2.5 z-10",
              "opacity-0 group-hover/card:opacity-100 transition-opacity duration-150",
              "h-5 w-5 rounded-full flex items-center justify-center",
              "bg-white border border-gray-200 shadow-sm",
              "hover:bg-red-50 hover:border-red-300",
            )}
          >
            <X className="h-2.5 w-2.5 text-gray-400 hover:text-red-500" />
          </button>
        )}

        {/* ══ Layout horizontal : QR gauche · Infos droite ══════════════════ */}
        <div
          className="flex items-stretch cursor-pointer select-none"
          onClick={() => setModalOpen(true)}
        >
          {/* ─ Colonne gauche : QR Code uniquement ─ */}
          {origin && (
            <div className="shrink-0 flex items-center justify-center p-3 border-r border-gray-100">
              <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-[5px]">
                <QRCodeSVG value={qrValue} size={76} bgColor="#ffffff" fgColor="#1d1d1f" level="M" />
              </div>
            </div>
          )}

          {/* ─ Colonne droite : Identité · Production · Footer ─ */}
          <div className="flex-1 min-w-0 flex flex-col justify-between px-3 py-3 gap-3">

            {/* ── Bloc Identité ── */}
            <div className="flex flex-col gap-[3px]">
              {/* NOM — majuscules, semibold */}
              <p
                className="truncate leading-tight"
                style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.02em", color: "#1d1d1f", textTransform: "uppercase" }}
              >
                {nom}
              </p>
              {/* Prénom — regular */}
              <p
                className="truncate leading-tight"
                style={{ fontSize: 14, fontWeight: 400, color: "#3a3a3c" }}
              >
                {prenom}
              </p>
              {/* Téléphone — gris Apple secondaire */}
              <p
                className="truncate"
                style={{ fontSize: 12, color: "#8e8e93" }}
              >
                {order.customerPhone ?? "—"}
              </p>
            </div>

            {/* ── Bloc Production — DTF AR (le plus important) ── */}
            <div>
              <p
                className="truncate mb-0.5"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aeaeb2" }}
              >
                DTF AR
              </p>
              <p
                className="truncate"
                style={{ fontSize: 18, fontWeight: 700, color: "#333333", lineHeight: 1.15 }}
              >
                {dtfLabel ?? "—"}
              </p>
            </div>

            {/* ── Bloc Footer : commentaire + prix ── */}
            <div className="flex items-end justify-between gap-2">
              <div className="flex-1 min-w-0">
                {order.notes && (
                  <p
                    className="truncate"
                    style={{ fontSize: 11, fontStyle: "italic", color: "#8e8e93" }}
                  >
                    {order.notes}
                  </p>
                )}
              </div>
              {/* Prix — couleur conditionnelle paiement */}
              <p
                className="shrink-0 tabular-nums"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: order.paymentStatus === "PAID" ? "#28cd41" : "#ff3b30",
                }}
              >
                {fmtPrice(order.total, currency)}
              </p>
            </div>

          </div>
        </div>

        {/* ── Tâches (stop propagation — ne déclenche pas le modal) ── */}
        <div
          className="border-t border-gray-100 px-3 pt-2 pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setTodoOpen((v) => !v)}
            className="w-full min-h-[44px] flex items-center justify-between group"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
              Tâches
            </span>
            <span className="flex items-center gap-1.5">
              {todos.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {pendingCount}/{todos.length}
                </span>
              )}
              <span className="text-[10px] text-gray-300">{todoOpen ? "▴" : "▾"}</span>
            </span>
          </button>

          {todoOpen && (
            <div className="space-y-0.5">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group/item flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-50 transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
                      todo.done ? "border-amber-500 bg-amber-500" : "border-gray-300 hover:border-amber-400"
                    )}
                  >
                    {todo.done && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                  </button>
                  <span className={cn(
                    "flex-1 text-[12px] leading-relaxed select-text",
                    todo.done ? "line-through text-gray-300" : "text-gray-700"
                  )}>
                    {todo.text}
                  </span>
                  <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <X className="h-2.5 w-2.5 text-gray-400" />
                  </button>
                </div>
              ))}

              {/* Ajouter — préfixé [utilisateur connecté] */}
              <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-50 transition-colors">
                <button
                  onClick={handleAddTodo}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Plus className="h-2 w-2 text-gray-400" />
                </button>
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={handleTodoKey}
                  placeholder={activeUser ? `Tâche pour ${activeUser}…` : "Ajouter une tâche…"}
                  className="flex-1 bg-transparent text-[12px] text-gray-700 placeholder:text-gray-300 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal fiche de commande ── */}
      {modalOpen && (
        <OrderFicheModal
          order={order}
          extra={extra}
          images={displayImages}
          addImage={addImage}
          origin={origin}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
