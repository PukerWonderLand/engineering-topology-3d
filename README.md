# Engineering Topology 3D

An evidence-aware 3D framework for visualizing physical systems, software stacks, causal journeys, and engineering data flows directly in the browser.

[Live demo](https://pukerwonderland.github.io/engineering-topology-3d/) · [中文说明](docs/README.zh-CN.md) · [AI authoring](docs/ai-authoring.md) · [Feature baseline](docs/feature-preservation-checklist.md) · [Architecture](docs/architecture.md) · [Security boundary](docs/security-boundary.md)

## Why this project exists

Engineering diagrams usually separate hardware, software, runtime state, and evidence into different documents. Engineering Topology 3D places them in one navigable scene while preserving the distinction between:

- physical topology and software hierarchy;
- payload flow, control flow, synchronization, and lifecycle rollback;
- source-proven facts, runtime observations, and explicit inference;
- overview labels and focus-mode function contracts.

The current `v0.2` release uses one SceneDefinition 2.0 enhanced renderer for every domain. The anonymized T113 ARM-XVC baseline and the NVMe Bitmap example both receive the complete system index, focus mode, labels, journeys, function contracts, evidence model, controls, fullscreen behavior, and localization without domain-specific React pages. These examples demonstrate the visualization model; they are not deployment guides or live device-management services.

## Features

- Real-time WebGL topology using React Three Fiber and Three.js.
- Distance-aware level of detail for zones, labels, blocks, and data flows.
- Collision-resolved module labels with camera and module-relative layouts.
- Focus framing that fits a selected module instead of resetting the entire scene.
- Five causal journeys and four independently switchable causal layers.
- Six-part function contracts: trigger, context, consumes, produces, state/resource, and completion/error.
- Evidence levels: `CODE_PROVEN`, `RTL_PROVEN`, `RUNTIME_OBSERVED`, and `INFERRED`.
- Chinese and English interface switching.
- Pure static output suitable for GitHub Pages, Nginx, or any object store.
- Versioned `SceneDefinition` schema with YAML parsing, relational validation, and a generic scene renderer.
- Drop-in scene discovery from `examples/<scene-id>/topology.yaml`; open it with `?scene=<scene-id>`.

## AI knowledge adaptation quick start

One scene has exactly one runtime knowledge file:

```text
examples/<scene-id>/topology.yaml
```

For an existing scene, edit only that file. For a new knowledge domain, create one new `examples/<scene-id>/topology.yaml`. Supporting `source-inventory.md` and `acceptance-checklist.md` files document evidence and acceptance but do not drive rendering.

An authoring AI should read, in order:

1. [Feature preservation checklist](docs/feature-preservation-checklist.md) — determines which existing capabilities must not regress.
2. [AI scene authoring guide](docs/ai-authoring.md) — defines evidence, entity, journey, layout and publication rules.
3. [SceneDefinition Schema](spec/scene-definition.schema.json) — defines the accepted YAML contract.
4. The closest existing example under `examples/` — provides structure, not reusable facts.

Copy this prompt into another AI:

```text
Adapt the supplied engineering materials into an Engineering Topology 3D scene.

Scene ID: <scene-id>
Source materials: <paths or attached documents>
Engineering questions: <questions the scene must answer>

This is a knowledge-only task. The only runtime knowledge file you may create
or edit is examples/<scene-id>/topology.yaml.

Do not modify src/, demo/, spec/, scripts/, tests/, package.json,
vite.config.ts, renderer components, interaction code or CSS.

Before editing, read:
1. docs/feature-preservation-checklist.md
2. docs/ai-authoring.md
3. spec/scene-definition.schema.json
4. the closest examples/*/topology.yaml

Model zones, nodes, edges, functions, journeys, layout, zhCN/enUS text and
evidence levels. Keep CODE_PROVEN, RTL_PROVEN, RUNTIME_OBSERVED and INFERRED
separate. Never infer a physical path from software code or promote a target
design into a runtime fact. Put unresolved claims in INFERRED and add a caveat.

Preserve every applicable COMMON and GENERIC item in the feature checklist.
If the current Schema cannot express a required capability, do not change the
renderer or invent unsupported fields. Report it as a framework gap.

Use the smallest viable workflow: estimate the knowledge scope, implement the
single YAML file, then run pnpm validate:scenes, pnpm lint and pnpm build.
Expand inspection only when validation fails or evidence is ambiguous.

The final report must include changed files, entity counts, evidence boundaries,
checklist scope, validation results, unverified items and whether src/ changed.
```

## Repository map

```text
engineering-topology-3d/
├── .github/                 # workflows and community templates
├── demo/                    # browser entry point
├── docs/                    # architecture, evidence and deployment notes
├── examples/
│   ├── t113-arm-xvc/        # anonymized reference model and acceptance notes
│   └── nvme-bitmap/         # schema-driven cross-domain example
├── public/                  # static public assets
├── scripts/                 # scene validation commands
├── spec/                    # versioned SceneDefinition JSON Schema
├── src/                     # renderer, interaction, layout, data and i18n source
├── tests/                   # small contract and static-build checks
├── LICENSE                  # Apache-2.0 source license
├── NOTICE                   # documentation/data licensing notice
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Local development

Requires Node.js 22.13 or newer.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4314/`.

## Build and check

```bash
pnpm lint
pnpm validate:scenes
pnpm test
```

The static site is emitted to `dist/`. Asset URLs are relative, so the same output works under a GitHub project Pages subpath.

## Reference example boundary

The T113 example intentionally contains only architecture-level information. It excludes real network addresses, JTAG serial numbers, credentials, bitstreams, flash images, operational logs, and production deployment scripts. Hardware writes must always rediscover the actual cable, USB chain, FPGA, and flash identity.

The T113 reference scene is the default URL. Every SceneDefinition 2.0 scene is loaded from `examples/*/topology.yaml` into the same enhanced renderer; for example, open `?scene=nvme-bitmap`. See [AI scene authoring](docs/ai-authoring.md) for the evidence, modeling, layout, localization, and validation contract.

## Contributing

Contributions are welcome under the [Developer Certificate of Origin](https://developercertificate.org/). See [CONTRIBUTING.md](.github/CONTRIBUTING.md) and sign commits with `git commit -s`.

## License

- Source code: [Apache License 2.0](LICENSE).
- Original documentation, knowledge models, and diagrams: [CC BY 4.0](NOTICE).
- Third-party dependencies remain under their own licenses; see [third-party-notices.md](docs/legal/third-party-notices.md).
