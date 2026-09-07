import { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Safe Sentry initialization
if (import.meta.env.VITE_SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (err) {
    console.warn("[Sentry] Initialization skipped:", err);
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled App Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", fontFamily: "sans-serif", textAlign: "center", backgroundColor: "#f8fafc" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>The application encountered an unexpected error. Please refresh to try again.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "0.75rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", backgroundColor: "#2563eb", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
