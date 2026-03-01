"use client";

/**
 * TeamGrid — 4 cartes collaborateurs style Apple.
 *
 * Chaque carte expose :
 *   · Avatar circulaire prêt pour Memoji (gradient + initiale)
 *   · Badge de rôle discret
 *   · Sélecteur d'humeur emoji (6 états)
 *   · Zone de notes libre avec placeholder chaleureux
 *   · Footer "Mis à jour par X · il y a N min"
 *
 * Persistance via /api/team-notes (PATCH par personne).
 * Auto-save sur blur (notes) ou sélection immédiate (mood).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Config équipe ──────────────────────────────────────────────────────────────

const TEAM = [
  {
    key: "loic",
    name: "Loïc",
    role: "Boss",
    initial: "L",
    placeholder: "Un mot pour Loïc…",
    avatarFrom: "#3a3a3c",
    avatarTo: "#1c1c1e",
    roleColor: "#6e6e73",
    roleBg: "#f2f2f7",
    cardAccent: "rgba(28,28,30,0.06)",
  },
  {
    key: "melina",
    name: "Mélina",
    role: "Vente",
    initial: "M",
    placeholder: "Un message pour Mélina ?",
    avatarFrom: "#ff6b9d",
    avatarTo: "#ff3b7a",
    roleColor: "#c2185b",
    roleBg: "#fff0f6",
    cardAccent: "rgba(255,59,122,0.06)",
  },
  {
    key: "amandine",
    name: "Amandine",
    role: "Social Media",
    initial: "A",
    placeholder: "Une idée pour Amandine ?",
    avatarFrom: "#bf5af2",
    avatarTo: "#9b59b6",
    roleColor: "#6d28d9",
    roleBg: "#f5f0ff",
    cardAccent: "rgba(148,88,222,0.06)",
  },
  {
    key: "renaud",
    name: "Renaud",
    role: "Atelier",
    initial: "R",
    placeholder: "Une consigne pour Renaud ?",
    avatarFrom: "#ff9f0a",
    avatarTo: "#ff6b00",
    roleColor: "#c2410c",
    roleBg: "#fff7ed",
    cardAccent: "rgba(255,107,0,0.06)",
  },
] as const;

type PersonKey = typeof TEAM[number]["key"];

// ── Moods ──────────────────────────────────────────────────────────────────────

const MOODS = [
  { emoji: "🔥", label: "En rush" },
  { emoji: "☕️", label: "En pause" },
  { emoji: "💪", label: "Dans le flow" },
  { emoji: "🎯", label: "Focus" },
  { emoji: "🤔", label: "En réflexion" },
  { emoji: "😊", label: "Bien" },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamNoteData {
  person: string;
  note: string;
  mood: string;
  updatedBy: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function displayName(key: string): string {
  const found = TEAM.find((t) => t.key === key);
  return found ? found.name : key;
}

function apiSave(patch: Partial<TeamNoteData> & { person: string }) {
  fetch("/api/team-notes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

// ── MoodPicker ─────────────────────────────────────────────────────────────────

function MoodPicker({
  current,
  onChange,
}: {
  current: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="Changer l'humeur"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          borderRadius: 20,
          border: "1px solid rgba(0,0,0,0.07)",
          background: open ? "rgba(0,0,0,0.04)" : "transparent",
          cursor: "pointer",
          transition: "background 0.15s ease",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>
          {current || "·"}
        </span>
        <span style={{ fontSize: 11, color: "#aeaeb2", lineHeight: 1 }}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 16,
              padding: "8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 140,
            }}
          >
            {MOODS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: current === emoji ? "rgba(0,0,0,0.05)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  width: "100%",
                  textAlign: "left",
                  transition: "background 0.12s ease",
                  WebkitTapHighlightColor: "transparent",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = current === emoji ? "rgba(0,0,0,0.05)" : "transparent"; }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
                <span style={{ fontSize: 13, color: "#3a3a3c", fontWeight: current === emoji ? 600 : 400 }}>{label}</span>
              </button>
            ))}

            {current && (
              <>
                <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />
                <button
                  onClick={() => { onChange(""); setOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    width: "100%",
                    textAlign: "left",
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, opacity: 0.3 }}>✕</span>
                  <span style={{ fontSize: 13, color: "#aeaeb2" }}>Effacer</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── TeamCard ───────────────────────────────────────────────────────────────────

function TeamCard({
  person,
  data,
  activeUser,
  onDataChange,
}: {
  person: typeof TEAM[number];
  data: TeamNoteData | undefined;
  activeUser: string;
  onDataChange: (key: PersonKey, patch: Partial<TeamNoteData>) => void;
}) {
  const [localNote, setLocalNote] = useState(data?.note ?? "");
  const [saved, setSaved] = useState(false);
  const [hovered, setHovered] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external data into local state (initial load + external updates)
  useEffect(() => {
    setLocalNote(data?.note ?? "");
  }, [data?.note]);

  const handleMoodChange = useCallback(
    (emoji: string) => {
      const patch = { mood: emoji, updatedBy: activeUser };
      onDataChange(person.key, patch);
      apiSave({ person: person.key, ...patch });
    },
    [person.key, activeUser, onDataChange]
  );

  const handleNoteChange = useCallback((val: string) => {
    setLocalNote(val);
    // Debounced auto-save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const patch = { note: val, updatedBy: activeUser };
      onDataChange(person.key, patch);
      apiSave({ person: person.key, ...patch });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 900);
  }, [person.key, activeUser, onDataChange]);

  const handleNoteBlur = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const patch = { note: localNote, updatedBy: activeUser };
    onDataChange(person.key, patch);
    apiSave({ person: person.key, ...patch });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, [localNote, person.key, activeUser, onDataChange]);

  const currentMood = data?.mood ?? "";
  const updatedBy = data?.updatedBy ?? "";
  const updatedAt = data?.updatedAt ?? "";

  const cardBg = hovered
    ? "rgba(255,255,255,1)"
    : "rgba(255,255,255,0.92)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: cardBg,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 24,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        boxShadow: hovered
          ? "0 12px 40px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.8) inset"
          : "0 2px 12px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.7) inset",
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        cursor: "default",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* ── Header : Avatar + Infos + Mood ──────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar circulaire — prêt pour Memoji */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            flexShrink: 0,
            background: `linear-gradient(145deg, ${person.avatarFrom}, ${person.avatarTo})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 16px ${person.avatarFrom}40`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Shimmer subtil */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)",
              borderRadius: "50%",
            }}
          />
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "-0.02em",
              position: "relative",
              zIndex: 1,
              userSelect: "none",
            }}
          >
            {person.initial}
          </span>
        </div>

        {/* Infos : Nom + Rôle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {person.name}
            </span>
            {/* Badge rôle */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: person.roleColor,
                background: person.roleBg,
                padding: "2px 8px",
                borderRadius: 20,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {person.role}
            </span>
          </div>

          {/* Mood actuel affiché */}
          {currentMood && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#8e8e93",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 14 }}>{currentMood}</span>
              <span>{MOODS.find((m) => m.emoji === currentMood)?.label ?? ""}</span>
            </div>
          )}
        </div>

        {/* Mood picker — coin droit */}
        <MoodPicker current={currentMood} onChange={handleMoodChange} />
      </div>

      {/* ── Séparateur fin ──────────────────────────────────────────────── */}
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${person.cardAccent}, transparent)`,
          borderRadius: 1,
        }}
      />

      {/* ── Zone de notes ───────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <textarea
          value={localNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder={person.placeholder}
          rows={5}
          style={{
            width: "100%",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            lineHeight: 1.65,
            color: "#3a3a3c",
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
            padding: 0,
            caretColor: person.avatarFrom,
          }}
          onFocus={(e) => {
            e.currentTarget.style.color = "#1d1d1f";
          }}
        />

        {/* Placeholder teinté quand vide */}
        <style>{`
          textarea::placeholder {
            color: #c7c7cc;
          }
        `}</style>
      </div>

      {/* ── Footer : Auteur + timestamp + indicateur de sauvegarde ──────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: -8,
        }}
      >
        <span style={{ fontSize: 11, color: "#c7c7cc", letterSpacing: "0.01em" }}>
          {updatedBy && updatedAt
            ? `Modifié par ${displayName(updatedBy)} · ${relativeTime(updatedAt)}`
            : updatedAt
            ? relativeTime(updatedAt)
            : "Aucune note pour l'instant"}
        </span>

        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 11, color: "#34c759", fontWeight: 600 }}
            >
              Sauvegardé ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── TeamGrid (export) ──────────────────────────────────────────────────────────

export function TeamGrid({ activeUser }: { activeUser: string }) {
  const [notesMap, setNotesMap] = useState<Record<string, TeamNoteData>>({});
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    fetch("/api/team-notes")
      .then((r) => r.json())
      .then((data: { notes: TeamNoteData[] }) => {
        const map: Record<string, TeamNoteData> = {};
        for (const n of data.notes) map[n.person] = n;
        setNotesMap(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDataChange = useCallback(
    (key: PersonKey, patch: Partial<TeamNoteData>) => {
      setNotesMap((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? { person: key, note: "", mood: "", updatedBy: "", updatedAt: "" }),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    []
  );

  // Stagger animation variant for the grid
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {TEAM.map((p) => (
          <div
            key={p.key}
            style={{
              height: 240,
              borderRadius: 24,
              background: "rgba(0,0,0,0.03)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* En-tête de section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ marginBottom: 24 }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#1d1d1f",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          L'équipe
        </h2>
        <p style={{ fontSize: 14, color: "#8e8e93", marginTop: 4, margin: "4px 0 0 0" }}>
          Notes, humeurs et consignes du jour.
        </p>
      </motion.div>

      {/* Grille 2×2 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {TEAM.map((person) => (
          <TeamCard
            key={person.key}
            person={person}
            data={notesMap[person.key]}
            activeUser={activeUser}
            onDataChange={handleDataChange}
          />
        ))}
      </motion.div>
    </div>
  );
}
