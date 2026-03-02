export default function NotFound() {
  return (
    <div
      style={{
        fontFamily:          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: "antialiased",
        background:          "#FFFFFF",
        minHeight:           "100vh",
        display:             "flex",
        flexDirection:       "column",
        alignItems:          "center",
        justifyContent:      "center",
        padding:             "40px 24px",
        color:               "#1D1D1F",
        textAlign:           "center",
      }}
    >
      <div style={{ marginBottom: "32px" }}>
        <span style={{ fontSize: "17px", fontWeight: "700", letterSpacing: "-0.3px" }}>
          Olda Studio
        </span>
      </div>

      <div
        style={{
          width:          "72px",
          height:         "72px",
          borderRadius:   "50%",
          background:     "#F5F5F7",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "28px",
          marginBottom:   "24px",
        }}
      >
        ?
      </div>

      <h1
        style={{
          fontSize:      "24px",
          fontWeight:    "700",
          letterSpacing: "-0.5px",
          margin:        "0 0 12px",
        }}
      >
        Commande introuvable
      </h1>
      <p style={{ fontSize: "15px", color: "#6E6E73", maxWidth: "320px", lineHeight: "1.5", margin: 0 }}>
        Ce lien de suivi n&apos;existe pas ou a expiré. Contactez l&apos;atelier pour plus d&apos;informations.
      </p>

      <p style={{ fontSize: "12px", color: "#C7C7CC", marginTop: "48px" }}>
        Olda Studio · Atelier de personnalisation
      </p>
    </div>
  );
}
