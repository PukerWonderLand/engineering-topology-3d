import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

test("build emits a self-contained static entry", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /Engineering Topology 3D/);
  assert.doesNotMatch(html, /https?:\/\/localhost|172\.100\.|25082610/);
  assert.doesNotMatch(html, /T113|NVMe|EG942H/, "static metadata must stay scene-neutral");

  const assets = await readdir(new URL("../dist/assets/", import.meta.url));
  assert.ok(assets.some((name) => name.endsWith(".js")), "missing JavaScript bundle");
  assert.ok(assets.some((name) => name.endsWith(".css")), "missing CSS bundle");
});

test("reference model preserves journeys and evidence boundaries", async () => {
  const data = await readFile(new URL("../examples/t113-arm-xvc/topology.yaml", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../src/PhysicalTopology3D.tsx", import.meta.url), "utf8");
  const types = await readFile(new URL("../src/enhanced-scene-types.ts", import.meta.url), "utf8");
  const scene = YAML.parse(data);

  for (const journey of ["send", "receive", "init", "wait", "remove"])
    assert.ok(scene.enhanced.content.zhCN.driverJourneys[journey], `missing journey ${journey}`);
  for (const level of ["CODE_PROVEN", "RTL_PROVEN", "RUNTIME_OBSERVED", "INFERRED"])
    assert.ok(data.includes(level) || renderer.includes(level) || types.includes(level), `missing evidence level ${level}`);

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

test("schema v2 drives the enhanced renderer through one entry", async () => {
  const schema = JSON.parse(await readFile(new URL("../spec/scene-definition.schema.json", import.meta.url), "utf8"));
  const loader = await readFile(new URL("../src/scene-loader.ts", import.meta.url), "utf8");
  const explorer = await readFile(new URL("../src/TopologyExplorer.tsx", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../src/PhysicalTopology3D.tsx", import.meta.url), "utf8");
  const entry = await readFile(new URL("../demo/main.tsx", import.meta.url), "utf8");

  for (const field of ["zones", "nodes", "edges", "journeys", "functions", "layout", "locales", "enhanced"])
    assert.ok(schema.required.includes(field), `SceneDefinition is missing ${field}`);
  assert.equal(schema.properties.schemaVersion.const, "2.0");
  assert.ok(loader.includes('import.meta.glob("../examples/*/topology.yaml"'));
  assert.ok(loader.includes("assertReferences"));
  for (const index of ["nodeById", "edgeById", "functionsByModuleId", "adjacentNodes", "edgesByLane", "journeyById", "nodesByZone", "labelsByZone", "viewMembership"])
    assert.ok(loader.includes(index), `missing runtime index ${index}`);
  assert.ok(entry.includes("EnhancedTopologyExplorer"));
  assert.ok(entry.includes("getScene(requestedSceneId)"));
  assert.ok(!entry.includes("GenericTopologyExplorer"));
  assert.ok(explorer.includes("buildEnhancedSceneRuntime"));
  assert.ok(!explorer.includes('from "./topology-data"'));
  assert.ok(renderer.includes("scene.visuals.zones.map"));
  assert.ok(renderer.includes("scene.visuals.modules.map"));
  assert.ok(!renderer.includes('from "./topology-data"'));
  assert.ok(!renderer.includes('from "./t113-scene-config"'));
});

test("build-time default scene and Linux deployment stay explicit and portable", async () => {
  const entry = await readFile(new URL("../demo/main.tsx", import.meta.url), "utf8");
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const deployment = await readFile(new URL("../docs/deployment.md", import.meta.url), "utf8");
  const service = await readFile(new URL("../deploy/systemd/engineering-topology-3d.service", import.meta.url), "utf8");
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.ok(entry.includes("new URLSearchParams(window.location.search)"));
  assert.ok(entry.includes("import.meta.env.VITE_DEFAULT_SCENE"));
  assert.ok(entry.indexOf("new URLSearchParams(window.location.search)") < entry.indexOf("import.meta.env.VITE_DEFAULT_SCENE"));
  assert.match(envExample, /^VITE_DEFAULT_SCENE=t113-arm-xvc$/m);
  assert.ok(viteConfig.includes("VITE_DEFAULT_SCENE does not exist"));
  assert.ok(viteConfig.includes("sceneIdPattern"));
  assert.ok(deployment.includes("VITE_DEFAULT_SCENE=eg942h-g30-r2-m4 pnpm build"));
  assert.ok(deployment.includes("Environment=ET3D_BIND=0.0.0.0"));

  for (const directive of [
    "DynamicUser=yes",
    "Environment=ET3D_BIND=127.0.0.1",
    "NoNewPrivileges=yes",
    "ProtectSystem=strict",
    "ProtectHome=yes",
    "CapabilityBoundingSet=",
  ]) assert.ok(service.includes(directive), `missing systemd hardening directive ${directive}`);

  assert.doesNotMatch(service, /\/home\/|172\.100\.|192\.168\.|10\.\d+\.\d+\.\d+/);
});

test("T113 golden baseline keeps enhanced IDs, bilingual parity, and defaults", async () => {
  const raw = await readFile(new URL("../examples/t113-arm-xvc/topology.yaml", import.meta.url), "utf8");
  const scene = YAML.parse(raw);
  const zh = scene.enhanced.content.zhCN;
  const en = scene.enhanced.content.enUS;
  assert.equal(scene.schemaVersion, "2.0");
  assert.equal(zh.topologyNodes.length, 17);
  assert.equal(zh.topologyEdges.length, 36);
  assert.deepEqual(zh.topologyNodes.map((item) => item.id).sort(), en.topologyNodes.map((item) => item.id).sort());
  assert.deepEqual(zh.topologyEdges.map((item) => item.id).sort(), en.topologyEdges.map((item) => item.id).sort());
  assert.deepEqual(Object.keys(zh.driverJourneys).sort(), ["init", "receive", "remove", "send", "wait"]);
  assert.equal(scene.enhanced.common.visuals.zones.length, 5);
  assert.deepEqual(scene.enhanced.displayDefaults, {
    pipeThickness: 4.5,
    hudDistance: 1.2,
    moduleLabelDistance: 1.2,
    labelLayoutMode: "module",
    labelLineThickness: 1.5,
    moduleLabelScale: 1,
    focusAnnotationScale: 1,
    focusHudTextScale: 1,
    subLabelDistance: 30,
    subLabelFadeRange: 8,
    farFadeStart: 48,
    farBlockOpacity: 0.22,
    farFlowOpacity: 0.55,
  });
});

test("a second domain is delivered only as a SceneDefinition v2 example", async () => {
  const raw = await readFile(new URL("../examples/nvme-bitmap/topology.yaml", import.meta.url), "utf8");
  const scene = YAML.parse(raw);
  assert.equal(scene.id, "nvme-bitmap");
  assert.equal(scene.schemaVersion, "2.0");
  assert.equal(scene.enhanced.common.visuals.zones.length, 5);
  assert.equal(scene.enhanced.content.zhCN.topologyNodes.length, 12);
  assert.ok(scene.enhanced.content.zhCN.viewOptions.length >= 5);
  assert.ok(Object.keys(scene.enhanced.content.zhCN.driverJourneys).length >= 1);
});

test("English and Chinese READMEs preserve the same information structure", async () => {
  const english = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const chinese = await readFile(new URL("../docs/README.zh-CN.md", import.meta.url), "utf8");
  const sectionCount = (value) => (value.match(/^## /gm) ?? []).length;
  const featureCount = (value, start, end) => {
    const section = value.slice(value.indexOf(start), value.indexOf(end));
    return (section.match(/^- /gm) ?? []).length;
  };

  assert.equal(sectionCount(english), sectionCount(chinese), "README section count differs");
  assert.equal(featureCount(english, "## Features", "## Repository map"), featureCount(chinese, "## 功能特性", "## 仓库结构"), "README feature count differs");
  for (const token of ["v0.2", "t113-arm-xvc", "nvme-bitmap", "eg942h-g30-r2-m4", "VITE_DEFAULT_SCENE", "SceneDefinition", "pnpm install --frozen-lockfile", "pnpm validate:scenes", "pnpm test", "CODE_PROVEN", "RTL_PROVEN", "RUNTIME_OBSERVED", "INFERRED"])
    assert.ok(english.includes(token) && chinese.includes(token), `README parity token is missing: ${token}`);
});
