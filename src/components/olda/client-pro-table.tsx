"use client";

/**
 * ClientProTable — Base de données clients professionnels.
 *
 * Colonnes : Société · Code Postal · Ville · Contacts · Date · Actions
 *
 * Ligne expandable :
 *   ① Contacts : liste + ajout/édition/suppression inline
 *      Champs contact : Nom · Fonction · Téléphone · Email
 *   ② Historique planning (inchangé)
 */

import {
  useState, useCallback, useRef, useEffect, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Trash2, Phone, ChevronDown, ChevronUp,
  User, Edit2, Check, Mail, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTable } from "@/components/ui/table-shell";
import { STATUS_LABELS, StatusBadge, SecteurPill, TableSearchBar } from "@/components/ui/table-cells";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanningHistoryItem {
  id:          string;
  designation: string;
  status:      string;
  deadline:    string | null;
  quantity:    number;
  color:       string;
  createdAt:   string;
}

export interface ClientContact {
  id:        string;
  nom:       string;
  fonction:  string;
  telephone: string;
  email:     string;
  position:  number;
}

export interface ClientItem {
  id:            string;
  nom:           string;        // Société
  codePostal:    string;
  ville:         string;
  telephone:     string;        // legacy
  createdAt:     string;
  contacts:      ClientContact[];
  planningItems: PlanningHistoryItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  clientId,
  onUpdate,
  onDelete,
}: {
  contact:  ClientContact;
  clientId: string;
  onUpdate: (c: ClientContact) => void;
  onDelete: (id: string)       => void;
}) {
  const [editing,  setEditing]  = useState(false);
  const [nom,      setNom]      = useState(contact.nom);
  const [fonction, setFonction] = useState(contact.fonction);
  const [tel,      setTel]      = useState(contact.telephone);
  const [email,    setEmail]    = useState(contact.email);
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom, fonction, telephone: tel, email }),
      });
      if (res.ok) {
        onUpdate({ ...contact, nom, fonction, telephone: tel, email });
        setEditing(false);
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, { method: "DELETE" });
      onDelete(contact.id);
    } catch { /* ignore */ }
  };

  if (editing) {
    return (
      <div className="grid gap-1.5 px-4 py-2.5 bg-blue-50/40 border-b border-slate-100"
        style={{ gridTemplateColumns: "1fr 100px 130px 1fr 72px" }}>
        <input
          autoFocus
          value={nom}
          onChange={e => setNom(e.target.value)}
          placeholder="Nom…"
          className="h-7 px-2 text-[12px] text-slate-900 bg-white rounded-md border border-blue-300 ring-1 ring-blue-100 focus:outline-none"
        />
        <input
          value={fonction}
          onChange={e => setFonction(e.target.value)}
          placeholder="Fonction…"
          className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
        />
        <input
          value={tel}
          onChange={e => setTel(e.target.value)}
          placeholder="06 …"
          className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="adresse@…"
          className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 w-7 rounded-md flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setEditing(false); setNom(contact.nom); setFonction(contact.fonction); setTel(contact.telephone); setEmail(contact.email); }}
            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-2 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors group"
      style={{ gridTemplateColumns: "1fr 100px 130px 1fr 72px" }}
    >
      {/* Nom */}
      <span className="text-[12px] font-semibold text-slate-800 truncate">
        {contact.nom || <span className="text-slate-300 italic font-normal">Sans nom</span>}
      </span>

      {/* Fonction */}
      <span className="text-[11px] text-slate-500 truncate">
        {contact.fonction || <span className="text-slate-300">—</span>}
      </span>

      {/* Téléphone */}
      <div className="flex items-center gap-1 min-w-0">
        {contact.telephone ? (
          <>
            <Phone className="h-3 w-3 text-slate-300 shrink-0" />
            <a
              href={`tel:${contact.telephone.replace(/\s/g, "")}`}
              className="text-[12px] text-slate-600 hover:text-blue-500 transition-colors truncate"
              onClick={e => e.stopPropagation()}
            >
              {contact.telephone}
            </a>
          </>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {/* Email */}
      <div className="flex items-center gap-1 min-w-0">
        {contact.email ? (
          <>
            <Mail className="h-3 w-3 text-slate-300 shrink-0" />
            <a
              href={`mailto:${contact.email}`}
              className="text-[12px] text-slate-600 hover:text-blue-500 transition-colors truncate"
              onClick={e => e.stopPropagation()}
            >
              {contact.email}
            </a>
          </>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-blue-400 hover:bg-blue-50 transition-colors"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={handleDelete}
          className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── AddContactForm ─────────────────────────────────────────────────────────────

function AddContactForm({
  clientId,
  onAdd,
  onCancel,
}: {
  clientId: string;
  onAdd:    (c: ClientContact) => void;
  onCancel: () => void;
}) {
  const [nom,      setNom]      = useState("");
  const [fonction, setFonction] = useState("");
  const [tel,      setTel]      = useState("");
  const [email,    setEmail]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom, fonction, telephone: tel, email }),
      });
      if (res.ok) {
        const { contact } = await res.json();
        onAdd(contact);
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid items-center gap-1.5 px-4 py-2.5 bg-green-50/50 border-t border-green-100"
      style={{ gridTemplateColumns: "1fr 100px 130px 1fr 72px" }}
    >
      <input
        autoFocus
        value={nom}
        onChange={e => setNom(e.target.value)}
        placeholder="Nom…"
        className="h-7 px-2 text-[12px] text-slate-900 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
      />
      <input
        value={fonction}
        onChange={e => setFonction(e.target.value)}
        placeholder="Fonction…"
        className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
      />
      <input
        value={tel}
        onChange={e => setTel(e.target.value)}
        placeholder="06 …"
        className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="adresse@…"
        className="h-7 px-2 text-[12px] text-slate-700 bg-white rounded-md border border-slate-200 focus:outline-none focus:border-blue-300"
      />
      <div className="flex items-center gap-1">
        <button
          type="submit"
          disabled={saving}
          className="h-7 px-2 rounded-md text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────────────────

function HistoryRow({ item }: { item: PlanningHistoryItem }) {
  return (
    <div
      className="grid gap-2 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
      style={{ gridTemplateColumns: "1fr 90px 90px 80px 100px" }}
    >
      <span className="text-[12px] text-slate-700 font-medium truncate">
        {item.designation || <span className="text-slate-300 italic">Sans désignation</span>}
      </span>
      <span className="text-[11px] tabular-nums text-slate-500 text-center">
        {item.quantity} u.
      </span>
      {item.color ? (
        <SecteurPill secteur={item.color} className="self-center justify-center" />
      ) : (
        <span />
      )}
      <span className="text-[11px] text-slate-400 text-center self-center tabular-nums">
        {item.deadline ? formatDate(item.deadline) : "—"}
      </span>
      <StatusBadge status={item.status} className="self-center justify-center" />
    </div>
  );
}

// ── ClientRow ─────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  onUpdate,
  onDelete,
}: {
  client:   ClientItem;
  onUpdate: (id: string, patch: Partial<Pick<ClientItem, "nom" | "codePostal" | "ville">>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [showAddCtc, setShowAddCtc] = useState(false);
  const [contacts,   setContacts]   = useState<ClientContact[]>(client.contacts ?? []);

  const [nomVal, setNomVal] = useState(client.nom);
  const [cpVal,  setCpVal]  = useState(client.codePostal ?? "");
  const [vilVal, setVilVal] = useState(client.ville ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nomVal.trim()) return;
    setSaving(true);
    await onUpdate(client.id, {
      nom:       nomVal.trim(),
      codePostal: cpVal.trim(),
      ville:     vilVal.trim(),
    });
    setSaving(false);
    setEditing(false);
  };

  const handleContactUpdate = useCallback((updated: ClientContact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const handleContactDelete = useCallback((id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleContactAdd = useCallback((c: ClientContact) => {
    setContacts(prev => [...prev, c]);
    setShowAddCtc(false);
  }, []);

  const ctcCount    = contacts.length;
  const planCount   = client.planningItems.length;

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* ── Ligne principale ── */}
      <div
        className={cn(
          "grid items-center px-4 py-3 gap-2 group transition-colors duration-100",
          expanded ? "bg-blue-50/40" : "hover:bg-slate-50/70",
        )}
        style={{ gridTemplateColumns: "32px 1fr 72px 1fr 80px 90px 48px" }}
      >
        {/* Avatar */}
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-white">
            {(nomVal || "?").charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Société */}
        {editing ? (
          <input
            autoFocus
            value={nomVal}
            onChange={e => setNomVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="h-8 px-2.5 text-[13px] font-semibold text-slate-900 bg-white rounded-lg border border-blue-300 ring-2 ring-blue-100/70 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-left font-semibold text-[13px] text-slate-900 truncate hover:text-blue-600 transition-colors"
          >
            {client.nom}
          </button>
        )}

        {/* Code Postal */}
        {editing ? (
          <input
            value={cpVal}
            onChange={e => setCpVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            placeholder="75000"
            className="h-8 px-2 text-[13px] text-slate-700 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-blue-300 w-full"
          />
        ) : (
          <span className="text-[12px] text-slate-500 tabular-nums">
            {client.codePostal || <span className="text-slate-300">—</span>}
          </span>
        )}

        {/* Ville */}
        {editing ? (
          <input
            value={vilVal}
            onChange={e => setVilVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            placeholder="Paris"
            className="h-8 px-2.5 text-[13px] text-slate-700 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-blue-300"
          />
        ) : (
          <span className="text-[13px] text-slate-700 truncate">
            {client.ville || <span className="text-slate-300 text-[12px]">—</span>}
          </span>
        )}

        {/* Contacts badge */}
        <div className="text-center">
          <button
            onClick={() => setExpanded(v => !v)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
              ctcCount > 0
                ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200",
            )}
          >
            {ctcCount} contact{ctcCount !== 1 ? "s" : ""}
          </button>
        </div>

        {/* Date ajout */}
        <span className="text-[12px] text-slate-400 text-center tabular-nums">
          {formatDate(client.createdAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 justify-end">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setEditing(false); setNomVal(client.nom); setCpVal(client.codePostal ?? ""); setVilVal(client.ville ?? ""); }}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
              <button
                onClick={() => { setEditing(true); setNomVal(client.nom); setCpVal(client.codePostal ?? ""); setVilVal(client.ville ?? ""); }}
                className="p-1.5 rounded-md text-slate-300 hover:text-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(client.id)}
                className="p-1.5 rounded-md text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Panneau expandé ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 space-y-2">

              {/* ── Contacts ── */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {/* Header contacts */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Contacts directs
                    </span>
                    {ctcCount > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
                        {ctcCount}
                      </span>
                    )}
                  </div>
                  {!showAddCtc && (
                    <button
                      onClick={() => setShowAddCtc(true)}
                      className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Ajouter
                    </button>
                  )}
                </div>

                {/* En-têtes colonnes contacts */}
                <div
                  className="grid px-4 py-1.5 bg-slate-50/50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400"
                  style={{ gridTemplateColumns: "1fr 100px 130px 1fr 72px" }}
                >
                  <span>Nom</span>
                  <span>Fonction</span>
                  <span>Téléphone</span>
                  <span>Email</span>
                  <span />
                </div>

                {contacts.length === 0 && !showAddCtc ? (
                  <div className="py-6 text-center text-[12px] text-slate-300 italic">
                    Aucun contact — cliquez « Ajouter »
                  </div>
                ) : (
                  contacts.map(c => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      clientId={client.id}
                      onUpdate={handleContactUpdate}
                      onDelete={handleContactDelete}
                    />
                  ))
                )}

                {showAddCtc && (
                  <AddContactForm
                    clientId={client.id}
                    onAdd={handleContactAdd}
                    onCancel={() => setShowAddCtc(false)}
                  />
                )}
              </div>

              {/* ── Historique planning ── */}
              {planCount > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Historique planning ({planCount})
                    </span>
                  </div>
                  <div
                    className="grid px-4 py-1.5 bg-slate-50/50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400"
                    style={{ gridTemplateColumns: "1fr 90px 90px 80px 100px" }}
                  >
                    <span>Désignation</span>
                    <span className="text-center">Qté</span>
                    <span className="text-center">Secteur</span>
                    <span className="text-center">Échéance</span>
                    <span className="text-center">État</span>
                  </div>
                  {client.planningItems.map(item => (
                    <HistoryRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AddClientForm ─────────────────────────────────────────────────────────────

function AddClientForm({
  onAdd,
  onCancel,
}: {
  onAdd:    (nom: string, codePostal: string, ville: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [nom,      setNom]      = useState("");
  const [cp,       setCp]       = useState("");
  const [ville,    setVille]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);
    await onAdd(nom.trim(), cp.trim(), ville.trim());
    setSaving(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onSubmit={handleSubmit}
      className="grid items-center gap-2 px-4 py-3 bg-blue-50/60 border-b border-blue-100"
      style={{ gridTemplateColumns: "32px 1fr 80px 1fr auto" }}
    >
      <div className="h-7 w-7 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
        <User className="h-3.5 w-3.5 text-blue-500" />
      </div>
      <input
        autoFocus
        value={nom}
        onChange={e => setNom(e.target.value)}
        placeholder="Société *"
        required
        className="h-8 px-2.5 text-[13px] font-semibold text-slate-900 bg-white rounded-lg border border-blue-300 ring-2 ring-blue-100/70 shadow-sm focus:outline-none"
      />
      <input
        value={cp}
        onChange={e => setCp(e.target.value)}
        placeholder="Code postal"
        className="h-8 px-2.5 text-[13px] text-slate-700 bg-white rounded-lg border border-slate-200 shadow-sm focus:outline-none focus:border-blue-300"
      />
      <input
        value={ville}
        onChange={e => setVille(e.target.value)}
        placeholder="Ville"
        className="h-8 px-2.5 text-[13px] text-slate-700 bg-white rounded-lg border border-slate-200 shadow-sm focus:outline-none focus:border-blue-300"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={saving || !nom.trim()}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium shrink-0",
            "bg-blue-500 text-white hover:bg-blue-600 active:scale-95",
            "transition-all duration-150 shadow-sm",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Ajouter
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    return clients.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      (c.ville ?? "").toLowerCase().includes(q) ||
      (c.codePostal ?? "").includes(q) ||
      c.contacts.some(ct =>
        ct.nom.toLowerCase().includes(q) ||
        ct.telephone.includes(q) ||
        ct.email.toLowerCase().includes(q),
      ),
    );
  }, [clients, search]);

  // ── API ───────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (nom: string, codePostal: string, ville: string) => {
    try {
      const res = await fetch("/api/clients", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom, codePostal, ville }),
      });
      if (!res.ok) return;
      const { client } = await res.json();
      onClientsChange([{ ...client, contacts: [], planningItems: [] }, ...clients]);
      setShowAdd(false);
    } catch (e) {
      console.error("Failed to add client:", e);
    }
  }, [clients, onClientsChange]);

  const handleUpdate = useCallback(async (
    id: string,
    patch: Partial<Pick<ClientItem, "nom" | "codePostal" | "ville">>,
  ) => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) return;
      onClientsChange(clients.map(c => c.id === id ? { ...c, ...patch } : c));
    } catch (e) {
      console.error("Failed to update client:", e);
    }
  }, [clients, onClientsChange]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds(p => new Set([...p, id]));
    onClientsChange(clients.filter(c => c.id !== id));
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
    } catch {
      const res  = await fetch("/api/clients");
      const data = await res.json();
      onClientsChange(data.clients ?? []);
    } finally {
      setDeletingIds(p => { const n = new Set(p); n.delete(id); return n; });
    }
  }, [clients, onClientsChange]);

  // ── Slots OrderTable ──────────────────────────────────────────────────────

  const toolbar = (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
        <button
          onClick={() => setShowAdd(v => !v)}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium shrink-0",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
            "transition-all duration-150 shadow-sm",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Ajouter un client</span>
        </button>
        <span className="text-[12px] text-slate-400 font-medium tabular-nums">
          {clients.length} client{clients.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="px-4 py-2.5 border-b border-black/[0.04]">
        <TableSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par société, ville, contact, email…"
        />
      </div>

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
      style={{ gridTemplateColumns: "32px 1fr 72px 1fr 80px 90px 48px" }}
    >
      <span />
      <span>Société</span>
      <span>CP</span>
      <span>Ville</span>
      <span className="text-center">Contacts</span>
      <span className="text-center">Ajouté le</span>
      <span />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OrderTable toolbar={toolbar} headers={headers}>
      <AnimatePresence mode="popLayout" initial={false}>
        {displayClients.map(client => (
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

      {displayClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center select-none">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
            <User className="h-5 w-5 text-slate-200" />
          </div>
          <p className="text-[13px] text-slate-400">
            {search ? `Aucun résultat pour « ${search} »` : "Aucun client pro enregistré"}
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
