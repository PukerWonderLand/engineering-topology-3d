import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));
const sceneIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, projectRoot, "VITE_DEFAULT_SCENE");
  const defaultSceneId = process.env.VITE_DEFAULT_SCENE?.trim() || loadedEnv.VITE_DEFAULT_SCENE?.trim();

  if (defaultSceneId) {
    if (!sceneIdPattern.test(defaultSceneId)) throw new Error(`Invalid VITE_DEFAULT_SCENE: ${defaultSceneId}`);
    const scenePath = fileURLToPath(new URL(`./examples/${defaultSceneId}/topology.yaml`, import.meta.url));
    if (!existsSync(scenePath)) throw new Error(`VITE_DEFAULT_SCENE does not exist: ${defaultSceneId}`);
  }

  return {
    root: fileURLToPath(new URL("./demo", import.meta.url)),
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    // Relative assets work on GitHub project Pages and ordinary static hosts.
    base: "./",
    plugins: [react()],
    resolve: {
      alias: {
        "@": projectRoot,
      },
    },
    build: {
      outDir: fileURLToPath(new URL("./dist", import.meta.url)),
      emptyOutDir: true,
      sourcemap: false,
      target: "es2020",
    },
  };
});
