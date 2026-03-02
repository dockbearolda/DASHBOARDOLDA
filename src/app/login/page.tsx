"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const TEAM_MEMBERS = [
  { key: "loic",     label: "Loïc"     },
  { key: "charlie",  label: "Charlie"  },
  { key: "melina",   label: "Mélina"   },
  { key: "amandine", label: "Amandine" },
  { key: "renaud",   label: "Renaud"   },
];

export default function LoginPage() {
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const pwdRef  = useRef<HTMLInputElement>(null);
  const router  = useRouter();

  // Focus le champ password dès qu'un membre est sélectionné
  useEffect(() => {
    if (selected) setTimeout(() => pwdRef.current?.focus(), 50);
  }, [selected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !password) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: selected, password }),
      });
      if (res.ok) {
        router.push("/dashboard/olda");
        router.refresh();
      } else {
        setError("Mot de passe incorrect");
        setPassword("");
        setTimeout(() => pwdRef.current?.focus(), 50);
      }
    } catch {
      setError("Erreur de connexion, réessayez");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily:          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
        background:          "#F5F5F7",
        minHeight:           "100vh",
        display:             "flex",
        alignItems:          "center",
        justifyContent:      "center",
        padding:             "24px",
      }}
    >
      <div
        style={{
          width:        "100%",
          maxWidth:     "380px",
          background:   "#FFFFFF",
          borderRadius: "20px",
          padding:      "40px 36px",
          boxShadow:    "0 2px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width:          "52px",
              height:         "52px",
              borderRadius:   "14px",
              background:     "#1D1D1F",
              display:        "inline-flex",
              alignItems:     "center",
              justifyContent: "center",
              marginBottom:   "14px",
            }}
          >
            <span style={{ fontSize: "22px" }}>✦</span>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.4px", margin: "0 0 4px", color: "#1D1D1F" }}>
            Olda Studio
          </h1>
          <p style={{ fontSize: "13px", color: "#86868B", margin: 0 }}>
            Connectez-vous pour accéder au dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Sélection du membre */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6E6E73", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
              Qui êtes-vous ?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {TEAM_MEMBERS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelected(m.key)}
                  style={{
                    padding:       "10px 8px",
                    borderRadius:  "12px",
                    border:        selected === m.key ? "2px solid #1D1D1F" : "2px solid #E5E5EA",
                    background:    selected === m.key ? "#1D1D1F" : "#FFFFFF",
                    color:         selected === m.key ? "#FFFFFF" : "#1D1D1F",
                    fontSize:      "13px",
                    fontWeight:    "600",
                    cursor:        "pointer",
                    transition:    "all 0.15s ease",
                    userSelect:    "none",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mot de passe — apparaît après sélection */}
          <div
            style={{
              overflow:   "hidden",
              maxHeight:  selected ? "120px" : "0",
              opacity:    selected ? 1 : 0,
              transition: "max-height 0.25s ease, opacity 0.2s ease",
            }}
          >
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6E6E73", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
              Mot de passe
            </label>
            <input
              ref={pwdRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width:        "100%",
                height:       "44px",
                padding:      "0 14px",
                borderRadius: "12px",
                border:       error ? "2px solid #FF3B30" : "2px solid #E5E5EA",
                fontSize:     "16px",
                color:        "#1D1D1F",
                background:   "#FFFFFF",
                outline:      "none",
                boxSizing:    "border-box",
                transition:   "border-color 0.15s ease",
                letterSpacing: "2px",
              }}
              onFocus={(e) => { if (!error) (e.target as HTMLInputElement).style.borderColor = "#1D1D1F"; }}
              onBlur={(e)  => { if (!error) (e.target as HTMLInputElement).style.borderColor = "#E5E5EA"; }}
            />
          </div>

          {/* Erreur */}
          {error && (
            <p style={{
              fontSize:     "13px",
              color:        "#FF3B30",
              margin:       "0",
              textAlign:    "center",
              fontWeight:   "500",
              animation:    "shake 0.3s ease",
            }}>
              {error}
            </p>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={!selected || !password || loading}
            style={{
              width:         "100%",
              height:        "46px",
              borderRadius:  "12px",
              border:        "none",
              background:    (!selected || !password || loading) ? "#E5E5EA" : "#1D1D1F",
              color:         (!selected || !password || loading) ? "#C7C7CC" : "#FFFFFF",
              fontSize:      "15px",
              fontWeight:    "600",
              cursor:        (!selected || !password || loading) ? "not-allowed" : "pointer",
              transition:    "background 0.15s ease, transform 0.1s ease",
              letterSpacing: "-0.2px",
            }}
            onMouseDown={(e) => { if (!(!selected || !password || loading)) (e.currentTarget.style.transform = "scale(0.98)"); }}
            onMouseUp={(e)   => { (e.currentTarget.style.transform = "scale(1)"); }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-6px); }
          75%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
