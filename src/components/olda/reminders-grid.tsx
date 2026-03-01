"use client";

/**
 * RemindersGrid — Gestures-first, Apple Reminders style, 4 inline cards.
 *
 * En-tête enrichi :
 *   · Avatar circulaire : sélection parmi ~24 icônes style SF Symbols (emoji)
 *     OU URL photo personnalisée
 *   · Couleur de carte : 9 palettes de dégradé style iOS
 *   · Mood picker (6 états emoji, dropdown animé)
 *   · Zone de note libre (debounce 900ms)
 *
 * Interactions todo (inchangées) :
 *   • Clic simple → édition inline · double-clic → suppression
 *   • Drag & Drop natif entre les 4 cartes
 *   • Toggle ✓/⊘ · ajout rapide
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "./person-note-modal";

// ── Config équipe ───────────────────────────────────────────────────────────────

const PEOPLE = [
  { key: "loic",     name: "Loïc",     initial: "L", defaultColor: "blue"   },
  { key: "charlie",  name: "Charlie",  initial: "C", defaultColor: "pink"   },
  { key: "melina",   name: "Mélina",   initial: "M", defaultColor: "purple" },
  { key: "amandine", name: "Amandine", initial: "A", defaultColor: "gold"   },
] as const;

type PersonKey = typeof PEOPLE[number]["key"];

// ── Palettes de couleur (style iOS / macOS) ────────────────────────────────────

interface ColorPreset {
  key:    string;
  label:  string;
  from:   string;
  to:     string;
  cardBg: string;     // classe Tailwind ou inline
  border: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { key: "slate",  label: "Graphite", from: "#3a3a3c", to: "#1c1c1e", cardBg: "#f2f2f4",  border: "rgba(58,58,60,0.18)" },
  { key: "blue",   label: "Bleu",     from: "#0a84ff", to: "#0055d4", cardBg: "#e8f2ff",  border: "rgba(10,132,255,0.22)" },
  { key: "teal",   label: "Teal",     from: "#5ac8fa", to: "#0a7ea4", cardBg: "#e5f7fd",  border: "rgba(90,200,250,0.28)" },
  { key: "purple", label: "Violet",   from: "#bf5af2", to: "#9a42c8", cardBg: "#f2e8fd",  border: "rgba(191,90,242,0.22)" },
  { key: "pink",   label: "Rose",     from: "#ff375f", to: "#c91f3e", cardBg: "#ffe8ed",  border: "rgba(255,55,95,0.22)" },
  { key: "orange", label: "Orange",   from: "#ff9f0a", to: "#d4700a", cardBg: "#fff3e0",  border: "rgba(255,159,10,0.22)" },
  { key: "green",  label: "Vert",     from: "#34c759", to: "#1a9e3f", cardBg: "#e8faf0",  border: "rgba(52,199,89,0.22)" },
  { key: "indigo", label: "Indigo",   from: "#5e5ce6", to: "#3634a3", cardBg: "#ecebff",  border: "rgba(94,92,230,0.22)" },
  { key: "gold",   label: "Or",       from: "#ffd60a", to: "#b59300", cardBg: "#fffbe0",  border: "rgba(255,214,10,0.22)" },
];

const DEFAULT_PRESET = COLOR_PRESETS[0]; // slate

function getPreset(key: string): ColorPreset {
  return COLOR_PRESETS.find((p) => p.key === key) ?? DEFAULT_PRESET;
}

// ── Avatars style SF Symbols ────────────────────────────────────────────────────

const AVATAR_ICONS = [
  // Animaux
  "🦁", "🐯", "🦊", "🐻", "🦅", "🦋", "🐬", "🦄",
  // Symboles / Tech
  "⚡", "🌟", "🎯", "🎨", "🚀", "🌊", "🔥", "💎",
  // Nature
  "🌿", "🏔", "🌸", "🌙", "☀️", "❄️", "🍀", "🌺",
];

// ── Moods ──────────────────────────────────────────────────────────────────────

const MOODS = [
  { emoji: "🔥", label: "En rush" },
  { emoji: "☕️", label: "En pause" },
  { emoji: "💪", label: "Dans le flow" },
  { emoji: "🎯", label: "Focus" },
  { emoji: "🤔", label: "En réflexion" },
  { emoji: "😊", label: "Bien" },
] as const;

const DBL_DELAY = 280;

function newId(): string {
  return `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Persistence helpers ────────────────────────────────────────────────────────

function apiSaveTodos(key: string, todos: TodoItem[]) {
  fetch(`/api/notes/${key}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ todos }),
  }).catch(() => {});
}

function apiSaveNote(key: string, content: string) {
  fetch(`/api/notes/${key}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ content }),
  }).catch(() => {});
}

function apiSaveProfile(userId: string, patch: {
  mood?: string;
  profilePhotoLink?: string | null;
  cardColor?: string;
}) {
  fetch("/api/user-profiles", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, ...patch }),
  }).catch(() => {});
}

// ── AvatarDisplay ─────────────────────────────────────────────────────────────

function AvatarDisplay({
  initial,
  photoLink,
  preset,
  size = 34,
}: {
  initial:   string;
  photoLink: string | null;
  preset:    ColorPreset;
  size?:     number;
}) {
  const isEmoji = photoLink?.startsWith("emoji:") ?? false;
  const emoji   = isEmoji ? photoLink!.slice(6) : null;
  const isUrl   = !isEmoji && !!photoLink;

  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${preset.from}, ${preset.to})`,
      }}
    >
      {isUrl ? (
        <img
          src={photoLink!}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : emoji ? (
        <span style={{ fontSize: Math.round(size * 0.52), lineHeight: 1, userSelect: "none" }}>
          {emoji}
        </span>
      ) : (
        <span style={{
          fontSize: Math.round(size * 0.38),
          fontWeight: 700,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.01em",
          userSelect: "none",
        }}>
          {initial}
        </span>
      )}
    </div>
  );
}

// ── AvatarPicker ──────────────────────────────────────────────────────────────

function AvatarPicker({
  initial,
  photoLink,
  cardColor,
  onPhotoChange,
  onColorChange,
  onClose,
}: {
  initial:       string;
  photoLink:     string | null;
  cardColor:     string;
  onPhotoChange: (v: string | null) => void;
  onColorChange: (v: string) => void;
  onClose:       () => void;
}) {
  const [urlInput, setUrlInput] = useState(
    photoLink && !photoLink.startsWith("emoji:") ? photoLink : ""
  );
  const preset = getPreset(cardColor);
  const ref    = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur — useRef pour éviter de recréer le listener à chaque render
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute left-0 top-full mt-2 z-50 w-[248px] rounded-2xl bg-white border border-gray-100 p-3"
      style={{ boxShadow: "0 12px 36px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.06)" }}
    >
      {/* Prévisualisation */}
      <div className="flex items-center gap-2.5 mb-3 p-2 rounded-xl bg-gray-50/70">
        <AvatarDisplay initial={initial} photoLink={photoLink} preset={preset} size={40} />
        <div>
          <p className="text-[11px] font-semibold text-gray-700">Aperçu</p>
          <p className="text-[10px] text-gray-400">Couleur + avatar</p>
        </div>
      </div>

      {/* Section avatars */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">
        Avatar
      </p>
      <div className="grid grid-cols-8 gap-1 mb-3">
        {AVATAR_ICONS.map((icon) => {
          const key     = `emoji:${icon}`;
          const active  = photoLink === key;
          return (
            <button
              key={icon}
              onClick={() => onPhotoChange(active ? null : key)}
              className={cn(
                "flex items-center justify-center rounded-xl transition-all duration-100",
                "text-[17px] leading-none",
                active
                  ? "scale-110 shadow-sm"
                  : "hover:scale-110 hover:bg-gray-100"
              )}
              style={{
                width: 26, height: 26,
                background: active
                  ? `linear-gradient(145deg, ${preset.from}, ${preset.to})`
                  : undefined,
              }}
              title={icon}
            >
              {icon}
            </button>
          );
        })}
      </div>

      {/* Section couleur de carte */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">
        Couleur de la carte
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {COLOR_PRESETS.map((cp) => {
          const active = cardColor === cp.key || (!cardColor && cp.key === "slate");
          return (
            <button
              key={cp.key}
              onClick={() => onColorChange(cp.key)}
              title={cp.label}
              className={cn(
                "rounded-full transition-all duration-100",
                active ? "scale-125 ring-2 ring-offset-1 ring-gray-300" : "hover:scale-110"
              )}
              style={{
                width: 20,
                height: 20,
                background: `linear-gradient(135deg, ${cp.from}, ${cp.to})`,
              }}
            />
          );
        })}
      </div>

      {/* URL personnalisée */}
      <div className="border-t border-gray-100 pt-2.5 mt-0.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5 flex items-center gap-1">
          <Link className="h-2.5 w-2.5" /> URL personnalisée
        </p>
        <div className="flex gap-1.5">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = urlInput.trim();
                onPhotoChange(val || null);
                if (val) onClose();
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="https://…"
            className="flex-1 text-[11px] text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-300 transition-colors min-w-0"
          />
          <button
            onClick={() => {
              const val = urlInput.trim();
              onPhotoChange(val || null);
              if (val) onClose();
            }}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── MoodButton ─────────────────────────────────────────────────────────────────

function MoodButton({ current, onChange }: { current: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="Humeur"
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-lg text-[14px] leading-none",
          "transition-colors duration-100 hover:bg-black/5",
          open && "bg-black/5"
        )}
      >
        {current || <span className="text-[10px] text-gray-300">·</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-1.5 z-50 flex flex-col gap-0.5 p-1.5 rounded-2xl border border-gray-100 bg-white"
            style={{ minWidth: 136, boxShadow: "0 8px 28px rgba(0,0,0,0.11)" }}
          >
            {MOODS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => { onChange(current === emoji ? "" : emoji); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-left transition-colors duration-100 hover:bg-gray-50",
                  current === emoji && "bg-gray-50"
                )}
              >
                <span className="text-[15px] leading-none">{emoji}</span>
                <span className={cn("text-[12px]", current === emoji ? "font-semibold text-gray-700" : "text-gray-500")}>
                  {label}
                </span>
              </button>
            ))}
            {current && (
              <>
                <div className="h-px bg-gray-100 mx-1 my-0.5" />
                <button
                  onClick={() => { onChange(""); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-left hover:bg-gray-50 transition-colors duration-100"
                >
                  <span className="text-[12px] opacity-30 leading-none">✕</span>
                  <span className="text-[12px] text-gray-400">Effacer</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ReminderCard ───────────────────────────────────────────────────────────────

function ReminderCard({
  personKey,
  personName,
  personInitial,
  todos,
  note,
  mood,
  photoLink,
  cardColor,
  isActive,
  onUpdate,
  onReceiveTodo,
  onEditingChange,
  onMoodChange,
  onNoteChange,
  onPhotoChange,
  onColorChange,
}: {
  personKey:       PersonKey;
  personName:      string;
  personInitial:   string;
  todos:           TodoItem[];
  note:            string;
  mood:            string;
  photoLink:       string | null;
  cardColor:       string;
  isActive?:       boolean;
  onUpdate:        (next: TodoItem[]) => void;
  onReceiveTodo:   (fromKey: PersonKey, todoId: string) => void;
  onEditingChange?:(isEditing: boolean) => void;
  onMoodChange:    (emoji: string) => void;
  onNoteChange:    (text: string) => void;
  onPhotoChange:   (url: string | null) => void;
  onColorChange:   (key: string) => void;
}) {
  const preset = getPreset(cardColor);

  // ── Todo UI state ────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editText,   setEditText]   = useState("");
  const [isAdding,   setIsAdding]   = useState(false);
  const [draft,      setDraft]      = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Profile UI state ─────────────────────────────────────────────────────────
  const [showPicker,  setShowPicker]  = useState(false);
  const [localNote,   setLocalNote]   = useState(note);
  const [noteSaved,   setNoteSaved]   = useState(false);
  const noteTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerAnchor  = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef  = useRef<HTMLInputElement>(null);
  const clickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalNote(note); }, [note]);

  // Auto-resize textarea — colle exactement au contenu, invisible quand vide
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [localNote]);

  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (noteTimer.current)  clearTimeout(noteTimer.current);
  }, []);

  useEffect(() => { onEditingChange?.(editingId !== null || isAdding); }, [editingId, isAdding, onEditingChange]);

  // ── Note ──────────────────────────────────────────────────────────────────────

  const handleNoteInput = useCallback((val: string) => {
    setLocalNote(val);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      onNoteChange(val);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1600);
    }, 900);
  }, [onNoteChange]);

  const handleNoteBlur = useCallback(() => {
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    onNoteChange(localNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1600);
  }, [localNote, onNoteChange]);

  // ── Todos ─────────────────────────────────────────────────────────────────────

  const toggle = useCallback((id: string) => {
    onUpdate(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, [todos, onUpdate]);

  const startEdit = useCallback((todo: TodoItem) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setTimeout(() => editInputRef.current?.focus(), 20);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const text = editText.trim();
    onUpdate(text ? todos.map(t => t.id === editingId ? { ...t, text } : t) : todos.filter(t => t.id !== editingId));
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, todos, onUpdate]);

  const handleItemClick = useCallback((todo: TodoItem) => {
    if (editingId === todo.id) return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onUpdate(todos.filter(t => t.id !== todo.id));
      return;
    }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; startEdit(todo); }, DBL_DELAY);
  }, [editingId, todos, onUpdate, startEdit]);

  const commitDraft = useCallback(() => {
    const text = draft.trim();
    if (text) {
      onUpdate([...todos, { id: newId(), text, done: false }]);
      setDraft("");
      setTimeout(() => addInputRef.current?.focus(), 0);
    } else {
      setIsAdding(false);
      setDraft("");
    }
  }, [draft, todos, onUpdate]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, todo: TodoItem) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("rd_todoId",  todo.id);
    e.dataTransfer.setData("rd_fromKey", personKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const todoId  = e.dataTransfer.getData("rd_todoId");
    const fromKey = e.dataTransfer.getData("rd_fromKey") as PersonKey;
    if (todoId && fromKey && fromKey !== personKey) onReceiveTodo(fromKey, todoId);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-3xl border p-4 flex flex-col gap-0",
        "transition-all duration-300",
        isActive   ? "shadow-md" : "",
        isDragOver ? "shadow-md" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        backgroundColor: preset.cardBg,
        borderColor: isActive
          ? preset.from + "55"
          : isDragOver
            ? preset.from + "44"
            : preset.border,
        boxShadow: isActive
          ? `0 2px 12px 0 ${preset.from}22, 0 0 0 1px ${preset.from}33`
          : isDragOver
            ? `0 2px 10px 0 ${preset.from}18`
            : `0 1px 4px 0 rgba(0,0,0,0.05)`,
      }}
    >
      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2">

        {/* Avatar cliquable → AvatarPicker */}
        <div ref={pickerAnchor} className="relative shrink-0">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowPicker((p) => !p)}
            title="Changer l'avatar"
            className="relative group rounded-full focus:outline-none"
          >
            <AvatarDisplay
              initial={personInitial}
              photoLink={photoLink}
              preset={preset}
              size={34}
            />
            {/* Overlay crayon */}
            <div className="absolute inset-0 rounded-full bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
              <span style={{ fontSize: 9, color: "white", fontWeight: 700 }}>✎</span>
            </div>
          </button>

          <AnimatePresence>
            {showPicker && (
              <AvatarPicker
                initial={personInitial}
                photoLink={photoLink}
                cardColor={cardColor}
                onPhotoChange={(v) => { onPhotoChange(v); }}
                onColorChange={(v) => { onColorChange(v); }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Nom + mood label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isActive && (
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: preset.from }}
              />
            )}
            <span
              className="text-[11px] font-bold uppercase tracking-wider truncate"
              style={{ color: preset.to }}
            >
              {personName}
            </span>
          </div>
          {mood && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
              {MOODS.find((m) => m.emoji === mood)?.label ?? ""}
            </p>
          )}
        </div>

        {/* Count badge */}
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: preset.cardBg, color: preset.from, border: `1px solid ${preset.border}` }}
        >
          {todos.length}
        </span>

        {/* Mood picker */}
        <MoodButton current={mood} onChange={onMoodChange} />
      </div>

      {/* ── Zone de note libre ───────────────────────────────────────────────── */}
      <div className="mb-2 relative rounded-lg px-2 py-1.5" style={{ background: `${preset.from}18`, borderLeft: `3px solid ${preset.from}` }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: preset.from }}>Informations importantes</p>
        <textarea
          ref={textareaRef}
          value={localNote}
          onChange={(e) => handleNoteInput(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Ajouter une information…"
          rows={1}
          className="w-full resize-none border-none outline-none bg-transparent text-[13px] leading-relaxed text-gray-800 placeholder:text-gray-400/70 font-[family-name:var(--font-handwritten)]"
          style={{
            caretColor: preset.from,
            overflow: "hidden",
          }}
        />
        <AnimatePresence>
          {noteSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 right-0 text-[10px] font-semibold"
              style={{ color: preset.from }}
            >
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Séparateur ──────────────────────────────────────────────────────── */}
      <div className="h-px mb-3" style={{ backgroundColor: preset.border }} />

      {/* ── Bouton Ajouter (haut à gauche, style primary) ───────────────────── */}
      <div className="mb-3">
        {isAdding ? (
          <div className="flex items-center gap-3 h-8 px-3 rounded-lg bg-white/70 border border-white/80">
            <span className="shrink-0 h-4 w-4 rounded-full border-2 border-gray-200" />
            <input
              ref={addInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); commitDraft(); }
                if (e.key === "Escape") { setIsAdding(false); setDraft(""); }
              }}
              onBlur={() => { commitDraft(); setIsAdding(false); }}
              placeholder="Nouvelle tâche..."
              className="flex-1 text-[14px] text-gray-700 placeholder:text-gray-400 bg-transparent outline-none font-[family-name:var(--font-handwritten)]"
            />
          </div>
        ) : (
          <button
            onClick={() => { setIsAdding(true); setTimeout(() => addInputRef.current?.focus(), 30); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Ajouter</span>
          </button>
        )}
      </div>

      {/* ── Liste des todos ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-1.5">
        {todos.length === 0 && !isAdding && (
          <p className="text-xs italic text-gray-300 py-2 text-center">Aucune tâche</p>
        )}

        <AnimatePresence mode="sync">
          {todos.map((todo) => (
            <motion.div
              key={todo.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.14, ease: [0.25, 0.1, 0.25, 1] } }}
              draggable={editingId !== todo.id}
              onDragStart={(e) => { if (editingId === todo.id) return; handleDragStart(e as unknown as React.DragEvent, todo); }}
              style={{ willChange: "transform, opacity" }}
              className={cn(
                "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition-colors duration-150",
                todo.done && "opacity-50",
                editingId !== todo.id && "cursor-grab active:cursor-grabbing hover:bg-white/30 group",
              )}
            >
              <motion.button
                onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
                whileTap={{ scale: 0.82, transition: { duration: 0.1 } }}
                style={todo.done
                  ? { willChange: "transform", background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`, borderColor: "transparent" }
                  : { willChange: "transform" }
                }
                className={cn(
                  "shrink-0 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors duration-150",
                  todo.done ? "border-transparent" : "border-gray-300"
                )}
              >
                {todo.done && <Check className="h-2.5 w-2.5 text-white" />}
              </motion.button>

              {editingId === todo.id ? (
                <input
                  ref={editInputRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                  }}
                  onBlur={commitEdit}
                  className="flex-1 text-[14px] text-gray-900 bg-transparent outline-none border-b font-[family-name:var(--font-handwritten)]"
                  style={{ borderColor: preset.from }}
                />
              ) : (
                <span
                  onClick={() => handleItemClick(todo)}
                  className={cn(
                    "flex-1 text-[14px] select-none cursor-text transition-colors duration-150 font-[family-name:var(--font-handwritten)]",
                    todo.done ? "line-through text-gray-400" : "text-gray-900 hover:text-gray-700"
                  )}
                >
                  {todo.text}
                </span>
              )}

              {editingId !== todo.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(todos.filter(t => t.id !== todo.id)); }}
                  className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}

// ── RemindersGrid ──────────────────────────────────────────────────────────────

interface ProfileData {
  userId:          string;
  profilePhotoLink: string | null;
  mood:            string;
  cardColor:       string;
}

export function RemindersGrid({
  notesMap,
  activeUser,
  onNoteChanged,
}: {
  notesMap:       Record<string, TodoItem[]>;
  activeUser?:    string;
  onNoteChanged?: (person: string) => void;
}) {
  const [todosMap, setTodosMap] = useState<Record<string, TodoItem[]>>(() => {
    const m: Record<string, TodoItem[]> = {};
    for (const p of PEOPLE) m[p.key] = notesMap[p.key] ?? [];
    return m;
  });

  const [notesContent, setNotesContent] = useState<Record<string, string>>({});
  const [profiles,     setProfiles]     = useState<Record<string, ProfileData>>({});

  const saveTimers       = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mountedRef       = useRef(true);
  const editingKeyRef    = useRef<string | null>(null);
  const onNoteChangedRef = useRef(onNoteChanged);
  useEffect(() => { onNoteChangedRef.current = onNoteChanged; }, [onNoteChanged]);

  // Chargement des profils
  useEffect(() => {
    fetch("/api/user-profiles")
      .then((r) => r.json())
      .then((data: { profiles: ProfileData[] }) => {
        const map: Record<string, ProfileData> = {};
        for (const p of data.profiles) map[p.userId] = p;
        setProfiles(map);
      })
      .catch(() => {});
  }, []);

  // Chargement des notes
  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data: { notes: { person: string; content: string }[] }) => {
        const map: Record<string, string> = {};
        for (const n of data.notes) map[n.person] = n.content ?? "";
        setNotesContent(map);
      })
      .catch(() => {});
  }, []);

  // SSE todos
  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        es = new EventSource("/api/notes/stream");
        es.addEventListener("note-changed", (event) => {
          if (!mountedRef.current) return;
          try {
            const note = JSON.parse((event as MessageEvent).data) as { person: string; todos: TodoItem[] | string };
            onNoteChangedRef.current?.(note.person);
            if (editingKeyRef.current === note.person) return;
            let todos: TodoItem[] = [];
            if (Array.isArray(note.todos))           todos = note.todos;
            else if (typeof note.todos === "string") { try { todos = JSON.parse(note.todos); } catch { todos = []; } }
            setTodosMap(prev => ({ ...prev, [note.person]: todos }));
          } catch { /* malformed */ }
        });
        es.onerror = () => {
          if (!mountedRef.current) return;
          es?.close();
          reconnectTimer = setTimeout(connect, 10_000);
        };
      } catch { /* SSE not supported */ }
    };

    connect();
    return () => {
      mountedRef.current = false;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const handleUpdate = useCallback((key: string, next: TodoItem[]) => {
    setTodosMap(prev => ({ ...prev, [key]: next }));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => apiSaveTodos(key, next), 600);
  }, []);

  const handleReceiveTodo = useCallback((fromKey: PersonKey, toKey: string, todoId: string) => {
    setTodosMap(prev => {
      const todo = prev[fromKey]?.find(t => t.id === todoId);
      if (!todo) return prev;
      const nextFrom = prev[fromKey].filter(t => t.id !== todoId);
      const nextTo   = [...(prev[toKey] ?? []), { ...todo, done: false }];
      apiSaveTodos(fromKey, nextFrom);
      apiSaveTodos(toKey,   nextTo);
      return { ...prev, [fromKey]: nextFrom, [toKey]: nextTo };
    });
  }, []);

  const handleNoteChange = useCallback((key: string, content: string) => {
    setNotesContent(prev => ({ ...prev, [key]: content }));
    apiSaveNote(key, content);
  }, []);

  const handleMoodChange = useCallback((key: string, emoji: string) => {
    setProfiles(prev => ({ ...prev, [key]: { ...(prev[key] ?? { userId: key, profilePhotoLink: null, mood: "", cardColor: "" }), mood: emoji } }));
    apiSaveProfile(key, { mood: emoji });
  }, []);

  const handlePhotoChange = useCallback((key: string, link: string | null) => {
    setProfiles(prev => ({ ...prev, [key]: { ...(prev[key] ?? { userId: key, profilePhotoLink: null, mood: "", cardColor: "" }), profilePhotoLink: link } }));
    apiSaveProfile(key, { profilePhotoLink: link });
  }, []);

  const handleColorChange = useCallback((key: string, colorKey: string) => {
    setProfiles(prev => ({ ...prev, [key]: { ...(prev[key] ?? { userId: key, profilePhotoLink: null, mood: "", cardColor: "" }), cardColor: colorKey } }));
    apiSaveProfile(key, { cardColor: colorKey });
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {PEOPLE.map((p) => (
        <ReminderCard
          key={p.key}
          personKey={p.key}
          personName={p.name}
          personInitial={p.initial}
          todos={todosMap[p.key] ?? []}
          note={notesContent[p.key] ?? ""}
          mood={profiles[p.key]?.mood ?? ""}
          photoLink={profiles[p.key]?.profilePhotoLink ?? null}
          cardColor={profiles[p.key]?.cardColor || p.defaultColor}
          isActive={p.key === activeUser}
          onUpdate={(next) => handleUpdate(p.key, next)}
          onReceiveTodo={(fromKey, todoId) => handleReceiveTodo(fromKey, p.key, todoId)}
          onEditingChange={(isEditing) => { editingKeyRef.current = isEditing ? p.key : null; }}
          onMoodChange={(emoji) => handleMoodChange(p.key, emoji)}
          onNoteChange={(content) => handleNoteChange(p.key, content)}
          onPhotoChange={(link) => handlePhotoChange(p.key, link)}
          onColorChange={(colorKey) => handleColorChange(p.key, colorKey)}
        />
      ))}
    </div>
  );
}
