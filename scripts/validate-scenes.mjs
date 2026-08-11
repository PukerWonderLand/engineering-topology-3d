import Ajv2020 from "ajv/dist/2020.js";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "..");
const schema = JSON.parse(await readFile(resolve(root, "spec/scene-definition.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const examplesRoot = resolve(root, "examples");
const directories = (await readdir(examplesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
const sceneIds = new Set();

function fail(source, messages) {
  throw new Error(`${source}\n${messages.map((message) => `  - ${message}`).join("\n")}`);
}

for (const directory of directories) {
  const source = resolve(examplesRoot, directory.name, "topology.yaml");
  const scene = YAML.parse(await readFile(source, "utf8"));
  if (!validate(scene)) fail(source, (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`));
  if (sceneIds.has(scene.id)) fail(source, [`duplicate scene id ${scene.id}`]);
  sceneIds.add(scene.id);

  const ids = (items) => new Set(items.map((item) => item.id));
  const zoneIds = ids(scene.zones); const nodeIds = ids(scene.nodes); const edgeIds = ids(scene.edges); const functionIds = ids(scene.functions);
  const problems = [];
  scene.nodes.forEach((node) => { if (!zoneIds.has(node.zoneId)) problems.push(`node ${node.id} -> missing zone ${node.zoneId}`); });
  scene.edges.forEach((edge) => { if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) problems.push(`edge ${edge.id} has a dangling endpoint`); });
  scene.functions.forEach((item) => { if (!nodeIds.has(item.moduleId)) problems.push(`function ${item.id} -> missing module ${item.moduleId}`); });
  scene.journeys.forEach((journey) => {
    journey.edgeIds.forEach((id) => { if (!edgeIds.has(id)) problems.push(`journey ${journey.id} -> missing edge ${id}`); });
    journey.steps.forEach((step) => {
      if (step.nodeId && !nodeIds.has(step.nodeId)) problems.push(`journey ${journey.id} -> missing node ${step.nodeId}`);
      if (step.functionId && !functionIds.has(step.functionId)) problems.push(`journey ${journey.id} -> missing function ${step.functionId}`);
    });
  });
  const nodeLayouts = new Set(scene.layout.nodes.map((item) => item.nodeId));
  const zoneLayouts = new Set(scene.layout.zones.map((item) => item.zoneId));
  scene.nodes.forEach((node) => { if (!nodeLayouts.has(node.id)) problems.push(`node ${node.id} has no layout`); });
  scene.zones.forEach((zone) => { if (!zoneLayouts.has(zone.id)) problems.push(`zone ${zone.id} has no layout`); });
  if (problems.length) fail(source, problems);
  console.log(`validated ${scene.id}: ${scene.zones.length} zones, ${scene.nodes.length} nodes, ${scene.edges.length} edges`);
}

if (!sceneIds.size) throw new Error("No topology scenes were found.");
