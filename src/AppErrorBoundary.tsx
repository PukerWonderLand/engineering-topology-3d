import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
  sceneId: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Engineering Topology 3D render failure", { sceneId: this.props.sceneId, error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#eef3f8", color: "#1d3046", fontFamily: "system-ui, sans-serif" }}>
        <section style={{ width: "min(680px, 100%)", padding: 28, border: "1px solid #d0dce6", borderRadius: 16, background: "#fff", boxShadow: "0 18px 50px rgba(21, 47, 73, 0.14)" }}>
          <p style={{ margin: 0, color: "#c13f5c", fontWeight: 800 }}>SCENE RENDER RECOVERY</p>
          <h1 style={{ margin: "10px 0" }}>场景渲染发生异常，但页面仍可恢复</h1>
          <p>场景：<code>{this.props.sceneId}</code></p>
          <pre style={{ overflow: "auto", padding: 12, borderRadius: 8, background: "#f5f7fa", whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: "#2878c7", color: "#fff", fontWeight: 750, cursor: "pointer" }}>重新加载场景</button>
        </section>
      </main>
    );
  }
}
