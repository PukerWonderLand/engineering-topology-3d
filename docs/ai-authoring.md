# AI scene authoring guide

This guide defines the contract for converting engineering knowledge into a schema-driven Engineering Topology 3D scene. An authoring AI should add or edit only `examples/<scene-id>/`; it must not modify reusable renderer code under `src/`.

Before making changes, read the [current feature baseline and AI preservation checklist](feature-preservation-checklist.md). Every SceneDefinition 2.0 scene enters the same enhanced renderer, so a scene-only contribution must preserve all applicable enhanced interactions and report the checklist scope in its final handoff.

## 1. Read evidence before drawing

Build a source inventory first. Separate every statement into one of four evidence levels:

- `CODE_PROVEN`: directly visible in source code or an interface definition;
- `RTL_PROVEN`: directly visible in RTL, a register contract, or a hardware specification;
- `RUNTIME_OBSERVED`: seen in a controlled trace, log, probe, or experiment;
- `INFERRED`: a hypothesis, target design, or unresolved boundary.

Never promote one level to another. A desired architecture is not a runtime fact, and a software path does not prove the physical device path.

## 2. Extract entities

Create an entity only when it owns state, transforms data, marks an execution boundary, or represents physical topology. Use these distinctions:

- **zone**: a major failure, ownership, deployment, or physical boundary;
- **node/module**: a component with a stable responsibility;
- **function**: an operation station inside one module;
- **data/state node**: a buffer, queue, descriptor, message, register, lock, or state machine that materially affects causality;
- **edge**: an evidenced relationship between two nodes;
- **journey**: a selected causal subset answering one engineering question.

Do not turn every source function into a node. Helper functions without ownership, state, protocol, synchronization, or hardware impact belong in notes rather than the main topology.

## 3. Model functions with six interfaces

Every function in `functions` must record:

1. `trigger` — who or what invokes it;
2. `context` — process, thread, syscall, interrupt, workqueue, firmware, or RTL context;
3. `consumes` — input data and ownership;
4. `produces` — output data and ownership;
5. `stateResource` — locks, queues, mappings, registers, buffers, and mutable state;
6. `completionError` — return, completion, wait, wakeup, retry, timeout, and rollback behavior.

Use `hardwareEffect` when the function writes MMIO, rings a doorbell, programs DMA, changes a GPIO, shifts JTAG, or otherwise changes a device-visible state.

## 4. Build causal journeys

Start from engineering questions, not from file order. Typical journeys are:

- normal send/write;
- normal receive/read;
- initialization and resource acquisition;
- blocking, interrupt, wakeup, retry, and timeout;
- removal, hot-unplug, failure, and reverse-order rollback.

Journey steps may reference a node or a function. `edgeIds` must contain only edges that participate in that journey. Keep payload, control, synchronization, lifecycle, and physical relationships distinct through `edge.kind`.

## 5. Choose spatial hierarchy

Use X for end-to-end causal or physical progression, Y for software layers or parallel instances, and Z for semantic depth. Keep zones far enough apart to preserve physical ownership boundaries.

Each node and zone requires a layout entry:

- `position`: center `[x, y, z]`;
- `size`: width, height, depth;
- `moduleSide`: preferred world-relative label side;
- `cameraSide`: preferred screen-relative label side.

Layout is presentation data. Do not encode claims by position alone; evidence and descriptions remain authoritative.

## 6. Localization

Every user-visible scene title, description, zone title, node title, edge title, and journey title must include both `zhCN` and `enUS`. Technical identifiers, symbols, register names, and function names should remain unchanged.

## 7. Security and publication boundary

Never place credentials, production IP addresses, customer names, JTAG serial numbers, proprietary source, bitstreams, flash images, or live operational logs in a public scene. Replace them with explicit examples such as `EXAMPLE_IP` or `PROBE_A` and describe the rediscovery requirement.

## 8. Complete SceneDefinition 2.0 surface

The base `zones`, `nodes`, `edges`, `functions`, `journeys`, and `layout` fields provide portable knowledge and reference validation. The required `enhanced` block supplies the full Explorer runtime:

- `content.zhCN` and `content.enUS`: topology nodes and edges, system/storage trees, views, lane/plane metadata, function interactions, five causal journeys, camera HUD copy, and runtime facts;
- `common.nodePositions`, `macroZones`, and `visuals`: physical placement, large-zone shells, module dimensions, layer frames, depth planes, colors, and label anchors;
- `common.routeNodeIds`, `directionCards`, and `globalModuleLabels`: filtered views, route cards, global annotations, and collision-layout membership;
- `common.focusModuleGroups` and journey role maps: module focus and transaction-journey entry points;
- `displayDefaults`: all pipe, label, HUD, LOD, opacity, and annotation-scale defaults.

IDs are the contract between these sections. Never translate IDs. Both locale branches must contain identical node, edge, view, and journey ID sets.

## 9. Required workflow

1. Copy one existing example directory.
2. Replace `topology.yaml` with facts from the new source inventory.
3. Set `schemaVersion: "2.0"` and complete the base knowledge model plus the `enhanced` runtime model.
4. Run `pnpm validate:scenes`.
5. Run `pnpm lint`.
6. Run `pnpm build`.
7. Open `/?scene=<scene-id>` and inspect the default camera, zone ownership, selected-node panel, journeys, labels, and evidence boundaries.

The validator rejects duplicate identifiers, dangling edge endpoints, missing module/function references, zone ownership disagreement, and missing node/zone layouts.

## 10. Completion criteria

A new knowledge scene is accepted only when:

- it adds files under `examples/<scene-id>/` without editing `src/`;
- the schema and relational validator pass;
- every node belongs to exactly one zone and has a layout;
- every function has the six-interface contract;
- every journey is readable as a causal path;
- unresolved facts remain `INFERRED` and carry a caveat;
- both supported languages are complete;
- the enhanced page renders through `?scene=<scene-id>` with the same controls, focus mode, labels, journeys, function contracts, evidence model, fullscreen behavior, and localization as the T113 baseline.
