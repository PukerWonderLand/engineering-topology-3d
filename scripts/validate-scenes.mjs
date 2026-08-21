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

  const validateEnhancedLocale = (localeName, content) => {
    const enhancedNodeIds = ids(content.topologyNodes);
    const enhancedEdgeIds = ids(content.topologyEdges);
    const journeyIds = new Set(Object.keys(content.driverJourneys));
    const planeIds = new Set(Object.keys(content.planeMeta));
    const edgeKinds = new Set(Object.keys(content.edgeMeta));
    const laneIds = new Set(Object.keys(content.laneMeta));
    const causalLayers = new Set(Object.keys(content.driverCausalLayerMeta));
    const journeyRelations = new Set(Object.keys(content.driverJourneyRelationMeta));
    const moduleRoles = new Set(Object.values(scene.enhanced.common.driverJourneyModuleRoleByNodeId));

    content.topologyNodes.forEach((node) => {
      if (!planeIds.has(node.data.plane)) problems.push(`${localeName} node ${node.id} -> missing planeMeta ${node.data.plane}`);
    });
    content.topologyEdges.forEach((edge) => {
      if (!enhancedNodeIds.has(edge.source) || !enhancedNodeIds.has(edge.target)) problems.push(`${localeName} enhanced edge ${edge.id} has a dangling endpoint`);
      if (!edgeKinds.has(edge.data.kind)) problems.push(`${localeName} edge ${edge.id} -> missing edgeMeta ${edge.data.kind}`);
      if (!laneIds.has(edge.data.lane)) problems.push(`${localeName} edge ${edge.id} -> missing laneMeta ${edge.data.lane}`);
    });
    content.systemTree.forEach((group) => {
      if (!planeIds.has(group.plane)) problems.push(`${localeName} systemTree ${group.label} -> missing planeMeta ${group.plane}`);
      group.nodes.forEach((id) => { if (!enhancedNodeIds.has(id)) problems.push(`${localeName} systemTree ${group.label} -> missing node ${id}`); });
    });
    content.storageTrees.forEach((tree) => {
      if (!planeIds.has(tree.plane)) problems.push(`${localeName} storageTree ${tree.id} -> missing planeMeta ${tree.plane}`);
      tree.roots.forEach((root) => { if (!enhancedNodeIds.has(root.nodeId)) problems.push(`${localeName} storageTree ${tree.id} -> missing node ${root.nodeId}`); });
    });
    Object.entries(content.driverJourneys).forEach(([journeyId, journey]) => {
      const stepIds = ids(journey.steps);
      journey.steps.forEach((step) => {
        if (!moduleRoles.has(step.moduleRole)) problems.push(`${localeName} journey ${journeyId} step ${step.id} -> unknown module role ${step.moduleRole}`);
        step.layers.forEach((layer) => { if (!causalLayers.has(layer)) problems.push(`${localeName} journey ${journeyId} step ${step.id} -> missing driverCausalLayerMeta ${layer}`); });
      });
      journey.edges.forEach((edge) => {
        if (!stepIds.has(edge.source) || !stepIds.has(edge.target)) problems.push(`${localeName} journey ${journeyId} relation has a dangling step`);
        if (!causalLayers.has(edge.layer)) problems.push(`${localeName} journey ${journeyId} relation -> missing driverCausalLayerMeta ${edge.layer}`);
        if (!journeyRelations.has(edge.relation)) problems.push(`${localeName} journey ${journeyId} relation -> missing driverJourneyRelationMeta ${edge.relation}`);
      });
    });
    content.viewOptions.forEach((view) => {
      if (!content.cameraHudViews[view.id]) problems.push(`${localeName} view ${view.id} -> missing cameraHudViews entry`);
    });
    if (enhancedEdgeIds.size !== content.topologyEdges.length) problems.push(`${localeName} enhanced topology edges contain duplicate ids`);
    return journeyIds;
  };

  const zhJourneyIds = validateEnhancedLocale("zhCN", scene.enhanced.content.zhCN);
  const enJourneyIds = validateEnhancedLocale("enUS", scene.enhanced.content.enUS);
  scene.enhanced.common.driverJourneyOrder.forEach((id) => {
    if (!zhJourneyIds.has(id) || !enJourneyIds.has(id)) problems.push(`driverJourneyOrder -> missing bilingual journey ${id}`);
  });
  if (!scene.enhanced.content.zhCN.cameraHudViews[scene.enhanced.defaultView] || !scene.enhanced.content.enUS.cameraHudViews[scene.enhanced.defaultView]) {
    problems.push(`defaultView ${scene.enhanced.defaultView} -> missing bilingual cameraHudViews entry`);
  }
  const nodeLayouts = new Set(scene.layout.nodes.map((item) => item.nodeId));
  const zoneLayouts = new Set(scene.layout.zones.map((item) => item.zoneId));
  scene.nodes.forEach((node) => { if (!nodeLayouts.has(node.id)) problems.push(`node ${node.id} has no layout`); });
  scene.zones.forEach((zone) => { if (!zoneLayouts.has(zone.id)) problems.push(`zone ${zone.id} has no layout`); });
  if (problems.length) fail(source, problems);
  console.log(`validated ${scene.id}: ${scene.zones.length} zones, ${scene.nodes.length} nodes, ${scene.edges.length} edges`);
}

if (!sceneIds.size) throw new Error("No topology scenes were found.");
