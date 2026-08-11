# Architecture

The browser entry in `demo/main.tsx` resolves the requested scene ID and always mounts the same `EnhancedTopologyExplorer`. There is no simplified route: the default URL and `?scene=<scene-id>` share the same system index, inspector, settings, focus mode, label engine, journeys, and 3D renderer.

`scene-definition.ts` and `spec/scene-definition.schema.json` define SceneDefinition 2.0. `scene-loader.ts` performs `parse -> validate -> resolve references -> normalize -> build runtime indexes` for every `examples/*/topology.yaml`. The indexes include node, edge, function, adjacency, lane, journey, zone, label, and view membership lookups.

`enhanced-scene-runtime.ts` selects the requested locale and converts the validated definition into the immutable runtime scene consumed by `TopologyExplorer.tsx` and `PhysicalTopology3D.tsx`. The renderer iterates `scene.visuals`, `scene.edges`, and `scene.journeys`; scene-specific nodes, positions, labels, views, and causal content are not imported from `topology-data.ts`.

`camera-fit.ts` computes module, journey, and declarative scene framing. `global-label-layout.ts` projects anchors into screen coordinates and resolves label collisions. Display defaults and spatial layout are part of the YAML scene, while interaction mechanics and CSS remain shared framework code.

The generated site is client-only: Vite bundles TypeScript and JSX into static JavaScript and CSS, and the visitor's browser performs all rendering. No Node.js, database, worker, device agent, or credential is present at runtime.

A new domain must be deliverable by adding only `examples/<scene-id>/topology.yaml` and optional static images. If a scene requires a React, CSS, or renderer edit, the shared SceneDefinition contract is incomplete and the contribution is not scene-only.
