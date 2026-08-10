import { createRoot } from "react-dom/client";
import TopologyExplorer from "../src/TopologyExplorer";
import "../src/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Static application root element is missing.");
}

createRoot(rootElement).render(<TopologyExplorer />);
