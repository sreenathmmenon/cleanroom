import { Component, type ReactNode } from "react";
import { TrueForgeUI } from "@truefoundry/trueforge-ui";

// Same-origin by default (scripts/serve-ui.mjs proxies /api to TrueForge);
// set VITE_TRUEFORGE_URL to target a server directly when CORS allows it.
const baseUrl = import.meta.env.VITE_TRUEFORGE_URL ?? window.location.origin;

class CrashBarrier extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: "1rem", whiteSpace: "pre-wrap", fontSize: 12 }}>
          UI crashed: {this.state.error.message}
          {"\n"}
          {this.state.error.stack?.slice(0, 1500)}
        </pre>
      );
    }
    return this.props.children;
  }
}

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
        <CrashBarrier>
          <TrueForgeUI
            server={{ type: "trueforge", baseUrl }}
            layout="sidebar"
            theme={{
              preset: "trueforge",
              mode: "dark",
              brand: { name: "Cleanroom" },
            }}
          />
        </CrashBarrier>
      </div>
    </div>
  );
}
