import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#12352e",
        color: "#f8f1d5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial",
        flexDirection: "column",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "42px", marginBottom: "10px" }}>
        Organizeme
      </h1>

      <p style={{ color: "#d8c993", marginBottom: "30px" }}>
        Organização financeira inteligente
      </p>

      <button
        style={{
          background: "#c6a15b",
          color: "#12352e",
          border: "none",
          borderRadius: "18px",
          padding: "18px 28px",
          fontSize: "18px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🎤 Toque e fale
      </button>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
