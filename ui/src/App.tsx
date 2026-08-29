import { TrueForgeUI } from "@truefoundry/trueforge-ui";

const baseUrl = import.meta.env.VITE_TRUEFORGE_URL ?? "http://localhost:8790";

export default function App() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.75rem",
          padding: "0.65rem 1.1rem",
          borderBottom: "1px solid rgba(128,128,128,0.25)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <strong style={{ fontSize: "0.95rem", letterSpacing: "0.08em" }}>CLEANROOM</strong>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
          drop in messy data. get back data you trust.
        </span>
        <a
          href="https://github.com/sreenathmmenon/cleanroom"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto", fontSize: "0.8rem", opacity: 0.7 }}
        >
          repo ↗
        </a>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TrueForgeUI
          server={{ type: "trueforge", baseUrl }}
          layout="sidebar"
          theme={{
            preset: "trueforge",
            mode: "dark",
            brand: { name: "Cleanroom" },
          }}
        />
      </div>
    </div>
  );
}
