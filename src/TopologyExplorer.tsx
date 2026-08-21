"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CameraPreset } from "./PhysicalTopology3D";
import type { GlobalLabelLayoutMode } from "./global-label-layout";
import { LocaleProvider, translationVariants, useLocale } from "./i18n/locale-context";
import { buildEnhancedSceneRuntime } from "./enhanced-scene-runtime";
import type {
  DriverFunctionContract,
  DriverJourney,
  EnhancedSceneRuntime,
  EnhancedStorageTree,
  EnhancedSystemTreeGroup,
  EnhancedTopologyEdge as TopologyEdge,
  EnhancedTopologyNode as TopologyNode,
} from "./enhanced-scene-types";
import { getScene } from "./scene-loader";
import type { NormalizedSceneDefinition } from "./scene-definition";

type EdgeKind = string;
type DriverCausalLayer = string;
type DriverJourneyId = string;
type ViewKey = string;

const DEFAULT_PIPE_THICKNESS = 4.5;
const DEFAULT_HUD_DISTANCE = 1.2;
const DEFAULT_MODULE_LABEL_DISTANCE = 1.2;
const DEFAULT_LABEL_LAYOUT_MODE: GlobalLabelLayoutMode = "module";
const DEFAULT_LABEL_LINE_THICKNESS = 1.5;
const DEFAULT_MODULE_LABEL_SCALE = 1;
const DEFAULT_FOCUS_ANNOTATION_SCALE = 1;
const DEFAULT_FOCUS_HUD_TEXT_SCALE = 1;
const DEFAULT_SUB_LABEL_DISTANCE = 30;
const DEFAULT_SUB_LABEL_FADE_RANGE = 8;
const DEFAULT_FAR_FADE_START = 48;
const DEFAULT_FAR_BLOCK_OPACITY = 0.22;
const DEFAULT_FAR_FLOW_OPACITY = 0.55;

function resolvePlaneMeta(meta: EnhancedSceneRuntime["planeMeta"], id: string) {
  return meta[id] ?? { color: "#4d8edb", label: id, short: id };
}

function resolveEdgeMeta(meta: EnhancedSceneRuntime["edgeMeta"], id: string) {
  return meta[id] ?? { color: "#708090", label: id };
}

function resolveCausalLayerMeta(meta: EnhancedSceneRuntime["driverCausalLayerMeta"], id: string) {
  return meta[id] ?? { color: "#4d8edb", label: id, short: id.toUpperCase(), description: id };
}

function defaultJourneyStepId(journey: DriverJourney) {
  return journey.steps.find((step) => step.kind === "function")?.id ?? journey.steps[0]?.id ?? "";
}

const journeyEvidenceLabels = {
  CODE_PROVEN: "脚本 / 资料直接证明",
  RTL_PROVEN: "设备 / 工具证明",
  RUNTIME_OBSERVED: "运行观测",
  INFERRED: "当前推断",
};

function clampPipeThickness(value: number) {
  return Math.min(6, Math.max(1, Math.round(value * 10) / 10));
}

function clampHudDistance(value: number) {
  return Math.min(2.4, Math.max(0.6, Math.round(value * 10) / 10));
}

function clampModuleLabelDistance(value: number) {
  return Math.min(2.4, Math.max(0.6, Math.round(value * 10) / 10));
}

function clampLabelLineThickness(value: number) {
  return Math.min(6, Math.max(0.5, Math.round(value * 10) / 10));
}

function clampModuleLabelScale(value: number) {
  return Math.min(1.6, Math.max(0.6, Math.round(value * 10) / 10));
}

function clampFocusAnnotationScale(value: number) {
  return Math.min(1.6, Math.max(0.6, Math.round(value * 10) / 10));
}

function clampFocusHudTextScale(value: number) {
  return Math.min(1.8, Math.max(0.8, Math.round(value * 10) / 10));
}

function clampSubLabelDistance(value: number) {
  return Math.min(70, Math.max(10, Math.round(value)));
}

function clampSubLabelFadeRange(value: number) {
  return Math.min(20, Math.max(2, Math.round(value)));
}

function clampFarFadeStart(value: number) {
  return Math.min(100, Math.max(15, Math.round(value)));
}

function clampFarBlockOpacity(value: number) {
  return Math.min(0.8, Math.max(0.08, Math.round(value * 100) / 100));
}

function clampFarFlowOpacity(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

const evidenceLabels = {
  code: "资料 / 实证闭合",
  target: "部署设计",
  inference: "边界 / 待验证",
};

function buildPath(start: string, end: string, edges: TopologyEdge[]) {
  const queue = [start];
  const visited = new Set([start]);
  const parent = new Map<string, { node: string; edge: string }>();
  const adjacency = new Map<string, { node: string; edge: string }[]>();

  edges.forEach((edge) => {
    const forward = adjacency.get(edge.source) ?? [];
    forward.push({ node: edge.target, edge: edge.id });
    adjacency.set(edge.source, forward);
    const reverse = adjacency.get(edge.target) ?? [];
    reverse.push({ node: edge.source, edge: edge.id });
    adjacency.set(edge.target, reverse);
  });

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === end) break;
    for (const next of adjacency.get(node) ?? []) {
      if (visited.has(next.node)) continue;
      visited.add(next.node);
      parent.set(next.node, { node, edge: next.edge });
      queue.push(next.node);
    }
  }

  if (!visited.has(end)) return { nodes: [] as string[], edges: [] as string[] };
  const nodeIds = [end];
  const edgeIds: string[] = [];
  let cursor = end;
  while (cursor !== start) {
    const step = parent.get(cursor);
    if (!step) break;
    edgeIds.unshift(step.edge);
    nodeIds.unshift(step.node);
    cursor = step.node;
  }
  return { nodes: nodeIds, edges: edgeIds };
}

function nodeSearchText(node: TopologyNode) {
  const bilingual = (value: string) => translationVariants(value).join(" ");
  const refs = node.data.codeRefs?.map((ref) => `${bilingual(ref.name)} ${ref.path} ${bilingual(ref.note)}`).join(" ") ?? "";
  const paths = node.data.paths?.map((path) => `${path.path} ${bilingual(path.role)}`).join(" ") ?? "";
  return `${bilingual(node.label)} ${bilingual(node.data.title)} ${bilingual(node.data.description)} ${node.data.tags?.join(" ") ?? ""} ${refs} ${paths}`.toLowerCase();
}

type SystemIndexMode = "system" | "storage";

function SystemIndexContent({
  mode,
  selectedId,
  nodeMap,
  systemTree,
  storageTrees,
  planeMeta,
  boundaryNote,
  onModeChange,
  onSelectNode,
  onMobileClose,
}: {
  mode: SystemIndexMode;
  selectedId: string;
  nodeMap: ReadonlyMap<string, TopologyNode>;
  systemTree: EnhancedSystemTreeGroup[];
  storageTrees: EnhancedStorageTree[];
  planeMeta: EnhancedSceneRuntime["planeMeta"];
  boundaryNote: string;
  onModeChange: (mode: SystemIndexMode) => void;
  onSelectNode: (id: string) => void;
  onMobileClose?: () => void;
}) {
  const { tr } = useLocale();
  return (
    <>
      <div className="panel-header">
        <div><p className="eyebrow">NAVIGATION</p><h2>{tr("系统索引")}</h2></div>
        {onMobileClose && (
          <button className="panel-close mobile-only" onClick={onMobileClose} aria-label={tr("关闭系统导航")}>×</button>
        )}
      </div>
      <div className="segmented-control">
        <button className={mode === "system" ? "active" : ""} onClick={() => onModeChange("system")}>{tr("系统树")}</button>
        <button className={mode === "storage" ? "active" : ""} onClick={() => onModeChange("storage")}>{tr("存储树")}</button>
      </div>

      <div className="panel-scroll">
        {mode === "system" ? (
          <div className="system-tree">
            {systemTree.map((group) => (
              <details key={group.label} open>
                <summary>
                  <span className="plane-dot" style={{ background: resolvePlaneMeta(planeMeta, group.plane).color }} />
                  <strong>{group.label}</strong>
                  <em>{group.nodes.length}</em>
                </summary>
                <div className="tree-children">
                  {group.nodes.map((id) => {
                    const node = nodeMap.get(id)!;
                    return (
                      <button className={selectedId === id ? "selected" : ""} key={id} onClick={() => onSelectNode(id)}>
                        <span>{node.data.layer}</span>
                        {node.data.title}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="storage-tree">
            <p className="boundary-note">{boundaryNote}</p>
            {storageTrees.map((tree) => (
              <details key={tree.id} open>
                <summary>
                  <span className="plane-dot" style={{ background: resolvePlaneMeta(planeMeta, tree.plane).color }} />
                  <strong>{tree.label}</strong>
                  <em>{tree.roots.length}</em>
                </summary>
                <div className="path-list">
                  {tree.roots.map((item) => (
                    <button key={item.path} onClick={() => onSelectNode(item.nodeId)}>
                      <code>{item.path}</code>
                      <span>{item.role}</span>
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function EnhancedTopologyExplorer({ scene }: { scene: NormalizedSceneDefinition }) {
  return <LocaleProvider><TopologyExplorerContent scene={scene} /></LocaleProvider>;
}

export default function TopologyExplorer() {
  const scene = getScene("t113-arm-xvc");
  if (!scene) throw new Error("Default scene t113-arm-xvc is missing");
  return <EnhancedTopologyExplorer scene={scene} />;
}

function TopologyExplorerContent({ scene }: { scene: NormalizedSceneDefinition }) {
  const { locale, setLocale, tr } = useLocale();
  const runtime = useMemo(() => buildEnhancedSceneRuntime(scene, locale), [scene, locale]);
  useEffect(() => {
    document.title = `${runtime.title} | Engineering Topology 3D`;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", runtime.description);
  }, [runtime.description, runtime.title]);
  const {
    edgeMeta,
    driverCausalLayerMeta,
    driverJourneyModuleRoleByNodeId,
    driverJourneyOrder,
    driverJourneys,
    focusModuleGroups,
    functionInteractions,
    planeMeta,
    runtimeFacts,
    storageTrees,
    systemTree,
    topologyEdges,
    topologyNodes,
    viewOptions,
  } = runtime;
  const allEdgeKinds = useMemo(() => Object.keys(edgeMeta), [edgeMeta]);
  const allDriverCausalLayers = useMemo(() => Object.keys(driverCausalLayerMeta), [driverCausalLayerMeta]);
  const defaultJourneyId = driverJourneyOrder[0];
  const defaults = runtime.displayDefaults;
  const storageKey = useCallback((suffix: string) => `${runtime.sceneId}-${suffix}`, [runtime.sceneId]);
  const PIPE_THICKNESS_STORAGE_KEY = storageKey("pipe-thickness");
  const HUD_DISTANCE_STORAGE_KEY = storageKey("hud-distance");
  const MODULE_LABEL_DISTANCE_STORAGE_KEY = storageKey("module-label-distance");
  const LABEL_LAYOUT_MODE_STORAGE_KEY = storageKey("label-layout-mode");
  const LABEL_LINE_THICKNESS_STORAGE_KEY = storageKey("label-line-thickness");
  const MODULE_LABEL_SCALE_STORAGE_KEY = storageKey("module-label-scale");
  const FOCUS_ANNOTATION_SCALE_STORAGE_KEY = storageKey("focus-annotation-scale");
  const FOCUS_HUD_TEXT_SCALE_STORAGE_KEY = storageKey("focus-hud-text-scale");
  const SUB_LABEL_DISTANCE_STORAGE_KEY = storageKey("sub-label-distance");
  const SUB_LABEL_FADE_RANGE_STORAGE_KEY = storageKey("sub-label-fade-range");
  const FAR_FADE_START_STORAGE_KEY = storageKey("far-fade-start");
  const FAR_BLOCK_OPACITY_STORAGE_KEY = storageKey("far-block-opacity");
  const FAR_FLOW_OPACITY_STORAGE_KEY = storageKey("far-flow-opacity");
  const scenePanelRef = useRef<HTMLElement>(null);
  const [PhysicalTopology3D, setPhysicalTopology3D] = useState<
    null | typeof import("./PhysicalTopology3D").default
  >(null);
  const [view, setView] = useState<ViewKey>(runtime.defaultView);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("iso");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [flowEnabled, setFlowEnabled] = useState(true);
  const [pipeThickness, setPipeThickness] = useState(defaults.pipeThickness ?? DEFAULT_PIPE_THICKNESS);
  const [hudDistance, setHudDistance] = useState(defaults.hudDistance ?? DEFAULT_HUD_DISTANCE);
  const [moduleLabelDistance, setModuleLabelDistance] = useState(defaults.moduleLabelDistance ?? DEFAULT_MODULE_LABEL_DISTANCE);
  const [labelLayoutMode, setLabelLayoutMode] = useState<GlobalLabelLayoutMode>(defaults.labelLayoutMode ?? DEFAULT_LABEL_LAYOUT_MODE);
  const [labelLineThickness, setLabelLineThickness] = useState(defaults.labelLineThickness ?? DEFAULT_LABEL_LINE_THICKNESS);
  const [moduleLabelScale, setModuleLabelScale] = useState(defaults.moduleLabelScale ?? DEFAULT_MODULE_LABEL_SCALE);
  const [subLabelDistance, setSubLabelDistance] = useState(defaults.subLabelDistance ?? DEFAULT_SUB_LABEL_DISTANCE);
  const [subLabelFadeRange, setSubLabelFadeRange] = useState(defaults.subLabelFadeRange ?? DEFAULT_SUB_LABEL_FADE_RANGE);
  const [farFadeStart, setFarFadeStart] = useState(defaults.farFadeStart ?? DEFAULT_FAR_FADE_START);
  const [farBlockOpacity, setFarBlockOpacity] = useState(defaults.farBlockOpacity ?? DEFAULT_FAR_BLOCK_OPACITY);
  const [farFlowOpacity, setFarFlowOpacity] = useState(defaults.farFlowOpacity ?? DEFAULT_FAR_FLOW_OPACITY);
  const [focusAnnotationScale, setFocusAnnotationScale] = useState(defaults.focusAnnotationScale ?? DEFAULT_FOCUS_ANNOTATION_SCALE);
  const [focusHudTextScale, setFocusHudTextScale] = useState(defaults.focusHudTextScale ?? DEFAULT_FOCUS_HUD_TEXT_SCALE);
  const [lineSettingsOpen, setLineSettingsOpen] = useState(false);
  const [edgeKinds, setEdgeKinds] = useState<Set<EdgeKind>>(new Set(allEdgeKinds));
  const [leftMode, setLeftMode] = useState<SystemIndexMode>("system");
  const [mobilePanel, setMobilePanel] = useState<"none" | "left" | "right">("none");
  const [focusedModuleId, setFocusedModuleId] = useState<string | null>(null);
  const [focusedFunctionIndex, setFocusedFunctionIndex] = useState(0);
  const [focusedJourneyId, setFocusedJourneyId] = useState<DriverJourneyId>(driverJourneyOrder[0]);
  const [focusedJourneyStepId, setFocusedJourneyStepId] = useState(defaultJourneyStepId(driverJourneys[driverJourneyOrder[0]]));
  const [enabledCausalLayers, setEnabledCausalLayers] = useState<Set<DriverCausalLayer>>(new Set(allDriverCausalLayers));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndexOpen, setFullscreenIndexOpen] = useState(true);
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    void import("./PhysicalTopology3D").then(({ default: Scene }) => {
      if (active) setPhysicalTopology3D(() => Scene);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = Number(window.localStorage.getItem(PIPE_THICKNESS_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= 1 && stored <= 6) setPipeThickness(clampPipeThickness(stored));
      const storedHudDistance = Number(window.localStorage.getItem(HUD_DISTANCE_STORAGE_KEY));
      if (Number.isFinite(storedHudDistance) && storedHudDistance >= 0.6 && storedHudDistance <= 2.4) {
        setHudDistance(clampHudDistance(storedHudDistance));
      }
      const storedModuleLabelDistance = Number(window.localStorage.getItem(MODULE_LABEL_DISTANCE_STORAGE_KEY));
      if (Number.isFinite(storedModuleLabelDistance) && storedModuleLabelDistance >= 0.6 && storedModuleLabelDistance <= 2.4) {
        setModuleLabelDistance(clampModuleLabelDistance(storedModuleLabelDistance));
      }
      const storedLabelLayoutMode = window.localStorage.getItem(LABEL_LAYOUT_MODE_STORAGE_KEY);
      if (storedLabelLayoutMode === "module" || storedLabelLayoutMode === "camera") {
        setLabelLayoutMode(storedLabelLayoutMode);
      }
      const storedLabelLineThickness = Number(window.localStorage.getItem(LABEL_LINE_THICKNESS_STORAGE_KEY));
      if (Number.isFinite(storedLabelLineThickness) && storedLabelLineThickness >= 0.5 && storedLabelLineThickness <= 6) {
        setLabelLineThickness(clampLabelLineThickness(storedLabelLineThickness));
      }
      const storedModuleLabelScale = Number(window.localStorage.getItem(MODULE_LABEL_SCALE_STORAGE_KEY));
      if (Number.isFinite(storedModuleLabelScale) && storedModuleLabelScale >= 0.6 && storedModuleLabelScale <= 1.6) {
        setModuleLabelScale(clampModuleLabelScale(storedModuleLabelScale));
      }
      const storedSubLabelDistance = Number(window.localStorage.getItem(SUB_LABEL_DISTANCE_STORAGE_KEY));
      if (Number.isFinite(storedSubLabelDistance) && storedSubLabelDistance >= 10 && storedSubLabelDistance <= 70) {
        setSubLabelDistance(clampSubLabelDistance(storedSubLabelDistance));
      }
      const storedSubLabelFadeRange = Number(window.localStorage.getItem(SUB_LABEL_FADE_RANGE_STORAGE_KEY));
      if (Number.isFinite(storedSubLabelFadeRange) && storedSubLabelFadeRange >= 2 && storedSubLabelFadeRange <= 20) {
        setSubLabelFadeRange(clampSubLabelFadeRange(storedSubLabelFadeRange));
      }
      const storedFarFadeStart = Number(window.localStorage.getItem(FAR_FADE_START_STORAGE_KEY));
      if (Number.isFinite(storedFarFadeStart) && storedFarFadeStart >= 15 && storedFarFadeStart <= 100) {
        setFarFadeStart(clampFarFadeStart(storedFarFadeStart));
      }
      const storedFarBlockOpacity = Number(window.localStorage.getItem(FAR_BLOCK_OPACITY_STORAGE_KEY));
      if (Number.isFinite(storedFarBlockOpacity) && storedFarBlockOpacity >= 0.08 && storedFarBlockOpacity <= 0.8) {
        setFarBlockOpacity(clampFarBlockOpacity(storedFarBlockOpacity));
      }
      const storedFarFlowOpacity = Number(window.localStorage.getItem(FAR_FLOW_OPACITY_STORAGE_KEY));
      if (Number.isFinite(storedFarFlowOpacity) && storedFarFlowOpacity >= 0 && storedFarFlowOpacity <= 1) {
        setFarFlowOpacity(clampFarFlowOpacity(storedFarFlowOpacity));
      }
      const storedFocusAnnotationScale = Number(window.localStorage.getItem(FOCUS_ANNOTATION_SCALE_STORAGE_KEY));
      if (Number.isFinite(storedFocusAnnotationScale) && storedFocusAnnotationScale >= 0.6 && storedFocusAnnotationScale <= 1.6) {
        setFocusAnnotationScale(clampFocusAnnotationScale(storedFocusAnnotationScale));
      }
      const storedFocusHudTextScale = Number(window.localStorage.getItem(FOCUS_HUD_TEXT_SCALE_STORAGE_KEY));
      if (Number.isFinite(storedFocusHudTextScale) && storedFocusHudTextScale >= 0.8 && storedFocusHudTextScale <= 1.8) {
        setFocusHudTextScale(clampFocusHudTextScale(storedFocusHudTextScale));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updatePipeThickness = useCallback((value: number) => {
    const nextValue = clampPipeThickness(value);
    setPipeThickness(nextValue);
    window.localStorage.setItem(PIPE_THICKNESS_STORAGE_KEY, String(nextValue));
  }, []);

  const updateHudDistance = useCallback((value: number) => {
    const nextValue = clampHudDistance(value);
    setHudDistance(nextValue);
    window.localStorage.setItem(HUD_DISTANCE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateModuleLabelDistance = useCallback((value: number) => {
    const nextValue = clampModuleLabelDistance(value);
    setModuleLabelDistance(nextValue);
    window.localStorage.setItem(MODULE_LABEL_DISTANCE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateLabelLayoutMode = useCallback((mode: GlobalLabelLayoutMode) => {
    setLabelLayoutMode(mode);
    window.localStorage.setItem(LABEL_LAYOUT_MODE_STORAGE_KEY, mode);
  }, []);

  const updateLabelLineThickness = useCallback((value: number) => {
    const nextValue = clampLabelLineThickness(value);
    setLabelLineThickness(nextValue);
    window.localStorage.setItem(LABEL_LINE_THICKNESS_STORAGE_KEY, String(nextValue));
  }, []);

  const updateModuleLabelScale = useCallback((value: number) => {
    const nextValue = clampModuleLabelScale(value);
    setModuleLabelScale(nextValue);
    window.localStorage.setItem(MODULE_LABEL_SCALE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateSubLabelDistance = useCallback((value: number) => {
    const nextValue = clampSubLabelDistance(value);
    setSubLabelDistance(nextValue);
    window.localStorage.setItem(SUB_LABEL_DISTANCE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateSubLabelFadeRange = useCallback((value: number) => {
    const nextValue = clampSubLabelFadeRange(value);
    setSubLabelFadeRange(nextValue);
    window.localStorage.setItem(SUB_LABEL_FADE_RANGE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateFarFadeStart = useCallback((value: number) => {
    const nextValue = clampFarFadeStart(value);
    setFarFadeStart(nextValue);
    window.localStorage.setItem(FAR_FADE_START_STORAGE_KEY, String(nextValue));
  }, []);

  const updateFarBlockOpacity = useCallback((value: number) => {
    const nextValue = clampFarBlockOpacity(value);
    setFarBlockOpacity(nextValue);
    window.localStorage.setItem(FAR_BLOCK_OPACITY_STORAGE_KEY, String(nextValue));
  }, []);

  const updateFarFlowOpacity = useCallback((value: number) => {
    const nextValue = clampFarFlowOpacity(value);
    setFarFlowOpacity(nextValue);
    window.localStorage.setItem(FAR_FLOW_OPACITY_STORAGE_KEY, String(nextValue));
  }, []);

  const updateFocusAnnotationScale = useCallback((value: number) => {
    const nextValue = clampFocusAnnotationScale(value);
    setFocusAnnotationScale(nextValue);
    window.localStorage.setItem(FOCUS_ANNOTATION_SCALE_STORAGE_KEY, String(nextValue));
  }, []);

  const updateFocusHudTextScale = useCallback((value: number) => {
    const nextValue = clampFocusHudTextScale(value);
    setFocusHudTextScale(nextValue);
    window.localStorage.setItem(FOCUS_HUD_TEXT_SCALE_STORAGE_KEY, String(nextValue));
  }, []);

  const nodeMap = useMemo(() => new Map(topologyNodes.map((node) => [node.id, node])), []);
  const edgeMap = useMemo(() => new Map(topologyEdges.map((edge) => [edge.id, edge])), []);

  const visibleNodes = useMemo(() => {
    return topologyNodes.filter((node) => {
      if (view === "overview") return node.data.views?.includes("overview") ?? false;
      return node.data.views?.includes(view) ?? false;
    });
  }, [view]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => topologyEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target) && edgeKinds.has(edge.data.kind),
    ),
    [edgeKinds, visibleNodeIds],
  );

  const path = useMemo(() => {
    if (!pathStart || !pathEnd) return { nodes: [] as string[], edges: [] as string[] };
    return buildPath(pathStart, pathEnd, visibleEdges);
  }, [pathEnd, pathStart, visibleEdges]);

  const relatedIds = useMemo(() => {
    if (path.nodes.length > 0) return [...path.nodes, ...path.edges];
    if (!selectedId) return [];
    const ids = new Set([selectedId]);
    const selectedEdge = edgeMap.get(selectedId);
    if (selectedEdge) {
      ids.add(selectedEdge.source);
      ids.add(selectedEdge.target);
      return [...ids];
    }
    topologyEdges.forEach((edge) => {
      if (edge.source === selectedId || edge.target === selectedId) {
        ids.add(edge.id);
        ids.add(edge.source);
        ids.add(edge.target);
      }
    });
    return [...ids];
  }, [edgeMap, path, selectedId]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return topologyNodes.filter((node) => nodeSearchText(node).includes(normalized)).slice(0, 8);
  }, [locale, query]);

  const selectedNode = nodeMap.get(selectedId);
  const selectedEdge = edgeMap.get(selectedId);
  const selectedObject = selectedNode ?? selectedEdge;
  const focusedNodeIds = useMemo(
    () => focusedModuleId ? (focusModuleGroups[focusedModuleId] ?? [focusedModuleId]) : [],
    [focusedModuleId],
  );
  const focusedModule = focusedModuleId ? nodeMap.get(focusedModuleId) : undefined;
  const focusedDriverRole = focusedModuleId ? driverJourneyModuleRoleByNodeId[focusedModuleId] : undefined;
  const focusedJourney = driverJourneys[focusedJourneyId];
  const focusedJourneyStep = focusedJourney.steps.find((step) => step.id === focusedJourneyStepId)
    ?? focusedJourney.steps.find((step) => step.kind === "function")
    ?? focusedJourney.steps[0];
  const focusedJourneyVisibleSteps = focusedJourney.steps.filter((step) => step.layers.some((layer) => enabledCausalLayers.has(layer)));
  const focusedJourneyContract = useMemo<DriverFunctionContract | undefined>(() => {
    if (!focusedJourneyStep) return undefined;
    if (focusedJourneyStep.contract) return focusedJourneyStep.contract;
    const incoming = focusedJourney.edges.filter((edge) => edge.target === focusedJourneyStep.id);
    const outgoing = focusedJourney.edges.filter((edge) => edge.source === focusedJourneyStep.id);
    const sourceTitles = incoming.map((edge) => focusedJourney.steps.find((step) => step.id === edge.source)?.shortTitle).filter(Boolean);
    const targetTitles = outgoing.map((edge) => focusedJourney.steps.find((step) => step.id === edge.target)?.shortTitle).filter(Boolean);
    return {
      trigger: incoming.length > 0 ? incoming.map((edge) => `${edge.relation}: ${edge.label}`).join(locale === "en-US" ? "; " : "；") : tr("当前事务旅程的起点。"),
      context: `${focusedJourneyStep.contextLane} / ${focusedJourneyStep.moduleRole}`,
      consumes: sourceTitles.length > 0 ? sourceTitles.join(locale === "en-US" ? ", " : "、") : tr("无上游 payload；由外部事件触发。"),
      produces: targetTitles.length > 0 ? targetTitles.join(locale === "en-US" ? ", " : "、") : tr("事务完成或进入错误出口。"),
      stateResource: locale === "en-US"
        ? `${focusedJourneyStep.kind} node; participates in ${focusedJourneyStep.layers.map((layer) => resolveCausalLayerMeta(driverCausalLayerMeta, layer).label).join(" / ")}.`
        : `${focusedJourneyStep.kind} 节点；参与 ${focusedJourneyStep.layers.map((layer) => resolveCausalLayerMeta(driverCausalLayerMeta, layer).label).join(" / ")}。`,
      completionError: locale === "en-US"
        ? `${tr(journeyEvidenceLabels[focusedJourneyStep.evidence])}; ${outgoing.length > 0 ? outgoing.map((edge) => `${edge.relation}: ${edge.label}`).join("; ") : tr("无后继边")}.`
        : `${tr(journeyEvidenceLabels[focusedJourneyStep.evidence])}；${outgoing.length > 0 ? outgoing.map((edge) => `${edge.relation}: ${edge.label}`).join("；") : tr("无后继边")}。`,
    };
  }, [focusedJourney, focusedJourneyStep, locale, tr]);
  const focusedFunctions = useMemo(
    () => focusedNodeIds.flatMap((id) => {
      const node = nodeMap.get(id);
      return (node?.data.codeRefs ?? []).map((ref) => ({ nodeId: id, ref }));
    }),
    [focusedNodeIds, nodeMap],
  );
  const focusedModuleInteractions = focusedModuleId
    ? (functionInteractions[focusedModuleId] ?? []).filter(
      (interaction) => interaction.source < focusedFunctions.length && interaction.target < focusedFunctions.length,
    )
    : [];
  const focusedFunction = focusedFunctions[focusedFunctionIndex];
  const focusedFunctionLinks = focusedModuleInteractions.filter(
    (interaction) => interaction.source === focusedFunctionIndex || interaction.target === focusedFunctionIndex,
  );

  const adjacentNodes = useMemo(() => {
    if (!selectedNode) return [];
    const ids = new Set<string>();
    topologyEdges.forEach((edge) => {
      if (edge.source === selectedNode.id) ids.add(edge.target);
      if (edge.target === selectedNode.id) ids.add(edge.source);
    });
    return [...ids].map((id) => nodeMap.get(id)).filter(Boolean) as TopologyNode[];
  }, [nodeMap, selectedNode]);

  const selectNode = useCallback((id: string) => {
    const node = nodeMap.get(id);
    if (!node) return;
    if (view === "overview" || !visibleNodeIds.has(id)) {
      const nextView = node.data.views?.find((candidate) => candidate !== "overview") ?? "overview";
      setView(nextView);
    }
    setSelectedId(id);
    if (pathStart && pathStart !== id) setPathEnd(id);
    if (!focusedModuleId) setMobilePanel("right");
  }, [focusedModuleId, nodeMap, pathStart, view, visibleNodeIds]);

  const selectEdge = useCallback((id: string) => {
    setSelectedId(id);
    setMobilePanel("right");
  }, []);

  const clearPath = useCallback(() => {
    setPathStart(null);
    setPathEnd(null);
  }, []);

  const focusModule = useCallback((id: string) => {
    const node = nodeMap.get(id);
    if (!node) return;
    clearPath();
    setFocusedModuleId(id);
    setFocusedFunctionIndex(0);
    setFocusedJourneyId(defaultJourneyId);
    setFocusedJourneyStepId(defaultJourneyStepId(driverJourneys[defaultJourneyId]));
    setEnabledCausalLayers(new Set(allDriverCausalLayers));
    setFullscreenIndexOpen(false);
    setSelectedId(id);
    setMobilePanel("none");
  }, [allDriverCausalLayers, clearPath, defaultJourneyId, driverJourneys, nodeMap]);

  const selectFocusedJourney = useCallback((journeyId: DriverJourneyId) => {
    const journey = driverJourneys[journeyId];
    setFocusedJourneyId(journeyId);
    setFocusedJourneyStepId(defaultJourneyStepId(journey));
    setEnabledCausalLayers((current) => {
      if (journey.steps.some((step) => step.layers.some((layer) => current.has(layer)))) return current;
      return new Set(journey.steps[0]?.layers ?? ["payload"]);
    });
  }, [driverJourneys]);

  const toggleCausalLayer = useCallback((layer: DriverCausalLayer) => {
    setEnabledCausalLayers((current) => {
      if (current.has(layer) && current.size === 1) return current;
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const exitFocus = useCallback(() => {
    setFocusedModuleId(null);
    setFocusedFunctionIndex(0);
    setFocusedJourneyStepId(defaultJourneyStepId(driverJourneys[defaultJourneyId]));
    setSelectedId("");
  }, [defaultJourneyId, driverJourneys]);

  const clearSelection = useCallback(() => {
    clearPath();
    setFocusedModuleId(null);
    setFocusedFunctionIndex(0);
    setFocusedJourneyStepId(defaultJourneyStepId(driverJourneys[defaultJourneyId]));
    setSelectedId("");
  }, [clearPath, defaultJourneyId, driverJourneys]);

  const resetView = useCallback(() => {
    setView(runtime.defaultView);
    setCameraPreset("iso");
    setAnnotationsEnabled(true);
    setFocusedModuleId(null);
    setFocusedFunctionIndex(0);
    setFocusedJourneyId(defaultJourneyId);
    setFocusedJourneyStepId(defaultJourneyStepId(driverJourneys[defaultJourneyId]));
    setEnabledCausalLayers(new Set(allDriverCausalLayers));
    setSelectedId("");
    clearPath();
  }, [allDriverCausalLayers, clearPath, defaultJourneyId, driverJourneys, runtime.defaultView]);

  const toggleFullscreen = useCallback(async () => {
    const target = scenePanelRef.current;
    if (!target || !document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      // Browsers can deny Fullscreen API outside a trusted user gesture.
    }
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      const nextFullscreen = document.fullscreenElement === scenePanelRef.current;
      setIsFullscreen(nextFullscreen);
      if (nextFullscreen) setFullscreenIndexOpen(true);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleEdgeKind = (kind: EdgeKind) => {
    setEdgeKinds((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement
        || (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) return;
      if (event.key.toLowerCase() === "r") resetView();
      if (event.key.toLowerCase() === "l" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setAnnotationsEnabled((enabled) => !enabled);
      }
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === "Escape") {
        if (lineSettingsOpen) setLineSettingsOpen(false);
        else if (focusedModuleId) exitFocus();
        else clearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, exitFocus, focusedModuleId, lineSettingsOpen, resetView, toggleFullscreen]);

  const focusHudStyle = focusedModule
    ? ({
        "--focus-accent": resolvePlaneMeta(planeMeta, focusedModule.data.plane).color,
        "--focus-hud-text-scale": focusHudTextScale,
      } as CSSProperties)
    : undefined;

  return (
    <main className={`app-shell ${focusedModuleId ? "focus-active" : ""}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">{runtime.sceneId.toUpperCase()} · SCENEDEFINITION 2.0</p>
            <h1>{runtime.title}</h1>
          </div>
        </div>

        <div className="runtime-strip" aria-label={tr("页面范围与证据口径")}>
          {runtimeFacts.map((fact) => (
            <div className={`runtime-fact tone-${fact.tone}`} key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>

        <div className="header-actions">
          <div className="locale-switcher" role="group" aria-label={tr("界面语言")}>
            <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")} aria-pressed={locale === "zh-CN"}>中文</button>
            <button type="button" className={locale === "en-US" ? "active" : ""} onClick={() => setLocale("en-US")} aria-pressed={locale === "en-US"}>EN</button>
          </div>
          <button className="icon-button mobile-only" onClick={() => setMobilePanel("left")} aria-label={tr("打开系统导航")}>{tr("树")}</button>
          <button className="icon-button" onClick={resetView} title={tr("返回场景物理全景 (R)")}>ALL</button>
          <button className="icon-button" onClick={clearSelection} title={tr("清除选择与路径 (Esc)")}>CLR</button>
          <button className="icon-button mobile-only" onClick={() => setMobilePanel("right")} aria-label={tr("打开详情面板")}>{tr("详")}</button>
        </div>
      </header>

      <section className="control-rail" aria-label={tr("视图与数据过滤")}>
        <div className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) selectNode(searchResults[0].id);
            }}
            placeholder={tr("搜索模块、函数、接口、路径或证据…")}
            aria-label={tr("搜索服务、脚本、端口、设备或路径")}
          />
          {query && <button onClick={() => setQuery("")} aria-label={tr("清空搜索")}>×</button>}
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((node) => (
                <button key={node.id} onClick={() => { selectNode(node.id); setQuery(""); }}>
                  <span style={{ background: resolvePlaneMeta(planeMeta, node.data.plane).color }} />
                  <div><strong>{node.data.title}</strong><small>{node.data.codeRefs?.[0]?.name ?? node.data.layer}</small></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="view-tabs" aria-label={tr("架构视图")}>
          {viewOptions.map((option) => (
            <button
              className={view === option.id ? "active" : ""}
              key={option.id}
              onClick={() => { setView(option.id); setAnnotationsEnabled(true); clearPath(); }}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className="rail-toggles">
          <label className="switch-control">
            <input type="checkbox" checked={flowEnabled} onChange={(event) => setFlowEnabled(event.target.checked)} />
            <span /> {tr("流向动画")}
          </label>
        </div>
      </section>

      <div className={`workspace-grid ${focusedModuleId ? "focus-workspace" : ""}`}>
        <aside className={`left-panel ${mobilePanel === "left" ? "mobile-open" : ""}`}>
          <SystemIndexContent
            mode={leftMode}
            selectedId={selectedId}
            nodeMap={nodeMap}
            systemTree={systemTree}
            storageTrees={storageTrees}
            planeMeta={planeMeta}
            boundaryNote={`${runtime.description} ${tr("本页是静态知识模型，不能当作设备当前在线状态。")}`}
            onModeChange={setLeftMode}
            onSelectNode={selectNode}
            onMobileClose={() => setMobilePanel("none")}
          />
        </aside>

        <section
          ref={scenePanelRef}
          className={`canvas-panel ${focusedModuleId ? "focus-mode" : ""} ${!annotationsEnabled && !focusedModuleId ? "clean-view" : ""} ${isFullscreen ? "is-fullscreen" : ""} ${isFullscreen && fullscreenIndexOpen ? "fullscreen-index-open" : ""}`}
          aria-label={focusedModule ? `${focusedModule.data.title} · ${tr("隔离模块信息")}` : runtime.description}
        >
          <div className="canvas-meta">
            <div><span className="live-pulse" /> PHYSICAL 3D MODE · {runtime.sceneId.toUpperCase()}</div>
            <span>{visibleNodes.length} NODES · {visibleEdges.length} EDGES IN CURRENT VIEW</span>
          </div>

          {isFullscreen && (
            <div className={`fullscreen-system-index ${fullscreenIndexOpen ? "open" : "collapsed"}`}>
              <aside id="fullscreen-system-index-panel" className="fullscreen-system-index-panel" aria-label={tr("全屏系统索引")}>
                <SystemIndexContent
                  mode={leftMode}
                  selectedId={selectedId}
                  nodeMap={nodeMap}
                  systemTree={systemTree}
                  storageTrees={storageTrees}
                  planeMeta={planeMeta}
                  boundaryNote={`${runtime.description} ${tr("本页是静态知识模型，不能当作设备当前在线状态。")}`}
                  onModeChange={setLeftMode}
                  onSelectNode={selectNode}
                />
              </aside>
              <button
                type="button"
                className="fullscreen-system-index-toggle"
                onClick={() => setFullscreenIndexOpen((open) => !open)}
                aria-controls="fullscreen-system-index-panel"
                aria-expanded={fullscreenIndexOpen}
                aria-label={tr(fullscreenIndexOpen ? "收起全屏系统索引" : "展开全屏系统索引")}
                title={tr(fullscreenIndexOpen ? "收起系统索引" : "展开系统索引")}
              ><span aria-hidden="true">{fullscreenIndexOpen ? "‹" : "›"}</span></button>
            </div>
          )}

          <div className="scene-mount">
            {PhysicalTopology3D ? (
              <PhysicalTopology3D
                scene={runtime}
                locale={locale}
                view={view}
                cameraPreset={cameraPreset}
                selectedId={selectedId}
                activeIds={relatedIds}
                flowEnabled={flowEnabled}
                lineThickness={pipeThickness}
                hudDistance={hudDistance}
                moduleLabelDistance={moduleLabelDistance}
                labelLayoutMode={labelLayoutMode}
                labelLineThickness={labelLineThickness}
                moduleLabelScale={moduleLabelScale}
                subLabelDistance={subLabelDistance}
                subLabelFadeRange={subLabelFadeRange}
                farFadeStart={farFadeStart}
                farBlockOpacity={farBlockOpacity}
                farFlowOpacity={farFlowOpacity}
                focusAnnotationScale={focusAnnotationScale}
                enabledEdgeKinds={edgeKinds}
                annotationsEnabled={annotationsEnabled}
                focusedModuleId={focusedModuleId}
                focusedFunctionIndex={focusedFunctionIndex}
                focusedJourneyId={focusedJourneyId}
                enabledCausalLayers={enabledCausalLayers}
                focusedJourneyStepId={focusedJourneyStepId}
                onNodeClick={selectNode}
                onModuleFocus={focusModule}
                onFunctionFocus={setFocusedFunctionIndex}
                onJourneyStepFocus={setFocusedJourneyStepId}
                onEdgeClick={selectEdge}
                onCanvasClick={focusedModuleId ? () => undefined : clearSelection}
              />
            ) : (
              <div className="scene-loading"><span /><strong>{tr("正在装载增强型 3D 工程拓扑…")}</strong></div>
            )}
          </div>

          <div className="camera-presets" aria-label={tr("3D 镜头预设")}>
            {([
              ["iso", tr("等轴")],
              ["front", tr("正视")],
              ["top", tr("俯视")],
              ["depth", tr("深度")],
            ] as [CameraPreset, string][]).map(([id, label]) => (
              <button className={cameraPreset === id ? "active" : ""} key={id} onClick={() => setCameraPreset(id)}>
                {label}
              </button>
            ))}
            <span className="camera-control-divider" aria-hidden="true" />
            <label
              className={`global-annotation-control ${annotationsEnabled ? "active" : ""}`}
              title={tr("显示或隐藏所有未选中模块的名称与基本作用 (L)")}
            >
              <input
                type="checkbox"
                checked={annotationsEnabled}
                onChange={(event) => setAnnotationsEnabled(event.target.checked)}
                aria-label={tr("全局模块标注")}
              />
              <span aria-hidden="true"><i /></span>
              <strong>{tr("全局标注")}</strong>
              <em>{tr(annotationsEnabled ? "开" : "关")}</em>
            </label>
          </div>

          {focusedModule && (
            <aside className="focus-hud" style={focusHudStyle} aria-label={tr("隔离模块信息")}>
              <div className="focus-hud-toolbar">
                <button type="button" onClick={exitFocus} title={tr("退出隔离聚焦 (Esc)")}>
                  <span aria-hidden="true">←</span> {tr("返回全景")}
                </button>
                <span>{resolvePlaneMeta(planeMeta, focusedModule.data.plane).short} · ISOLATED</span>
              </div>
              <div className="focus-hud-title">
                <p>{focusedModule.data.layer}</p>
                <h2>{focusedModule.data.title}</h2>
                <div>
                  <span>{focusedDriverRole ? `${focusedJourney.steps.length} STATIONS` : `${focusedFunctions.length} SCRIPT / SERVICE`}</span>
                  <span>{focusedDriverRole ? `${focusedJourney.edges.length} CAUSAL EDGES` : `${focusedModuleInteractions.length} LINKS`}</span>
                  <span>FIT 100%</span>
                  <span>{focusedDriverRole ? "4 CAUSAL LAYERS" : "3D DEPTH"}</span>
                </div>
              </div>
              {focusedDriverRole ? (
                <>
                  <div className="focus-hud-journey-tabs" aria-label={tr("黄金事务旅程")}>
                    {driverJourneyOrder.map((journeyId) => {
                      const journey = driverJourneys[journeyId];
                      return (
                        <button
                          type="button"
                          key={journeyId}
                          className={focusedJourneyId === journeyId ? "active" : ""}
                          onClick={() => selectFocusedJourney(journeyId)}
                          title={journey.title}
                        >{journey.shortTitle}</button>
                      );
                    })}
                  </div>
                  <div className="focus-hud-causal-layers" aria-label={tr("四层因果图开关")}>
                    {allDriverCausalLayers.map((layer) => {
                      const meta = resolveCausalLayerMeta(driverCausalLayerMeta, layer);
                      const enabled = enabledCausalLayers.has(layer);
                      return (
                        <button
                          type="button"
                          key={layer}
                          className={enabled ? "active" : ""}
                          style={{ "--layer-color": meta.color } as CSSProperties}
                          aria-pressed={enabled}
                          onClick={() => toggleCausalLayer(layer)}
                          title={meta.description}
                        ><i />{meta.label}</button>
                      );
                    })}
                  </div>
                  <section className="focus-hud-journey-summary">
                    <div><span>ACTIVE JOURNEY</span><strong>{focusedJourney.title}</strong></div>
                    <p>{focusedJourney.summary}</p>
                  </section>
                  <div className="focus-hud-journey-step-list" aria-label={tr("事务操作站")}>
                    {focusedJourneyVisibleSteps.map((step) => (
                      <button
                        type="button"
                        key={step.id}
                        className={focusedJourneyStep?.id === step.id ? "active" : ""}
                        style={{ "--step-color": resolveCausalLayerMeta(driverCausalLayerMeta, step.layers[0] ?? "payload").color } as CSSProperties}
                        onClick={() => setFocusedJourneyStepId(step.id)}
                        title={step.title}
                      >
                        <span>{step.moduleRole} · {step.contextLane}</span>
                        <strong>{step.shortTitle}</strong>
                      </button>
                    ))}
                  </div>
                  {focusedJourneyStep && focusedJourneyContract && (
                    <section className="focus-hud-contract">
                      <header>
                        <div><span>{focusedJourneyStep.kind.toUpperCase()} · {focusedJourneyStep.moduleRole}</span><strong>{focusedJourneyStep.title}</strong></div>
                        <em className={`journey-evidence evidence-${focusedJourneyStep.evidence.toLowerCase()}`}>{focusedJourneyStep.evidence}</em>
                      </header>
                      <dl>
                        <div><dt>Trigger</dt><dd>{focusedJourneyContract.trigger}</dd></div>
                        <div><dt>Context</dt><dd>{focusedJourneyContract.context}</dd></div>
                        <div><dt>Consumes</dt><dd>{focusedJourneyContract.consumes}</dd></div>
                        <div><dt>Produces</dt><dd>{focusedJourneyContract.produces}</dd></div>
                        <div><dt>State / Resource</dt><dd>{focusedJourneyContract.stateResource}</dd></div>
                        <div><dt>Completion / Error</dt><dd>{focusedJourneyContract.completionError}</dd></div>
                      </dl>
                      {focusedJourneyContract.hardwareEffect && <p className="focus-hud-hardware-effect"><b>Hardware effect</b>{focusedJourneyContract.hardwareEffect}</p>}
                      <footer>
                        <span>{tr(journeyEvidenceLabels[focusedJourneyStep.evidence])}</span>
                        {focusedJourneyStep.source && <code>{focusedJourneyStep.source}</code>}
                      </footer>
                    </section>
                  )}
                  <div className="focus-hud-journey-caveat"><b>{tr("证据边界")}</b><span>{focusedJourney.caveat}</span></div>
                </>
              ) : focusedFunction ? (
                <>
                  <div className="focus-hud-function-list" aria-label={tr("脚本、服务与证据入口列表")}>
                    {focusedFunctions.map((item, index) => (
                      <button
                        type="button"
                        className={focusedFunctionIndex === index ? "active" : ""}
                        key={`${item.nodeId}-${item.ref.path}`}
                        onClick={() => setFocusedFunctionIndex(index)}
                        title={item.ref.note}
                      >
                        {item.ref.name}
                      </button>
                    ))}
                  </div>
                  <div className="focus-hud-function">
                    <b>{tr("入口")}</b>
                    <div>
                      <strong>{focusedFunction.ref.name}</strong>
                      <p>{focusedFunction.ref.note}</p>
                      <code>{focusedFunction.ref.path}</code>
                    </div>
                  </div>
                </>
              ) : (
                <div className="focus-hud-empty-function">
                  <strong>{tr("该物理模块没有独立脚本或服务入口")}</strong>
                  <p>{tr("镜头仍按模块包围盒完成 100% 适配；可旋转查看硬件位置与接口关系。")}</p>
                </div>
              )}
              {!focusedDriverRole && focusedFunctionLinks.length > 0 && (
                <div className="focus-hud-links" aria-label={tr("当前入口内部互动")}>
                  {focusedFunctionLinks.map((interaction) => (
                    <span key={`${interaction.source}-${interaction.target}-${interaction.label}`}>
                      <i>{interaction.kind}</i>{interaction.label}
                    </span>
                  ))}
                </div>
              )}
              <small>{tr("短点脚本/服务节点或彩色连线切换 · 长按 / 拖动旋转 · 滚轮缩放")}</small>
            </aside>
          )}

          <button
            type="button"
            className={`line-settings-trigger ${lineSettingsOpen ? "active" : ""}`}
            onClick={() => setLineSettingsOpen((open) => !open)}
            aria-expanded={lineSettingsOpen}
            aria-controls="line-thickness-settings"
            title={tr("设置标注布局模式、模块标签距离、模块标签大小、3D 批注、聚焦详情文字、标签连接线粗细、主管道和 HUD")}
          >
            <span aria-hidden="true" />
            {tr("管道粗细")} <strong>{pipeThickness.toFixed(1)}×</strong>
          </button>

          {lineSettingsOpen && (
            <aside id="line-thickness-settings" className="line-settings-panel" aria-label={tr("3D 视口显示设置")}>
              <header>
                <div><p className="eyebrow">LANGUAGE / LABEL / CAMERA / PIPE</p><h3>{tr("3D 视口显示设置")}</h3></div>
                <button type="button" onClick={() => setLineSettingsOpen(false)} aria-label={tr("关闭线条设置")}>×</button>
              </header>
              <section className="display-setting-section locale-setting-section">
                <div className="line-thickness-readout">
                  <span>{tr("语言")}</span><strong>{locale === "zh-CN" ? "中文" : "EN"}</strong>
                </div>
                <div className="settings-locale-options" role="group" aria-label={tr("界面语言")}>
                  <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")} aria-pressed={locale === "zh-CN"}>中文</button>
                  <button type="button" className={locale === "en-US" ? "active" : ""} onClick={() => setLocale("en-US")} aria-pressed={locale === "en-US"}>English</button>
                </div>
                <p>{tr("切换后保留当前镜头、聚焦模块、事务旅程和选中状态。")}</p>
              </section>
              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("主管道粗细")}</span><strong>{pipeThickness.toFixed(1)}×</strong>
                </div>
                <div className="line-thickness-preview" style={{ "--preview-thickness": `${pipeThickness}px` } as CSSProperties} aria-hidden="true">
                  <i className="c2s-preview" /><i className="s2c-preview" />
                </div>
                <label htmlFor="pipe-thickness-range">
                  <span>{tr("细")}</span>
                  <input
                    id="pipe-thickness-range"
                    type="range"
                    min="1"
                    max="6"
                    step="0.1"
                    value={pipeThickness}
                    onChange={(event) => updatePipeThickness(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${pipeThickness.toFixed(1)} times` : `${pipeThickness.toFixed(1)} 倍`}
                  />
                  <span>{tr("粗")}</span>
                </label>
                <div className="line-thickness-presets" aria-label={tr("粗细倍率预设")}>
                  {[1, 3, 4.5, 6].map((value) => (
                    <button
                      type="button"
                      className={pipeThickness === value ? "active" : ""}
                      key={value}
                      onClick={() => updatePipeThickness(value)}
                    >{value.toFixed(value % 1 === 0 ? 0 : 1)}×</button>
                  ))}
                </div>
                <p>{tr("调节场景主管道粗细；函数调用和状态互动线保持细线。")}</p>
              </section>

              <section className="display-setting-section label-layout-mode-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("标注布局模式")}</span><strong>{tr(labelLayoutMode === "module" ? "模块周边" : "摄像机两侧")}</strong>
                </div>
                <div className="label-layout-mode-options" role="group" aria-label={tr("标注布局模式")}>
                  <button
                    type="button"
                    className={labelLayoutMode === "module" ? "active" : ""}
                    aria-pressed={labelLayoutMode === "module"}
                    onClick={() => updateLabelLayoutMode("module")}
                  >{tr("模块周边")}</button>
                  <button
                    type="button"
                    className={labelLayoutMode === "camera" ? "active" : ""}
                    aria-pressed={labelLayoutMode === "camera"}
                    onClick={() => updateLabelLayoutMode("camera")}
                  >{tr("摄像机两侧")}</button>
                </div>
                <p>{tr(labelLayoutMode === "module"
                  ? "每张标签只围绕自己的模块锚点就近避让，不使用摄像机固定列。"
                  : "标签固定随镜头移动，但强制分布到左右安全边，避开画面中心。")}</p>
              </section>

              <section className="display-setting-section module-label-distance-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("模块标签距离")}</span><strong>{moduleLabelDistance.toFixed(1)}×</strong>
                </div>
                <label htmlFor="module-label-distance-range">
                  <span>{tr("贴近")}</span>
                  <input
                    id="module-label-distance-range"
                    type="range"
                    min="0.6"
                    max="2.4"
                    step="0.1"
                    value={moduleLabelDistance}
                    onChange={(event) => updateModuleLabelDistance(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${moduleLabelDistance.toFixed(1)} times module label distance` : `${moduleLabelDistance.toFixed(1)} 倍模块标签距离`}
                  />
                  <span>{tr("远离")}</span>
                </label>
                <p>{tr(labelLayoutMode === "module"
                  ? "控制标签与自己模块边缘的间距；碰撞时只在该锚点周围寻找最近空位。"
                  : "控制标签向左右安全边的偏移距离；两侧标签不会停在画面中心。")}</p>
              </section>

              <section className="display-setting-section module-label-scale-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("模块标签大小")}</span><strong>{moduleLabelScale.toFixed(1)}×</strong>
                </div>
                <label htmlFor="module-label-scale-range">
                  <span>{tr("小")}</span>
                  <input
                    id="module-label-scale-range"
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.1"
                    value={moduleLabelScale}
                    onChange={(event) => updateModuleLabelScale(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${moduleLabelScale.toFixed(1)} times module label size` : `${moduleLabelScale.toFixed(1)} 倍模块标签大小`}
                  />
                  <span>{tr("大")}</span>
                </label>
                <p>{tr("同步缩放标签卡片与文字；碰撞求解会按实际尺寸重新分列和避让。")}</p>
              </section>

              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("子标签隐藏距离")}</span><strong>{subLabelDistance}</strong>
                </div>
                <label htmlFor="sub-label-distance-range">
                  <span>{tr("近")}</span>
                  <input
                    id="sub-label-distance-range"
                    type="range"
                    min="10"
                    max="70"
                    step="1"
                    value={subLabelDistance}
                    onChange={(event) => updateSubLabelDistance(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `Hide sub-labels at ${subLabelDistance} from the zone surface` : `距大区表面 ${subLabelDistance} 时隐藏子标签`}
                  />
                  <span>{tr("远")}</span>
                </label>
                <p>{tr("按摄像机到各自大区表面的距离独立计算；超过阈值后只保留大区标题，选中模块始终显示。")}</p>
              </section>

              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("子标签渐隐范围")}</span><strong>{subLabelFadeRange}</strong>
                </div>
                <label htmlFor="sub-label-fade-range">
                  <span>{tr("短")}</span>
                  <input
                    id="sub-label-fade-range"
                    type="range"
                    min="2"
                    max="20"
                    step="1"
                    value={subLabelFadeRange}
                    onChange={(event) => updateSubLabelFadeRange(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${subLabelFadeRange} sub-label fade distance` : `${subLabelFadeRange} 的子标签渐隐距离`}
                  />
                  <span>{tr("长")}</span>
                </label>
                <p>{tr("控制子标签由清晰到隐藏的过渡宽度；过低透明度的标签会先退出碰撞求解。")}</p>
              </section>

              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("远景衰减起点")}</span><strong>{farFadeStart}</strong>
                </div>
                <label htmlFor="far-fade-start-range">
                  <span>{tr("近")}</span>
                  <input
                    id="far-fade-start-range"
                    type="range"
                    min="15"
                    max="100"
                    step="1"
                    value={farFadeStart}
                    onChange={(event) => updateFarFadeStart(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `Start far-view fading after ${farFadeStart}` : `距目标 ${farFadeStart} 后开始远景衰减`}
                  />
                  <span>{tr("远")}</span>
                </label>
                <p>{tr("板块使用所属大区表面距离，数据流使用曲线中点距离，从此位置开始向最远透明度平滑过渡。")}</p>
              </section>

              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("最远板块不透明度")}</span><strong>{Math.round(farBlockOpacity * 100)}%</strong>
                </div>
                <label htmlFor="far-block-opacity-range">
                  <span>{tr("淡")}</span>
                  <input
                    id="far-block-opacity-range"
                    type="range"
                    min="0.08"
                    max="0.8"
                    step="0.01"
                    value={farBlockOpacity}
                    onChange={(event) => updateFarBlockOpacity(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${Math.round(farBlockOpacity * 100)}% far block opacity` : `${Math.round(farBlockOpacity * 100)}% 最远板块不透明度`}
                  />
                  <span>{tr("实")}</span>
                </label>
                <p>{tr("这是大区外壳和内部模块的远景下限，拉到最远也不会再次变成全透明。")}</p>
              </section>

              <section className="display-setting-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("最远数据流不透明度")}</span><strong>{Math.round(farFlowOpacity * 100)}%</strong>
                </div>
                <label htmlFor="far-flow-opacity-range">
                  <span>{tr("淡")}</span>
                  <input
                    id="far-flow-opacity-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={farFlowOpacity}
                    onChange={(event) => updateFarFlowOpacity(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${Math.round(farFlowOpacity * 100)}% far flow opacity` : `${Math.round(farFlowOpacity * 100)}% 最远数据流不透明度`}
                  />
                  <span>{tr("实")}</span>
                </label>
                <p>{tr("控制数据流主管道在远景中的可见下限；保持为零时允许远景完全隐藏。")}</p>
              </section>

              <section className="display-setting-section focus-annotation-scale-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("聚焦批注 UI 大小")}</span><strong>{focusAnnotationScale.toFixed(1)}×</strong>
                </div>
                <label htmlFor="focus-annotation-scale-range">
                  <span>{tr("小")}</span>
                  <input
                    id="focus-annotation-scale-range"
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.1"
                    value={focusAnnotationScale}
                    onChange={(event) => updateFocusAnnotationScale(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${focusAnnotationScale.toFixed(1)} times focus annotation size` : `${focusAnnotationScale.toFixed(1)} 倍聚焦批注 UI 大小`}
                  />
                  <span>{tr("大")}</span>
                </label>
                <p>{tr("缩放运维事务内部的脚本/服务卡片、因果边标签、执行上下文与层级批注；不改变模型几何和左侧事务详情面板。")}</p>
              </section>

              <section className="display-setting-section focus-hud-text-scale-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("聚焦详情文字大小")}</span><strong>{focusHudTextScale.toFixed(1)}×</strong>
                </div>
                <label htmlFor="focus-hud-text-scale-range">
                  <span>{tr("小")}</span>
                  <input
                    id="focus-hud-text-scale-range"
                    type="range"
                    min="0.8"
                    max="1.8"
                    step="0.1"
                    value={focusHudTextScale}
                    onChange={(event) => updateFocusHudTextScale(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${focusHudTextScale.toFixed(1)} times focus detail text size` : `${focusHudTextScale.toFixed(1)} 倍聚焦详情文字大小`}
                  />
                  <span>{tr("大")}</span>
                </label>
                <p>{tr("只放大左上角事务详情面板的标题、旅程、六接口契约和证据说明；面板继续独立滚动，不改变右侧 3D 批注。")}</p>
              </section>

              <section className="display-setting-section label-line-thickness-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("标签连接线粗细")}</span><strong>{labelLineThickness.toFixed(1)}×</strong>
                </div>
                <div
                  className="label-line-thickness-preview"
                  style={{ "--label-line-preview-thickness": `${labelLineThickness}px` } as CSSProperties}
                  aria-hidden="true"
                ><i /></div>
                <label htmlFor="label-line-thickness-range">
                  <span>{tr("细")}</span>
                  <input
                    id="label-line-thickness-range"
                    type="range"
                    min="0.5"
                    max="6"
                    step="0.1"
                    value={labelLineThickness}
                    onChange={(event) => updateLabelLineThickness(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${labelLineThickness.toFixed(1)} times label leader thickness` : `${labelLineThickness.toFixed(1)} 倍标签连接线粗细`}
                  />
                  <span>{tr("粗")}</span>
                </label>
                <p>{tr("只调节模块标签到实际模块锚点的连接线，不改变三条业务主管道。")}</p>
              </section>

              <section className="display-setting-section hud-distance-section">
                <div className="line-thickness-readout" aria-live="polite">
                  <span>{tr("HUD 前方距离")}</span><strong>{hudDistance.toFixed(1)}</strong>
                </div>
                <label htmlFor="hud-distance-range">
                  <span>{tr("近")}</span>
                  <input
                    id="hud-distance-range"
                    type="range"
                    min="0.6"
                    max="2.4"
                    step="0.1"
                    value={hudDistance}
                    onChange={(event) => updateHudDistance(Number(event.target.value))}
                    aria-valuetext={locale === "en-US" ? `${hudDistance.toFixed(1)} HUD distance` : `${hudDistance.toFixed(1)} HUD 距离`}
                  />
                  <span>{tr("远")}</span>
                </label>
                <p>{tr("选中信息 HUD 固定在摄像机视野前方；调近会更大，调远会更紧凑。")}</p>
              </section>

              <button
                type="button"
                className="restore-line-default"
                onClick={() => {
                  updatePipeThickness(defaults.pipeThickness);
                  updateModuleLabelDistance(defaults.moduleLabelDistance);
                  updateLabelLayoutMode(defaults.labelLayoutMode);
                  updateLabelLineThickness(defaults.labelLineThickness);
                  updateModuleLabelScale(defaults.moduleLabelScale);
                  updateSubLabelDistance(defaults.subLabelDistance);
                  updateSubLabelFadeRange(defaults.subLabelFadeRange);
                  updateFarFadeStart(defaults.farFadeStart);
                  updateFarBlockOpacity(defaults.farBlockOpacity);
                  updateFarFlowOpacity(defaults.farFlowOpacity);
                  updateFocusAnnotationScale(defaults.focusAnnotationScale);
                  updateFocusHudTextScale(defaults.focusHudTextScale);
                  updateHudDistance(defaults.hudDistance);
                }}
              >{tr("恢复默认：子标签 30 / 渐隐 8 / 远景 48 / 板块 22% / 数据流 55%")}</button>
            </aside>
          )}

          <button
            type="button"
            className="canvas-fullscreen-button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
            title={`${tr(isFullscreen ? "退出" : "进入")} 3D ${locale === "en-US" ? "viewport fullscreen" : "视口全屏"} (F)`}
          >
            <span aria-hidden="true">{isFullscreen ? "↙" : "⛶"}</span>
            {tr(isFullscreen ? "退出全屏" : "全屏观察")}
          </button>

          <div className="physical-map-key" aria-hidden="true">
            <span><i className="solid-card" />{runtime.visuals.zones.map((zone) => zone.title).join(" / ")}</span>
            {Object.values(runtime.laneMeta).slice(0, 2).map((lane, index) => (
              <span key={lane.label}><i className={index === 0 ? "c2s-card" : "s2c-card"} />{lane.label}</span>
            ))}
            <span><i className="function-pin" />{tr("函数 / RTL / 设备节点")}</span>
            <span><i className="function-link" />{tr("数据 / 控制 / 同步 / 生命周期")}</span>
            <span><i className="depth-stack" />{tr("场景定义的空间与因果深度")}</span>
          </div>

          {/* The 3D scene owns physical geometry and camera-facing labels; side panels remain the evidence/control surface. */}
          <div className="sr-only">
            {runtime.description}
          </div>

          <div className="canvas-legend">
            {allEdgeKinds.map((kind) => (
              <button className={edgeKinds.has(kind) ? "enabled" : "disabled"} key={kind} onClick={() => toggleEdgeKind(kind)}>
                <span style={{ background: resolveEdgeMeta(edgeMeta, kind).color }} />{resolveEdgeMeta(edgeMeta, kind).label}
              </button>
            ))}
          </div>

          <div className="canvas-help">{tr("左键短点选择 · 左键长按 / 拖动旋转 · 右键平移 · 滚轮缩放 · L 全局标注 · F 全屏 · R 标注全景")}</div>
        </section>

        <aside className={`right-panel ${mobilePanel === "right" ? "mobile-open" : ""}`}>
          <div className="panel-header">
            <div><p className="eyebrow">INSPECTOR</p><h2>{tr("节点 / 边详情")}</h2></div>
            <button className="panel-close mobile-only" onClick={() => setMobilePanel("none")} aria-label={tr("关闭详情")}>×</button>
          </div>
          <div className="panel-scroll inspector-scroll">
            {!selectedObject && (
              <div className="empty-inspector"><span>◎</span><h3>{tr("选择一个 3D 部件")}</h3><p>{tr("点击场景中的模块、函数或数据流，查看接口、目录、事务旅程和证据边界。")}</p></div>
            )}

            {selectedNode && (
              <article className="node-details">
                <div className="detail-kicker">
                  <span style={{ color: resolvePlaneMeta(planeMeta, selectedNode.data.plane).color }}>{resolvePlaneMeta(planeMeta, selectedNode.data.plane).short}</span>
                  <span className={`evidence-badge evidence-${selectedNode.data.evidence}`}>{tr(evidenceLabels[selectedNode.data.evidence])}</span>
                </div>
                <h3>{selectedNode.data.title}</h3>
                <p className="node-id">{selectedNode.id} · {selectedNode.data.layer}</p>
                <p className="detail-description">{selectedNode.data.description}</p>

                {selectedNode.data.runtimeNote && (
                  <div className="runtime-note"><strong>{tr("状态边界")}</strong><p>{selectedNode.data.runtimeNote}</p></div>
                )}

                {selectedNode.data.interfaces && (
                  <section className="detail-section">
                    <h4>{tr("接口 / 协议")}</h4>
                    <div className="chip-list">{selectedNode.data.interfaces.map((item) => <span key={item}>{item}</span>)}</div>
                  </section>
                )}

                {selectedNode.data.codeRefs && (
                  <section className="detail-section">
                    <h4>{tr("脚本 / 服务 / 证据入口")} <em>{selectedNode.data.codeRefs.length}</em></h4>
                    <div className="code-ref-list">
                      {selectedNode.data.codeRefs.map((ref) => (
                        <div key={`${ref.path}-${ref.name}`}>
                          <strong>{ref.name}</strong>
                          <code>{ref.path}</code>
                          <p>{ref.note}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedNode.data.paths && (
                  <section className="detail-section">
                    <h4>{tr("运行目录 / 设备节点")} <em>{selectedNode.data.paths.length}</em></h4>
                    <div className="detail-paths">
                      {selectedNode.data.paths.map((item) => (
                        <div key={item.path}><code>{item.path}</code><span>{item.role} · {tr(item.confidence === "code" ? "代码推导" : "候选")}</span></div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="detail-section">
                  <h4>{tr("相邻节点")} <em>{adjacentNodes.length}</em></h4>
                  <div className="neighbor-list">
                    {adjacentNodes.slice(0, 10).map((node) => (
                      <button key={node.id} onClick={() => selectNode(node.id)}>
                        <span style={{ background: resolvePlaneMeta(planeMeta, node.data.plane).color }} />{node.data.title}
                      </button>
                    ))}
                  </div>
                </section>

                <div className="path-actions">
                  <button
                    className={pathStart === selectedNode.id ? "active" : ""}
                    onClick={() => { setPathStart(selectedNode.id); setPathEnd(null); }}
                  >
                    {tr(pathStart === selectedNode.id ? "✓ 路径起点" : "设为路径起点")}
                  </button>
                  {pathStart && pathStart !== selectedNode.id && <button onClick={() => setPathEnd(selectedNode.id)}>{tr("连到此节点")}</button>}
                  {(pathStart || pathEnd) && <button className="ghost" onClick={clearPath}>{tr("清除路径")}</button>}
                </div>
              </article>
            )}

            {selectedEdge && (
              <article className="node-details edge-details">
                <div className="detail-kicker">
                  <span style={{ color: resolveEdgeMeta(edgeMeta, selectedEdge.data.kind).color }}>{selectedEdge.data.kind}</span>
                  <span className={`evidence-badge evidence-${selectedEdge.data.evidence}`}>{tr(evidenceLabels[selectedEdge.data.evidence])}</span>
                </div>
                <h3>{resolveEdgeMeta(edgeMeta, selectedEdge.data.kind).label}</h3>
                <p className="node-id">{selectedEdge.source} → {selectedEdge.target}</p>
                <p className="detail-description">{selectedEdge.data.description}</p>
                {selectedEdge.data.protocol && <div className="runtime-note protocol-note"><strong>{tr("协议合同")}</strong><p>{selectedEdge.data.protocol}</p></div>}
                <section className="detail-section">
                  <h4>{tr("两端实体")}</h4>
                  <div className="neighbor-list">
                    {[selectedEdge.source, selectedEdge.target].map((id) => {
                      const node = nodeMap.get(id)!;
                      return <button key={id} onClick={() => selectNode(id)}><span style={{ background: resolvePlaneMeta(planeMeta, node.data.plane).color }} />{node.data.title}</button>;
                    })}
                  </div>
                </section>
              </article>
            )}
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        <div className="path-status">
          <span>PATH</span>
          {pathStart ? (
            <>
              <strong>{nodeMap.get(pathStart)?.data.title}</strong>
              <i>→</i>
              <strong>{pathEnd ? nodeMap.get(pathEnd)?.data.title : tr("点击目标节点")}</strong>
              {pathEnd && <em>{path.nodes.length > 0 ? (locale === "en-US" ? `${path.edges.length} hops` : `${path.edges.length} 跳`) : tr("当前过滤下无路径")}</em>}
            </>
          ) : <p>{tr("在详情面板设置起点，再点击目标节点查看跨层路径")}</p>}
        </div>
        <div className="evidence-legend">
          <span className="evidence-code">{tr("代码闭合")}</span>
          <span className="evidence-target">{tr("目标架构")}</span>
          <span className="evidence-inference">{tr("结构推断")}</span>
        </div>
      </footer>
    </main>
  );
}
