"use client";

/**
 * RemindersGrid — Gestures-first, Apple Reminders style, 4 inline cards.
 *
 * En-tête enrichi :
 *   · Avatar circulaire (photo URL ou gradient + initiale)
 *   · Clic avatar → input URL photo (save on blur/Enter)
 *   · Mood picker (6 états emoji, dropdown animé)
 *   · Zone de note libre (debounce 900ms + save immédiat au blur)
 *
 * Interactions todo (inchangées) :
 *   • Clic simple sur un texte  → édition inline (blur = save auto)
 *   • Double-clic sur un texte  → suppression immédiate
 *   • Glisser-déposer           → déplace un item entre les 4 fiches
 *   • Clic sur le cercle        → toggle ✓/⊘
 *   • Crayon en haut à droite   → ouvre l'input d'ajout
 *
 * Drag & Drop 100 % natif (HTML5 DataTransfer), zéro lib externe.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "./person-note-modal";

// ── Config équipe ───────────────────────────────────────────────────────────────

const PEOPLE = [
  { key: "loic",     name: "Loïc",     initial: "L", from: "#3a3a3c", to: "#1c1c1e" },
  { key: "charlie",  name: "Charlie",  initial: "C", from: "#0a84ff", to: "#0071e3" },
  { key: "melina",   name: "Mélina",   initial: "M", from: "#ff6b9d", to: "#ff375f" },
  { key: "amandine", name: "Amandine", initial: "A", from: "#bf5af2", to: "#9b59b6" },
] as const;

type PersonKey = typeof PEOPLE[number]["key"];

const MOODS = [
  { emoji: "🔥", label: "En rush" },
  { emoji: "☕️", label: "En pause" },
  { emoji: "💪", label: "Dans le flow" },
  { emoji: "🎯", label: "Focus" },
  { emoji: "🤔", label: "En réflexion" },
  { emoji: "😊", label: "Bien" },
] as const;

/** Délai (ms) pour distinguer clic simple / double-clic */
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

function apiSaveProfile(userId: string, patch: { mood?: string; profilePhotoLink?: string | null }) {
  fetch("/api/user-profiles", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, ...patch }),
  }).catch(() => {});
}

// ── MoodButton ─────────────────────────────────────────────────────────────────

function MoodButton({
  current,
  onChange,
}: {
  current: string;
  onChange: (emoji: string) => void;
}) {
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
          "transition-colors duration-100 hover:bg-gray-100",
          open && "bg-gray-100"
        )}
      >
        {current || <span className="text-[11px] text-gray-300">·</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-1.5 z-50 flex flex-col gap-0.5 p-1.5 rounded-2xl border border-gray-100 bg-white"
            style={{
              minWidth: 136,
              boxShadow: "0 8px 28px rgba(0,0,0,0.11), 0 1px 0 rgba(255,255,255,0.7) inset",
            }}
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
  personFrom,
  personTo,
  todos,
  note,
  mood,
  photoLink,
  isActive,
  onUpdate,
  onReceiveTodo,
  onEditingChange,
  onMoodChange,
  onNoteChange,
  onPhotoChange,
}: {
  personKey:       PersonKey;
  personName:      string;
  personInitial:   string;
  personFrom:      string;
  personTo:        string;
  todos:           TodoItem[];
  note:            string;
  mood:            string;
  photoLink:       string | null;
  isActive?:       boolean;
  onUpdate:        (next: TodoItem[]) => void;
  onReceiveTodo:   (fromKey: PersonKey, todoId: string) => void;
  onEditingChange?:(isEditing: boolean) => void;
  onMoodChange:    (emoji: string) => void;
  onNoteChange:    (text: string) => void;
  onPhotoChange:   (url: string) => void;
}) {
  // ── Todo UI state ────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editText,   setEditText]   = useState("");
  const [isAdding,   setIsAdding]   = useState(false);
  const [draft,      setDraft]      = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Profile / note UI state ──────────────────────────────────────────────────
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [photoUrl,       setPhotoUrl]       = useState(photoLink ?? "");
  const [localNote,      setLocalNote]      = useState(note);
  const [noteSaved,      setNoteSaved]      = useState(false);
  const noteTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoRef   = useRef<HTMLInputElement>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef  = useRef<HTMLInputElement>(null);
  const clickTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync note from parent (SSE update) — ne pas écraser si on est en train de taper
  useEffect(() => { setLocalNote(note); }, [note]);
  useEffect(() => { setPhotoUrl(photoLink ?? ""); }, [photoLink]);

  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (noteTimer.current)  clearTimeout(noteTimer.current);
  }, []);

  // Notifier parent quand mode édition change
  useEffect(() => {
    onEditingChange?.(editingId !== null || isAdding);
  }, [editingId, isAdding, onEditingChange]);

  // Focus input photo à l'ouverture
  useEffect(() => {
    if (showPhotoInput) setTimeout(() => photoRef.current?.focus(), 30);
  }, [showPhotoInput]);

  // ── Note handlers ─────────────────────────────────────────────────────────────

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

  // ── Photo handlers ────────────────────────────────────────────────────────────

  const commitPhoto = useCallback(() => {
    setShowPhotoInput(false);
    onPhotoChange(photoUrl.trim());
  }, [photoUrl, onPhotoChange]);

  // ── Todo helpers ──────────────────────────────────────────────────────────────

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
    onUpdate(
      text
        ? todos.map(t => t.id === editingId ? { ...t, text } : t)
        : todos.filter(t => t.id !== editingId)
    );
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
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      startEdit(todo);
    }, DBL_DELAY);
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

  const openAdd = () => {
    setIsAdding(true);
    setTimeout(() => addInputRef.current?.focus(), 30);
  };

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
        "rounded-2xl bg-white border p-3 flex flex-col gap-0",
        "transition-colors duration-150",
        isActive   ? "border-blue-300/70 bg-blue-50/30" : "border-gray-100",
        isDragOver ? "border-blue-400 bg-blue-50/50" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        fontFamily: "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        boxShadow: isActive
          ? "0 1px 8px 0 rgba(59,130,246,0.10), 0 0 0 1px rgba(147,197,253,0.5)"
          : isDragOver
            ? "0 2px 12px 0 rgba(59,130,246,0.14)"
            : "0 1px 4px 0 rgba(0,0,0,0.05)",
      }}
    >
      {/* ── En-tête : Avatar + Nom + Mood ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2">

        {/* Avatar cliquable */}
        <button
          onClick={() => setShowPhotoInput((p) => !p)}
          title="Changer la photo"
          className="relative shrink-0 group rounded-full focus:outline-none"
          style={{ width: 34, height: 34 }}
        >
          {/* Cercle gradient ou photo */}
          <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: `linear-gradient(145deg, ${personFrom}, ${personTo})` }}
          >
            {photoLink ? (
              <img
                src={photoLink}
                alt={personName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.92)",
                  letterSpacing: "-0.01em",
                  userSelect: "none",
                }}
              >
                {personInitial}
              </span>
            )}
          </div>
          {/* Overlay crayon au survol */}
          <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
            <span style={{ fontSize: 10, color: "white" }}>✎</span>
          </div>
        </button>

        {/* Nom + mood label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider truncate",
              isActive ? "text-blue-600" : "text-gray-900"
            )}>
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
        <span className="text-[11px] font-semibold text-gray-400 px-2 py-0.5 rounded-full bg-gray-100/80 shrink-0">
          {todos.length}
        </span>

        {/* Mood picker */}
        <MoodButton current={mood} onChange={onMoodChange} />
      </div>

      {/* ── Input URL photo (affiché si showPhotoInput) ─────────────────────── */}
      <AnimatePresence>
        {showPhotoInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mb-2"
          >
            <input
              ref={photoRef}
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); commitPhoto(); }
                if (e.key === "Escape") { setShowPhotoInput(false); }
              }}
              onBlur={commitPhoto}
              placeholder="URL de la photo (lien direct)…"
              className="w-full text-[11px] text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-300 transition-colors"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Zone de note libre ───────────────────────────────────────────────── */}
      <div className="mb-2 relative">
        <textarea
          value={localNote}
          onChange={(e) => handleNoteInput(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder={`Note pour ${personName}…`}
          rows={2}
          className="w-full resize-none border-none outline-none bg-transparent text-[12px] leading-relaxed text-gray-600 placeholder:text-gray-300"
          style={{
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
            caretColor: personFrom,
          }}
        />
        <AnimatePresence>
          {noteSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 right-0 text-[10px] text-green-500 font-semibold"
            >
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Séparateur ──────────────────────────────────────────────────────── */}
      <div className="h-px bg-gray-100 mb-2" />

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
              onDragStart={(e) => {
                if (editingId === todo.id) return;
                handleDragStart(e as unknown as React.DragEvent, todo);
              }}
              style={{ willChange: "transform, opacity" }}
              className={cn(
                "flex items-center gap-2 w-full rounded-xl px-2.5 py-2 bg-white border border-gray-100",
                "transition-colors duration-150",
                editingId !== todo.id && "cursor-grab active:cursor-grabbing hover:border-gray-200 group",
              )}
            >
              {/* Dot toggle */}
              <motion.button
                onClick={(e) => { e.stopPropagation(); toggle(todo.id); }}
                whileTap={{ scale: 0.82, transition: { duration: 0.1 } }}
                style={{ willChange: "transform" }}
                className={cn(
                  "shrink-0 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors duration-150",
                  todo.done
                    ? "bg-green-500 border-green-500"
                    : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                )}
              >
                {todo.done && <Check className="h-2.5 w-2.5 text-white" />}
              </motion.button>

              {/* Texte ou input inline */}
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
                  className="flex-1 text-[13px] font-medium text-gray-900 bg-transparent outline-none border-b border-blue-400"
                />
              ) : (
                <span
                  onClick={() => handleItemClick(todo)}
                  className={cn(
                    "flex-1 text-[13px] font-medium select-none cursor-text transition-colors duration-150",
                    todo.done ? "line-through text-gray-400" : "text-gray-900 hover:text-gray-700"
                  )}
                >
                  {todo.text}
                </span>
              )}

              {/* Trash au survol */}
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

      {/* ── Ajout rapide ────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-2 border-t border-gray-100">
        {isAdding ? (
          <div className="flex items-center gap-2">
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
              className="flex-1 text-[13px] text-gray-700 placeholder:text-gray-400 bg-transparent outline-none"
            />
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 w-full text-[12px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        )}
      </div>
    </div>
  );
}

// ── RemindersGrid ──────────────────────────────────────────────────────────────

interface ProfileData {
  userId:          string;
  profilePhotoLink: string | null;
  mood:            string;
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

  // Notes libres (content)
  const [notesContent, setNotesContent] = useState<Record<string, string>>({});

  // Profils (mood + photo)
  const [profiles, setProfiles] = useState<Record<string, ProfileData>>({});

  const saveTimers       = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mountedRef       = useRef(true);
  const editingKeyRef    = useRef<string | null>(null);
  const onNoteChangedRef = useRef(onNoteChanged);
  useEffect(() => { onNoteChangedRef.current = onNoteChanged; }, [onNoteChanged]);

  // ── Chargement initial des profils ────────────────────────────────────────────
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

  // ── Chargement initial des notes (content) ────────────────────────────────────
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

  // ── SSE : todos en temps réel ─────────────────────────────────────────────────
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
            const note = JSON.parse((event as MessageEvent).data) as {
              person: string;
              todos:  TodoItem[] | string;
            };
            onNoteChangedRef.current?.(note.person);
            if (editingKeyRef.current === note.person) return;
            let todos: TodoItem[] = [];
            if (Array.isArray(note.todos))           todos = note.todos;
            else if (typeof note.todos === "string") {
              try { todos = JSON.parse(note.todos); } catch { todos = []; }
            }
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

  // ── Handlers ──────────────────────────────────────────────────────────────────

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
    setProfiles(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { userId: key, profilePhotoLink: null, mood: "" }), mood: emoji },
    }));
    apiSaveProfile(key, { mood: emoji });
  }, []);

  const handlePhotoChange = useCallback((key: string, url: string) => {
    const link = url || null;
    setProfiles(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { userId: key, profilePhotoLink: null, mood: "" }), profilePhotoLink: link },
    }));
    apiSaveProfile(key, { profilePhotoLink: link });
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {PEOPLE.map((p) => (
        <ReminderCard
          key={p.key}
          personKey={p.key}
          personName={p.name}
          personInitial={p.initial}
          personFrom={p.from}
          personTo={p.to}
          todos={todosMap[p.key] ?? []}
          note={notesContent[p.key] ?? ""}
          mood={profiles[p.key]?.mood ?? ""}
          photoLink={profiles[p.key]?.profilePhotoLink ?? null}
          isActive={p.key === activeUser}
          onUpdate={(next) => handleUpdate(p.key, next)}
          onReceiveTodo={(fromKey, todoId) => handleReceiveTodo(fromKey, p.key, todoId)}
          onEditingChange={(isEditing) => { editingKeyRef.current = isEditing ? p.key : null; }}
          onMoodChange={(emoji) => handleMoodChange(p.key, emoji)}
          onNoteChange={(content) => handleNoteChange(p.key, content)}
          onPhotoChange={(url) => handlePhotoChange(p.key, url)}
        />
      ))}
    </div>
  );
}
