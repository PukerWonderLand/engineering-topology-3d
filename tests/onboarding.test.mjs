import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("welcome tour covers the five product capabilities with real media assets", async () => {
  const source = await readFile(new URL("src/onboarding/WelcomeTour.tsx", projectRoot), "utf8");
  const expectedIds = [
    "project-overview",
    "progressive-labels",
    "index-navigation",
    "display-settings",
    "node-deep-dive",
  ];

  for (const [index, id] of expectedIds.entries()) {
    assert.ok(source.includes(`id: "${id}"`), `missing welcome step ${id}`);
    const prefix = String(index + 1).padStart(2, "0");
    const mediaName = `${prefix}-${id}`;
    for (const extension of ["gif", "png"]) {
      const media = new URL(`public/onboarding/${mediaName}.${extension}`, projectRoot);
      await access(media);
      assert.ok((await stat(media)).size > 1_000, `${mediaName}.${extension} must be a real media asset`);
    }
  }

  for (const token of ["prefers-reduced-motion", "ArrowRight", "ArrowLeft", "aria-modal", "WELCOME_TOUR_STORAGE_KEY"])
    assert.ok(source.includes(token), `missing welcome behavior ${token}`);
});

test("system index navigation flies to nodes without entering focus mode", async () => {
  const explorer = await readFile(new URL("src/TopologyExplorer.tsx", projectRoot), "utf8");
  const scene = await readFile(new URL("src/PhysicalTopology3D.tsx", projectRoot), "utf8");

  for (const token of ["navigateToNode", "cameraNavigationSequenceRef", "navigationRequest={cameraNavigation}"])
    assert.ok(explorer.includes(token), `missing index navigation behavior ${token}`);
  for (const token of ["CameraNavigationRequest", "navigationFrame", "transitionRef", "/ 520"])
    assert.ok(scene.includes(token), `missing camera flight behavior ${token}`);
});
