export type Vector3Tuple = [number, number, number];
export type EvidenceKind = "code" | "target" | "inference";
export type DriverEvidenceLevel = "CODE_PROVEN" | "RTL_PROVEN" | "RUNTIME_OBSERVED" | "INFERRED";
export type GlobalLabelSide = "left" | "right";
export interface BilingualText { zhCN: string; enUS: string; }

export interface CodeRef { name: string; path: string; note: string; }
export interface PathRef { path: string; role: string; confidence: "code" | "candidate"; }

export type FunctionInteractionKind = "CALL" | "DATA" | "IRQ" | "CONTROL";
export interface FunctionInteraction {
  source: number;
  target: number;
  label: string;
  kind: FunctionInteractionKind;
  note: string;
}

export interface DriverFunctionContract {
  trigger: string;
  context: string;
  consumes: string;
  produces: string;
  stateResource: string;
  completionError: string;
  hardwareEffect?: string;
}

export interface DriverJourneyStep {
  id: string;
  title: string;
  shortTitle: string;
  moduleRole: string;
  contextLane: string;
  layers: string[];
  kind: "function" | "data" | "state" | "hardware" | "event" | "completion";
  evidence: DriverEvidenceLevel;
  source?: string;
  contract?: DriverFunctionContract;
}

export interface DriverJourneyEdge {
  source: string;
  target: string;
  label: string;
  relation: string;
  layer: string;
}

export interface DriverJourney {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  caveat: string;
  steps: DriverJourneyStep[];
  edges: DriverJourneyEdge[];
}

export interface EnhancedNodeData {
  title: string;
  plane: string;
  layer: string;
  kind: "client" | "network" | "host" | "vm" | "container" | "service" | "device" | "target";
  description: string;
  evidence: EvidenceKind;
  core?: boolean;
  tags?: string[];
  interfaces?: string[];
  codeRefs?: CodeRef[];
  paths?: PathRef[];
  views?: string[];
  runtimeNote?: string;
}

export interface EnhancedTopologyNode {
  id: string;
  label: string;
  subLabel?: string;
  fill?: string;
  size?: number;
  labelVisible?: boolean;
  data: EnhancedNodeData;
}

export interface EnhancedTopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  fill?: string;
  dashed?: boolean;
  interpolation?: string;
  arrowPlacement?: string;
  data: {
    kind: string;
    lane: string;
    description: string;
    evidence: EvidenceKind;
    protocol?: string;
  };
}

export interface EnhancedViewOption { id: string; label: string; hint: string; }
export interface EnhancedSystemTreeGroup { label: string; plane: string; nodes: string[]; }
export interface EnhancedStorageTree {
  id: string;
  label: string;
  plane: string;
  roots: Array<{ path: string; role: string; nodeId: string }>;
}
export interface EnhancedRuntimeFact { label: string; value: string; tone: string; }

export interface EnhancedSceneLocaleContent {
  planeMeta: Record<string, { label: string; short: string; color: string }>;
  edgeMeta: Record<string, { color: string; label: string }>;
  laneMeta: Record<string, { color: string; label: string; summary: string }>;
  functionInteractions: Record<string, FunctionInteraction[]>;
  driverCausalLayerMeta: Record<string, { label: string; short: string; color: string; description: string }>;
  driverJourneyRelationMeta: Record<string, { color: string; label: string; dashed: boolean }>;
  driverJourneys: Record<string, DriverJourney>;
  topologyNodes: EnhancedTopologyNode[];
  topologyEdges: EnhancedTopologyEdge[];
  viewOptions: EnhancedViewOption[];
  systemTree: EnhancedSystemTreeGroup[];
  storageTrees: EnhancedStorageTree[];
  runtimeFacts: EnhancedRuntimeFact[];
  cameraHudViews: Record<string, { eyebrow: string; title: string; detail: string }>;
}

export interface MacroZoneDefinition {
  center: Vector3Tuple;
  halfSize: Vector3Tuple;
  nodeIds: string[];
}

export interface GlobalModuleLabelDefinition {
  id: string;
  color: string;
  halfWidth: number;
  moduleSide: GlobalLabelSide;
  cameraSide: GlobalLabelSide;
}

export interface SceneModuleVisual {
  nodeId: string;
  title: BilingualText;
  eyebrow: BilingualText;
  position: Vector3Tuple;
  size: Vector3Tuple;
  color: string;
  labelOffset: Vector3Tuple;
  detailGroup: string;
}

export interface SceneZoneVisual {
  id: string;
  anchorNodeId: string;
  eyebrow: BilingualText;
  title: BilingualText;
  summary: BilingualText;
  position: Vector3Tuple;
  size: Vector3Tuple;
  color: string;
  detailGroup: string;
  backdrop: "server" | "gateway" | "generic";
}

export interface SceneLayerVisual {
  id: string;
  title: BilingualText;
  position: Vector3Tuple;
  size: Vector3Tuple;
  color: string;
  detailGroup: string;
}

export interface SceneDepthVisual {
  id: string;
  label: BilingualText;
  position: Vector3Tuple;
  size: [number, number];
  color: string;
  detailGroup: string;
}

export interface EnhancedSceneCommon {
  focusModuleGroups: Record<string, string[]>;
  driverJourneyModuleRoleByNodeId: Record<string, string>;
  driverJourneyOrder: string[];
  nodePositions: Record<string, Vector3Tuple>;
  macroZones: Record<string, MacroZoneDefinition>;
  globalModuleLabels: GlobalModuleLabelDefinition[];
  routeNodeIds: Record<string, string[]>;
  directionCards: Array<{ lane: string; view: string; position: Vector3Tuple; origin: Vector3Tuple; edgeId: string }>;
  visuals: {
    zones: SceneZoneVisual[];
    modules: SceneModuleVisual[];
    layers: SceneLayerVisual[];
    depths: SceneDepthVisual[];
  };
}

export interface EnhancedDisplayDefaults {
  pipeThickness: number;
  hudDistance: number;
  moduleLabelDistance: number;
  labelLayoutMode: "module" | "camera";
  labelLineThickness: number;
  moduleLabelScale: number;
  focusAnnotationScale: number;
  focusHudTextScale: number;
  subLabelDistance: number;
  subLabelFadeRange: number;
  farFadeStart: number;
  farBlockOpacity: number;
  farFlowOpacity: number;
}

export interface EnhancedSceneDefinition {
  defaultView: string;
  content: { zhCN: EnhancedSceneLocaleContent; enUS: EnhancedSceneLocaleContent };
  common: EnhancedSceneCommon;
  displayDefaults: EnhancedDisplayDefaults;
}

export type EnhancedRuntimeVisuals = {
  zones: Array<Omit<SceneZoneVisual, "eyebrow" | "title" | "summary"> & { eyebrow: string; title: string; summary: string }>;
  modules: Array<Omit<SceneModuleVisual, "title" | "eyebrow"> & { title: string; eyebrow: string }>;
  layers: Array<Omit<SceneLayerVisual, "title"> & { title: string }>;
  depths: Array<Omit<SceneDepthVisual, "label"> & { label: string }>;
};

export type EnhancedSceneRuntime = EnhancedSceneLocaleContent & Omit<EnhancedSceneCommon, "visuals"> & {
  sceneId: string;
  title: string;
  description: string;
  defaultView: string;
  displayDefaults: EnhancedDisplayDefaults;
  visuals: EnhancedRuntimeVisuals;
  nodeById: ReadonlyMap<string, EnhancedTopologyNode>;
  edgeById: ReadonlyMap<string, EnhancedTopologyEdge>;
  functionsByModuleId: ReadonlyMap<string, CodeRef[]>;
  adjacentNodes: ReadonlyMap<string, ReadonlySet<string>>;
  edgesByLane: ReadonlyMap<string, EnhancedTopologyEdge[]>;
  journeyById: ReadonlyMap<string, DriverJourney>;
  nodesByZone: ReadonlyMap<string, EnhancedTopologyNode[]>;
  labelsByZone: ReadonlyMap<string, GlobalModuleLabelDefinition[]>;
  viewMembership: ReadonlyMap<string, ReadonlySet<string>>;
};
