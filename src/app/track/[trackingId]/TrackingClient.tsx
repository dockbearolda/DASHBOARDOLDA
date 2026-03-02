"use client";

import { useEffect, useState } from "react";
import type { TrackingData } from "./page";

// ── Mapping statuts → étapes visuelles ─────────────────────────────────────

type StepKey = "received" | "processing" | "production" | "done";

const STATUS_TO_STEP: Record<string, StepKey> = {
  // Commande reçue — état initial
  A_DEVISER:           "received",
  // En traitement
  ATTENTE_VALIDATION:  "processing",
  MAQUETTE_A_FAIRE:    "processing",
  ATTENTE_MARCHANDISE: "processing",
  A_PREPARER:          "processing",
  A_PRODUIRE:          "processing",
  MANQUE_INFORMATION:  "processing",
  // En production
  EN_PRODUCTION:       "production",
  A_MONTER_NETTOYER:   "production",
  PREVENIR_CLIENT:     "production",
  // Produit terminé
  TERMINE:             "done",
  CLIENT_PREVENU:      "done",
  RELANCE_CLIENT:      "done",
  PRODUIT_RECUPERE:    "done",
  A_FACTURER:          "done",
  FACTURE_FAITE:       "done",
};

const STEPS: { key: StepKey; label: string; sublabel: string; icon: string }[] = [
  {
    key:      "received",
    label:    "Commande reçue",
    sublabel: "Votre commande a bien été enregistrée",
    icon:     "✓",
  },
  {
    key:      "processing",
    label:    "En traitement",
    sublabel: "Votre commande est en cours de préparation",
    icon:     "◷",
  },
  {
    key:      "production",
    label:    "En production",
    sublabel: "Votre commande est en cours de fabrication",
    icon:     "⚙",
  },
  {
    key:      "done",
    label:    "Produit terminé",
    sublabel: "Votre commande est prête !",
    icon:     "★",
  },
];

const STEP_INDEX: Record<StepKey, number> = {
  received:   0,
  processing: 1,
  production: 2,
  done:       3,
};

function getActiveStep(status: string): number {
  const step = STATUS_TO_STEP[status] ?? "received";
  return STEP_INDEX[step];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ── Composant principal ────────────────────────────────────────────────────

export default function TrackingClient({ initialData }: { initialData: TrackingData }) {
  const [data, setData] = useState<TrackingData>(initialData);
  const activeStep = getActiveStep(data.status);

  // Polling toutes les 30s pour mise à jour temps réel
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/track/${data.trackingId}`);
        if (res.ok) {
          const json = await res.json();
          setData((prev) => ({ ...prev, ...json }));
        }
      } catch {
        // Silencieux — polling non critique
      }
    };

    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [data.trackingId]);

  return (
    <div
      style={{
        fontFamily:          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        background:          "#FFFFFF",
        minHeight:           "100vh",
        color:               "#1D1D1F",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom:    "1px solid #F5F5F7",
          padding:         "20px 24px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
        }}
      >
        <span
          style={{
            fontSize:   "17px",
            fontWeight: "700",
            letterSpacing: "-0.3px",
            color:      "#1D1D1F",
          }}
        >
          Olda Studio
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: "480px",
          margin:   "0 auto",
          padding:  "40px 24px 60px",
        }}
      >
        {/* Titre commande */}
        <div style={{ marginBottom: "36px" }}>
          <p style={{ fontSize: "13px", color: "#86868B", marginBottom: "6px", fontWeight: "500", letterSpacing: "0.4px", textTransform: "uppercase" }}>
            Suivi de commande
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "-0.5px", margin: "0 0 6px", lineHeight: "1.2" }}>
            {data.designation || "Commande personnalisée"}
          </h1>
          <p style={{ fontSize: "15px", color: "#6E6E73", margin: 0 }}>
            Pour {data.clientName || "vous"}
            {data.quantity > 1 && ` · ${data.quantity} article${data.quantity > 1 ? "s" : ""}`}
          </p>
          {data.deadline && (
            <p style={{ fontSize: "13px", color: "#86868B", marginTop: "8px" }}>
              Date estimée : <strong style={{ color: "#1D1D1F" }}>{formatDate(data.deadline)}</strong>
            </p>
          )}
        </div>

        {/* Stepper vertical */}
        <div style={{ position: "relative" }}>
          {STEPS.map((step, idx) => {
            const isDone   = idx < activeStep;
            const isActive = idx === activeStep;
            const isFuture = idx > activeStep;

            return (
              <div
                key={step.key}
                style={{
                  display:        "flex",
                  alignItems:     "flex-start",
                  gap:            "16px",
                  paddingBottom:  idx < STEPS.length - 1 ? "32px" : "0",
                  position:       "relative",
                }}
              >
                {/* Ligne verticale */}
                {idx < STEPS.length - 1 && (
                  <div
                    style={{
                      position:   "absolute",
                      left:       "19px",
                      top:        "40px",
                      width:      "2px",
                      height:     "calc(100% - 8px)",
                      background: isDone ? "#1D1D1F" : "#E5E5EA",
                      transition: "background 0.4s ease",
                    }}
                  />
                )}

                {/* Cercle étape */}
                <div
                  style={{
                    width:          "40px",
                    height:         "40px",
                    borderRadius:   "50%",
                    flexShrink:     0,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       isDone ? "16px" : "14px",
                    fontWeight:     "600",
                    transition:     "all 0.4s ease",
                    background:     isDone
                      ? "#1D1D1F"
                      : isActive
                      ? "#1D1D1F"
                      : "#F5F5F7",
                    color:          isDone || isActive ? "#FFFFFF" : "#C7C7CC",
                    boxShadow:      isActive
                      ? "0 0 0 4px rgba(29,29,31,0.1)"
                      : "none",
                    animation:      isActive ? "pulse-ring 2s infinite" : "none",
                  }}
                >
                  {isDone ? "✓" : step.icon}
                </div>

                {/* Texte */}
                <div style={{ paddingTop: "8px", flex: 1 }}>
                  <p
                    style={{
                      margin:     "0 0 2px",
                      fontSize:   "16px",
                      fontWeight: isActive ? "700" : isFuture ? "400" : "600",
                      color:      isFuture ? "#C7C7CC" : "#1D1D1F",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {step.label}
                  </p>
                  {(isActive || isDone) && (
                    <p
                      style={{
                        margin:   "0",
                        fontSize: "13px",
                        color:    "#86868B",
                        lineHeight: "1.4",
                      }}
                    >
                      {step.sublabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer discret */}
        <div
          style={{
            marginTop:  "52px",
            paddingTop: "20px",
            borderTop:  "1px solid #F5F5F7",
            textAlign:  "center",
          }}
        >
          <p style={{ fontSize: "12px", color: "#C7C7CC", margin: 0 }}>
            Olda Studio · Atelier de personnalisation
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 4px rgba(29,29,31,0.08); }
          50%  { box-shadow: 0 0 0 8px rgba(29,29,31,0.04); }
          100% { box-shadow: 0 0 0 4px rgba(29,29,31,0.08); }
        }
      `}</style>
    </div>
  );
}
