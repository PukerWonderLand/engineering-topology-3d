"use client";

import { Edges, Grid, Html, Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { translateText as tr } from "./i18n/locale-context";
import type { Locale } from "./i18n/types";
import {
  distanceToFitPerspectiveBox,
  journeyFocusFrame,
  moduleFocusFrame,
  type ModuleFocusFrame,
} from "./camera-fit";
import {
  resolveGlobalLabelCollisions,
  type GlobalLabelObstacle,
  type GlobalLabelLayoutMode,
  type GlobalModuleLabelLayout,
  type ProjectedGlobalModuleLabel,
} from "./global-label-layout";
import type {
  DriverJourney,
  DriverJourneyEdge,
  DriverJourneyStep,
  EnhancedSceneRuntime,
  EnhancedTopologyNode as TopologyNode,
  FunctionInteraction,
  MacroZoneDefinition,
} from "./enhanced-scene-types";

type EdgeKind = string;
type DriverCausalLayer = string;
type DriverContextLane = string;
type DriverJourneyId = string;
type DriverModuleRole = string;
type FlowLane = string;
type ViewKey = string;
type MacroZoneId = string;

type V3 = [number, number, number];
export type CameraPreset = "iso" | "front" | "top" | "depth";
export interface CameraNavigationRequest {
  nodeId: string;
  requestId: number;
}
type LabelDensity = "clean" | "panorama" | "detail";
type LabelTier = "system" | "detail";

const LONG_PRESS_ROTATE_MS = 220;
const DRAG_ROTATE_THRESHOLD_PX = 4;
const CLICK_PERMIT_MS = 180;
const CAMERA_LOCKED_LABELS = true;
const GLOBAL_LABEL_OBSTACLE_PADDING = 9;
const GLOBAL_LABEL_OBSTACLE_SELECTORS = [
  ".camera-hud-context",
  ".camera-hud-selection",
  ".camera-hud-readout",
  ".scene-axis",
  ".scene-live-note",
  ".camera-presets",
  ".physical-map-key",
  ".canvas-legend",
  ".canvas-help",
  ".line-settings-trigger",
  ".line-settings-panel",
  ".canvas-fullscreen-button",
  ".scene-macro-zone-label",
].join(",");

let currentLabelDensity: LabelDensity = "panorama";
const labelDensityListeners = new Set<() => void>();

function setSceneLabelDensity(nextDensity: LabelDensity) {
  if (currentLabelDensity === nextDensity) return;
  currentLabelDensity = nextDensity;
  labelDensityListeners.forEach((listener) => listener());
}

function subscribeLabelDensity(listener: () => void) {
  labelDensityListeners.add(listener);
  return () => labelDensityListeners.delete(listener);
}

function useSceneLabelDensity() {
  return useSyncExternalStore(
    subscribeLabelDensity,
    () => currentLabelDensity,
    () => "panorama" as LabelDensity,
  );
}
interface PhysicalTopology3DProps {
  scene: EnhancedSceneRuntime;
  locale: Locale;
  view: ViewKey;
  cameraPreset: CameraPreset;
  selectedId: string;
  activeIds: string[];
  flowEnabled: boolean;
  lineThickness: number;
  hudDistance: number;
  moduleLabelDistance: number;
  moduleLabelScale: number;
  subLabelDistance: number;
  subLabelFadeRange: number;
  farFadeStart: number;
  farBlockOpacity: number;
  farFlowOpacity: number;
  focusAnnotationScale: number;
  labelLayoutMode: GlobalLabelLayoutMode;
  labelLineThickness: number;
  enabledEdgeKinds: ReadonlySet<EdgeKind>;
  annotationsEnabled: boolean;
  focusedModuleId: string | null;
  focusedFunctionIndex: number;
  focusedJourneyId: DriverJourneyId;
  enabledCausalLayers: ReadonlySet<DriverCausalLayer>;
  focusedJourneyStepId: string;
  navigationRequest: CameraNavigationRequest | null;
  onNodeClick: (id: string) => void;
  onModuleFocus: (id: string) => void;
  onFunctionFocus: (index: number) => void;
  onJourneyStepFocus: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onCanvasClick: () => void;
}

interface ModuleBlockProps {
  title: string;
  eyebrow: string;
  nodeIds: string[];
  position: V3;
  size: V3;
  color: string;
  selectedId: string;
  activeIds: Set<string>;
  onNodeClick: (id: string) => void;
  onModuleFocus?: (id: string) => void;
  onFunctionFocus?: (index: number) => void;
  canActivateObject: () => boolean;
  showDetails: boolean;
  opacity?: number;
  farFadeStart?: number;
  farBlockOpacity?: number;
  focusMode?: boolean;
  focusedFunctionIndex?: number;
  showModuleCard?: boolean;
  labelOffset?: V3;
}

const EnhancedSceneContext = createContext<EnhancedSceneRuntime | null>(null);

function useEnhancedScene() {
  const scene = useContext(EnhancedSceneContext);
  if (!scene) throw new Error("PhysicalTopology3D requires EnhancedSceneContext");
  return scene;
}

function smoothstep(minimum: number, maximum: number, value: number) {
  if (maximum <= minimum) return value >= maximum ? 1 : 0;
  const normalized = clampNumber((value - minimum) / (maximum - minimum), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function macroZoneSurfaceDistance(cameraPosition: THREE.Vector3, zoneId: MacroZoneId, macroZones: Record<string, MacroZoneDefinition>) {
  const zone = macroZones[zoneId];
  const dx = Math.max(Math.abs(cameraPosition.x - zone.center[0]) - zone.halfSize[0], 0);
  const dy = Math.max(Math.abs(cameraPosition.y - zone.center[1]) - zone.halfSize[1], 0);
  const dz = Math.max(Math.abs(cameraPosition.z - zone.center[2]) - zone.halfSize[2], 0);
  return Math.hypot(dx, dy, dz);
}

function labelVisibilityForDistance(distance: number, hideDistance: number, fadeRange: number) {
  return 1 - smoothstep(Math.max(0, hideDistance - fadeRange), hideDistance, distance);
}

function projectedPointIsInViewport(projected: THREE.Vector3) {
  return Number.isFinite(projected.x)
    && Number.isFinite(projected.y)
    && Number.isFinite(projected.z)
    && projected.x >= -1
    && projected.x <= 1
    && projected.y >= -1
    && projected.y <= 1
    && projected.z >= -1
    && projected.z <= 1;
}

function farVisibilityFactor(distance: number, farFadeStart: number) {
  return smoothstep(farFadeStart, 120, distance);
}

function clampNumber(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function nodesFor(ids: string[], nodeMap: ReadonlyMap<string, TopologyNode>) {
  return ids.map((id) => nodeMap.get(id)).filter(Boolean) as TopologyNode[];
}

function zoneOpacity(view: ViewKey, zone: string, routeViews: ReadonlySet<string>) {
  if (view === "overview" || routeViews.has(view)) return 1;
  return view === zone ? 1 : 0.22;
}

type SceneAccentStyle = CSSProperties & {
  "--scene-accent"?: string;
  "--pipe-color"?: string;
  "--module-label-scale"?: number;
};

function accentStyle(color: string): SceneAccentStyle {
  return { "--scene-accent": color, "--pipe-color": color };
}

function GlobalLabelProjectionTracker({
  locale,
  enabled,
  view,
  selectedId,
  activeIds,
  moduleLabelDistance,
  moduleLabelScale,
  subLabelDistance,
  subLabelFadeRange,
  labelLayoutMode,
  obstacles,
  onLayouts,
}: {
  locale: Locale;
  enabled: boolean;
  view: ViewKey;
  selectedId: string;
  activeIds: Set<string>;
  moduleLabelDistance: number;
  moduleLabelScale: number;
  subLabelDistance: number;
  subLabelFadeRange: number;
  labelLayoutMode: GlobalLabelLayoutMode;
  obstacles: GlobalLabelObstacle[];
  onLayouts: (layouts: GlobalModuleLabelLayout[]) => void;
}) {
  const scene = useEnhancedScene();
  const {
    globalModuleLabels: globalModuleLabelDefinitions,
    macroZones: macroZoneDefinitions,
    nodeById: nodeMap,
    nodePositions,
    routeNodeIds,
    viewMembership,
  } = scene;
  const macroZoneByNodeId = useMemo(() => new Map<string, MacroZoneId>(
    Object.entries(macroZoneDefinitions).flatMap(([zoneId, definition]) => definition.nodeIds.map((nodeId) => [nodeId, zoneId])),
  ), [macroZoneDefinitions]);
  const { camera, size } = useThree();
  const lastSignatureRef = useRef("");

  useEffect(() => {
    lastSignatureRef.current = "";
    if (!enabled) onLayouts([]);
  }, [enabled, locale, onLayouts]);

  useFrame(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) return;
    const semanticViewNodeIds = viewMembership.get(view);
    const journeyViewNodeIds = new Set(routeNodeIds[view] ?? []);
    const hasSemanticView = Boolean(semanticViewNodeIds?.size);
    const hasJourneyView = journeyViewNodeIds.size > 0;
    const showEveryNode = view === "overview" || view === "c2s" || view === "s2c";
    const projectedLabels: ProjectedGlobalModuleLabel[] = [];

    globalModuleLabelDefinitions.forEach((definition) => {
      const node = nodeMap.get(definition.id);
      const position = nodePositions[definition.id];
      if (!node || !position) return;
      const visibleInCurrentView = showEveryNode
        || (hasSemanticView && semanticViewNodeIds?.has(definition.id))
        || (hasJourneyView && journeyViewNodeIds.has(definition.id))
        || (!hasSemanticView && !hasJourneyView && node.data.plane === view);
      if (!visibleInCurrentView) return;

      const worldPosition = new THREE.Vector3(...position);
      const zoneId = macroZoneByNodeId.get(definition.id);
      if (!zoneId) return;
      // Distance and camera framing are independent gates. Checking the node
      // center in NDC keeps off-screen annotations out of collision layout,
      // instead of clamping their leaders back onto a viewport edge.
      const projectedCenter = worldPosition.clone().project(camera);
      if (!projectedPointIsInViewport(projectedCenter)) return;
      const zoneDistance = macroZoneSurfaceDistance(camera.position, zoneId, macroZoneDefinitions);
      // View membership decides eligibility; distance controls fading. Selection
      // can bypass distance, but never the viewport gate above.
      const visibility = definition.id === selectedId
        ? 1
        : labelVisibilityForDistance(zoneDistance, subLabelDistance, subLabelFadeRange);
      if (visibility <= 0.035) return;
      const side = labelLayoutMode === "camera" ? definition.cameraSide : definition.moduleSide;
      const firstEdge = worldPosition.clone().add(new THREE.Vector3(definition.halfWidth, 0, 0));
      const secondEdge = worldPosition.clone().add(new THREE.Vector3(-definition.halfWidth, 0, 0));
      const projectedEdges = [firstEdge.project(camera), secondEdge.project(camera)];
      const projected = side === "right"
        ? projectedEdges.reduce((rightmost, candidate) => candidate.x > rightmost.x ? candidate : rightmost)
        : projectedEdges.reduce((leftmost, candidate) => candidate.x < leftmost.x ? candidate : leftmost);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) return;

      projectedLabels.push({
        id: definition.id,
        title: node.data.title,
        eyebrow: node.data.layer,
        description: node.data.description,
        color: definition.color,
        side,
        anchorX: Math.round(clampNumber((projected.x * 0.5 + 0.5) * size.width, 0, size.width) * 2) / 2,
        anchorY: Math.round(clampNumber((-projected.y * 0.5 + 0.5) * size.height, 0, size.height) * 2) / 2,
        cameraDistance: camera.position.distanceTo(worldPosition),
        visibility,
        muted: definition.id !== selectedId && activeIds.size > 0 && !activeIds.has(definition.id),
        selected: definition.id === selectedId,
      });
    });

    const layouts = resolveGlobalLabelCollisions(
      projectedLabels,
      size.width,
      size.height,
      moduleLabelDistance,
      labelLayoutMode,
      moduleLabelScale,
      obstacles,
    );
    const signature = JSON.stringify(layouts.map((layout) => [
      layout.id,
      layout.anchorX,
      layout.anchorY,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      layout.column,
      layout.muted,
      Math.round(layout.visibility * 100) / 100,
    ]));
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    onLayouts(layouts);
  });

  return null;
}

function GlobalModuleLabelOverlay({
  layouts,
  selectedId,
  labelLayoutMode,
  labelLineThickness,
  moduleLabelScale,
  onModuleFocus,
}: {
  layouts: GlobalModuleLabelLayout[];
  selectedId: string;
  labelLayoutMode: GlobalLabelLayoutMode;
  labelLineThickness: number;
  moduleLabelScale: number;
  onModuleFocus: (id: string) => void;
}) {
  return (
    <div
      className={`global-module-label-layer mode-${labelLayoutMode}`}
      aria-label={tr(labelLayoutMode === "module" ? "散布在对应模块周边的全局标注" : "固定在摄像机左右两侧的全局标注")}
    >
      <svg className="global-module-label-leaders" aria-hidden="true">
        {layouts.map((layout) => {
          const selected = layout.id === selectedId;
          const cardEdgeX = layout.side === "right" ? layout.x : layout.x + layout.width;
          const cardCenterY = layout.y + layout.height / 2;
          const deltaX = cardEdgeX - layout.anchorX;
          const firstControlX = layout.anchorX + deltaX * 0.42;
          const secondControlX = layout.anchorX + deltaX * 0.78;
          const path = `M ${layout.anchorX} ${layout.anchorY} C ${firstControlX} ${layout.anchorY}, ${secondControlX} ${cardCenterY}, ${cardEdgeX} ${cardCenterY}`;
          return (
            <g key={`leader-${layout.id}`} className={`global-module-leader ${selected ? "selected" : ""} ${layout.muted ? "muted" : ""}`}>
              {selected && (
                <path
                  className="leader-halo"
                  d={path}
                  stroke="#ffffff"
                  style={{ strokeWidth: Math.max(5, labelLineThickness * 3.5) }}
                />
              )}
              <path
                className="leader-core"
                d={path}
                stroke={layout.color}
                opacity={layout.visibility * (layout.muted ? 0.38 : 0.92)}
                style={{ strokeWidth: Math.max(1.4, labelLineThickness * (selected ? 2.35 : 1.65)) }}
              />
              <circle
                className="leader-anchor"
                cx={layout.anchorX}
                cy={layout.anchorY}
                r={Math.max(selected ? 5 : 3.2, 2.2 + labelLineThickness * (selected ? 0.9 : 0.65))}
                fill={layout.color}
                opacity={layout.visibility * (layout.muted ? 0.42 : 1)}
                style={{ strokeWidth: Math.max(selected ? 2.2 : 1.2, labelLineThickness * 0.55) }}
              />
              {selected && <circle className="leader-anchor-pulse" cx={layout.anchorX} cy={layout.anchorY} r={Math.max(9, 6 + labelLineThickness * 1.4)} />}
            </g>
          );
        })}
      </svg>
      {layouts.map((layout) => (
        <button
          key={layout.id}
          type="button"
          className={`scene-global-module-label screen-layout ${layout.id === selectedId ? "selected" : ""} ${layout.muted ? "muted" : ""}`}
          style={{
            ...accentStyle(layout.color),
            "--module-label-scale": moduleLabelScale,
            fontSize: `${moduleLabelScale}em`,
            left: layout.x,
            top: layout.y,
            width: layout.width,
            height: layout.height,
            opacity: layout.visibility * (layout.muted ? 0.58 : 1),
          } as SceneAccentStyle}
          onClick={() => onModuleFocus(layout.id)}
          title={`${layout.title}：${layout.description}`}
        >
          <span>{layout.eyebrow}</span>
          <strong>{layout.title}</strong>
          <small>{layout.description}</small>
        </button>
      ))}
    </div>
  );
}
function FloatingLabel({
  position,
  priority = "normal",
  tier = "detail",
  children,
}: {
  position: V3;
  priority?: "low" | "normal" | "high";
  tier?: LabelTier;
  children: ReactNode;
}) {
  const density = useSceneLabelDensity();
  if (CAMERA_LOCKED_LABELS) return null;
  if (density === "clean" || (density === "panorama" && tier === "detail")) return null;
  const zIndexRange: [number, number] = priority === "high" ? [36, 26] : priority === "low" ? [12, 2] : [24, 10];

  return (
    <Html position={position} center zIndexRange={zIndexRange} wrapperClass="scene-floating-label">
      {children}
    </Html>
  );
}

function CameraRig({
  view,
  preset,
  focusFrame,
  navigationFrame,
  navigationRequestId,
  onDistanceBandChange,
  onGestureStart,
  onGestureEnd,
}: {
  view: ViewKey;
  preset: CameraPreset;
  focusFrame: ModuleFocusFrame | null;
  navigationFrame: ModuleFocusFrame | null;
  navigationRequestId: number | null;
  onDistanceBandChange: (density: Exclude<LabelDensity, "clean">) => void;
  onGestureStart: () => void;
  onGestureEnd: (changed: boolean) => void;
}) {
  const scene = useEnhancedScene();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const transitionRef = useRef<null | {
    startedAt: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  }>(null);
  const densityRef = useRef<Exclude<LabelDensity, "clean">>("panorama");
  const gestureActiveRef = useRef(false);
  const gestureChangedRef = useRef(false);
  const { camera, invalidate, size } = useThree();
  const focused = Boolean(focusFrame);

  const reportDistanceBand = useCallback((target: THREE.Vector3) => {
    const distance = camera.position.distanceTo(target);
    const nextDensity = focused
      ? "detail"
      : densityRef.current === "detail"
        ? distance > 18.5 ? "panorama" : "detail"
        : distance < 16.2 ? "detail" : "panorama";
    if (nextDensity !== densityRef.current) {
      densityRef.current = nextDensity;
      onDistanceBandChange(nextDensity);
    }
  }, [camera, focused, onDistanceBandChange]);

  useEffect(() => {
    const routeViews = new Set(Object.keys(scene.routeNodeIds));
    const requestedNodeIds = new Set(scene.routeNodeIds[view] ?? []);
    const semanticViewNodeIds = scene.viewMembership.get(view);
    const hasSemanticView = Boolean(semanticViewNodeIds?.size);
    const visibleModules = scene.visuals.modules.filter((module) => (
      view === "overview"
      || requestedNodeIds.has(module.nodeId)
      || (!routeViews.has(view) && hasSemanticView && semanticViewNodeIds?.has(module.nodeId))
      || (!routeViews.has(view) && !hasSemanticView && module.detailGroup === view)
    ));
    const candidates = visibleModules.length > 0 ? visibleModules : scene.visuals.modules;
    const visibleNodeIds = new Set(candidates.map((module) => module.nodeId));
    const bounds = new THREE.Box3();
    candidates.forEach((module) => {
      const center = new THREE.Vector3(...module.position);
      const half = new THREE.Vector3(...module.size).multiplyScalar(0.5);
      bounds.expandByPoint(center.clone().sub(half));
      bounds.expandByPoint(center.clone().add(half));
    });
    scene.visuals.zones
      .filter((zone) => (
        view === "overview"
        || scene.macroZones[zone.id]?.nodeIds.some((nodeId) => visibleNodeIds.has(nodeId))
        || (!routeViews.has(view) && !hasSemanticView && zone.detailGroup === view)
      ))
      .forEach((zone) => {
        const center = new THREE.Vector3(...zone.position);
        const half = new THREE.Vector3(...zone.size).multiplyScalar(0.5);
        bounds.expandByPoint(center.clone().sub(half));
        bounds.expandByPoint(center.clone().add(half));
      });
    const derivedCenter = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const derivedSize = bounds.isEmpty() ? new THREE.Vector3(12, 8, 4) : bounds.getSize(new THREE.Vector3());
    const frame = focusFrame ?? navigationFrame ?? {
      center: [derivedCenter.x, derivedCenter.y, derivedCenter.z] as V3,
      size: [Math.max(derivedSize.x, 4), Math.max(derivedSize.y, 4), Math.max(derivedSize.z, 3)] as V3,
    };
    const mirror = view === "s2c" ? -1 : 1;
    const directions: Record<CameraPreset, THREE.Vector3> = {
      iso: new THREE.Vector3(0.52 * mirror, 0.32, 0.79),
      front: new THREE.Vector3(0, 0.04, 1),
      top: new THREE.Vector3(0.001, 0.84, 0.54),
      depth: new THREE.Vector3(0.93 * mirror, 0.14, 0.34),
    };
    const center = new THREE.Vector3(...frame.center);
    const direction = directions[preset].normalize();
    const verticalFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 40;
    const fitDistance = distanceToFitPerspectiveBox(
      frame.size,
      [direction.x, direction.y, direction.z],
      verticalFov,
      size.width / Math.max(1, size.height),
    );
    const targetPosition = center.clone().add(direction.multiplyScalar(fitDistance));
    const shouldFly = navigationFrame !== null && focusFrame === null && navigationRequestId !== null;
    camera.up.set(0, 1, 0);

    if (shouldFly) {
      transitionRef.current = {
        startedAt: performance.now(),
        fromPosition: camera.position.clone(),
        toPosition: targetPosition,
        fromTarget: controlsRef.current?.target.clone() ?? new THREE.Vector3(),
        toTarget: center,
      };
    } else {
      transitionRef.current = null;
      camera.position.copy(targetPosition);
      camera.lookAt(center);
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
      reportDistanceBand(center);
    }
    invalidate();
  }, [camera, focusFrame, invalidate, navigationFrame, navigationRequestId, preset, reportDistanceBand, scene, size.height, size.width, view]);

  useFrame(() => {
    const transition = transitionRef.current;
    if (!transition) return;
    const progress = clampNumber((performance.now() - transition.startedAt) / 520, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    const target = new THREE.Vector3().lerpVectors(transition.fromTarget, transition.toTarget, eased);
    camera.lookAt(target);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    reportDistanceBand(target);
    if (progress >= 1) transitionRef.current = null;
    else invalidate();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={focused ? 3.1 : 4.5}
      maxDistance={focused ? 18 : 120}
      maxPolarAngle={Math.PI * 0.62}
      onStart={() => {
        transitionRef.current = null;
        gestureActiveRef.current = true;
        gestureChangedRef.current = false;
        onGestureStart();
      }}
      onChange={() => {
        if (gestureActiveRef.current) gestureChangedRef.current = true;
        reportDistanceBand(controlsRef.current?.target ?? new THREE.Vector3());
        invalidate();
      }}
      onEnd={() => {
        const changed = gestureChangedRef.current;
        gestureActiveRef.current = false;
        gestureChangedRef.current = false;
        onGestureEnd(changed);
      }}
    />
  );
}

function DemandFlowLoop({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    if (!enabled) return;
    const timer = window.setInterval(() => invalidate(), 1000 / 28);
    return () => window.clearInterval(timer);
  }, [enabled, invalidate]);
  return null;
}

function PulsingBoxHalo({ size, radius = 0.08 }: { size: V3; radius?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const pulse = 0.5 + Math.sin(clock.elapsedTime * 2.15) * 0.5;
    if (groupRef.current) groupRef.current.scale.setScalar(1.018 + pulse * 0.022);
    if (materialRef.current) materialRef.current.opacity = 0.08 + pulse * 0.18;
  });
  return (
    <group ref={groupRef}>
      <RoundedBox args={size} radius={radius} smoothness={1}>
        <meshBasicMaterial ref={materialRef} color="#ffffff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
        <Edges scale={1.01} color="#ffffff" lineWidth={5.2} />
      </RoundedBox>
    </group>
  );
}

function PulsingSphereHalo({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const pulse = 0.5 + Math.sin(clock.elapsedTime * 2.15) * 0.5;
    if (meshRef.current) meshRef.current.scale.setScalar(1 + pulse * 0.22);
    if (materialRef.current) materialRef.current.opacity = 0.18 + pulse * 0.34;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 18, 18]} />
      <meshBasicMaterial ref={materialRef} color="#ffffff" transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function PulsingTubeHalo({ curve, radius }: { curve: THREE.CatmullRomCurve3; radius: number }) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const pulse = 0.5 + Math.sin(clock.elapsedTime * 2.15) * 0.5;
    if (materialRef.current) materialRef.current.opacity = 0.16 + pulse * 0.28;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 30, radius, 10, false]} />
      <meshBasicMaterial ref={materialRef} color="#ffffff" transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function LayerFrame({ title, position, size, color, showLabel, labelSide = "left" }: {
  title: string;
  position: V3;
  size: V3;
  color: string;
  showLabel: boolean;
  labelSide?: "left" | "right";
}) {
  const side = labelSide === "left" ? -1 : 1;
  const labelPosition: V3 = [side * (size[0] / 2 + 1.45), 0, size[2] / 2 + 0.32];
  const lineEnd: V3 = [side * (size[0] / 2 + 0.98), 0, size[2] / 2 + 0.18];
  return (
    <group position={position}>
      <RoundedBox args={size} radius={0.07} smoothness={1}>
        <meshStandardMaterial color={color} transparent opacity={0.1} depthWrite={false} roughness={0.72} />
        <Edges scale={1.006} color={color} lineWidth={0.8} />
      </RoundedBox>
      {showLabel && !CAMERA_LOCKED_LABELS && (
        <>
          <Line points={[[side * size[0] / 2, 0, size[2] / 2], lineEnd]} color={color} lineWidth={1} transparent opacity={0.7} />
          <FloatingLabel position={labelPosition} priority="low">
            <div className="scene-layer-label" style={accentStyle(color)}>
              <span>LAYER CONTAINER</span>
              <strong>{title}</strong>
            </div>
          </FloatingLabel>
        </>
      )}
    </group>
  );
}

function DepthGuide({ label, position, size, color, showLabel }: {
  label: string;
  position: V3;
  size: [number, number];
  color: string;
  showLabel: boolean;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[size[0], size[1], 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={showLabel ? 0.07 : 0.028} depthWrite={false} side={THREE.DoubleSide} />
        <Edges scale={1.002} color={color} lineWidth={showLabel ? 0.7 : 0.35} />
      </mesh>
      {showLabel && !CAMERA_LOCKED_LABELS && (
        <FloatingLabel position={[-size[0] / 2 + 1.05, size[1] / 2 + 0.2, 0.08]} priority="low">
          <div className="scene-depth-label" style={accentStyle(color)}>{label}</div>
        </FloatingLabel>
      )}
    </group>
  );
}

const functionColors: Record<FunctionInteraction["kind"], string> = {
  CALL: "#38bdf8",
  DATA: "#facc15",
  IRQ: "#f472b6",
  CONTROL: "#a78bfa",
};

function FunctionLink({ interaction, source, target, active, onSelect }: {
  interaction: FunctionInteraction;
  source: V3;
  target: V3;
  active: boolean;
  onSelect: () => void;
}) {
  const color = functionColors[interaction.kind];
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...source);
    const end = new THREE.Vector3(...target);
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.y += 0.12;
    midpoint.z = Math.max(start.z, end.z) + 0.12;
    return new THREE.CatmullRomCurve3([start, midpoint, end]);
  }, [source, target]);
  const arrow = useMemo(() => curve.getPointAt(0.72), [curve]);
  const rotation = useMemo(() => {
    const tangent = curve.getTangentAt(0.72).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  }, [curve]);
  return (
    <group>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <tubeGeometry args={[curve, 14, active ? 0.018 : 0.011, 5, false]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.98 : 0.5} depthWrite={false} />
      </mesh>
      <mesh position={arrow} quaternion={rotation}>
        <coneGeometry args={[active ? 0.045 : 0.032, active ? 0.1 : 0.075, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 1 : 0.65} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FunctionPoint({ position, title, note, color, selected, labelLift, onSelect }: {
  position: V3;
  title: string;
  note: string;
  color: string;
  selected: boolean;
  labelLift: number;
  onSelect: () => void;
}) {
  return (
    <group position={position}>
      {selected && <PulsingSphereHalo radius={0.118} />}
      <mesh scale={selected ? 1.25 : 1} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[selected ? 0.073 : 0.054, 12, 12]} />
        <meshStandardMaterial color={color} emissive={selected ? "#ffffff" : color} emissiveIntensity={selected ? 0.82 : 0.36} roughness={0.22} />
      </mesh>
      {selected && (
        <mesh><torusGeometry args={[0.1, 0.015, 8, 20]} /><meshBasicMaterial color="#ffffff" /></mesh>
      )}
      <Html
        position={[0, labelLift, 0.14]}
        center
        zIndexRange={selected ? [58, 48] : [46, 36]}
        wrapperClass="scene-function-name-anchor"
      >
        <button
          type="button"
          className={`scene-function-node-chip ${selected ? "selected" : ""}`}
          style={accentStyle(color)}
          title={`${title} · ${note}`}
          aria-label={`${title}: ${note}`}
          onClick={onSelect}
        >{title}</button>
      </Html>
    </group>
  );
}

function ModuleBlock({
  title,
  eyebrow,
  nodeIds,
  position,
  size,
  color,
  selectedId,
  activeIds,
  onNodeClick,
  onModuleFocus,
  onFunctionFocus,
  canActivateObject,
  showDetails,
  opacity = 1,
  farFadeStart = 42,
  farBlockOpacity = 0.22,
  focusMode = false,
  focusedFunctionIndex = 0,
  showModuleCard = true,
  labelOffset,
}: ModuleBlockProps) {
  const scene = useEnhancedScene();
  const { functionInteractions, macroZones, nodeById: nodeMap } = scene;
  const macroZoneByNodeId = useMemo(() => new Map<string, MacroZoneId>(
    Object.entries(macroZones).flatMap(([zoneId, definition]) => definition.nodeIds.map((nodeId) => [nodeId, zoneId])),
  ), [macroZones]);
  const nodes = nodesFor(nodeIds, nodeMap);
  const primary = nodes[0];
  const functions = nodes.flatMap((node) => (node.data.codeRefs ?? []).map((ref) => ({ nodeId: node.id, ref })));
  const interactions = primary ? functionInteractions[primary.id] ?? [] : [];
  const selected = nodeIds.includes(selectedId);
  const related = activeIds.size === 0 || nodeIds.some((id) => activeIds.has(id));
  const blockOpacity = focusMode || selected ? 1 : related ? 0.82 * opacity : 0.14;
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const zoneId = primary ? macroZoneByNodeId.get(primary.id) : undefined;
  const surfaceZ = size[2] / 2;
  const revealFunctions = focusMode || selected;
  const selectedFunction = focusMode ? focusedFunctionIndex : 0;
  const functionPositions: V3[] = (() => {
    const labelSpacing = focusMode ? 1.7 : size[0] >= 5 ? 1.15 : 0.85;
    const span = Math.min(size[0] * 0.86, Math.max(1.2, Math.max(0, functions.length - 1) * labelSpacing));
    return functions.map((_, index) => {
      const x = functions.length === 1 ? 0 : -span / 2 + (span * index) / (functions.length - 1);
      return [x, (index % 2 === 0 ? -1 : 1) * Math.min(size[1] * 0.2, 0.15), surfaceZ + 0.34 + (index % 3) * 0.22];
    });
  })();
  const externalLabel: V3 = labelOffset ?? [size[0] / 2 + 1.6, size[1] / 2 + 0.38, surfaceZ + 0.46];
  const leaderEnd: V3 = [externalLabel[0] > 0 ? externalLabel[0] - 0.55 : externalLabel[0] + 0.55, externalLabel[1], externalLabel[2] - 0.08];

  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    if (focusMode || selected || !zoneId) {
      materialRef.current.opacity = blockOpacity;
      materialRef.current.depthWrite = blockOpacity > 0.46;
      return;
    }
    const distance = macroZoneSurfaceDistance(camera.position, zoneId, macroZones);
    const farFactor = farVisibilityFactor(distance, farFadeStart);
    // Distance fading must never make an already-muted object brighter.
    const farTargetOpacity = Math.min(blockOpacity, farBlockOpacity);
    const effectiveOpacity = THREE.MathUtils.lerp(blockOpacity, farTargetOpacity, farFactor);
    materialRef.current.opacity = effectiveOpacity;
    materialRef.current.depthWrite = effectiveOpacity > 0.46;
  });

  const selectNode = () => {
    if (!primary) return;
    if (!canActivateObject()) return;
    if (onModuleFocus && !focusMode) onModuleFocus(primary.id);
    else onNodeClick(primary.id);
  };
  const activateLabel = () => {
    if (!primary) return;
    if (!canActivateObject()) return;
    if (onModuleFocus && !focusMode) onModuleFocus(primary.id);
    else onNodeClick(primary.id);
  };
  const selectFunction = (index: number, nodeId: string) => {
    if (!primary) return;
    if (!canActivateObject()) return;
    onNodeClick(nodeId);
    if (focusMode) onFunctionFocus?.(index);
    else onModuleFocus?.(primary.id);
  };

  if (!primary) return null;

  return (
    <group position={position}>
      {selected && <PulsingBoxHalo size={size} />}
      <RoundedBox
        args={size}
        radius={0.08}
        smoothness={1}
        onClick={(event) => { event.stopPropagation(); selectNode(); }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (canActivateObject()) onModuleFocus?.(primary.id);
        }}
      >
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={selected ? "#ffffff" : color}
          emissiveIntensity={selected ? 0.62 : related ? 0.12 : 0.01}
          transparent
          opacity={blockOpacity}
          roughness={selected ? 0.2 : 0.42}
          metalness={selected ? 0.18 : 0.1}
          depthWrite={blockOpacity > 0.46}
        />
        <Edges scale={1.008} color={selected ? "#ffffff" : color} lineWidth={selected ? 4.8 : 1.05} />
      </RoundedBox>

      {revealFunctions && (
        <group>
          {functions.map(({ nodeId, ref }, index) => (
            <Line
              key={`stem-${nodeId}-${ref.name}`}
              points={[[functionPositions[index][0], functionPositions[index][1], surfaceZ], functionPositions[index]]}
              color={color}
              lineWidth={selectedFunction === index ? 1.4 : 0.65}
              transparent
              opacity={selectedFunction === index ? 0.86 : 0.38}
            />
          ))}
          {interactions
            .filter((interaction) => interaction.source < functions.length && interaction.target < functions.length)
            .map((interaction) => (
              <FunctionLink
                key={`${interaction.source}-${interaction.target}-${interaction.label}`}
                interaction={interaction}
                source={functionPositions[interaction.source]}
                target={functionPositions[interaction.target]}
                active={selectedFunction === interaction.source || selectedFunction === interaction.target}
                onSelect={() => selectFunction(interaction.target, functions[interaction.target].nodeId)}
              />
            ))}
          {functions.map(({ nodeId, ref }, index) => (
            <FunctionPoint
              key={`${nodeId}-${ref.path}-${ref.name}`}
              position={functionPositions[index]}
              title={ref.name}
              note={ref.note}
              color={color}
              selected={selectedFunction === index}
              labelLift={0.18 + (index % 2) * 0.14}
              onSelect={() => selectFunction(index, nodeId)}
            />
          ))}
        </group>
      )}

      {!CAMERA_LOCKED_LABELS && showModuleCard && (showDetails || selected) && (
        <>
          <Line points={[[0, size[1] / 2, surfaceZ], leaderEnd]} color={color} lineWidth={selected ? 1.5 : 0.8} transparent opacity={0.72} />
          <FloatingLabel position={externalLabel} priority={selected ? "high" : "normal"}>
            <button
              type="button"
              className={`scene-node-label wide ${selected ? "selected" : ""}`}
              style={accentStyle(color)}
              onClick={activateLabel}
            >
              <span>{eyebrow}</span>
              <strong>{title}</strong>
              <small>{functions.length} FUNC / RTL · 3D DEPTH · {interactions.length} LINKS</small>
            </button>
          </FloatingLabel>
        </>
      )}
    </group>
  );
}

function SystemShell({ nodeId, title, subtitle, summary, position, size, color, opacity, labelPosition, onNodeClick }: {
  nodeId: string;
  title: string;
  subtitle: string;
  summary: string[];
  position: V3;
  size: V3;
  color: string;
  opacity: number;
  labelPosition: V3;
  onNodeClick: (id: string) => void;
}) {
  const side = labelPosition[0] < 0 ? -1 : 1;
  const localAnchor: V3 = [side * size[0] / 2, 0, size[2] / 2];
  const leaderEnd: V3 = [labelPosition[0] - position[0] - side * 0.9, labelPosition[1] - position[1], labelPosition[2] - position[2] - 0.08];
  return (
    <group position={position}>
      <RoundedBox args={size} radius={0.14} smoothness={1} onClick={(event) => { event.stopPropagation(); onNodeClick(nodeId); }}>
        <meshStandardMaterial color={color} transparent opacity={0.16 * opacity} roughness={0.62} metalness={0.06} depthWrite={false} />
        <Edges scale={1.006} color={color} lineWidth={1.7} />
      </RoundedBox>
      {!CAMERA_LOCKED_LABELS && (
        <>
          <Line points={[localAnchor, leaderEnd]} color={color} lineWidth={1.2} transparent opacity={0.72} />
          <FloatingLabel
            position={[labelPosition[0] - position[0], labelPosition[1] - position[1], labelPosition[2] - position[2]]}
            tier="system"
            priority="high"
          >
            <button type="button" className="scene-system-label" style={accentStyle(color)} onClick={() => onNodeClick(nodeId)}>
              <span>{subtitle}</span>
              <strong>{title}</strong>
              <span className="scene-system-summary">{summary.map((item) => <em key={item}>{item}</em>)}</span>
            </button>
          </FloatingLabel>
        </>
      )}
    </group>
  );
}

function MacroZoneShell({ nodeId, zoneId, eyebrow, title, summary, position, size, color, opacity, subLabelDistance, subLabelFadeRange, farFadeStart, farBlockOpacity, onNodeClick }: {
  nodeId: string;
  zoneId: MacroZoneId;
  eyebrow: string;
  title: string;
  summary: string;
  position: V3;
  size: V3;
  color: string;
  opacity: number;
  subLabelDistance: number;
  subLabelFadeRange: number;
  farFadeStart: number;
  farBlockOpacity: number;
  onNodeClick: (id: string) => void;
}) {
  const { macroZones } = useEnhancedScene();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [lod, setLod] = useState<0 | 1 | 2>(0);
  const labelY = size[1] / 2 + 0.9;
  useFrame(({ camera }) => {
    const distance = macroZoneSurfaceDistance(camera.position, zoneId, macroZones);
    const nextLod: 0 | 1 | 2 = distance >= subLabelDistance
      ? 0
      : distance >= Math.max(0, subLabelDistance - subLabelFadeRange)
        ? 1
        : 2;
    if (nextLod !== lod) setLod(nextLod);
    if (materialRef.current) {
      const nearOpacity = 0.26 * opacity;
      const farFactor = farVisibilityFactor(distance, farFadeStart);
      const farTargetOpacity = Math.min(nearOpacity, farBlockOpacity);
      materialRef.current.opacity = THREE.MathUtils.lerp(nearOpacity, farTargetOpacity, farFactor);
      materialRef.current.depthWrite = materialRef.current.opacity >= 0.36;
    }
  });
  return (
    <group position={position}>
      <RoundedBox args={size} radius={0.18} smoothness={1} onClick={(event) => { event.stopPropagation(); onNodeClick(nodeId); }}>
        <meshStandardMaterial ref={materialRef} color={color} transparent opacity={farBlockOpacity} roughness={0.68} depthWrite={false} />
        <Edges scale={1.007} color={color} lineWidth={2.4} />
      </RoundedBox>
      <Line points={[[0, size[1] / 2, size[2] / 2], [0, labelY - 0.24, 1.08]]} color={color} lineWidth={2.2} transparent opacity={0.86} />
      <Html position={[0, labelY, 1.16]} center zIndexRange={[86, 72]} wrapperClass="scene-macro-zone-label-anchor">
        <button type="button" className={`scene-macro-zone-label lod-${lod}`} style={accentStyle(color)} onClick={(event) => { event.stopPropagation(); onNodeClick(nodeId); }}>
          {lod >= 1 && <span>{eyebrow}</span>}
          <strong>{title}</strong>
          {lod >= 2 && <small>{summary}</small>}
        </button>
      </Html>
    </group>
  );
}

function DeclarativeTopology({
  view,
  selectedId,
  activeIds,
  onNodeClick,
  onModuleFocus,
  canActivateObject,
  subLabelDistance,
  subLabelFadeRange,
  farFadeStart,
  farBlockOpacity,
}: {
  view: ViewKey;
  selectedId: string;
  activeIds: Set<string>;
  onNodeClick: (id: string) => void;
  onModuleFocus: (id: string) => void;
  canActivateObject: () => boolean;
  subLabelDistance: number;
  subLabelFadeRange: number;
  farFadeStart: number;
  farBlockOpacity: number;
}) {
  const scene = useEnhancedScene();
  const routeViews = useMemo(() => new Set(Object.keys(scene.routeNodeIds)), [scene.routeNodeIds]);
  const semanticViewNodeIds = scene.viewMembership.get(view);
  const hasSemanticView = Boolean(semanticViewNodeIds?.size) && !routeViews.has(view);
  const zoneHasSemanticMember = (zoneId: string) => (
    scene.macroZones[zoneId]?.nodeIds.some((nodeId) => semanticViewNodeIds?.has(nodeId)) ?? false
  );
  const zoneOpacityFor = (zoneId: string, detailGroup: string) => hasSemanticView
    ? zoneHasSemanticMember(zoneId) ? 1 : 0.1
    : zoneOpacity(view, detailGroup, routeViews);
  const moduleOpacityFor = (nodeId: string, detailGroup: string) => hasSemanticView
    ? semanticViewNodeIds?.has(nodeId) ? 1 : 0.1
    : zoneOpacity(view, detailGroup, routeViews);
  const detailsFor = (nodeId: string, detailGroup: string) => hasSemanticView
    ? Boolean(semanticViewNodeIds?.has(nodeId))
    : view === "overview" || routeViews.has(view) || view === detailGroup;
  return (
    <group>
      {scene.visuals.zones.map((zone) => {
        const opacity = zoneOpacityFor(zone.id, zone.detailGroup);
        return (
          <group key={zone.id}>
            <RoundedBox args={zone.size} radius={0.14} smoothness={1} position={zone.position}>
              <meshStandardMaterial color={zone.color} transparent opacity={0.12 * opacity} roughness={0.72} depthWrite={false} />
              <Edges scale={1.006} color={zone.color} lineWidth={1.5} />
            </RoundedBox>
            <MacroZoneShell
              nodeId={zone.anchorNodeId}
              zoneId={zone.id}
              eyebrow={zone.eyebrow}
              title={zone.title}
              summary={zone.summary}
              position={zone.position}
              size={zone.size}
              color={zone.color}
              opacity={opacity}
              subLabelDistance={subLabelDistance}
              subLabelFadeRange={subLabelFadeRange}
              farFadeStart={farFadeStart}
              farBlockOpacity={farBlockOpacity}
              onNodeClick={onNodeClick}
            />
          </group>
        );
      })}
      {scene.visuals.layers.map((layer) => (
        <LayerFrame key={layer.id} title={layer.title} position={layer.position} size={layer.size} color={layer.color} showLabel={!hasSemanticView && detailsFor("", layer.detailGroup)} />
      ))}
      {scene.visuals.depths.map((depth) => (
        <DepthGuide key={depth.id} label={depth.label} position={depth.position} size={depth.size} color={depth.color} showLabel={!hasSemanticView && detailsFor("", depth.detailGroup)} />
      ))}
      {scene.visuals.modules.map((module) => (
        <ModuleBlock
          key={module.nodeId}
          title={module.title}
          eyebrow={module.eyebrow}
          nodeIds={[module.nodeId]}
          position={module.position}
          size={module.size}
          color={module.color}
          labelOffset={module.labelOffset}
          selectedId={selectedId}
          activeIds={activeIds}
          onNodeClick={onNodeClick}
          onModuleFocus={onModuleFocus}
          canActivateObject={canActivateObject}
          showDetails={detailsFor(module.nodeId, module.detailGroup)}
          opacity={moduleOpacityFor(module.nodeId, module.detailGroup)}
          farFadeStart={farFadeStart}
          farBlockOpacity={farBlockOpacity}
        />
      ))}
    </group>
  );
}

function FlowPulse({ curve, color, speed, phaseOffset, selected, lineThickness, farFadeStart, farFlowOpacity, baseOpacity }: {
  curve: THREE.CatmullRomCurve3;
  color: string;
  speed: number;
  phaseOffset: number;
  selected: boolean;
  lineThickness: number;
  farFadeStart: number;
  farFlowOpacity: number;
  baseOpacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const curveMidpoint = useMemo(() => curve.getPointAt(0.5), [curve]);
  useFrame(({ camera, clock }) => {
    if (!ref.current) return;
    const point = curve.getPointAt((clock.elapsedTime * speed + phaseOffset) % 1);
    ref.current.position.copy(point);
    if (materialRef.current) {
      const distance = Math.max(0, camera.position.distanceTo(curveMidpoint) - 4);
      const farFactor = farVisibilityFactor(distance, farFadeStart);
      materialRef.current.opacity = selected
        ? 1
        : THREE.MathUtils.lerp(baseOpacity, Math.min(baseOpacity, farFlowOpacity), farFactor);
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[(selected ? 0.075 : 0.052) * Math.min(3.4, 0.75 + lineThickness * 0.45), 12, 12]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={baseOpacity} depthWrite={false} />
    </mesh>
  );
}

function Pipe3D({ edgeId, points, selectedId, activeIds, enabledEdgeKinds, flowEnabled, lineThickness, farFadeStart, farFlowOpacity, onEdgeClick, showLabel }: {
  edgeId: string;
  points: V3[];
  selectedId: string;
  activeIds: Set<string>;
  enabledEdgeKinds: ReadonlySet<EdgeKind>;
  flowEnabled: boolean;
  lineThickness: number;
  farFadeStart: number;
  farFlowOpacity: number;
  onEdgeClick: (id: string) => void;
  showLabel: boolean;
}) {
  const { edgeById: edgeMap, laneMeta } = useEnhancedScene();
  const edge = edgeMap.get(edgeId);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), [points]);
  const tubeMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const arrowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const curveMidpoint = useMemo(() => curve.getPointAt(0.5), [curve]);
  const selected = selectedId === edgeId;
  const related = !edge || activeIds.size === 0 || activeIds.has(edgeId) || activeIds.has(edge.source) || activeIds.has(edge.target);
  const baseOpacity = selected ? 1 : related ? 0.78 : 0.1;
  useFrame(({ camera }) => {
    if (!edge) return;
    const distance = Math.max(0, camera.position.distanceTo(curveMidpoint) - 4);
    const farFactor = farVisibilityFactor(distance, farFadeStart);
    const farTarget = selected ? 1 : Math.min(baseOpacity, farFlowOpacity);
    const effectiveOpacity = THREE.MathUtils.lerp(baseOpacity, farTarget, farFactor);
    if (tubeMaterialRef.current) tubeMaterialRef.current.opacity = effectiveOpacity;
    if (arrowMaterialRef.current) arrowMaterialRef.current.opacity = effectiveOpacity;
  });
  if (!edge || !enabledEdgeKinds.has(edge.data.kind)) return null;
  const color = laneMeta[edge.data.lane]?.color ?? edge.fill ?? "#4d8edb";
  const opacity = baseOpacity;
  const arrowPoint = curve.getPointAt(0.76);
  const tangent = curve.getTangentAt(0.76).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  const midpoint = curve.getPointAt(0.52);
  const laneIndex = Math.max(0, Object.keys(laneMeta).indexOf(edge.data.lane));
  const labelSide = laneIndex % 2 === 0 ? -1 : 1;
  const labelAnchor: V3 = [midpoint.x + labelSide * 1.45, midpoint.y + 0.08, midpoint.z + 0.5];
  const tubeRadius = (selected ? 0.055 : 0.034) * lineThickness;
  const arrowScale = Math.min(3.8, Math.max(1, lineThickness * 0.75));

  return (
    <group>
      {selected && <PulsingTubeHalo curve={curve} radius={tubeRadius * 1.72} />}
      <mesh onClick={(event) => { event.stopPropagation(); onEdgeClick(edgeId); }}>
        <tubeGeometry args={[curve, 24, tubeRadius, 8, false]} />
        <meshBasicMaterial ref={tubeMaterialRef} color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={arrowPoint} quaternion={rotation}>
        <coneGeometry args={[(selected ? 0.07 : 0.046) * arrowScale, (selected ? 0.16 : 0.11) * arrowScale, 9]} />
        <meshBasicMaterial ref={arrowMaterialRef} color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {flowEnabled && related && <FlowPulse curve={curve} color={color} speed={0.16} phaseOffset={(edgeId.length % 9) / 10} selected={selected} lineThickness={lineThickness} farFadeStart={farFadeStart} farFlowOpacity={farFlowOpacity} baseOpacity={baseOpacity} />}
      {!CAMERA_LOCKED_LABELS && (showLabel || selected) && (
        <>
          <Line points={[[midpoint.x, midpoint.y, midpoint.z], labelAnchor]} color={color} lineWidth={selected ? 1.5 : 0.75} transparent opacity={0.72} />
          <FloatingLabel position={labelAnchor} priority={selected ? "high" : "low"}>
            <button type="button" className={`scene-pipe-label ${selected ? "selected" : ""}`} style={accentStyle(color)} onClick={() => onEdgeClick(edgeId)}>
              <i /><span>{edge.data.protocol}</span><small>{edge.data.lane}</small>
            </button>
          </FloatingLabel>
        </>
      )}
    </group>
  );
}

function edgePoints(edgeId: string, lineThickness: number, scene: EnhancedSceneRuntime): V3[] {
  const { edgeById: edgeMap, nodePositions } = scene;
  const edge = edgeMap.get(edgeId);
  if (!edge) return [[0, 0, 0], [0, 0, 0]];
  const source = nodePositions[edge.source];
  const target = nodePositions[edge.target];
  const laneSpacing = 0.15 + Math.min(lineThickness, 6) * 0.045;
  const laneIds = Object.keys(scene.laneMeta);
  const laneIndex = Math.max(0, laneIds.indexOf(edge.data.lane));
  const laneOffset = (laneIndex - (laneIds.length - 1) / 2) * laneSpacing;
  const start: V3 = [source[0], source[1] + laneOffset, source[2] + 0.22];
  const end: V3 = [target[0], target[1] + laneOffset, target[2] + 0.22];
  const horizontalDistance = Math.abs(start[0] - end[0]);
  if (horizontalDistance > 4) {
    const lift = Math.max(start[2], end[2]) + Math.min(1.8, 0.55 + horizontalDistance * 0.055);
    return [
      start,
      [start[0] + (end[0] - start[0]) * 0.34, start[1], lift],
      [start[0] + (end[0] - start[0]) * 0.66, end[1], lift],
      end,
    ];
  }
  const midpoint: V3 = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    Math.max(start[2], end[2]) + (Math.abs(start[1] - end[1]) > 1 ? 0.32 : 0.14),
  ];
  return [start, midpoint, end];
}

function DirectionCard({ lane, position, origin, selected, onClick }: {
  lane: FlowLane;
  position: V3;
  origin: V3;
  selected: boolean;
  onClick: () => void;
}) {
  const { laneMeta } = useEnhancedScene();
  const meta = laneMeta[lane] ?? { color: "#4d8edb", label: lane, summary: lane };
  if (CAMERA_LOCKED_LABELS) return null;
  const lineEnd: V3 = [position[0] + (position[0] < 0 ? 0.9 : -0.9), position[1] - 0.15, position[2] - 0.1];
  return (
    <group>
      <Line points={[origin, lineEnd]} color={meta.color} lineWidth={selected ? 1.8 : 1.05} transparent opacity={0.82} />
      <FloatingLabel position={position} priority={selected ? "high" : "normal"} tier="system">
        <button type="button" className={`scene-pcie-link-card direction-card ${selected ? "selected" : ""}`} style={accentStyle(meta.color)} onClick={onClick}>
          <span>ENGINEERING TRANSACTION PATH</span>
          <strong>{meta.label}</strong>
          <span className="scene-pcie-link-lanes"><em><b>→</b>{meta.summary}</em><em><b>3D</b>SCENE</em></span>
          <small>{meta.summary}</small>
        </button>
      </FloatingLabel>
    </group>
  );
}

const contextLaneColors = ["#22a7cf", "#218c83", "#168f7b", "#8064c8", "#6869bd", "#e84855", "#f29a1f", "#3abc9c"];

function buildContextLaneMeta(journey: DriverJourney) {
  const laneIds = [...new Set(journey.steps.map((step) => step.contextLane))];
  const top = 2.55;
  const bottom = -2.35;
  return Object.fromEntries(laneIds.map((lane, index) => [lane, {
    label: lane.replaceAll("_", " "),
    y: laneIds.length === 1 ? 0 : top + ((bottom - top) * index) / (laneIds.length - 1),
    color: contextLaneColors[index % contextLaneColors.length],
  }])) as Record<string, { label: string; y: number; color: string }>;
}

function journeyLayerZ(layer: DriverCausalLayer, layerIds: string[]) {
  const index = Math.max(0, layerIds.indexOf(layer));
  return 0.48 + index * 0.74;
}

function JourneyFlowToken({ curve, color, phase }: { curve: THREE.CatmullRomCurve3; color: string; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.copy(curve.getPointAt((clock.elapsedTime * 0.1 + phase) % 1));
  });
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[0.092, 14, 14]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.78} depthWrite={false} /></mesh>
      <mesh><sphereGeometry args={[0.058, 14, 14]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}

function JourneyEdge3D({
  edge,
  source,
  target,
  journey,
  selected,
  flowEnabled,
  onSelect,
}: {
  edge: DriverJourneyEdge;
  source: V3;
  target: V3;
  journey: DriverJourney;
  selected: boolean;
  flowEnabled: boolean;
  onSelect: () => void;
}) {
  const { driverJourneyRelationMeta } = useEnhancedScene();
  const meta = driverJourneyRelationMeta[edge.relation] ?? { color: "#708090", label: edge.relation, dashed: false };
  const color = edge.relation === "PAYLOAD"
    ? journey.id === "receive" ? "#13a681" : "#2f83e7"
    : meta.color;
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...source);
    const end = new THREE.Vector3(...target);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += Math.abs(end.y - start.y) > 1.2 ? 0.22 : 0.08;
    middle.z = Math.max(start.z, end.z) + 0.18;
    return new THREE.CatmullRomCurve3([start, middle, end]);
  }, [source, target]);
  const points = useMemo(() => curve.getPoints(28).map((point) => [point.x, point.y, point.z] as V3), [curve]);
  const arrowPoint = curve.getPointAt(0.82);
  const tangent = curve.getTangentAt(0.82).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  const lineWidth = edge.relation === "PAYLOAD" ? 6.2 : edge.relation === "IRQ" ? 4.6 : edge.relation === "MMIO" ? 3.8 : 2.2;
  return (
    <group>
      {selected && <Line points={points} color="#ffffff" lineWidth={lineWidth + 6} transparent opacity={0.78} />}
      <Line
        points={points}
        color={color}
        lineWidth={selected ? lineWidth + 1.8 : lineWidth}
        transparent
        opacity={selected ? 1 : 0.9}
        dashed={meta.dashed}
        dashSize={0.15}
        gapSize={0.1}
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
      />
      <mesh position={arrowPoint} quaternion={rotation}>
        <coneGeometry args={[selected ? 0.095 : 0.068, selected ? 0.22 : 0.16, 9]} />
        <meshBasicMaterial color={selected ? "#ffffff" : color} />
      </mesh>
      {flowEnabled && edge.relation === "PAYLOAD" && <JourneyFlowToken curve={curve} color={color} phase={(edge.source.length % 7) / 8} />}
      <Html position={curve.getPointAt(0.5)} center zIndexRange={selected ? [62, 52] : [38, 28]} wrapperClass="journey-edge-label-anchor">
        <button type="button" className={`journey-edge-label ${selected ? "selected" : ""}`} style={accentStyle(color)} onClick={onSelect}>
          <b>{edge.relation}</b><span>{edge.label}</span>
        </button>
      </Html>
    </group>
  );
}

function JourneyStepGeometry({ step, color, opacity }: { step: DriverJourneyStep; color: string; opacity: number }) {
  const material = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.46} transparent opacity={opacity} roughness={0.28} metalness={0.12} depthWrite={opacity > 0.7} />;
  if (step.kind === "function") {
    return <mesh><sphereGeometry args={[0.18, 18, 18]} />{material}</mesh>;
  }
  if (step.kind === "state") {
    return <mesh><octahedronGeometry args={[0.2, 0]} />{material}</mesh>;
  }
  if (step.kind === "event") {
    return <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.16, 18]} />{material}</mesh>;
  }
  if (step.kind === "completion") {
    return <mesh><torusGeometry args={[0.16, 0.052, 10, 22]} />{material}</mesh>;
  }
  const size: V3 = step.kind === "hardware" ? [0.58, 0.34, 0.3] : [0.7, 0.3, 0.26];
  return (
    <RoundedBox args={size} radius={0.055} smoothness={1}>
      {material}
      <Edges scale={1.006} color={color} lineWidth={1.5} />
    </RoundedBox>
  );
}

function JourneyStepNode({
  step,
  position,
  index,
  focusedRole,
  selected,
  onSelect,
}: {
  step: DriverJourneyStep;
  position: V3;
  index: number;
  focusedRole: DriverModuleRole;
  selected: boolean;
  onSelect: () => void;
}) {
  const { driverCausalLayerMeta } = useEnhancedScene();
  const primaryLayer = step.layers[0];
  const color = driverCausalLayerMeta[primaryLayer]?.color ?? "#4d8edb";
  const activeModule = step.moduleRole === focusedRole;
  const opacity = selected ? 1 : activeModule ? 0.98 : 0.62;
  const labelLift = 0.49 + (index % 3) * 0.13;
  const haloSize: V3 = step.kind === "hardware" ? [0.72, 0.46, 0.42] : [0.5, 0.5, 0.5];
  return (
    <group position={position}>
      {selected && (step.kind === "function" || step.kind === "state" || step.kind === "event" || step.kind === "completion"
        ? <PulsingSphereHalo radius={0.29} />
        : <PulsingBoxHalo size={haloSize} radius={0.06} />)}
      <group onClick={(event) => { event.stopPropagation(); onSelect(); }} scale={selected ? 1.22 : activeModule ? 1.08 : 1}>
        <JourneyStepGeometry step={step} color={color} opacity={opacity} />
      </group>
      <Line points={[[0, 0.2, 0.08], [0, labelLift - 0.1, 0.18]]} color={selected ? "#ffffff" : color} lineWidth={selected ? 3.8 : 1.8} transparent opacity={selected ? 1 : 0.78} />
      <Html position={[0, labelLift, 0.2]} center zIndexRange={selected ? [72, 62] : [52, 42]} wrapperClass="journey-step-label-anchor">
        <button
          type="button"
          className={`journey-step-chip ${selected ? "selected" : ""} ${activeModule ? "active-module" : "context-module"}`}
          style={accentStyle(color)}
          onClick={onSelect}
          title={step.title}
        >
          <span>{step.moduleRole.replaceAll("_", " ")} · {step.evidence}</span>
          <strong>{step.shortTitle}</strong>
        </button>
      </Html>
    </group>
  );
}

function JourneyLayerPlane({ layer, width }: { layer: DriverCausalLayer; width: number }) {
  const { driverCausalLayerMeta } = useEnhancedScene();
  const layerIds = Object.keys(driverCausalLayerMeta);
  const meta = driverCausalLayerMeta[layer] ?? { color: "#4d8edb", short: layer, label: layer, description: layer };
  const z = journeyLayerZ(layer, layerIds);
  return (
    <group position={[0, 0, z]}>
      <mesh>
        <boxGeometry args={[width + 0.5, 5.8, 0.025]} />
        <meshBasicMaterial color={meta.color} transparent opacity={0.045} depthWrite={false} side={THREE.DoubleSide} />
        <Edges scale={1.002} color={meta.color} lineWidth={0.7} />
      </mesh>
      <Html position={[width / 2 - 0.75, 2.72, 0.06]} center zIndexRange={[26, 18]} wrapperClass="journey-layer-label-anchor">
        <div className="journey-layer-label" style={accentStyle(meta.color)}><b>{meta.short}</b><span>{meta.label}</span></div>
      </Html>
    </group>
  );
}

function DriverJourneyStage({
  journey,
  focusedRole,
  enabledLayers,
  selectedStepId,
  flowEnabled,
  onStepFocus,
  canActivateObject,
}: {
  journey: DriverJourney;
  focusedRole: DriverModuleRole;
  enabledLayers: ReadonlySet<DriverCausalLayer>;
  selectedStepId: string;
  flowEnabled: boolean;
  onStepFocus: (id: string) => void;
  canActivateObject: () => boolean;
}) {
  const { driverCausalLayerMeta } = useEnhancedScene();
  const driverContextLaneMeta = useMemo(() => buildContextLaneMeta(journey), [journey]);
  const layerIds = useMemo(() => Object.keys(driverCausalLayerMeta), [driverCausalLayerMeta]);
  const { moduleWidth: width } = journeyFocusFrame(journey.steps.length);
  const visibleSteps = journey.steps.filter((step) => step.layers.some((layer) => enabledLayers.has(layer)));
  const positions = useMemo(() => {
    const result = new Map<string, V3>();
    const span = width - 1.5;
    journey.steps.forEach((step, index) => {
      const x = journey.steps.length === 1 ? 0 : -span / 2 + (span * index) / (journey.steps.length - 1);
      const activeLayer = step.layers.find((layer) => enabledLayers.has(layer)) ?? step.layers[0];
      result.set(step.id, [x, driverContextLaneMeta[step.contextLane]?.y ?? 0, journeyLayerZ(activeLayer, layerIds)]);
    });
    return result;
  }, [driverContextLaneMeta, enabledLayers, journey.steps, layerIds, width]);
  const visibleStepIds = new Set(visibleSteps.map((step) => step.id));
  const usedLanes = Object.keys(driverContextLaneMeta)
    .filter((lane) => visibleSteps.some((step) => step.contextLane === lane));
  const activate = (id: string) => {
    if (canActivateObject()) onStepFocus(id);
  };
  return (
    <group>
      {([...enabledLayers] as DriverCausalLayer[]).map((layer) => <JourneyLayerPlane key={layer} layer={layer} width={width} />)}
      {usedLanes.map((lane) => {
        const meta = driverContextLaneMeta[lane];
        return (
          <group key={lane}>
            <Line points={[[-width / 2, meta.y, 0.16], [width / 2, meta.y, 0.16]]} color={meta.color} lineWidth={1.1} transparent opacity={0.28} />
            <Html position={[-width / 2 - 0.62, meta.y, 0.2]} center zIndexRange={[34, 24]} wrapperClass="journey-context-label-anchor">
              <div className="journey-context-label" style={accentStyle(meta.color)}>{meta.label}</div>
            </Html>
          </group>
        );
      })}
      {journey.edges
        .filter((edge) => enabledLayers.has(edge.layer) && visibleStepIds.has(edge.source) && visibleStepIds.has(edge.target))
        .map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          return (
            <JourneyEdge3D
              key={`${journey.id}-${edge.source}-${edge.target}-${edge.relation}`}
              edge={edge}
              source={source}
              target={target}
              journey={journey}
              selected={selectedStepId === edge.source || selectedStepId === edge.target}
              flowEnabled={flowEnabled}
              onSelect={() => activate(edge.target)}
            />
          );
        })}
      {visibleSteps.map((step) => (
        <JourneyStepNode
          key={`${journey.id}-${step.id}`}
          step={step}
          position={positions.get(step.id)!}
          index={journey.steps.findIndex((candidate) => candidate.id === step.id)}
          focusedRole={focusedRole}
          selected={selectedStepId === step.id}
          onSelect={() => activate(step.id)}
        />
      ))}
      <Grid position={[0, -3.1, 0]} args={[width + 3, 8]} cellSize={0.65} cellThickness={0.3} cellColor="#b5c7d5" sectionSize={2.6} sectionThickness={0.62} sectionColor="#7d9aaf" fadeDistance={22} fadeStrength={1} infiniteGrid={false} />
    </group>
  );
}

function FocusedModuleStage({ moduleId, selectedId, focusedFunctionIndex, focusedJourneyId, enabledCausalLayers, focusedJourneyStepId, flowEnabled, onNodeClick, onFunctionFocus, onJourneyStepFocus, canActivateObject }: {
  moduleId: string;
  selectedId: string;
  focusedFunctionIndex: number;
  focusedJourneyId: DriverJourneyId;
  enabledCausalLayers: ReadonlySet<DriverCausalLayer>;
  focusedJourneyStepId: string;
  flowEnabled: boolean;
  onNodeClick: (id: string) => void;
  onFunctionFocus: (index: number) => void;
  onJourneyStepFocus: (id: string) => void;
  canActivateObject: () => boolean;
}) {
  const scene = useEnhancedScene();
  const { driverJourneyModuleRoleByNodeId, driverJourneys, focusModuleGroups, nodeById: nodeMap, planeMeta } = scene;
  const focusedRole = driverJourneyModuleRoleByNodeId[moduleId];
  const focusedJourney = driverJourneys[focusedJourneyId];
  if (focusedRole && focusedJourney) {
    return (
      <DriverJourneyStage
        journey={focusedJourney}
        focusedRole={focusedRole}
        enabledLayers={enabledCausalLayers}
        selectedStepId={focusedJourneyStepId}
        flowEnabled={flowEnabled}
        onStepFocus={onJourneyStepFocus}
        canActivateObject={canActivateObject}
      />
    );
  }
  const nodeIds = focusModuleGroups[moduleId] ?? [moduleId];
  const nodes = nodesFor(nodeIds, nodeMap);
  const primary = nodes[0];
  const functionCount = nodes.reduce((count, node) => count + (node.data.codeRefs?.length ?? 0), 0);
  const activeIds = new Set(nodeIds);
  if (!primary) return null;
  const { moduleWidth: width } = moduleFocusFrame(functionCount);
  const color = planeMeta[primary.data.plane]?.color ?? "#4d8edb";
  return (
    <group>
      <DepthGuide label="" position={[0, 0, 0.72]} size={[width + 0.9, 3]} color={color} showLabel={false} />
      <DepthGuide label="" position={[0, 0, 1.5]} size={[width + 0.6, 2.72]} color={color} showLabel={false} />
      <DepthGuide label="" position={[0, 0, 2.28]} size={[width + 0.3, 2.44]} color={color} showLabel={false} />
      <ModuleBlock
        title={primary.data.title}
        eyebrow={`${primary.data.layer} · ISOLATED MODULE`}
        nodeIds={nodeIds}
        position={[0, 0, 0.25]}
        size={[width, 2.15, 0.72]}
        color={color}
        selectedId={selectedId}
        activeIds={activeIds}
        onNodeClick={onNodeClick}
        onFunctionFocus={onFunctionFocus}
        canActivateObject={canActivateObject}
        showDetails
        focusMode
        focusedFunctionIndex={focusedFunctionIndex}
        showModuleCard={false}
      />
      <Grid position={[0, -1.6, 0]} args={[14, 9]} cellSize={0.6} cellThickness={0.3} cellColor="#b5c7d5" sectionSize={2.4} sectionThickness={0.62} sectionColor="#7d9aaf" fadeDistance={17} fadeStrength={1} infiniteGrid={false} />
    </group>
  );
}

function CameraHudOverlay({ view, selectedId, lineThickness, hudDistance, density }: {
  view: ViewKey;
  selectedId: string;
  lineThickness: number;
  hudDistance: number;
  density: Exclude<LabelDensity, "clean">;
}) {
  const { cameraHudViews: cameraHudViews, edgeById: edgeMap, laneMeta, nodeById: nodeMap, planeMeta } = useEnhancedScene();
  const selectedNode = nodeMap.get(selectedId);
  const selectedEdge = edgeMap.get(selectedId);
  const viewMeta = cameraHudViews[view] ?? cameraHudViews.overview ?? { eyebrow: view, title: view, detail: "" };
  const functions = selectedNode?.data.codeRefs ?? [];
  const hudScale = Math.max(0.82, Math.min(1.18, 1.18 - (hudDistance - 0.6) * 0.2));
  const hudStyle = {
    "--hud-scale": hudScale,
    "--hud-opacity": Math.max(0.78, 1.02 - (hudDistance - 0.6) * 0.08),
  } as CSSProperties;

  return (
    <div className={`camera-hud-overlay hud-${density}`} style={hudStyle} aria-label={tr("固定在摄像机视野中的架构标签")}>
      <i className="camera-hud-corner corner-tl" /><i className="camera-hud-corner corner-tr" />
      <i className="camera-hud-corner corner-bl" /><i className="camera-hud-corner corner-br" />

      <section className="camera-hud-card camera-hud-context">
        <span>{viewMeta.eyebrow}</span>
        <strong>{viewMeta.title}</strong>
        <p>{viewMeta.detail}</p>
        <div className="camera-hud-lanes">
          {Object.values(laneMeta).slice(0, 3).map((lane) => <em key={lane.label}>{lane.label}</em>)}
        </div>
      </section>

      <section className={`camera-hud-card camera-hud-selection ${selectedNode || selectedEdge ? "has-selection" : "empty"}`}>
        <span>{selectedNode ? `${planeMeta[selectedNode.data.plane]?.short ?? selectedNode.data.plane} · ${selectedNode.data.layer}` : selectedEdge ? `${selectedEdge.data.lane} · ${selectedEdge.data.kind}` : "SELECTION HUD"}</span>
        <strong>{selectedNode?.data.title ?? selectedEdge?.data.protocol ?? tr("短点一个模块或主管道")}</strong>
        <p>{selectedNode?.data.description ?? selectedEdge?.data.description ?? tr("选中后，真实函数、RTL 或协议名称会固定显示在这里，不再使用无信息编号。")}</p>
        {functions.length > 0 && (
          <div className="camera-hud-functions" aria-label={tr("真实函数与 RTL 名称")}>
            {functions.map((ref) => <code key={`${ref.name}-${ref.path}`}>{ref.name}</code>)}
          </div>
        )}
      </section>

      <div className="camera-hud-readout">
        <span>CAMERA-LOCKED HUD</span>
        <strong>PIPE {lineThickness.toFixed(1)}×</strong>
        <strong>HUD DEPTH {hudDistance.toFixed(1)}</strong>
      </div>
    </div>
  );
}

function PhysicalScene({
  locale,
  view,
  cameraPreset,
  selectedId,
  activeIds: activeIdList,
  flowEnabled,
  lineThickness,
  moduleLabelDistance,
  moduleLabelScale,
  subLabelDistance,
  subLabelFadeRange,
  farFadeStart,
  farBlockOpacity,
  farFlowOpacity,
  labelLayoutMode,
  annotationsEnabled,
  enabledEdgeKinds,
  focusedModuleId,
  focusedFunctionIndex,
  focusedJourneyId,
  enabledCausalLayers,
  focusedJourneyStepId,
  navigationRequest,
  onNodeClick,
  onModuleFocus,
  onFunctionFocus,
  onJourneyStepFocus,
  onEdgeClick,
  onDistanceBandChange,
  onCameraGestureStart,
  onCameraGestureEnd,
  canActivateObject,
  onGlobalLabelLayouts,
  globalLabelObstacles,
}: Omit<PhysicalTopology3DProps, "scene" | "onCanvasClick" | "hudDistance" | "labelLineThickness" | "focusAnnotationScale"> & {
  onDistanceBandChange: (density: Exclude<LabelDensity, "clean">) => void;
  onCameraGestureStart: () => void;
  onCameraGestureEnd: (changed: boolean) => void;
  canActivateObject: () => boolean;
  onGlobalLabelLayouts: (layouts: GlobalModuleLabelLayout[]) => void;
  globalLabelObstacles: GlobalLabelObstacle[];
}) {
  const scene = useEnhancedScene();
  const {
    directionCards,
    driverJourneyModuleRoleByNodeId,
    driverJourneys,
    focusModuleGroups,
    nodeById: nodeMap,
    routeNodeIds,
    topologyEdges,
  } = scene;
  const routeViewIds = useMemo(() => new Set(Object.keys(routeNodeIds)), [routeNodeIds]);
  const routeNodes = routeNodeIds[view] ?? [];
  const routeNodeSet = useMemo(() => new Set(routeNodes), [routeNodes]);
  const semanticViewNodeIds = scene.viewMembership.get(view);
  const visibleTopologyNodeIds = routeNodeSet.size > 0
    ? routeNodeSet
    : semanticViewNodeIds?.size
      ? semanticViewNodeIds
      : null;
  const activeIds = useMemo(() => {
    const ids = new Set(activeIdList);
    routeNodes.forEach((id) => ids.add(id));
    topologyEdges.filter((edge) => routeNodeSet.has(edge.source) && routeNodeSet.has(edge.target)).forEach((edge) => ids.add(edge.id));
    return ids;
  }, [activeIdList, routeNodeSet, routeNodes, topologyEdges]);
  const focusFrame = useMemo(() => {
    if (!focusedModuleId) return null;
    if (driverJourneyModuleRoleByNodeId[focusedModuleId] && driverJourneys[focusedJourneyId]) {
      return journeyFocusFrame(driverJourneys[focusedJourneyId].steps.length);
    }
    const nodeIds = focusModuleGroups[focusedModuleId] ?? [focusedModuleId];
    const functionCount = nodesFor(nodeIds, nodeMap).reduce(
      (count, node) => count + (node.data.codeRefs?.length ?? 0),
      0,
    );
    return moduleFocusFrame(functionCount);
  }, [driverJourneyModuleRoleByNodeId, driverJourneys, focusModuleGroups, focusedJourneyId, focusedModuleId, nodeMap]);
  const navigationFrame = useMemo<ModuleFocusFrame | null>(() => {
    if (!navigationRequest || focusedModuleId) return null;
    const visual = scene.visuals.modules.find((module) => module.nodeId === navigationRequest.nodeId);
    const center = visual?.position ?? scene.nodePositions[navigationRequest.nodeId];
    if (!center) return null;
    const rawSize = visual?.size ?? [4, 3, 3];
    const size: V3 = [
      Math.max(7, rawSize[0] * 1.8),
      Math.max(5, rawSize[1] * 2.2),
      Math.max(4.5, rawSize[2] * 2.8),
    ];
    return { center, size, moduleWidth: size[0] };
  }, [focusedModuleId, navigationRequest, scene.nodePositions, scene.visuals.modules]);
  return (
    <>
      <CameraRig
        view={view}
        preset={cameraPreset}
        focusFrame={focusFrame}
        navigationFrame={navigationFrame}
        navigationRequestId={navigationRequest?.requestId ?? null}
        onDistanceBandChange={onDistanceBandChange}
        onGestureStart={onCameraGestureStart}
        onGestureEnd={onCameraGestureEnd}
      />
      <GlobalLabelProjectionTracker
        locale={locale}
        enabled={annotationsEnabled && !focusedModuleId}
        view={view}
        selectedId={selectedId}
        activeIds={activeIds}
        moduleLabelDistance={moduleLabelDistance}
        moduleLabelScale={moduleLabelScale}
        subLabelDistance={subLabelDistance}
        subLabelFadeRange={subLabelFadeRange}
        labelLayoutMode={labelLayoutMode}
        obstacles={globalLabelObstacles}
        onLayouts={onGlobalLabelLayouts}
      />
      <DemandFlowLoop enabled={flowEnabled || Boolean(selectedId) || Boolean(focusedModuleId)} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#f4fbff", "#8ea3b3", 1.45]} />
      <directionalLight position={[10, 14, 16]} intensity={1.9} />
      <directionalLight position={[-9, 7, 10]} intensity={0.5} color="#b7d4ef" />

      {focusedModuleId ? (
        <FocusedModuleStage
          moduleId={focusedModuleId}
          selectedId={selectedId}
          focusedFunctionIndex={focusedFunctionIndex}
          focusedJourneyId={focusedJourneyId}
          enabledCausalLayers={enabledCausalLayers}
          focusedJourneyStepId={focusedJourneyStepId}
          flowEnabled={flowEnabled}
          onNodeClick={onNodeClick}
          onFunctionFocus={onFunctionFocus}
          onJourneyStepFocus={onJourneyStepFocus}
          canActivateObject={canActivateObject}
        />
      ) : (
        <>
          <DeclarativeTopology
            view={view}
            selectedId={selectedId}
            activeIds={activeIds}
            onNodeClick={onNodeClick}
            onModuleFocus={onModuleFocus}
            canActivateObject={canActivateObject}
            subLabelDistance={subLabelDistance}
            subLabelFadeRange={subLabelFadeRange}
            farFadeStart={farFadeStart}
            farBlockOpacity={farBlockOpacity}
          />

          {directionCards.map((card) => (
            <DirectionCard key={card.lane} lane={card.lane} position={card.position} origin={card.origin} selected={view === card.view} onClick={() => onEdgeClick(card.edgeId)} />
          ))}

          {topologyEdges.filter((edge) => (
            !visibleTopologyNodeIds
            || (visibleTopologyNodeIds.has(edge.source) && visibleTopologyNodeIds.has(edge.target))
          )).map((edge) => (
            <Pipe3D
              key={edge.id}
              edgeId={edge.id}
              points={edgePoints(edge.id, lineThickness, scene)}
              selectedId={selectedId}
              activeIds={activeIds}
              enabledEdgeKinds={enabledEdgeKinds}
              flowEnabled={flowEnabled}
              lineThickness={lineThickness}
              farFadeStart={farFadeStart}
              farFlowOpacity={farFlowOpacity}
              onEdgeClick={onEdgeClick}
              showLabel={routeViewIds.has(view)}
            />
          ))}

          <Grid position={[1.5, -6.25, 0]} args={[96, 30]} cellSize={1.5} cellThickness={0.3} cellColor="#aec0ce" sectionSize={6} sectionThickness={0.65} sectionColor="#7897ad" fadeDistance={110} fadeStrength={1} infiniteGrid={false} />
        </>
      )}
    </>
  );
}

export default function PhysicalTopology3D({
  scene,
  locale,
  view,
  cameraPreset,
  selectedId,
  activeIds,
  flowEnabled,
  lineThickness,
  hudDistance,
  moduleLabelDistance,
  moduleLabelScale,
  subLabelDistance,
  subLabelFadeRange,
  farFadeStart,
  farBlockOpacity,
  farFlowOpacity,
  focusAnnotationScale,
  labelLayoutMode,
  labelLineThickness,
  enabledEdgeKinds,
  annotationsEnabled,
  focusedModuleId,
  focusedFunctionIndex,
  focusedJourneyId,
  enabledCausalLayers,
  focusedJourneyStepId,
  navigationRequest,
  onNodeClick,
  onModuleFocus,
  onFunctionFocus,
  onJourneyStepFocus,
  onEdgeClick,
  onCanvasClick,
}: PhysicalTopology3DProps) {
  const sceneShellRef = useRef<HTMLDivElement>(null);
  const pointerGestureRef = useRef({
    pointerId: null as number | null,
    startedAt: 0,
    startX: 0,
    startY: 0,
    moved: false,
    timerId: null as number | null,
  });
  const activationPermitUntilRef = useRef(0);
  const [cameraLabelDensity, setCameraLabelDensity] = useState<Exclude<LabelDensity, "clean">>("panorama");
  const [globalLabelLayouts, setGlobalLabelLayouts] = useState<GlobalModuleLabelLayout[]>([]);
  const [globalLabelObstacles, setGlobalLabelObstacles] = useState<GlobalLabelObstacle[]>([]);
  const effectiveLabelDensity: LabelDensity = focusedModuleId ? "detail" : annotationsEnabled ? cameraLabelDensity : "clean";

  useEffect(() => setSceneLabelDensity(effectiveLabelDensity), [effectiveLabelDensity]);
  useEffect(() => () => {
    const timerId = pointerGestureRef.current.timerId;
    if (timerId !== null) window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!annotationsEnabled || focusedModuleId) return;

    const shell = sceneShellRef.current;
    const panel = shell?.closest<HTMLElement>(".canvas-panel");
    if (!shell || !panel) return;

    let animationFrame = 0;
    let lastSignature = "";
    const observedElements = new WeakSet<Element>();

    const measureObstacles = () => {
      animationFrame = 0;
      const shellRect = shell.getBoundingClientRect();
      if (shellRect.width <= 0 || shellRect.height <= 0) return;
      const obstacles: GlobalLabelObstacle[] = [];

      panel.querySelectorAll<HTMLElement>(GLOBAL_LABEL_OBSTACLE_SELECTORS).forEach((element, index) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const left = Math.max(shellRect.left, rect.left - GLOBAL_LABEL_OBSTACLE_PADDING);
        const top = Math.max(shellRect.top, rect.top - GLOBAL_LABEL_OBSTACLE_PADDING);
        const right = Math.min(shellRect.right, rect.right + GLOBAL_LABEL_OBSTACLE_PADDING);
        const bottom = Math.min(shellRect.bottom, rect.bottom + GLOBAL_LABEL_OBSTACLE_PADDING);
        if (right <= left || bottom <= top) return;

        obstacles.push({
          id: `${element.className || element.tagName}-${index}`,
          x: Math.round((left - shellRect.left) * 2) / 2,
          y: Math.round((top - shellRect.top) * 2) / 2,
          width: Math.round((right - left) * 2) / 2,
          height: Math.round((bottom - top) * 2) / 2,
        });
      });

      const signature = JSON.stringify(obstacles.map((obstacle) => [
        obstacle.id,
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      ]));
      if (signature === lastSignature) return;
      lastSignature = signature;
      setGlobalLabelObstacles(obstacles);
    };

    const scheduleMeasurement = () => {
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(measureObstacles);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    const observeVisibleObstacles = () => {
      resizeObserver.observe(shell);
      resizeObserver.observe(panel);
      panel.querySelectorAll<HTMLElement>(GLOBAL_LABEL_OBSTACLE_SELECTORS).forEach((element) => {
        if (observedElements.has(element)) return;
        observedElements.add(element);
        resizeObserver.observe(element);
      });
    };
    const mutationObserver = new MutationObserver((records) => {
      const relevantChange = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target?.closest(".global-module-label-layer");
      });
      if (!relevantChange) return;
      observeVisibleObstacles();
      scheduleMeasurement();
    });

    observeVisibleObstacles();
    mutationObserver.observe(panel, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", scheduleMeasurement);
    scheduleMeasurement();

    return () => {
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [annotationsEnabled, cameraLabelDensity, focusedModuleId, hudDistance, locale, selectedId]);

  const beginPointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const gesture = pointerGestureRef.current;
    if (gesture.timerId !== null) window.clearTimeout(gesture.timerId);
    activationPermitUntilRef.current = 0;
    gesture.pointerId = event.pointerId;
    gesture.startedAt = performance.now();
    gesture.startX = event.clientX;
    gesture.startY = event.clientY;
    gesture.moved = false;
    gesture.timerId = window.setTimeout(() => {
      if (gesture.pointerId === event.pointerId) activationPermitUntilRef.current = 0;
    }, LONG_PRESS_ROTATE_MS);
  }, []);

  const updatePointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (gesture.pointerId !== event.pointerId || gesture.moved) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >= DRAG_ROTATE_THRESHOLD_PX) {
      gesture.moved = true;
      activationPermitUntilRef.current = 0;
    }
  }, []);

  const finishPointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.timerId !== null) window.clearTimeout(gesture.timerId);
    const heldFor = performance.now() - gesture.startedAt;
    const isShortClick = !gesture.moved && heldFor < LONG_PRESS_ROTATE_MS;
    gesture.pointerId = null;
    gesture.timerId = null;
    activationPermitUntilRef.current = isShortClick ? performance.now() + CLICK_PERMIT_MS : 0;
  }, []);

  const cancelPointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.timerId !== null) window.clearTimeout(gesture.timerId);
    gesture.pointerId = null;
    gesture.timerId = null;
    gesture.moved = true;
    activationPermitUntilRef.current = 0;
  }, []);

  const beginCameraGesture = useCallback(() => { activationPermitUntilRef.current = 0; }, []);
  const finishCameraGesture = useCallback((changed: boolean) => {
    if (changed) activationPermitUntilRef.current = 0;
  }, []);
  const canActivateObject = useCallback(() => performance.now() <= activationPermitUntilRef.current, []);

  const guardedNodeClick = useCallback((id: string) => { if (canActivateObject()) onNodeClick(id); }, [canActivateObject, onNodeClick]);
  const guardedModuleFocus = useCallback((id: string) => { if (canActivateObject()) onModuleFocus(id); }, [canActivateObject, onModuleFocus]);
  const guardedFunctionFocus = useCallback((index: number) => { if (canActivateObject()) onFunctionFocus(index); }, [canActivateObject, onFunctionFocus]);
  const guardedEdgeClick = useCallback((id: string) => { if (canActivateObject()) onEdgeClick(id); }, [canActivateObject, onEdgeClick]);
  const guardedCanvasClick = useCallback(() => { if (canActivateObject()) onCanvasClick(); }, [canActivateObject, onCanvasClick]);

  return (
    <EnhancedSceneContext.Provider value={scene}>
    <div
      ref={sceneShellRef}
      className={`physical-scene-shell ${focusedModuleId ? "focus-mode" : ""} label-${effectiveLabelDensity}`}
      style={{ "--focus-annotation-scale": focusAnnotationScale } as CSSProperties}
      onPointerDownCapture={beginPointerGesture}
      onPointerMoveCapture={updatePointerGesture}
      onPointerUpCapture={finishPointerGesture}
      onPointerCancelCapture={cancelPointerGesture}
    >
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [1.5, 18, 72], fov: 40, near: 0.1, far: 300 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
        frameloop="demand"
        onPointerMissed={guardedCanvasClick}
      >
        <color attach="background" args={["#edf3f7"]} />
        <PhysicalScene
          locale={locale}
          view={view}
          cameraPreset={cameraPreset}
          selectedId={selectedId}
          activeIds={activeIds}
          flowEnabled={flowEnabled}
          lineThickness={lineThickness}
          moduleLabelDistance={moduleLabelDistance}
          moduleLabelScale={moduleLabelScale}
          subLabelDistance={subLabelDistance}
          subLabelFadeRange={subLabelFadeRange}
          farFadeStart={farFadeStart}
          farBlockOpacity={farBlockOpacity}
          farFlowOpacity={farFlowOpacity}
          labelLayoutMode={labelLayoutMode}
          annotationsEnabled={annotationsEnabled}
          enabledEdgeKinds={enabledEdgeKinds}
          focusedModuleId={focusedModuleId}
          focusedFunctionIndex={focusedFunctionIndex}
          focusedJourneyId={focusedJourneyId}
          enabledCausalLayers={enabledCausalLayers}
          focusedJourneyStepId={focusedJourneyStepId}
          navigationRequest={navigationRequest}
          onNodeClick={guardedNodeClick}
          onModuleFocus={guardedModuleFocus}
          onFunctionFocus={guardedFunctionFocus}
          onJourneyStepFocus={onJourneyStepFocus}
          onEdgeClick={guardedEdgeClick}
          onDistanceBandChange={setCameraLabelDensity}
          onCameraGestureStart={beginCameraGesture}
          onCameraGestureEnd={finishCameraGesture}
          canActivateObject={canActivateObject}
          onGlobalLabelLayouts={setGlobalLabelLayouts}
          globalLabelObstacles={globalLabelObstacles}
        />
      </Canvas>
      {annotationsEnabled && !focusedModuleId && (
        <>
          <GlobalModuleLabelOverlay
            layouts={globalLabelLayouts}
            selectedId={selectedId}
            labelLayoutMode={labelLayoutMode}
            labelLineThickness={labelLineThickness}
            moduleLabelScale={moduleLabelScale}
            onModuleFocus={guardedModuleFocus}
          />
          <CameraHudOverlay view={view} selectedId={selectedId} lineThickness={lineThickness} hudDistance={hudDistance} density={cameraLabelDensity} />
        </>
      )}
      <div className="scene-axis" aria-hidden="true">
        <span className="axis-x">X · {scene.visuals.zones.map((zone) => zone.title).join(" → ")}</span>
        <span className="axis-y">Y · {Object.values(scene.laneMeta).map((lane) => lane.label).join(" / ")}</span>
        <span className="axis-z">Z · DATA → CONTROL → SYNC → LIFECYCLE</span>
      </div>
      <div className="scene-live-note target-mode static-boundary-note">
        <span className="live-pulse" />
        <div><strong>{scene.sceneId.toUpperCase()} · EVIDENCE-BOUNDED MODEL</strong><small>{scene.description}</small></div>
      </div>
    </div>
    </EnhancedSceneContext.Provider>
  );
}
