import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("build emits a self-contained static entry", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /Engineering Topology 3D/);
  assert.doesNotMatch(html, /https?:\/\/localhost|172\.100\.|25082610/);

  const assets = await readdir(new URL("../dist/assets/", import.meta.url));
  assert.ok(assets.some((name) => name.endsWith(".js")), "missing JavaScript bundle");
  assert.ok(assets.some((name) => name.endsWith(".css")), "missing CSS bundle");
});

test("reference model preserves journeys and evidence boundaries", async () => {
  const data = await readFile(new URL("../src/topology-data.ts", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../src/PhysicalTopology3D.tsx", import.meta.url), "utf8");

  for (const journey of ["send", "receive", "init", "wait", "remove"])
    assert.match(data, new RegExp(`${journey}:`), `missing journey ${journey}`);
  for (const level of ["CODE_PROVEN", "RTL_PROVEN", "RUNTIME_OBSERVED", "INFERRED"])
    assert.ok(data.includes(level) || renderer.includes(level), `missing evidence level ${level}`);

  const publicText = `${data}\n${renderer}`;
  assert.ok(publicText.includes("EXAMPLE_IP"));
  assert.ok(publicText.includes("PROBE_A"));
});

test("interaction source keeps LOD, collision, focus, fullscreen, and language controls", async () => {
  const explorer = await readFile(new URL("../src/TopologyExplorer.tsx", import.meta.url), "utf8");
  const physical = await readFile(new URL("../src/PhysicalTopology3D.tsx", import.meta.url), "utf8");
  const labels = await readFile(new URL("../src/global-label-layout.ts", import.meta.url), "utf8");

  for (const token of ["subLabelDistance", "farBlockOpacity", "farFlowOpacity", "fullscreenIndexOpen", "LocaleProvider"])
    assert.ok(explorer.includes(token), `missing explorer control ${token}`);
  for (const token of ["LONG_PRESS_ROTATE_MS", "frameloop=\"demand\"", "moduleFocusFrame", "resolveGlobalLabelCollisions"])
    assert.ok(physical.includes(token), `missing 3D interaction ${token}`);
  assert.ok(labels.includes("resolveGlobalLabelCollisions"));
});
