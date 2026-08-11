import type { Locale } from "./i18n/types";
import type { NormalizedSceneDefinition } from "./scene-definition";
import type {
  CodeRef,
  DriverJourney,
  EnhancedSceneRuntime,
  EnhancedTopologyEdge,
  EnhancedTopologyNode,
  GlobalModuleLabelDefinition,
} from "./enhanced-scene-types";

function appendMapArray<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

export function buildEnhancedSceneRuntime(scene: NormalizedSceneDefinition, locale: Locale): EnhancedSceneRuntime {
  const content = locale === "en-US" ? scene.enhanced.content.enUS : scene.enhanced.content.zhCN;
  const common = scene.enhanced.common;
  const nodeById = new Map<string, EnhancedTopologyNode>(content.topologyNodes.map((node) => [node.id, node]));
  const edgeById = new Map<string, EnhancedTopologyEdge>(content.topologyEdges.map((edge) => [edge.id, edge]));
  const functionsByModuleId = new Map<string, CodeRef[]>();
  content.topologyNodes.forEach((node) => (node.data.codeRefs ?? []).forEach((ref) => appendMapArray(functionsByModuleId, node.id, ref)));

  const adjacentNodes = new Map<string, Set<string>>();
  const edgesByLane = new Map<string, EnhancedTopologyEdge[]>();
  content.topologyEdges.forEach((edge) => {
    const source = adjacentNodes.get(edge.source) ?? new Set<string>();
    const target = adjacentNodes.get(edge.target) ?? new Set<string>();
    source.add(edge.target);
    target.add(edge.source);
    adjacentNodes.set(edge.source, source);
    adjacentNodes.set(edge.target, target);
    appendMapArray(edgesByLane, edge.data.lane, edge);
  });

  const nodesByZone = new Map<string, EnhancedTopologyNode[]>();
  Object.entries(common.macroZones).forEach(([zoneId, zone]) => {
    nodesByZone.set(zoneId, zone.nodeIds.map((id) => nodeById.get(id)).filter(Boolean) as EnhancedTopologyNode[]);
  });
  const zoneByNodeId = new Map<string, string>();
  Object.entries(common.macroZones).forEach(([zoneId, zone]) => zone.nodeIds.forEach((nodeId) => zoneByNodeId.set(nodeId, zoneId)));
  const labelsByZone = new Map<string, GlobalModuleLabelDefinition[]>();
  common.globalModuleLabels.forEach((label) => appendMapArray(labelsByZone, zoneByNodeId.get(label.id) ?? "unassigned", label));

  const viewMembership = new Map<string, Set<string>>();
  content.topologyNodes.forEach((node) => {
    (node.data.views ?? []).forEach((viewId) => {
      const members = viewMembership.get(viewId) ?? new Set<string>();
      members.add(node.id);
      viewMembership.set(viewId, members);
    });
  });

  const localize = (value: { zhCN: string; enUS: string }) => locale === "en-US" ? value.enUS : value.zhCN;
  const visuals = {
    zones: common.visuals.zones.map((item) => ({ ...item, eyebrow: localize(item.eyebrow), title: localize(item.title), summary: localize(item.summary) })),
    modules: common.visuals.modules.map((item) => ({ ...item, title: localize(item.title), eyebrow: localize(item.eyebrow) })),
    layers: common.visuals.layers.map((item) => ({ ...item, title: localize(item.title) })),
    depths: common.visuals.depths.map((item) => ({ ...item, label: localize(item.label) })),
  };

  return {
    sceneId: scene.id,
    title: locale === "en-US" ? scene.title.enUS : scene.title.zhCN,
    description: locale === "en-US" ? scene.description.enUS : scene.description.zhCN,
    defaultView: scene.enhanced.defaultView,
    displayDefaults: scene.enhanced.displayDefaults,
    ...content,
    ...common,
    visuals,
    nodeById,
    edgeById,
    functionsByModuleId,
    adjacentNodes,
    edgesByLane,
    journeyById: new Map<string, DriverJourney>(Object.entries(content.driverJourneys)),
    nodesByZone,
    labelsByZone,
    viewMembership,
  };
}
