import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "../src/AppErrorBoundary";
import { EnhancedTopologyExplorer } from "../src/TopologyExplorer";
import { getScene } from "../src/scene-loader";
import "../src/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Static application root element is missing.");
}

const requestedSceneId = new URLSearchParams(window.location.search).get("scene")?.trim()
  || import.meta.env.VITE_DEFAULT_SCENE?.trim()
  || "t113-arm-xvc";
const scene = getScene(requestedSceneId);
const root = createRoot(rootElement);

if (!scene) {
  root.render(
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#eef3f8", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "min(640px, 100%)", padding: 28, border: "1px solid #d0dce6", borderRadius: 16, background: "#fff", color: "#1d3046" }}>
        <p style={{ color: "#c13f5c", fontWeight: 800 }}>UNKNOWN SCENE</p>
        <h1>没有找到请求的三维场景</h1>
        <p>场景 ID：<code>{requestedSceneId}</code></p>
        <a href="?scene=t113-arm-xvc">返回默认场景</a>
      </section>
    </main>,
  );
} else {
  root.render(
    <AppErrorBoundary sceneId={scene.id}>
      <EnhancedTopologyExplorer key={scene.id} scene={scene} />
    </AppErrorBoundary>,
  );
}
