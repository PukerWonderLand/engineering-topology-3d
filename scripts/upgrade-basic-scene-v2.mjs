import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/upgrade-basic-scene-v2.mjs <topology.yaml>");
const scenePath = path.resolve(input);
const scene = YAML.parse(await readFile(scenePath, "utf8"));
if (scene.schemaVersion === "2.0" && scene.enhanced) {
  console.log(`${scenePath} is already SceneDefinition 2.0`);
  process.exit(0);
}

const localized = (value, locale) => value?.[locale] ?? "";
const evidenceToLegacy = { CODE_PROVEN: "code", RTL_PROVEN: "target", RUNTIME_OBSERVED: "target", INFERRED: "inference" };
const nodeKindToLegacy = { actor: "client", application: "client", service: "service", driver: "service", protocol: "network", buffer: "device", device: "device", hardware: "target", data: "device", state: "service" };
const edgeKindToLegacy = { payload: "DATA", control: "CONTROL", sync: "CONTROL", lifecycle: "CONTROL", physical: "PHYSICAL" };
const palette = ["#2878c7", "#7657c8", "#168f7b", "#2f83e7", "#7fae3f", "#e14b72"];

const zoneById = new Map(scene.zones.map((zone) => [zone.id, zone]));
const functionById = new Map(scene.functions.map((item) => [item.id, item]));
const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));

function localeContent(locale) {
  const topologyNodes = scene.nodes.map((node) => ({
    id: node.id,
    label: localized(node.title, locale),
    fill: node.color,
    data: {
      title: localized(node.title, locale),
      plane: node.zoneId,
      layer: localized(node.eyebrow, locale) || localized(zoneById.get(node.zoneId)?.eyebrow, locale),
      kind: nodeKindToLegacy[node.kind] ?? "service",
      description: localized(node.description, locale),
      evidence: evidenceToLegacy[node.evidence],
      core: true,
      tags: node.tags ?? [],
      interfaces: node.interfaces ?? [],
      codeRefs: [
        ...(node.sources ?? []).map((source) => ({ name: localized(node.title, locale), path: source.path, note: source.note })),
        ...scene.functions.filter((item) => item.moduleId === node.id).flatMap((item) => (item.sources ?? []).map((source) => ({ name: item.name, path: source.path, note: source.note }))),
      ],
      views: ["overview", node.zoneId, ...scene.journeys.filter((journey) => journey.steps.some((step) => step.nodeId === node.id || (step.functionId && functionById.get(step.functionId)?.moduleId === node.id))).map((journey) => journey.id)],
    },
  }));
  const topologyEdges = scene.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: localized(edge.title, locale),
    fill: edge.color,
    dashed: edge.dashed,
    data: {
      kind: edgeKindToLegacy[edge.kind],
      lane: edge.lane ?? "PRIMARY",
      description: localized(edge.description, locale),
      evidence: evidenceToLegacy[edge.evidence],
      protocol: edge.protocol,
    },
  }));
  const driverJourneys = Object.fromEntries(scene.journeys.map((journey) => [journey.id, {
    id: journey.id,
    title: localized(journey.title, locale),
    shortTitle: localized(journey.title, locale),
    summary: localized(journey.summary, locale),
    caveat: localized(journey.caveat, locale),
    steps: journey.steps.map((step) => {
      const fn = step.functionId ? functionById.get(step.functionId) : undefined;
      const moduleId = step.nodeId ?? fn?.moduleId ?? scene.nodes[0].id;
      return {
        id: step.id,
        title: localized(step.title, locale),
        shortTitle: fn?.name ?? localized(step.title, locale),
        moduleRole: moduleId,
        contextLane: nodeById.get(moduleId)?.zoneId ?? "default",
        layers: [scene.edges.find((edge) => journey.edgeIds.includes(edge.id))?.kind ?? "control"],
        kind: fn ? "function" : "data",
        evidence: step.evidence,
        source: fn?.sources?.[0]?.path,
        contract: fn?.contract,
      };
    }),
    edges: journey.steps.slice(0, -1).map((step, index) => ({ source: step.id, target: journey.steps[index + 1].id, label: "NEXT", relation: "PAYLOAD", layer: "payload" })),
  }]));
  const viewOptions = [
    { id: "overview", label: locale === "zhCN" ? "物理全景" : "Overview", hint: localized(scene.description, locale) },
    ...scene.zones.map((zone) => ({ id: zone.id, label: localized(zone.title, locale), hint: localized(zone.summary, locale) })),
    ...scene.journeys.map((journey) => ({ id: journey.id, label: localized(journey.title, locale), hint: localized(journey.summary, locale) })),
  ];
  return {
    planeMeta: Object.fromEntries(scene.zones.map((zone) => [zone.id, { label: localized(zone.title, locale), short: localized(zone.title, locale), color: zone.color }])),
    edgeMeta: Object.fromEntries([...new Set(scene.edges.map((edge) => edgeKindToLegacy[edge.kind]))].map((kind, index) => [kind, { color: palette[index % palette.length], label: kind }])),
    laneMeta: Object.fromEntries([...new Set(topologyEdges.map((edge) => edge.data.lane))].map((lane, index) => [lane, { color: palette[index % palette.length], label: lane, summary: lane }])),
    functionInteractions: Object.fromEntries(scene.nodes.map((node) => [node.id, []])),
    driverCausalLayerMeta: {
      payload: { label: locale === "zhCN" ? "数据与所有权" : "Payload and ownership", short: "DATA", color: "#4d8edb", description: "payload" },
      control: { label: locale === "zhCN" ? "控制执行" : "Control execution", short: "CTRL", color: "#708090", description: "control" },
      sync: { label: locale === "zhCN" ? "同步与完成" : "Synchronization", short: "SYNC", color: "#e5b534", description: "sync" },
      lifecycle: { label: locale === "zhCN" ? "生命周期与回滚" : "Lifecycle and rollback", short: "LIFE", color: "#e14b72", description: "lifecycle" },
    },
    driverJourneyRelationMeta: {
      PAYLOAD: { color: "#4d8edb", label: "PAYLOAD", dashed: false },
      CALL: { color: "#708090", label: "CALL", dashed: false },
      QUEUE: { color: "#22b8cf", label: "QUEUE", dashed: false },
      STATE: { color: "#8a61d1", label: "STATE", dashed: false },
      MMIO: { color: "#f4a62a", label: "MMIO", dashed: false },
      IRQ: { color: "#e14b72", label: "IRQ", dashed: false },
      WAIT: { color: "#e5b534", label: "WAIT", dashed: true },
      ERROR: { color: "#c13f5c", label: "ERROR", dashed: true },
      LIFECYCLE: { color: "#e14b72", label: "LIFECYCLE", dashed: true },
    },
    driverJourneys,
    topologyNodes,
    topologyEdges,
    viewOptions,
    systemTree: scene.zones.map((zone) => ({ label: localized(zone.title, locale), plane: zone.id, nodes: zone.nodeIds })),
    storageTrees: scene.nodes.filter((node) => node.sources?.length).map((node) => ({ id: `${node.id}-sources`, label: localized(node.title, locale), plane: node.zoneId, roots: node.sources.map((source) => ({ path: source.path, role: source.note, nodeId: node.id })) })),
    runtimeFacts: [{ label: locale === "zhCN" ? "证据等级" : "Evidence level", value: scene.evidence, tone: scene.evidence === "INFERRED" ? "warn" : "good" }],
    cameraHudViews: Object.fromEntries(viewOptions.map((view) => [view.id, { eyebrow: scene.id.toUpperCase(), title: view.label, detail: view.hint }])),
  };
}

const macroZones = Object.fromEntries(scene.zones.map((zone) => {
  const layout = scene.layout.zones.find((item) => item.zoneId === zone.id);
  return [zone.id, { center: layout.position, halfSize: layout.size.map((value) => value / 2), nodeIds: zone.nodeIds }];
}));
const nodePositions = Object.fromEntries(scene.layout.nodes.map((item) => [item.nodeId, item.position]));
const globals = scene.layout.nodes.map((layout) => ({ id: layout.nodeId, color: nodeById.get(layout.nodeId)?.color ?? "#4d8edb", halfWidth: layout.size[0] / 2, moduleSide: layout.moduleSide ?? "right", cameraSide: layout.cameraSide ?? "right" }));
const visuals = {
  zones: scene.zones.map((zone) => {
    const layout = scene.layout.zones.find((item) => item.zoneId === zone.id);
    return { id: zone.id, anchorNodeId: zone.nodeIds[0], eyebrow: zone.eyebrow, title: zone.title, summary: zone.summary, position: layout.position, size: layout.size, color: zone.color, detailGroup: zone.id, backdrop: layout.backdrop === "server" ? "server" : layout.backdrop === "board" ? "gateway" : "generic" };
  }),
  modules: scene.nodes.map((node) => {
    const layout = scene.layout.nodes.find((item) => item.nodeId === node.id);
    return { nodeId: node.id, title: node.title, eyebrow: node.eyebrow ?? zoneById.get(node.zoneId).eyebrow, position: layout.position, size: layout.size, color: node.color ?? zoneById.get(node.zoneId).color, labelOffset: layout.labelOffset ?? [layout.size[0] / 2 + 1, 0.2, layout.size[2] + 0.4], detailGroup: node.zoneId };
  }),
  layers: [],
  depths: [],
};

scene.schemaVersion = "2.0";
scene.edges = scene.edges.map((edge) => ({ ...edge, lane: edge.lane ?? (edge.kind === "payload" ? "PRIMARY" : edge.kind.toUpperCase()) }));
scene.enhanced = {
  defaultView: "overview",
  content: { zhCN: localeContent("zhCN"), enUS: localeContent("enUS") },
  common: {
    focusModuleGroups: Object.fromEntries(scene.nodes.map((node) => [node.id, [node.id]])),
    driverJourneyModuleRoleByNodeId: Object.fromEntries(scene.nodes.map((node) => [node.id, node.id])),
    driverJourneyOrder: scene.journeys.map((journey) => journey.id),
    nodePositions,
    macroZones,
    globalModuleLabels: globals,
    routeNodeIds: Object.fromEntries(scene.journeys.map((journey) => [journey.id, journey.steps.map((step) => step.nodeId ?? functionById.get(step.functionId)?.moduleId).filter(Boolean)])),
    directionCards: [],
    visuals,
  },
  displayDefaults: {
    pipeThickness: 4.5, hudDistance: 1.2, moduleLabelDistance: 1.2, labelLayoutMode: "module", labelLineThickness: 1.5, moduleLabelScale: 1,
    focusAnnotationScale: 1, focusHudTextScale: 1, subLabelDistance: 30, subLabelFadeRange: 8, farFadeStart: 48,
    farBlockOpacity: scene.layout.farBlockOpacity ?? 0.22, farFlowOpacity: scene.layout.farFlowOpacity ?? 0.55,
  },
};

await writeFile(scenePath, YAML.stringify(scene, { lineWidth: 0 }), "utf8");
console.log(scenePath);
