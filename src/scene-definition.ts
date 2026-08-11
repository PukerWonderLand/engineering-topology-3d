import type { EnhancedSceneDefinition } from "./enhanced-scene-types";

export const SCENE_SCHEMA_VERSION = "2.0" as const;

export type Vector3Tuple = [number, number, number];
export type SceneEvidenceLevel = "CODE_PROVEN" | "RTL_PROVEN" | "RUNTIME_OBSERVED" | "INFERRED";
export type SceneNodeKind = "actor" | "application" | "service" | "driver" | "protocol" | "buffer" | "device" | "hardware" | "data" | "state";
export type SceneEdgeKind = "payload" | "control" | "sync" | "lifecycle" | "physical";
export type SceneLabelSide = "left" | "right";

export interface LocalizedText {
  zhCN: string;
  enUS: string;
}

export interface SceneSourceRef {
  path: string;
  note: string;
  line?: number;
}

export interface SceneFunctionContract {
  trigger: string;
  context: string;
  consumes: string;
  produces: string;
  stateResource: string;
  completionError: string;
  hardwareEffect?: string;
}

export interface SceneFunction {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  evidence: SceneEvidenceLevel;
  contract: SceneFunctionContract;
  sources?: SceneSourceRef[];
}

export interface SceneNode {
  id: string;
  zoneId: string;
  title: LocalizedText;
  eyebrow?: LocalizedText;
  description: LocalizedText;
  kind: SceneNodeKind;
  evidence: SceneEvidenceLevel;
  color?: string;
  tags?: string[];
  interfaces?: string[];
  sources?: SceneSourceRef[];
}

export interface SceneEdge {
  id: string;
  source: string;
  target: string;
  title: LocalizedText;
  description: LocalizedText;
  kind: SceneEdgeKind;
  evidence: SceneEvidenceLevel;
  color?: string;
  lane?: string;
  protocol?: string;
  dashed?: boolean;
}

export interface SceneJourneyStep {
  id: string;
  nodeId?: string;
  functionId?: string;
  title: LocalizedText;
  evidence: SceneEvidenceLevel;
}

export interface SceneJourney {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  caveat?: LocalizedText;
  steps: SceneJourneyStep[];
  edgeIds: string[];
}

export interface SceneZone {
  id: string;
  title: LocalizedText;
  eyebrow: LocalizedText;
  summary: LocalizedText;
  color: string;
  nodeIds: string[];
}

export interface SceneNodeLayout {
  nodeId: string;
  position: Vector3Tuple;
  size: Vector3Tuple;
  labelOffset?: Vector3Tuple;
  moduleSide?: SceneLabelSide;
  cameraSide?: SceneLabelSide;
}

export interface SceneZoneLayout {
  zoneId: string;
  position: Vector3Tuple;
  size: Vector3Tuple;
  backdrop?: "generic" | "server" | "board" | "fabric" | "device";
}

export interface SceneCameraPreset {
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov?: number;
}

export interface SceneLayout {
  nodes: SceneNodeLayout[];
  zones: SceneZoneLayout[];
  camera: SceneCameraPreset;
  labelDistance?: number;
  farBlockOpacity?: number;
  farFlowOpacity?: number;
}

export interface SceneLocaleDefinition {
  default: "zh-CN" | "en-US";
  supported: Array<"zh-CN" | "en-US">;
}

export interface SceneDefinition {
  schemaVersion: typeof SCENE_SCHEMA_VERSION;
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  evidence: SceneEvidenceLevel;
  locales: SceneLocaleDefinition;
  zones: SceneZone[];
  nodes: SceneNode[];
  edges: SceneEdge[];
  journeys: SceneJourney[];
  functions: SceneFunction[];
  layout: SceneLayout;
  enhanced: EnhancedSceneDefinition;
}

export interface NormalizedSceneDefinition extends SceneDefinition {
  nodeById: ReadonlyMap<string, SceneNode>;
  zoneById: ReadonlyMap<string, SceneZone>;
  edgeById: ReadonlyMap<string, SceneEdge>;
  functionById: ReadonlyMap<string, SceneFunction>;
  functionsByModuleId: ReadonlyMap<string, SceneFunction[]>;
  adjacentNodes: ReadonlyMap<string, ReadonlySet<string>>;
  edgesByLane: ReadonlyMap<string, SceneEdge[]>;
  journeyById: ReadonlyMap<string, SceneJourney>;
  nodesByZone: ReadonlyMap<string, SceneNode[]>;
  labelsByZone: ReadonlyMap<string, string[]>;
  viewMembership: ReadonlyMap<string, ReadonlySet<string>>;
  nodeLayoutById: ReadonlyMap<string, SceneNodeLayout>;
  zoneLayoutById: ReadonlyMap<string, SceneZoneLayout>;
}
