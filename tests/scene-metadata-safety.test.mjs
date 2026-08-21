import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

test("every enhanced scene reference resolves to declared metadata", async () => {
  const examplesUrl = new URL("../examples/", import.meta.url);
  const directories = (await readdir(examplesUrl, { withFileTypes: true })).filter((entry) => entry.isDirectory());

  for (const directory of directories) {
    const raw = await readFile(new URL(`${directory.name}/topology.yaml`, examplesUrl), "utf8");
    const scene = YAML.parse(raw);
    for (const locale of ["zhCN", "enUS"]) {
      const content = scene.enhanced.content[locale];
      for (const node of content.topologyNodes) assert.ok(content.planeMeta[node.data.plane], `${scene.id}/${locale}: missing plane ${node.data.plane}`);
      for (const edge of content.topologyEdges) {
        assert.ok(content.edgeMeta[edge.data.kind], `${scene.id}/${locale}: missing edge kind ${edge.data.kind}`);
        assert.ok(content.laneMeta[edge.data.lane], `${scene.id}/${locale}: missing lane ${edge.data.lane}`);
      }
      for (const [journeyId, journey] of Object.entries(content.driverJourneys)) {
        for (const step of journey.steps) {
          for (const layer of step.layers) assert.ok(content.driverCausalLayerMeta[layer], `${scene.id}/${locale}/${journeyId}: missing causal layer ${layer}`);
        }
        for (const edge of journey.edges) {
          assert.ok(content.driverCausalLayerMeta[edge.layer], `${scene.id}/${locale}/${journeyId}: missing relation layer ${edge.layer}`);
          assert.ok(content.driverJourneyRelationMeta[edge.relation], `${scene.id}/${locale}/${journeyId}: missing relation ${edge.relation}`);
        }
      }
    }
  }
});

test("UI keeps metadata fallbacks and a render error boundary", async () => {
  const explorer = await readFile(new URL("../src/TopologyExplorer.tsx", import.meta.url), "utf8");
  const entry = await readFile(new URL("../demo/main.tsx", import.meta.url), "utf8");
  const boundary = await readFile(new URL("../src/AppErrorBoundary.tsx", import.meta.url), "utf8");
  const upgrader = await readFile(new URL("../scripts/upgrade-basic-scene-v2.mjs", import.meta.url), "utf8");

  for (const helper of ["resolvePlaneMeta", "resolveEdgeMeta", "resolveCausalLayerMeta"])
    assert.ok(explorer.includes(helper), `missing renderer fallback ${helper}`);
  assert.ok(entry.includes("AppErrorBoundary"));
  assert.ok(entry.includes("UNKNOWN SCENE"));
  assert.ok(boundary.includes("getDerivedStateFromError"));
  assert.match(upgrader, /physical:\s*"payload"/);
  assert.ok(upgrader.includes("journey.edgeIds[Math.min(stepIndex"));
});

test("EG942H public scene excludes machine-specific paths and addresses", async () => {
  const directory = new URL("../examples/eg942h-g30-r2-m4/", import.meta.url);
  const publicSources = await Promise.all([
    "topology.yaml",
    "source-inventory.md",
    "acceptance-checklist.md",
  ].map((name) => readFile(new URL(name, directory), "utf8")));
  const publicText = publicSources.join("\n");

  assert.doesNotMatch(publicText, /\/home\/codex|172\.100\.|25082610/);
  assert.match(publicText, /external\/eg942h-g30-boot-recorder\/bmc_boot_recorder\.py/);
  assert.match(publicText, /external\/eg942h-g30-boot-web\/boot_web\.py/);
});
