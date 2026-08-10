# Engineering Topology 3D

An evidence-aware 3D framework for visualizing physical systems, software stacks, causal journeys, and engineering data flows directly in the browser.

[Live demo](https://pukerwonderland.github.io/engineering-topology-3d/) · [中文说明](docs/README.zh-CN.md) · [Architecture](docs/architecture.md) · [Security boundary](docs/security-boundary.md)

## Why this project exists

Engineering diagrams usually separate hardware, software, runtime state, and evidence into different documents. Engineering Topology 3D places them in one navigable scene while preserving the distinction between:

- physical topology and software hierarchy;
- payload flow, control flow, synchronization, and lifecycle rollback;
- source-proven facts, runtime observations, and explicit inference;
- overview labels and focus-mode function contracts.

The current `v0.1` release ships one reference implementation: an anonymized T113 ARM-XVC gateway connecting an x86 FPGA workstation, LAN, USB hub, JTAG probes, and FPGA devices. It demonstrates the visualization model; it is not a deployment guide or a live device-management service.

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

## Repository map

```text
engineering-topology-3d/
├── .github/                 # workflows and community templates
├── demo/                    # browser entry point
├── docs/                    # architecture, evidence and deployment notes
├── examples/
│   └── t113-arm-xvc/        # anonymized reference model and acceptance notes
├── public/                  # static public assets
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
pnpm test
```

The static site is emitted to `dist/`. Asset URLs are relative, so the same output works under a GitHub project Pages subpath.

## Reference example boundary

The T113 example intentionally contains only architecture-level information. It excludes real network addresses, JTAG serial numbers, credentials, bitstreams, flash images, operational logs, and production deployment scripts. Hardware writes must always rediscover the actual cable, USB chain, FPGA, and flash identity.

The renderer and interaction mechanics are reusable today, while complete schema-driven scene generation is still on the roadmap. See [roadmap.md](docs/roadmap.md) for the exact boundary instead of assuming every scene element is already data-driven.

## Contributing

Contributions are welcome under the [Developer Certificate of Origin](https://developercertificate.org/). See [CONTRIBUTING.md](.github/CONTRIBUTING.md) and sign commits with `git commit -s`.

## License

- Source code: [Apache License 2.0](LICENSE).
- Original documentation, knowledge models, and diagrams: [CC BY 4.0](NOTICE).
- Third-party dependencies remain under their own licenses; see [third-party-notices.md](docs/legal/third-party-notices.md).
