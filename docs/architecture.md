# Architecture

The browser entry in `demo/` mounts `TopologyExplorer`. The explorer owns navigation, global controls, language state, selection, and detail panels. `PhysicalTopology3D` owns the React Three Fiber scene, camera, blocks, pipes, labels, and focus transitions.

`topology-data.ts` currently defines the bundled reference scene and causal journeys. `camera-fit.ts` computes module and journey framing. `global-label-layout.ts` projects anchors into screen coordinates and resolves label collisions before rendering.

The generated site is client-only: Vite bundles TypeScript and JSX into static JavaScript and CSS, and the visitor's browser performs all rendering. No Node.js, database, worker, device agent, or credential is present at runtime.

The reusable mechanics are already separated from deployment infrastructure. Full schema-to-scene generation is planned; some physical placements in the reference renderer remain explicit in `PhysicalTopology3D.tsx` in v0.1.
