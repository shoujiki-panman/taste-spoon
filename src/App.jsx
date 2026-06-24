import { useEffect, useState } from "react";
import TasteSpoon from "./TasteSpoon.jsx";
import XRPreview from "./XRPreview.jsx";

export default function App() {
  const [view, setView] = useState(() => window.location.hash === "#xr-preview" ? "xr" : "home");

  useEffect(() => {
    const onHashChange = () => setView(window.location.hash === "#xr-preview" ? "xr" : "home");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const go = (next) => {
    window.location.hash = next === "xr" ? "xr-preview" : "";
    setView(next);
  };

  return (
    <>
      <div style={navStyles.wrap}>
        <button
          type="button"
          onClick={() => go("home")}
          aria-pressed={view === "home"}
          style={{ ...navStyles.button, ...(view === "home" ? navStyles.active : null) }}
        >
          🥄 Taste Spoon
        </button>
        <button
          type="button"
          onClick={() => go("xr")}
          aria-pressed={view === "xr"}
          style={{ ...navStyles.button, ...(view === "xr" ? navStyles.active : null) }}
        >
          ◉ XR Preview
        </button>
      </div>
      {view === "xr" ? <XRPreview /> : <TasteSpoon />}
    </>
  );
}

const navStyles = {
  wrap: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    gap: 8,
    justifyContent: "center",
    padding: "10px 12px",
    background: "rgba(255, 252, 246, 0.92)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid rgba(43, 35, 25, 0.08)",
  },
  button: {
    appearance: "none",
    border: "1px solid rgba(43, 35, 25, 0.12)",
    borderRadius: 999,
    background: "#fff",
    color: "#514335",
    fontWeight: 800,
    fontSize: 14,
    padding: "10px 14px",
    cursor: "pointer",
  },
  active: {
    background: "#2f241b",
    color: "#fff7ed",
    borderColor: "#2f241b",
    boxShadow: "0 8px 18px rgba(47, 36, 27, 0.16)",
  },
};
