import { createRoot } from "react-dom/client";
import { EnhancedTopologyExplorer } from "../src/TopologyExplorer";
import { getScene } from "../src/scene-loader";
import "../src/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Static application root element is missing.");
}

const requestedSceneId = new URLSearchParams(window.location.search).get("scene") ?? "t113-arm-xvc";
const scene = getScene(requestedSceneId);

if (!scene) {
  throw new Error(`Unknown scene: ${requestedSceneId}`);
}

const root = createRoot(rootElement);
root.render(<EnhancedTopologyExplorer key={scene.id} scene={scene} />);
