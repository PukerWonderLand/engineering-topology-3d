/// <reference types="vite/client" />

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import YAML from "yaml";
import sceneSchema from "../spec/scene-definition.schema.json";
import type { NormalizedSceneDefinition, SceneDefinition } from "./scene-definition";

const rawSceneModules = import.meta.glob("../examples/*/topology.yaml", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile<SceneDefinition>(sceneSchema);

export class SceneValidationError extends Error {
  readonly source: string;
  readonly details: string[];

  constructor(source: string, details: string[]) {
    super(`Invalid topology scene ${source}:\n${details.join("\n")}`);
    this.name = "SceneValidationError";
    this.source = source;
    this.details = details;
  }
}

function formatAjvError(error: ErrorObject) {
  return `${error.instancePath || "/"} ${error.message ?? "is invalid"}`;
}

function assertUnique(source: string, group: string, ids: string[]) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new SceneValidationError(source, [`${group} contains duplicate ids: ${[...new Set(duplicates)].join(", ")}`]);
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function assertReferences(scene: SceneDefinition, source: string) {
  assertUnique(source, "zones", scene.zones.map((item) => item.id));
  assertUnique(source, "nodes", scene.nodes.map((item) => item.id));
  assertUnique(source, "edges", scene.edges.map((item) => item.id));
  assertUnique(source, "journeys", scene.journeys.map((item) => item.id));
  assertUnique(source, "functions", scene.functions.map((item) => item.id));

  const zoneIds = new Set(scene.zones.map((item) => item.id));
  const nodeIds = new Set(scene.nodes.map((item) => item.id));
  const edgeIds = new Set(scene.edges.map((item) => item.id));
  const functionIds = new Set(scene.functions.map((item) => item.id));
  const problems: string[] = [];

  scene.nodes.forEach((node) => {
    if (!zoneIds.has(node.zoneId)) problems.push(`node ${node.id} references missing zone ${node.zoneId}`);
  });
  scene.zones.forEach((zone) => {
    zone.nodeIds.forEach((nodeId) => {
      if (!nodeIds.has(nodeId)) problems.push(`zone ${zone.id} references missing node ${nodeId}`);
      else if (scene.nodes.find((node) => node.id === nodeId)?.zoneId !== zone.id) problems.push(`zone ${zone.id} and node ${nodeId} disagree about ownership`);
    });
  });
  scene.edges.forEach((edge) => {
    if (!nodeIds.has(edge.source)) problems.push(`edge ${edge.id} has missing source ${edge.source}`);
    if (!nodeIds.has(edge.target)) problems.push(`edge ${edge.id} has missing target ${edge.target}`);
  });
  scene.functions.forEach((item) => {
    if (!nodeIds.has(item.moduleId)) problems.push(`function ${item.id} references missing module ${item.moduleId}`);
  });
  scene.journeys.forEach((journey) => {
    journey.edgeIds.forEach((edgeId) => {
      if (!edgeIds.has(edgeId)) problems.push(`journey ${journey.id} references missing edge ${edgeId}`);
    });
    journey.steps.forEach((step) => {
      if (step.nodeId && !nodeIds.has(step.nodeId)) problems.push(`journey ${journey.id} step ${step.id} references missing node ${step.nodeId}`);
      if (step.functionId && !functionIds.has(step.functionId)) problems.push(`journey ${journey.id} step ${step.id} references missing function ${step.functionId}`);
    });
  });

  const nodeLayouts = new Set(scene.layout.nodes.map((item) => item.nodeId));
  const zoneLayouts = new Set(scene.layout.zones.map((item) => item.zoneId));
  scene.nodes.forEach((node) => { if (!nodeLayouts.has(node.id)) problems.push(`node ${node.id} has no layout`); });
  scene.zones.forEach((zone) => { if (!zoneLayouts.has(zone.id)) problems.push(`zone ${zone.id} has no layout`); });
  scene.layout.nodes.forEach((item) => { if (!nodeIds.has(item.nodeId)) problems.push(`layout references missing node ${item.nodeId}`); });
  scene.layout.zones.forEach((item) => { if (!zoneIds.has(item.zoneId)) problems.push(`layout references missing zone ${item.zoneId}`); });

  const enhanced = scene.enhanced;
  const zh = enhanced.content.zhCN;
  const en = enhanced.content.enUS;
  const enhancedNodeIds = zh.topologyNodes.map((item) => item.id);
  const enhancedEdgeIds = zh.topologyEdges.map((item) => item.id);
  assertUnique(source, "enhanced zhCN nodes", enhancedNodeIds);
  assertUnique(source, "enhanced zhCN edges", enhancedEdgeIds);
  assertUnique(source, "enhanced enUS nodes", en.topologyNodes.map((item) => item.id));
  assertUnique(source, "enhanced enUS edges", en.topologyEdges.map((item) => item.id));
  if (!sameIds(enhancedNodeIds, en.topologyNodes.map((item) => item.id))) problems.push("enhanced locale node IDs differ");
  if (!sameIds(enhancedEdgeIds, en.topologyEdges.map((item) => item.id))) problems.push("enhanced locale edge IDs differ");
  if (!sameIds(Object.keys(zh.driverJourneys), Object.keys(en.driverJourneys))) problems.push("enhanced locale journey IDs differ");
  if (!sameIds(zh.viewOptions.map((item) => item.id), en.viewOptions.map((item) => item.id))) problems.push("enhanced locale view IDs differ");

  const enhancedNodeIdSet = new Set(enhancedNodeIds);
  const enhancedEdgeIdSet = new Set(enhancedEdgeIds);
  zh.topologyEdges.forEach((edge) => {
    if (!enhancedNodeIdSet.has(edge.source)) problems.push(`enhanced edge ${edge.id} has missing source ${edge.source}`);
    if (!enhancedNodeIdSet.has(edge.target)) problems.push(`enhanced edge ${edge.id} has missing target ${edge.target}`);
  });
  enhanced.common.driverJourneyOrder.forEach((id) => {
    if (!zh.driverJourneys[id]) problems.push(`driverJourneyOrder references missing journey ${id}`);
  });
  Object.entries(zh.driverJourneys).forEach(([journeyId, journey]) => {
    const stepIds = new Set(journey.steps.map((step) => step.id));
    journey.edges.forEach((edge) => {
      if (!stepIds.has(edge.source)) problems.push(`journey ${journeyId} relation has missing source step ${edge.source}`);
      if (!stepIds.has(edge.target)) problems.push(`journey ${journeyId} relation has missing target step ${edge.target}`);
    });
  });
  enhancedNodeIds.forEach((id) => {
    if (!enhanced.common.nodePositions[id]) problems.push(`enhanced node ${id} has no nodePositions entry`);
  });
  Object.values(enhanced.common.macroZones).flatMap((zone) => zone.nodeIds).forEach((id) => {
    if (!enhancedNodeIdSet.has(id)) problems.push(`macro zone references missing enhanced node ${id}`);
  });
  enhanced.common.globalModuleLabels.forEach((label) => {
    if (!enhancedNodeIdSet.has(label.id)) problems.push(`global label references missing enhanced node ${label.id}`);
  });
  Object.values(enhanced.common.routeNodeIds).flat().forEach((id) => {
    if (!enhancedNodeIdSet.has(id)) problems.push(`route references missing enhanced node ${id}`);
  });
  enhanced.common.directionCards.forEach((card) => {
    if (!enhancedEdgeIdSet.has(card.edgeId)) problems.push(`direction card references missing enhanced edge ${card.edgeId}`);
  });
  enhanced.common.visuals.modules.forEach((visual) => {
    if (!enhancedNodeIdSet.has(visual.nodeId)) problems.push(`module visual references missing enhanced node ${visual.nodeId}`);
  });
  enhanced.common.visuals.zones.forEach((visual) => {
    if (!enhancedNodeIdSet.has(visual.anchorNodeId)) problems.push(`zone visual references missing enhanced node ${visual.anchorNodeId}`);
    if (!enhanced.common.macroZones[visual.id]) problems.push(`zone visual ${visual.id} has no macro zone definition`);
  });

  if (problems.length) throw new SceneValidationError(source, problems);
}

function appendMapArray<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function normalize(scene: SceneDefinition): NormalizedSceneDefinition {
  const functionsByModuleId = new Map<string, SceneDefinition["functions"]>();
  scene.functions.forEach((item) => appendMapArray(functionsByModuleId, item.moduleId, item));

  const adjacentNodes = new Map<string, Set<string>>();
  const edgesByLane = new Map<string, SceneDefinition["edges"]>();
  scene.edges.forEach((edge) => {
    const source = adjacentNodes.get(edge.source) ?? new Set<string>();
    const target = adjacentNodes.get(edge.target) ?? new Set<string>();
    source.add(edge.target);
    target.add(edge.source);
    adjacentNodes.set(edge.source, source);
    adjacentNodes.set(edge.target, target);
    appendMapArray(edgesByLane, edge.lane ?? edge.kind, edge);
  });

  const nodesByZone = new Map<string, SceneDefinition["nodes"]>();
  scene.nodes.forEach((node) => appendMapArray(nodesByZone, node.zoneId, node));

  const enhancedNodeZone = new Map<string, string>();
  Object.entries(scene.enhanced.common.macroZones).forEach(([zoneId, zone]) => zone.nodeIds.forEach((nodeId) => enhancedNodeZone.set(nodeId, zoneId)));
  const labelsByZone = new Map<string, string[]>();
  scene.enhanced.common.globalModuleLabels.forEach((label) => appendMapArray(labelsByZone, enhancedNodeZone.get(label.id) ?? "unassigned", label.id));

  const viewMembership = new Map<string, Set<string>>();
  scene.enhanced.content.zhCN.topologyNodes.forEach((node) => {
    (node.data.views ?? []).forEach((viewId) => {
      const members = viewMembership.get(viewId) ?? new Set<string>();
      members.add(node.id);
      viewMembership.set(viewId, members);
    });
  });

  return Object.freeze({
    ...scene,
    nodeById: new Map(scene.nodes.map((item) => [item.id, item])),
    zoneById: new Map(scene.zones.map((item) => [item.id, item])),
    edgeById: new Map(scene.edges.map((item) => [item.id, item])),
    functionById: new Map(scene.functions.map((item) => [item.id, item])),
    functionsByModuleId,
    adjacentNodes,
    edgesByLane,
    journeyById: new Map(scene.journeys.map((item) => [item.id, item])),
    nodesByZone,
    labelsByZone,
    viewMembership,
    nodeLayoutById: new Map(scene.layout.nodes.map((item) => [item.nodeId, item])),
    zoneLayoutById: new Map(scene.layout.zones.map((item) => [item.zoneId, item])),
  });
}

export function parseAndNormalizeScene(yamlText: string, source = "inline YAML"): NormalizedSceneDefinition {
  let candidate: unknown;
  try {
    candidate = YAML.parse(yamlText);
  } catch (error) {
    throw new SceneValidationError(source, [error instanceof Error ? error.message : String(error)]);
  }

  if (!validateSchema(candidate)) {
    throw new SceneValidationError(source, (validateSchema.errors ?? []).map(formatAjvError));
  }

  const scene = candidate as SceneDefinition;
  assertReferences(scene, source);
  return normalize(scene);
}

const loadedScenes = new Map<string, NormalizedSceneDefinition>();
for (const [source, yamlText] of Object.entries(rawSceneModules)) {
  const scene = parseAndNormalizeScene(yamlText, source);
  if (loadedScenes.has(scene.id)) throw new SceneValidationError(source, [`duplicate scene id ${scene.id}`]);
  loadedScenes.set(scene.id, scene);
}

export function listScenes() {
  return [...loadedScenes.values()];
}

export function getScene(sceneId: string) {
  return loadedScenes.get(sceneId);
}
