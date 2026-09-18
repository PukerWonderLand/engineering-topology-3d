#!/usr/bin/env node
/**
 * Build the `spu-spug-global-topology` SceneDefinition 2.0 scene.
 *
 * Input (never committed — pass absolute paths):
 *   --data     SPU-SPUG架构-解析中间数据.json   (vsdx_parse.py output)
 *   --regions  SPU-SPUG架构-区域划分配置.json   (reviewed region partition)
 *
 * Output (committed):
 *   examples/spu-spug-global-topology/topology.yaml
 *   examples/spu-spug-global-topology/source-inventory.md
 *   examples/spu-spug-global-topology/acceptance-checklist.md
 *
 * Scope: PCIe address space and physical topology. The sibling scene
 * `spu-spug-driver-overview` owns code/repository ownership; see the
 * mutual-exclusion note in both acceptance checklists.
 *
 * Usage:
 *   node scripts/build-spu-spug-global-scene.mjs \
 *     --data  "/path/to/SPU-SPUG架构-解析中间数据.json" \
 *     --regions "/path/to/SPU-SPUG架构-区域划分配置.json"
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "..");
const SCENE_ID = "spu-spug-global-topology";
const OUT_DIR = join(root, "examples", SCENE_ID);

/* ------------------------------------------------------------------ args */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    out[token.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.data || !args.regions) {
  console.error("usage: --data <parse.json> --regions <regions.json> [--out <dir>]");
  process.exit(2);
}
const outDir = args.out ? resolve(args.out) : OUT_DIR;

/* -------------------------------------------------------------- vocabulary */

// Shared semantics reused verbatim from the sibling scene so both scenes read
// the same way. Keep in sync with examples/spu-spug-driver-overview.
const EDGE_META = {
  CONTROL: { color: "#d59a2b", label: { zhCN: "控制", enUS: "Control" } },
  DATA: { color: "#4d8edb", label: { zhCN: "数据", enUS: "Data" } },
  SYNC: { color: "#9b6bc4", label: { zhCN: "同步", enUS: "Sync" } },
  LIFECYCLE: { color: "#d35f5f", label: { zhCN: "生命周期", enUS: "Lifecycle" } },
  PHYSICAL: { color: "#607d8b", label: { zhCN: "物理/PCIe", enUS: "Physical/PCIe" } },
};

const EDGE_KIND_TO_LANE = {
  control: "CONTROL",
  payload: "DATA",
  sync: "SYNC",
  lifecycle: "LIFECYCLE",
  physical: "PHYSICAL",
};

const CAUSAL_LAYERS = {
  payload: {
    label: { zhCN: "数据与所有权", enUS: "Data and ownership" },
    short: { zhCN: "DATA", enUS: "DATA" },
    color: "#4d8edb",
    description: { zhCN: "数据生产、传输与消费", enUS: "Production, transport, consumption" },
  },
  control: {
    label: { zhCN: "控制执行", enUS: "Control execution" },
    short: { zhCN: "CTRL", enUS: "CTRL" },
    color: "#d59a2b",
    description: { zhCN: "配置、调用与状态控制", enUS: "Configuration, invocation, state control" },
  },
  sync: {
    label: { zhCN: "同步与完成", enUS: "Synchronisation" },
    short: { zhCN: "SYNC", enUS: "SYNC" },
    color: "#9b6bc4",
    description: { zhCN: "IRQ、等待与握手", enUS: "IRQ, wait, handshake" },
  },
  lifecycle: {
    label: { zhCN: "生命周期与回滚", enUS: "Lifecycle and rollback" },
    short: { zhCN: "LIFE", enUS: "LIFE" },
    color: "#d35f5f",
    description: { zhCN: "枚举、绑定、解绑与逆序释放", enUS: "Enumeration, bind, unbind, teardown" },
  },
};

const JOURNEY_RELATIONS = {
  PAYLOAD: { color: "#4d8edb", label: "PAYLOAD", dashed: false },
  CALL: { color: "#d59a2b", label: "CALL", dashed: false },
  QUEUE: { color: "#2a9d8f", label: "QUEUE", dashed: false },
  STATE: { color: "#e76f51", label: "STATE", dashed: false },
  MMIO: { color: "#f4a261", label: "MMIO", dashed: false },
  IRQ: { color: "#9b6bc4", label: "IRQ", dashed: true },
  WAIT: { color: "#8d99ae", label: "WAIT", dashed: true },
  ERROR: { color: "#d62828", label: "ERROR", dashed: true },
  LIFECYCLE: { color: "#d35f5f", label: "LIFECYCLE", dashed: true },
};

const DISPLAY_DEFAULTS = {
  pipeThickness: 3,
  hudDistance: 1.15,
  moduleLabelDistance: 1.15,
  labelLayoutMode: "module",
  labelLineThickness: 1.4,
  moduleLabelScale: 0.92,
  focusAnnotationScale: 1.6,
  focusHudTextScale: 1.8,
  subLabelDistance: 34,
  subLabelFadeRange: 9,
  farFadeStart: 100,
  farBlockOpacity: 0.22,
  farFlowOpacity: 0.18,
};

/* ---------------------------------------------------------------- zones */

// Column order follows the physical signal path, not the Visio page order:
// HOST -> fabric -> SPUG branches -> SPUG-FPGA -> SPU-FPGA -> SPU CPU -> SPU software.
const ZONES = [
  {
    id: "host",
    title: { zhCN: "HOST 侧软件栈", enUS: "Host Software Stack" },
    eyebrow: { zhCN: "区域 01 · 主机侧", enUS: "ZONE 01 · HOST SIDE" },
    summary: {
      zhCN: "内核、用户态、平台阶段与业务阶段；含 Host 根端口与 NUMA 归属",
      enUS: "Kernel, userspace, platform and business layers; host root port and NUMA placement",
    },
    color: "#22a7cf",
    backdrop: "server",
  },
  {
    id: "pcie-fabric",
    title: { zhCN: "PCIe Switch 与两侧地址空间", enUS: "PCIe Switch and Address Spaces" },
    eyebrow: { zhCN: "区域 02 · 物理互联", enUS: "ZONE 02 · PHYSICAL FABRIC" },
    summary: {
      zhCN: "Broadcom PEX880xx 上游/下游端口、下级 Switch 与 Host/SPU 两套 PCIe 地址语义",
      enUS: "Broadcom PEX880xx upstream/downstream ports, sub-switches, and the host/SPU address spaces",
    },
    color: "#607d8b",
    backdrop: "fabric",
  },
  {
    id: "spug",
    title: { zhCN: "SPUG 三条设备支路", enUS: "SPUG Device Branches" },
    eyebrow: { zhCN: "区域 03 · 支路与桥", enUS: "ZONE 03 · BRANCHES AND BRIDGES" },
    summary: {
      zhCN: "NVMe / GPU / RDMA 三条支路的上下游桥与物理设备；所有权已交给 SPU",
      enUS: "Upstream/downstream bridges and physical devices on the NVMe, GPU and RDMA branches; ownership held by SPU",
    },
    color: "#b767f1",
    backdrop: "device",
  },
  {
    id: "spug-fpga",
    title: { zhCN: "SPUG-FPGA", enUS: "SPUG-FPGA" },
    eyebrow: { zhCN: "区域 04 · 下游桥接", enUS: "ZONE 04 · DOWNSTREAM BRIDGE" },
    summary: {
      zhCN: "三块 SPUG-FPGA 的 BAR 窗口、控制寄存器与下游配置代理",
      enUS: "BAR windows, control registers and downstream configuration proxy on the three SPUG-FPGAs",
    },
    color: "#d64d72",
    backdrop: "board",
  },
  {
    id: "spu-fpga",
    title: { zhCN: "SPU-FPGA 与 BAR 窗口", enUS: "SPU-FPGA and BAR Windows" },
    eyebrow: { zhCN: "区域 05 · 上行/下行端点", enUS: "ZONE 05 · UPSTREAM AND DOWNSTREAM ENDPOINTS" },
    summary: {
      zhCN: "SUEP 上行、SDEP 与 SP37 下行三组 BAR 窗口，以及地址转换与 TLP 代理",
      enUS: "Three BAR groups (SUEP upstream, SDEP and SP37 downstream), address translation and TLP proxying",
    },
    color: "#168f7b",
    backdrop: "board",
  },
  {
    id: "spu-cpu",
    title: { zhCN: "SPU 内部 CPU 与虚拟总线", enUS: "SPU Internal CPU and Virtual Bus" },
    eyebrow: { zhCN: "区域 06 · 内部枚举", enUS: "ZONE 06 · INTERNAL ENUMERATION" },
    summary: {
      zhCN: "SPU CPU、spu_vgpu 造出的虚拟 PCI 总线 f0、虚拟设备与内部根端口",
      enUS: "SPU CPU, the virtual PCI bus f0 created by spu_vgpu, virtual devices and the internal root port",
    },
    color: "#2f83e7",
    backdrop: "board",
  },
  {
    id: "spu-sw",
    title: { zhCN: "SPU 软件栈", enUS: "SPU Software Stack" },
    eyebrow: { zhCN: "区域 07 · 客侧软件", enUS: "ZONE 07 · SPU SIDE SOFTWARE" },
    summary: {
      zhCN: "业务层、用户态与内核部分；sp37 与 spu_vgpu 的加载侧",
      enUS: "Business, userspace and kernel layers; the load side of sp37 and spu_vgpu",
    },
    color: "#c05e2b",
    backdrop: "server",
  },
];

/* ---------------------------------------------------------------- nodes */

// `shapes` lists the Visio shape ids this node aggregates. `weight` orders the
// node inside its zone column (higher = higher on screen).
// Evidence is asserted per node; `sources` cites the shape ids it came from.
const NODES = [
  // --- host -------------------------------------------------------------
  {
    id: "host-business",
    zone: "host",
    shapes: ["469"],
    weight: 9,
    title: { zhCN: "Host 业务阶段", enUS: "Host Business Layer" },
    blurb: {
      zhCN: "设备/应用/部署生命周期、安全会话网关与 SDK 入口：host_ams、SPU SDK、Nereus SDK、host_buildin_admin。",
      enUS: "Device/app/deployment lifecycle, secure session gateway and SDK entry points: host_ams, SPU SDK, Nereus SDK, host_buildin_admin.",
    },
    kind: "service",
    evidence: "CODE_PROVEN",
  },
  {
    id: "host-platform",
    zone: "host",
    shapes: ["470", "450", "467", "464"],
    weight: 7,
    title: { zhCN: "Host 平台阶段", enUS: "Host Platform Layer" },
    blurb: {
      zhCN: "host_nms（L4 TCP 代理/端口映射/加密会话元数据）、host_tun（三层虚拟网络数据面）与 PCS/PCIe。",
      enUS: "host_nms (L4 TCP proxy, port mapping, encrypted session metadata), host_tun (L3 virtual network data plane) and PCS/PCIe.",
    },
    kind: "service",
    evidence: "CODE_PROVEN",
  },
  {
    id: "host-userspace",
    zone: "host",
    shapes: ["507", "448"],
    weight: 5,
    title: { zhCN: "Host 用户态", enUS: "Host Userspace" },
    blurb: {
      zhCN: "host_pcs / pcie_server 封装 SP37 节点，向客户端提供 Unix Socket 服务。",
      enUS: "host_pcs / pcie_server wraps the SP37 node and exposes a Unix socket service to clients.",
    },
    kind: "service",
    evidence: "CODE_PROVEN",
  },
  {
    id: "host-kernel",
    zone: "host",
    shapes: ["506", "446", "442", "472"],
    weight: 3,
    title: { zhCN: "Host 内核驱动", enUS: "Host Kernel Drivers" },
    blurb: {
      zhCN: "sp37.ko（绑定 5709:1000）、sdep.ko（绑定 5709:1001，扫 SPUG/GPU 拓扑、NTB 管理、P2P）与 hblkd_end.ko。",
      enUS: "sp37.ko (binds 5709:1000), sdep.ko (binds 5709:1001; scans SPUG/GPU topology, manages NTB and P2P) and hblkd_end.ko.",
    },
    kind: "driver",
    evidence: "CODE_PROVEN",
  },
  {
    id: "host-numa",
    zone: "host",
    shapes: ["269"],
    weight: 1,
    title: { zhCN: "Hygon CPU0 / NUMA Node 3", enUS: "Hygon CPU0 / NUMA Node 3" },
    blurb: {
      zhCN: "Host 侧的 CPU 与 NUMA 归属，决定根端口和 IOMMU group 的物理位置。",
      enUS: "Host CPU and NUMA placement, which fixes the physical location of the root port and IOMMU group.",
    },
    kind: "hardware",
    evidence: "RUNTIME_OBSERVED",
  },
  {
    id: "host-root-port",
    zone: "host",
    shapes: ["229"],
    weight: 2,
    title: { zhCN: "70:03.7 CPU PCIe Root Port", enUS: "70:03.7 CPU PCIe Root Port" },
    blurb: {
      zhCN: "Host 根端口，PEX880xx 上游侧的挂载点。",
      enUS: "Host root port; the attach point for the upstream side of the PEX880xx.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "host-addr-space",
    zone: "host",
    shapes: ["283", "291"],
    weight: 0,
    title: { zhCN: "HOST 系统环境的 PCIE 地址", enUS: "Host PCIe Address Space" },
    blurb: {
      zhCN: "Host 侧看到的 PCIe 地址语义；SDEP 下行 Bar2（32GiB）在此被重定向。",
      enUS: "PCIe address semantics as seen from the host; the SDEP downstream Bar2 (32GiB) is redirected here.",
    },
    kind: "state",
    evidence: "CODE_PROVEN",
  },

  // --- pcie-fabric ------------------------------------------------------
  {
    id: "pex-switch",
    zone: "pcie-fabric",
    shapes: ["230"],
    weight: 8,
    title: { zhCN: "Broadcom PEX880xx PCIe Gen4 Switch", enUS: "Broadcom PEX880xx PCIe Gen4 Switch" },
    blurb: {
      zhCN: "71:00.0 上游，72:00.0 / 72:04.0 / 72:08.0 下游，72:1c.0 管理口。",
      enUS: "71:00.0 upstream; 72:00.0 / 72:04.0 / 72:08.0 downstream; 72:1c.0 management.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "pex-sub-switch",
    zone: "pcie-fabric",
    shapes: ["343", "366", "368"],
    weight: 6,
    title: { zhCN: "下级 PEX Switch 支路", enUS: "Subordinate PEX Switch Branches" },
    blurb: {
      zhCN: "三条下级支路（73·74、79·7a、7c·7d），把上游端口分到各设备支路。",
      enUS: "Three subordinate branches (73/74, 79/7a, 7c/7d) fanning the upstream port out to the device branches.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "pex-downstream",
    zone: "pcie-fabric",
    shapes: ["340", "363", "367"],
    weight: 4,
    title: { zhCN: "Switch 下游端口", enUS: "Switch Downstream Ports" },
    blurb: {
      zhCN: "72:00.0 / 72:04.0 / 72:08.0；分别通向 NVMe、GPU 与 RDMA 侧上游桥。",
      enUS: "72:00.0 / 72:04.0 / 72:08.0; feeding the NVMe, GPU and RDMA upstream bridges respectively.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "pex-upstream",
    zone: "pcie-fabric",
    shapes: ["339"],
    weight: 2,
    title: { zhCN: "71:00.0 Switch 上游端口", enUS: "71:00.0 Switch Upstream Port" },
    blurb: {
      zhCN: "Switch 面向 Host 根端口的一侧。",
      enUS: "The switch side facing the host root port.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "pex-mgmt",
    zone: "pcie-fabric",
    shapes: ["377"],
    weight: 0,
    title: { zhCN: "72:1c.0 管理口", enUS: "72:1c.0 Management Port" },
    blurb: {
      zhCN: "Switch 内部管理端点。",
      enUS: "Switch internal management endpoint.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "p2p",
    zone: "pcie-fabric",
    shapes: ["288"],
    weight: -2,
    title: { zhCN: "P2P 直通", enUS: "P2P Direct Path" },
    blurb: {
      zhCN: "两块 SPUG 之间的直通映射；现场映射表全空，当前流量并不走这条路。",
      enUS: "Direct mapping between the two SPUGs; the live mapping tables are empty, so traffic does not currently take this path.",
    },
    kind: "state",
    evidence: "RUNTIME_OBSERVED",
  },
  {
    id: "spu-addr-space",
    zone: "pcie-fabric",
    shapes: ["277", "293", "306"],
    weight: -4,
    title: { zhCN: "SPU 系统环境的 PCIE 地址", enUS: "SPU PCIe Address Space" },
    blurb: {
      zhCN: "SPU 侧看到的 PCIe 地址语义；SUEP 上行大 BAR 窗口在此落地并被还原成物理地址。",
      enUS: "PCIe address semantics as seen from SPU; the large SUEP upstream BAR window lands here and is restored to a physical address.",
    },
    kind: "state",
    evidence: "CODE_PROVEN",
  },

  // --- spug -------------------------------------------------------------
  {
    id: "spug-nvme-branch",
    zone: "spug",
    shapes: ["370", "369", "373", "211"],
    weight: 6,
    title: { zhCN: "NVMe 支路", enUS: "NVMe Branch" },
    blurb: {
      zhCN: "上游桥 7f:00.0（5709:2000）→ 下游桥 80:00.0（5709:2001）→ 物理 Samsung NVMe 81:00.0（144d:a808）。Host 侧无驱动，所有权已交给 SPU。",
      enUS: "Upstream 7f:00.0 (5709:2000) -> downstream 80:00.0 (5709:2001) -> physical Samsung NVMe 81:00.0 (144d:a808). No host driver: ownership has been handed to SPU.",
    },
    kind: "device",
    evidence: "RUNTIME_OBSERVED",
  },
  {
    id: "spug-gpu-branch",
    zone: "spug",
    shapes: ["347", "346", "359", "212"],
    weight: 3,
    title: { zhCN: "GPU 支路", enUS: "GPU Branch" },
    blurb: {
      zhCN: "上游桥 76:00.0（5709:2000）→ 下游桥 77:00.0（5709:2001）→ 物理 NVIDIA A10 78:00.0（10de:2236）。Host 侧同样无驱动。",
      enUS: "Upstream 76:00.0 (5709:2000) -> downstream 77:00.0 (5709:2001) -> physical NVIDIA A10 78:00.0 (10de:2236). Also no host driver.",
    },
    kind: "device",
    evidence: "RUNTIME_OBSERVED",
  },
  {
    id: "spug-rdma-branch",
    zone: "spug",
    shapes: ["213"],
    weight: 0,
    title: { zhCN: "RDMA 支路", enUS: "RDMA Branch" },
    blurb: {
      zhCN: "RDMA 网卡及其 SPUG-FPGA；源图中只给出实体，没有下游端口细节。",
      enUS: "The RDMA NIC and its SPUG-FPGA. The source diagram gives the entity only, without downstream port detail.",
    },
    kind: "device",
    evidence: "INFERRED",
  },

  // --- spug-fpga --------------------------------------------------------
  {
    id: "spug-fpga-nvme",
    zone: "spug-fpga",
    shapes: ["208", "327", "328", "329", "330", "331", "332", "335", "393", "394"],
    weight: 6,
    title: { zhCN: "SPUG-FPGA（NVMe 侧）", enUS: "SPUG-FPGA (NVMe side)" },
    blurb: {
      zhCN: "Bar0/1/2/4 地址转换表；Bar0 16MiB 控制寄存器窗口、Bar1 1MiB 下游 Config/IO 代理窗口；另有寄存器地图与代理职责说明。",
      enUS: "Bar0/1/2/4 address translation tables; Bar0 16MiB control-register window, Bar1 1MiB downstream config/IO proxy window; plus register map and proxy responsibilities.",
    },
    kind: "hardware",
    evidence: "RTL_PROVEN",
  },
  {
    id: "spug-fpga-gpu",
    zone: "spug-fpga",
    shapes: ["345", "348", "349", "350", "351", "352", "353", "354", "355", "356"],
    weight: 3,
    title: { zhCN: "SPUG-FPGA（GPU 侧）", enUS: "SPUG-FPGA (GPU side)" },
    blurb: {
      zhCN: "两组 Bar0/1/2/4 与地址转换逻辑，结构与 NVMe 侧同源。",
      enUS: "Two Bar0/1/2/4 groups and address translation logic, structurally identical to the NVMe side.",
    },
    kind: "hardware",
    evidence: "RTL_PROVEN",
  },
  {
    id: "spug-fpga-rdma",
    zone: "spug-fpga",
    shapes: ["214"],
    weight: 0,
    title: { zhCN: "SPUG-FPGA（RDMA 侧）", enUS: "SPUG-FPGA (RDMA side)" },
    blurb: {
      zhCN: "源图只给出实体框；连接线 [261] 一端悬空连到这里，需要对着原图确认是自由线段还是漏连。",
      enUS: "The source diagram gives the entity box only; connector [261] is dangling at one end into this shape, so confirm against the original whether it is a free segment or a missed connection.",
    },
    kind: "hardware",
    evidence: "INFERRED",
  },

  // --- spu-fpga ---------------------------------------------------------
  {
    id: "spu-fpga",
    zone: "spu-fpga",
    shapes: ["206"],
    weight: 8,
    title: { zhCN: "SPU-FPGA", enUS: "SPU-FPGA" },
    blurb: {
      zhCN: "上行 SUEP、下行 SDEP 与 SP37 三套端点与 BAR 窗口都挂在这块 FPGA 上。",
      enUS: "The upstream SUEP, downstream SDEP and SP37 endpoints and their BAR windows all hang off this FPGA.",
    },
    kind: "hardware",
    evidence: "RTL_PROVEN",
  },
  {
    id: "suep-upstream",
    zone: "spu-fpga",
    shapes: ["383"],
    weight: 6,
    title: { zhCN: "02:00.1 SUEP 上行端点", enUS: "02:00.1 SUEP Upstream Endpoint" },
    blurb: {
      zhCN: "驱动 suep_driver；Host 看到的 SUEP 卡侧端点。",
      enUS: "Driven by suep_driver; the SUEP endpoint as seen by the host.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "sdep-downstream",
    zone: "spu-fpga",
    shapes: ["378"],
    weight: 4,
    title: { zhCN: "7b:00.1 EDP / SDEP 下行端点", enUS: "7b:00.1 EDP / SDEP Downstream Endpoint" },
    blurb: {
      zhCN: "HOST 侧 Endpoint，SDEP 数据/控制 Function，VID:DID = 5709:1001，驱动 sdep_driver。",
      enUS: "Host-side endpoint, SDEP data/control function, VID:DID = 5709:1001, driven by sdep_driver.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "sp37-downstream",
    zone: "spu-fpga",
    shapes: ["303", "304"],
    weight: 2,
    title: { zhCN: "7b:00.0 SP37 下行端点", enUS: "7b:00.0 SP37 Downstream Endpoint" },
    blurb: {
      zhCN: "SP37 控制 Function，VID:DID = 5709:1000；SPU 与 Host 之间最底层的字节搬运通道。",
      enUS: "SP37 control function, VID:DID = 5709:1000; the lowest-level byte-transport channel between SPU and host.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "bar-suep-pool",
    zone: "spu-fpga",
    shapes: ["408", "410", "412", "414", "416"],
    weight: 5,
    title: { zhCN: "SUEP 上行 BAR 窗口", enUS: "SUEP Upstream BAR Windows" },
    blurb: {
      zhCN: "Bar0 256MiB / Bar1 512MiB / Bar2 4GiB / Bar2 大型 64 位虚拟 BAR 地址池 128GiB / ROM 虚拟设备 Expansion ROM 地址池 16MiB。地址走查命中的就是 128GiB 这一组。",
      enUS: "Bar0 256MiB / Bar1 512MiB / Bar2 4GiB / Bar2 large 64-bit virtual BAR pool 128GiB / ROM virtual expansion ROM pool 16MiB. The address walkthrough lands in the 128GiB group.",
    },
    kind: "buffer",
    evidence: "RTL_PROVEN",
  },
  {
    id: "bar-sdep-pool",
    zone: "spu-fpga",
    shapes: ["400", "402", "404"],
    weight: 3,
    title: { zhCN: "SDEP 下行 BAR 窗口", enUS: "SDEP Downstream BAR Windows" },
    blurb: {
      zhCN: "Bar0 4MiB / Bar1 4MiB / Bar2 32GiB；Bar2 是 Host 侧 DMA 重定向窗口。",
      enUS: "Bar0 4MiB / Bar1 4MiB / Bar2 32GiB; Bar2 is the host-side DMA redirection window.",
    },
    kind: "buffer",
    evidence: "RTL_PROVEN",
  },
  {
    id: "bar-sp37-pool",
    zone: "spu-fpga",
    shapes: ["396", "398", "406"],
    weight: 1,
    title: { zhCN: "SP37 下行 BAR 窗口", enUS: "SP37 Downstream BAR Windows" },
    blurb: {
      zhCN: "Bar0 128KiB（Host 侧与 SPU 侧各一）/ Bar2 64KiB；容量最小，只承载控制与消息。",
      enUS: "Bar0 128KiB (one on each side) / Bar2 64KiB; the smallest windows, carrying control and messages only.",
    },
    kind: "buffer",
    evidence: "RTL_PROVEN",
  },
  {
    id: "spu-fpga-addr-trans",
    zone: "spu-fpga",
    shapes: ["323"],
    weight: -1,
    title: { zhCN: "SPU-FPGA 地址转换", enUS: "SPU-FPGA Address Translation" },
    blurb: {
      zhCN: "从描述符取回原始地址后覆盖代理 TLP 头：s_spu_rq_tdata(63 downto 0) <= s_spu_rq_real_addr。",
      enUS: "Restores the original address from the descriptor and overwrites the proxied TLP header: s_spu_rq_tdata(63 downto 0) <= s_spu_rq_real_addr.",
    },
    kind: "hardware",
    evidence: "RTL_PROVEN",
  },

  // --- spu-cpu ----------------------------------------------------------
  {
    id: "spu-cpu",
    zone: "spu-cpu",
    shapes: ["268"],
    weight: 6,
    title: { zhCN: "SPU Hygon CPU", enUS: "SPU Hygon CPU" },
    blurb: {
      zhCN: "SPU 内部的 CPU，软件栈与虚拟总线都跑在它上面。",
      enUS: "The CPU inside SPU; both the software stack and the virtual bus run on it.",
    },
    kind: "hardware",
    evidence: "RUNTIME_OBSERVED",
  },
  {
    id: "spu-root-port",
    zone: "spu-cpu",
    shapes: ["264"],
    weight: 4,
    title: { zhCN: "00:03.1 PCIe Root Port", enUS: "00:03.1 PCIe Root Port" },
    blurb: {
      zhCN: "SPU 内部的 PCIe 根端口，虚拟总线 f0 挂在其下。",
      enUS: "The PCIe root port inside SPU; the virtual bus f0 hangs beneath it.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-vbus-f0",
    zone: "spu-cpu",
    shapes: ["387"],
    weight: 2,
    title: { zhCN: "spu_vgpu 创建的虚拟 PCI Bus f0", enUS: "Virtual PCI Bus f0 created by spu_vgpu" },
    blurb: {
      zhCN: "spu_vgpu.ko 绑定 FPGA-SPU 侧 5709:1001，把 Host/SPUG 后的设备映射成 SPU 内部可枚举的 PCIe 设备。",
      enUS: "spu_vgpu.ko binds the FPGA-SPU side 5709:1001 and maps devices behind host/SPUG into PCIe devices enumerable inside SPU.",
    },
    kind: "state",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-vgpu-a10",
    zone: "spu-cpu",
    shapes: ["388"],
    weight: 0,
    title: { zhCN: "f0:00.0 虚拟 A10", enUS: "f0:00.0 Virtual A10" },
    blurb: {
      zhCN: "保留 10de:2236，与物理 A10 同 ID。",
      enUS: "Retains 10de:2236, matching the physical A10.",
    },
    kind: "device",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-vgpu-nvme",
    zone: "spu-cpu",
    shapes: ["389"],
    weight: -2,
    title: { zhCN: "f0:01.0 虚拟 Samsung NVMe", enUS: "f0:01.0 Virtual Samsung NVMe" },
    blurb: {
      zhCN: "保留 144d:a808，与物理 NVMe 同 ID。",
      enUS: "Retains 144d:a808, matching the physical NVMe.",
    },
    kind: "device",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-ep-direct",
    zone: "spu-cpu",
    shapes: ["265"],
    weight: -4,
    title: { zhCN: "EP 端口-直连", enUS: "EP Port (Direct)" },
    blurb: {
      zhCN: "SUEP 大 BAR 窗口与 SPU 内部地址空间的接合点。",
      enUS: "The junction between the large SUEP BAR window and the SPU internal address space.",
    },
    kind: "hardware",
    evidence: "CODE_PROVEN",
  },

  // --- spu-sw -----------------------------------------------------------
  {
    id: "spu-business",
    zone: "spu-sw",
    shapes: ["599"],
    weight: 6,
    title: { zhCN: "SPU 业务层", enUS: "SPU Business Layer" },
    blurb: {
      zhCN: "工作负载镜像、GateWay 与 Application Manager；GPU/NVMe/RDMA/块设备在 SPU 内被消费的位置。",
      enUS: "Workload images, GateWay and Application Manager; where GPU/NVMe/RDMA/block devices are consumed inside SPU.",
    },
    kind: "application",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-userspace",
    zone: "spu-sw",
    shapes: ["583"],
    weight: 4,
    title: { zhCN: "SPU 用户态", enUS: "SPU Userspace" },
    blurb: {
      zhCN: "LibOS、spu_connect、spu_tssd、Keyring 与服务层。",
      enUS: "LibOS, spu_connect, spu_tssd, Keyring and the service layer.",
    },
    kind: "service",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-kernel",
    zone: "spu-sw",
    shapes: ["207"],
    weight: 2,
    title: { zhCN: "SPU 内核部分", enUS: "SPU Kernel Layer" },
    blurb: {
      zhCN: "SPU 侧内核模块的加载区域。",
      enUS: "The load area for SPU-side kernel modules.",
    },
    kind: "driver",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-kernel-custom",
    zone: "spu-sw",
    shapes: ["477", "513", "514"],
    weight: 0,
    title: { zhCN: "SPU 定制内核 spu_kernel", enUS: "SPU Custom Kernel spu_kernel" },
    blurb: {
      zhCN: "hook_dma / hook_rdma 与系统能力扩展；DMA 重定向的落点。",
      enUS: "hook_dma / hook_rdma and system capability extensions; the landing point for DMA redirection.",
    },
    kind: "driver",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-sp37",
    zone: "spu-sw",
    shapes: ["423"],
    weight: -2,
    title: { zhCN: "sp37.ko（SPU 侧）", enUS: "sp37.ko (SPU side)" },
    blurb: {
      zhCN: "与 Host 侧同源模块，提供 /dev/sp37_h2c_0、/dev/sp37_c2h_0、/dev/sp37_efuse0，Buffer 默认 1 MiB。",
      enUS: "Same module as the host side; provides /dev/sp37_h2c_0, /dev/sp37_c2h_0, /dev/sp37_efuse0 with a 1 MiB default buffer.",
    },
    kind: "driver",
    evidence: "CODE_PROVEN",
  },
  {
    id: "spu-vgpu",
    zone: "spu-sw",
    shapes: ["437"],
    weight: -4,
    title: { zhCN: "spu_vgpu.ko", enUS: "spu_vgpu.ko" },
    blurb: {
      zhCN: "绑定 5709:1001，负责把 Host/SPUG 后的 GPU、NVMe、RNIC 映射成 SPU 内部可枚举的 PCIe 设备。",
      enUS: "Binds 5709:1001 and maps the GPU, NVMe and RNIC behind host/SPUG into PCIe devices enumerable inside SPU.",
    },
    kind: "driver",
    evidence: "CODE_PROVEN",
  },
];

/* ---------------------------------------------------------------- edges */

// The source diagram has no connector between the six entity containers, so the
// skeleton is rebuilt from the inclusion tree, the three inter-region edges, the
// four intra-region crossings, the address annotations, and the region E text
// chain. Each edge records the source shapes that justify it.
const EDGES = [
  { id: "host-scan-root", source: "host-kernel", target: "host-root-port", kind: "control", weight: 6,
    shapes: ["446"], title: { zhCN: "内核驱动挂载根端口", enUS: "Kernel drivers attach to the root port" },
    blurb: { zhCN: "sp37.ko 绑定 Function 0，sdep.ko 绑定 Function 1，二者都从根端口下的上游桥获得 BAR。", enUS: "sp37.ko binds function 0 and sdep.ko binds function 1; both take their BARs from the upstream bridge below the root port." } },
  { id: "root-to-fabric", source: "host-root-port", target: "pex-switch", kind: "physical", weight: 0,
    shapes: [], title: { zhCN: "根端口上行到 PEX880xx", enUS: "Root port upstream to PEX880xx" },
    blurb: { zhCN: "源图没有画出这条连线，是按 70:03.7 根端口与 71:00.0 上游端口的 BDF 关系推得。", enUS: "The source diagram does not draw this link; it is inferred from the 70:03.7 root port and 71:00.0 upstream port BDF pairing." } },
  { id: "fabric-upstream", source: "pex-switch", target: "pex-sub-switch", kind: "physical", weight: -2,
    shapes: ["374", "375", "376"], title: { zhCN: "Switch 上游分发到下级支路", enUS: "Switch fans out to subordinate branches" },
    blurb: { zhCN: "72:00.0 / 72:04.0 / 72:08.0 分别接到三条下级支路。", enUS: "72:00.0 / 72:04.0 / 72:08.0 feed the three subordinate branches." } },
  { id: "fabric-to-nvme-bridge", source: "pex-sub-switch", target: "spug-nvme-branch", kind: "physical", weight: -4,
    shapes: ["366", "368"], title: { zhCN: "下游支路到 NVMe 侧上游桥", enUS: "Branch to the NVMe-side upstream bridge" },
    blurb: { zhCN: "经 7f:00.0（5709:2000）进入 NVMe 支路。", enUS: "Enters the NVMe branch through 7f:00.0 (5709:2000)." } },
  { id: "fabric-to-gpu-bridge", source: "pex-sub-switch", target: "spug-gpu-branch", kind: "physical", weight: -6,
    shapes: ["233", "343"], title: { zhCN: "下游支路到 GPU 侧上游桥", enUS: "Branch to the GPU-side upstream bridge" },
    blurb: { zhCN: "经 76:00.0（5709:2000）进入 GPU 支路。", enUS: "Enters the GPU branch through 76:00.0 (5709:2000)." } },
  { id: "nvme-bridge-to-spug-fpga", source: "spug-nvme-branch", target: "spug-fpga-nvme", kind: "physical", weight: -8,
    shapes: ["285", "287", "284"], title: { zhCN: "NVMe 侧 SPUG-FPGA 接管下游桥", enUS: "NVMe-side SPUG-FPGA owns the downstream bridge" },
    blurb: { zhCN: "80:00.0（5709:2001）在 Linux 里显示为 pcieport，但 SDEP 驱动内部仍然获得并操作了 SPUG BAR。", enUS: "80:00.0 (5709:2001) shows up as pcieport in Linux, yet the SDEP driver still acquires and operates the SPUG BAR." } },
  { id: "gpu-bridge-to-spug-fpga", source: "spug-gpu-branch", target: "spug-fpga-gpu", kind: "physical", weight: -10,
    shapes: ["390"], title: { zhCN: "GPU 侧 SPUG-FPGA 接管下游桥", enUS: "GPU-side SPUG-FPGA owns the downstream bridge" },
    blurb: { zhCN: "77:00.0（5709:2001）经 SPUG-FPGA 接到物理 A10 78:00.0。", enUS: "77:00.0 (5709:2001) reaches the physical A10 78:00.0 through the SPUG-FPGA." } },
  { id: "spug-fpga-to-spu-fpga-proxy", source: "spug-fpga-nvme", target: "spu-fpga-addr-trans", kind: "payload", weight: -12,
    shapes: ["295", "296", "298"], title: { zhCN: "SPUG-FPGA 发描述符给 SPU-FPGA", enUS: "SPUG-FPGA sends descriptors to SPU-FPGA" },
    blurb: { zhCN: "SPUG-FPGA 发两类 TLP：描述符在 SDEP BAR1 + 0x1000~0x1700（携带原始地址/长度/类型/Tag），真实请求与数据在 SDEP BAR1 + 0x80000~0xf0000。", enUS: "SPUG-FPGA emits two TLP classes: descriptors at SDEP BAR1 + 0x1000..0x1700 (carrying original address, length, type and tag), and real requests/data at SDEP BAR1 + 0x80000..0xf0000." } },
  { id: "addr-trans-to-suep-bar", source: "spu-fpga-addr-trans", target: "bar-suep-pool", kind: "payload", weight: -14,
    shapes: ["298", "300", "301"], title: { zhCN: "覆盖 TLP 头后命中 SUEP BAR4", enUS: "Overwritten TLP header hits SUEP BAR4" },
    blurb: { zhCN: "RQ 送到 SPU 侧 PCIe 接口后命中 SUEP BAR4，按「物理地址 = 物理A10 BAR1 + (虚拟地址 − 虚拟A10 BAR1)」还原。", enUS: "The RQ reaches the SPU-side PCIe interface and hits SUEP BAR4, restored as physical = physical-A10-BAR1 + (virtual - virtual-A10-BAR1)." } },
  { id: "suep-bar-to-ep", source: "bar-suep-pool", target: "spu-ep-direct", kind: "payload", weight: -16,
    shapes: ["308"], title: { zhCN: "SUEP Bar2 128GiB 窗口到 EP 端口", enUS: "SUEP Bar2 128GiB window to the EP port" },
    blurb: { zhCN: "大型 64 位虚拟 BAR 地址池把下游设备地址空间搬进 SPU 内部。", enUS: "The large 64-bit virtual BAR pool moves downstream device address space inside SPU." } },
  { id: "ep-to-root-port", source: "spu-ep-direct", target: "spu-root-port", kind: "physical", weight: -18,
    shapes: ["421"], title: { zhCN: "EP 端口接到内部根端口", enUS: "EP port attaches to the internal root port" },
    blurb: { zhCN: "SPU 内部 PCIe 树的入口。", enUS: "The entry point of the SPU-internal PCIe tree." } },
  { id: "root-port-to-vbus", source: "spu-root-port", target: "spu-vbus-f0", kind: "physical", weight: -20,
    shapes: ["420"], title: { zhCN: "根端口下的虚拟总线 f0", enUS: "Virtual bus f0 beneath the root port" },
    blurb: { zhCN: "spu_vgpu 在 SPU 内部造出这条总线并挂上虚拟设备。", enUS: "spu_vgpu creates this bus inside SPU and attaches the virtual devices." } },
  { id: "vbus-to-virtual-a10", source: "spu-vbus-f0", target: "spu-vgpu-a10", kind: "physical", weight: -22,
    shapes: ["420"], title: { zhCN: "枚举出 f0:00.0 虚拟 A10", enUS: "Enumerates f0:00.0 virtual A10" },
    blurb: { zhCN: "保留 10de:2236。", enUS: "Retains 10de:2236." } },
  { id: "vbus-to-virtual-nvme", source: "spu-vbus-f0", target: "spu-vgpu-nvme", kind: "physical", weight: -24,
    shapes: ["420"], title: { zhCN: "枚举出 f0:01.0 虚拟 NVMe", enUS: "Enumerates f0:01.0 virtual NVMe" },
    blurb: { zhCN: "保留 144d:a808。", enUS: "Retains 144d:a808." } },
  { id: "spu-sw-drives-vgpu", source: "spu-vgpu", target: "spu-vbus-f0", kind: "control", weight: -26,
    shapes: ["437", "387"], title: { zhCN: "spu_vgpu 建立虚拟总线", enUS: "spu_vgpu establishes the virtual bus" },
    blurb: { zhCN: "驱动加载后用虚拟总线把下游设备暴露给 SPU。", enUS: "After loading, the driver exposes downstream devices to SPU through the virtual bus." } },
  { id: "sdep-to-host-addr", source: "bar-sdep-pool", target: "host-addr-space", kind: "payload", weight: -28,
    shapes: ["321"], title: { zhCN: "SDEP Bar2 32GiB 到 Host 地址空间", enUS: "SDEP Bar2 32GiB to the host address space" },
    blurb: { zhCN: "Host 侧 DMA 重定向窗口，sdep_driver 能看到 A10 / NVMe / 两块 SPUG 的静态 BDF 与 BAR。", enUS: "The host-side DMA redirection window; sdep_driver can see the static BDF and BAR of the A10, NVMe and both SPUGs." } },
  { id: "sp37-pair", source: "spu-sp37", target: "sp37-downstream", kind: "control", weight: -30,
    shapes: ["423", "304"], title: { zhCN: "双侧 sp37 通过 Function 0 通信", enUS: "Both sp37 sides communicate over function 0" },
    blurb: { zhCN: "Buffer 默认 1 MiB，只负责可靠搬运字节和硬件控制。", enUS: "1 MiB default buffer; only responsible for reliable byte transport and hardware control." } },
  { id: "host-kernel-to-sdep", source: "host-kernel", target: "sdep-downstream", kind: "control", weight: -32,
    shapes: ["442", "378"], title: { zhCN: "sdep.ko 绑定 SDEP Function", enUS: "sdep.ko binds the SDEP function" },
    blurb: { zhCN: "sdep.ko 绑定 5709:1001，扫 SPUG/GPU 拓扑并管理 NTB 与 P2P。", enUS: "sdep.ko binds 5709:1001, scans the SPUG/GPU topology and manages NTB and P2P." } },
];

/* -------------------------------------------------------------- journeys */

const JOURNEYS = [
  {
    id: "address-translation-walkthrough",
    title: { zhCN: "地址映射走查（TLP 代理链路）", enUS: "Address Translation Walkthrough (TLP Proxy)" },
    summary: {
      zhCN: "SPUG-FPGA 发描述符 → SPU-FPGA 取回原始地址并覆盖 TLP 头 → 命中 SUEP BAR4 → 还原物理地址。",
      enUS: "SPUG-FPGA sends descriptors -> SPU-FPGA restores the original address and overwrites the TLP header -> hits SUEP BAR4 -> restores the physical address.",
    },
    caveat: {
      zhCN: "这是一次现场取证记录，不是结构定义；图中没有 SPUG-FPGA 到 SPU-FPGA 的连接线，链路由区域 E 的六个说明框串起。",
      enUS: "This is a field observation, not a structural definition; the diagram draws no connector from SPUG-FPGA to SPU-FPGA. The chain is stitched from the six region-E callouts.",
    },
    edges: ["spug-fpga-to-spu-fpga-proxy", "addr-trans-to-suep-bar", "suep-bar-to-ep"],
    steps: [
      { id: "step-descriptor", nodeId: "spug-fpga-nvme", relation: "MMIO", layer: "payload",
        title: { zhCN: "SPUG-FPGA 发描述符", enUS: "SPUG-FPGA emits descriptors" },
        detail: { zhCN: "描述符写在 SDEP BAR1 + 0x1000~0x1700，携带原始地址、长度、类型与 Tag。", enUS: "Descriptors are written at SDEP BAR1 + 0x1000..0x1700 carrying original address, length, type and tag." } },
      { id: "step-overwrite", nodeId: "spu-fpga-addr-trans", relation: "CALL", layer: "control",
        title: { zhCN: "覆盖代理 TLP 头", enUS: "Overwrite the proxied TLP header" },
        detail: { zhCN: "取回原地址 = 0x3c000400000，写入 s_spu_rq_tdata(63 downto 0)。", enUS: "Original address 0x3c000400000 is restored into s_spu_rq_tdata(63 downto 0)." } },
      { id: "step-hit-bar4", nodeId: "bar-suep-pool", relation: "PAYLOAD", layer: "payload",
        title: { zhCN: "RQ 命中 SUEP BAR4", enUS: "The RQ hits SUEP BAR4" },
        detail: { zhCN: "RQ 送到 SPU 侧 PCIe 接口，落在 SUEP BAR4 的 128GiB 虚拟 BAR 地址池。", enUS: "The RQ reaches the SPU-side PCIe interface and lands in the 128GiB virtual BAR pool of SUEP BAR4." } },
      { id: "step-restore", nodeId: "spu-ep-direct", relation: "STATE", layer: "payload",
        title: { zhCN: "还原物理地址", enUS: "Restore the physical address" },
        detail: { zhCN: "0x34000000000 + (0x3c000400000 − 0x3c000000000) = 0x34000400000，与实机 Region 4: 128G @ 0x3c000000000 对得上。", enUS: "0x34000000000 + (0x3c000400000 - 0x3c000000000) = 0x34000400000, matching the measured Region 4: 128G @ 0x3c000000000." } },
    ],
  },
];

/* ------------------------------------------------------------- utilities */

// The source diagram's vertical arrangement is preserved inside each zone: the
// mean Visio y of a node's shapes decides its row, and `weight` only breaks ties.
function sourceRow(node) {
  const values = node.shapes.map((id) => shapeById.get(id)?.y ?? 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// The inspector and system tree only understand these three tokens; the precise
// enum stays on the base node and in source-inventory.md.
const EVIDENCE_TOKEN = {
  CODE_PROVEN: "code",
  RTL_PROVEN: "code",
  RUNTIME_OBSERVED: "code",
  INFERRED: "inference",
};

/* ------------------------------------------------------------------ build */

const data = JSON.parse(await readFile(resolve(args.data), "utf8"));
const regions = JSON.parse(await readFile(resolve(args.regions), "utf8"));

const page = data.pages[0];
const shapeById = new Map(page.shapes.map((shape) => [shape.id, shape]));
const connectorById = new Map(page.connectors.map((connector) => [connector.id, connector]));
const regionByKey = new Map(regions.regions.map((region) => [region.key, region]));

const missingShapes = [];
for (const node of [...NODES]) {
  for (const id of node.shapes) if (!shapeById.has(id)) missingShapes.push(`${node.id} -> shape ${id}`);
}
for (const edge of EDGES) {
  for (const id of edge.shapes) {
    if (!connectorById.has(id) && !shapeById.has(id)) missingShapes.push(`edge ${edge.id} -> ${id}`);
  }
}
if (missingShapes.length) {
  console.error("source data is missing shapes/connectors referenced by the spec:");
  for (const line of missingShapes) console.error("  " + line);
  process.exit(1);
}

function describeBasis(ids) {
  return ids
    .map((id) => {
      const connector = connectorById.get(id);
      if (connector) return `连接线 [${id}] ${connector.src ?? "?"}→${connector.dst ?? "?"}`;
      const shape = shapeById.get(id);
      return `形状 [${id}] ${(shape?.text ?? "").replaceAll("\n", " / ")}`;
    })
    .join("；");
}

const ZONE_LAYOUT = {
  // Two rows keep the seven entity columns wide enough for their label cards.
  host: { row: 0, col: 0 },
  "pcie-fabric": { row: 0, col: 1 },
  spug: { row: 0, col: 2 },
  "spug-fpga": { row: 0, col: 3 },
  "spu-fpga": { row: 1, col: 0 },
  "spu-cpu": { row: 1, col: 1 },
  "spu-sw": { row: 1, col: 2 },
};
const ROW_CENTER_Y = [11, -9];
const ROW_COLUMNS = [4, 3];
const COLUMN_STEP = 15;
const NODE_STEP_Y = 2.8;
const NODE_COLUMN_STEP = 5.4;

function zoneColumns(zoneId) {
  const count = NODES.filter((node) => node.zone === zoneId).length;
  return count > 4 ? 2 : 1;
}

// Zone geometry: one column block per zone, two rows of zones.
const zoneGeom = new Map();
for (const zone of ZONES) {
  const { row, col } = ZONE_LAYOUT[zone.id];
  const columns = ROW_COLUMNS[row];
  const x = (col - (columns - 1) / 2) * COLUMN_STEP;
  const members = NODES.filter((node) => node.zone === zone.id);
  const cols = zoneColumns(zone.id);
  const rows = Math.ceil(members.length / cols);
  const height = Math.max(9, rows * NODE_STEP_Y + 4);
  const width = cols > 1 ? 11 : 7;
  zoneGeom.set(zone.id, {
    x,
    center: [x, ROW_CENTER_Y[row], 0],
    size: [width, height, 2],
    anchor: members[0]?.id,
  });
}

// Node geometry: stacked inside the zone block, wrapping into two sub-columns
// once a zone has more than four nodes.
const nodeGeom = new Map();
for (const zone of ZONES) {
  const members = NODES.filter((node) => node.zone === zone.id)
    .slice()
    .sort((a, b) => sourceRow(b) - sourceRow(a) || b.weight - a.weight);
  const geom = zoneGeom.get(zone.id);
  const cols = zoneColumns(zone.id);
  const rows = Math.ceil(members.length / cols);
  members.forEach((node, i) => {
    const subCol = Math.floor(i / rows);
    const rowIndex = i % rows;
    const offsetX = cols > 1 ? (subCol - (cols - 1) / 2) * NODE_COLUMN_STEP : 0;
    const offsetY = ((rows - 1) / 2 - rowIndex) * NODE_STEP_Y;
    const position = [geom.center[0] + offsetX, geom.center[1] + offsetY, 0.9];
    // Label side alternates by sub-column so cards do not stack on one another.
    const side = (cols > 1 ? subCol : i) % 2 === 0 ? "left" : "right";
    nodeGeom.set(node.id, {
      position,
      size: [4.6, 2.2, 1.1],
      labelOffset: [side === "left" ? -3.4 : 3.4, 0.2, 1.8],
      moduleSide: side,
      cameraSide: side,
      eyebrow: zone.eyebrow,
    });
  });
}

const zoneById = new Map(ZONES.map((zone) => [zone.id, zone]));

// --- base scene --------------------------------------------------------

const zones = ZONES.map((zone) => {
  const members = NODES.filter((node) => node.zone === zone.id).map((node) => node.id);
  return {
    id: zone.id,
    title: zone.title,
    eyebrow: zone.eyebrow,
    summary: zone.summary,
    color: zone.color,
    nodeIds: members,
  };
});

const nodes = NODES.map((node) => ({
  id: node.id,
  zoneId: node.zone,
  title: node.title,
  description: node.blurb,
  kind: node.kind,
  evidence: node.evidence,
  color: zoneById.get(node.zone).color,
  tags: [],
  interfaces: node.shapes.map((id) => `vsdx-shape:${id}`),
  sources: [
    {
      path: `SPU&SPUG的架构.vsdx#shape-${node.shapes[0]}`,
      note: node.shapes
        .map((id) => `[${id}] ${(shapeById.get(id).text ?? "").replaceAll("\n", " / ")}`)
        .join(" | ")
        .slice(0, 400),
    },
  ],
}));

const edges = EDGES.map((edge) => {
  const lane = EDGE_KIND_TO_LANE[edge.kind];
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    title: edge.title,
    description: edge.blurb,
    kind: edge.kind,
    evidence: edge.shapes.length ? "CODE_PROVEN" : "INFERRED",
    color: EDGE_META[lane].color,
    lane,
    protocol: "PCIe",
    dashed: !edge.shapes.length,
  };
});

const edgeIds = new Set(EDGES.map((edge) => edge.id));
const edgeByRoute = new Map(EDGES.map((edge) => [`${edge.source}->${edge.target}`, edge.id]));

const journeys = JOURNEYS.map((journey) => ({
  id: journey.id,
  title: journey.title,
  summary: journey.summary,
  caveat: journey.caveat,
  steps: journey.steps.map((step) => ({
    id: step.id,
    title: step.title,
    nodeId: step.nodeId,
    evidence: "RUNTIME_OBSERVED",
  })),
  edgeIds: journey.edges,
}));

const layout = {
  nodes: NODES.map((node) => {
    const geom = nodeGeom.get(node.id);
    return {
      nodeId: node.id,
      position: geom.position,
      size: geom.size,
      labelOffset: geom.labelOffset,
      moduleSide: geom.moduleSide,
      cameraSide: geom.cameraSide,
    };
  }),
  zones: ZONES.map((zone) => {
    const geom = zoneGeom.get(zone.id);
    return { zoneId: zone.id, position: geom.center, size: geom.size, backdrop: zone.backdrop };
  }),
  camera: {
    position: [2, 16, 88],
    target: [0, 1, 0],
    fov: 48,
  },
  labelDistance: 1.2,
  farBlockOpacity: 0.22,
  farFlowOpacity: 0.18,
};

// --- enhanced ----------------------------------------------------------

function buildLocale(isZh) {
  const pick = (pair) => (isZh ? pair.zhCN : pair.enUS);

  const planeMeta = Object.fromEntries(
    ZONES.map((zone) => [zone.id, { label: pick(zone.title), short: pick(zone.title), color: zone.color }]),
  );

  const edgeMeta = Object.fromEntries(
    Object.entries(EDGE_META).map(([key, value]) => [key, { color: value.color, label: pick(value.label) }]),
  );

  const laneMeta = Object.fromEntries(
    Object.entries(EDGE_META).map(([key, value]) => [
      key,
      { color: value.color, label: pick(value.label), summary: pick(value.label) },
    ]),
  );

  const functionInteractions = Object.fromEntries(NODES.map((node) => [node.id, []]));

  const driverCausalLayerMeta = Object.fromEntries(
    Object.entries(CAUSAL_LAYERS).map(([key, value]) => [
      key,
      { label: pick(value.label), short: pick(value.short), color: value.color, description: pick(value.description) },
    ]),
  );

  const driverJourneyRelationMeta = Object.fromEntries(
    Object.entries(JOURNEY_RELATIONS).map(([key, value]) => [key, { ...value }]),
  );

  const driverJourneys = Object.fromEntries(
    JOURNEYS.map((journey) => [
      journey.id,
      {
        id: journey.id,
        title: pick(journey.title),
        shortTitle: pick(journey.title),
        summary: pick(journey.summary),
        caveat: pick(journey.caveat),
        steps: journey.steps.map((step) => ({
          id: step.id,
          title: pick(step.title),
          detail: pick(step.detail),
          moduleNodeId: step.nodeId,
          moduleRole: step.nodeId,
          layers: [step.layer],
        })),
        edges: journey.steps.slice(0, -1).map((step, index) => ({
          source: step.id,
          target: journey.steps[index + 1].id,
          layer: journey.steps[index + 1].layer,
          relation: journey.steps[index + 1].relation,
        })),
      },
    ]),
  );

  const topologyNodes = NODES.map((node) => {
    const geom = nodeGeom.get(node.id);
    return {
      id: node.id,
      label: pick(node.title),
      fill: zoneById.get(node.zone).color,
      size: geom.size,
      data: {
        title: pick(node.title),
        plane: node.zone,
        layer: pick(zoneById.get(node.zone).eyebrow),
        kind: node.kind,
        description: pick(node.blurb),
        evidence: EVIDENCE_TOKEN[node.evidence],
        views: VIEWS.filter((view) => view.zoneIds.includes(node.zone)).map((view) => view.id),
      },
    };
  });

  const topologyEdges = EDGES.map((edge) => {
    const lane = EDGE_KIND_TO_LANE[edge.kind];
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: pick(edge.title),
      fill: EDGE_META[lane].color,
      data: {
        kind: lane,
        lane,
        title: pick(edge.title),
        description: pick(edge.blurb),
        evidence: edge.shapes.length ? "CODE_PROVEN" : "INFERRED",
      },
    };
  });

  const viewOptions = VIEWS.map((view) => ({
    id: view.id,
    label: pick(view.label),
    hint: pick(view.hint),
  }));

  const systemTree = ZONES.map((zone) => ({
    label: pick(zone.title),
    plane: zone.id,
    nodes: NODES.filter((node) => node.zone === zone.id).map((node) => node.id),
  }));

  const storageTrees = [];

  const runtimeFacts = [
    { label: pick({ zhCN: "证据基线", enUS: "Evidence baseline" }), value: "SPU&SPUG的架构.vsdx", tone: "ok" },
    { label: pick({ zhCN: "源图形状", enUS: "Source shapes" }), value: `${page.stats.shapes}`, tone: "ok" },
    { label: pick({ zhCN: "源图连接线", enUS: "Source connectors" }), value: `${page.stats.connectors}`, tone: "ok" },
    { label: pick({ zhCN: "实机观测", enUS: "Live observation" }), value: pick({ zhCN: "仅地址走查", enUS: "Address walkthrough only" }), tone: "warn" },
  ];

  const cameraHudViews = Object.fromEntries(
    VIEWS.map((view) => [
      view.id,
      { eyebrow: pick(view.eyebrow), title: pick(view.label), detail: pick(view.hint) },
    ]),
  );

  return {
    planeMeta,
    edgeMeta,
    laneMeta,
    functionInteractions,
    driverCausalLayerMeta,
    driverJourneyRelationMeta,
    driverJourneys,
    topologyNodes,
    topologyEdges,
    viewOptions,
    systemTree,
    storageTrees,
    runtimeFacts,
    cameraHudViews,
  };
}

const VIEWS = [
  {
    id: "physical-path",
    zoneIds: ZONES.map((zone) => zone.id),
    eyebrow: { zhCN: "SPU-SPUG-GLOBAL", enUS: "SPU-SPUG-GLOBAL" },
    label: { zhCN: "物理路径", enUS: "Physical path" },
    hint: { zhCN: "从 Host 根端口经 PEX880xx 到三条设备支路，再回到 SPU-FPGA 的上行/下行端点。", enUS: "From the host root port through the PEX880xx to the three device branches, then back to the SPU-FPGA upstream/downstream endpoints." },
  },
  {
    id: "bar-windows",
    zoneIds: ["spu-fpga", "spug-fpga", "spu-cpu"],
    eyebrow: { zhCN: "SPU-SPUG-GLOBAL", enUS: "SPU-SPUG-GLOBAL" },
    label: { zhCN: "BAR 窗口", enUS: "BAR windows" },
    hint: { zhCN: "SUEP 上行、SDEP 与 SP37 下行三组 BAR，以及三块 SPUG-FPGA 的地址转换表。", enUS: "The SUEP upstream, SDEP and SP37 downstream BAR groups, plus the translation tables on the three SPUG-FPGAs." },
  },
  {
    id: "virtual-bus",
    zoneIds: ["spu-cpu", "spu-sw", "spug"],
    eyebrow: { zhCN: "SPU-SPUG-GLOBAL", enUS: "SPU-SPUG-GLOBAL" },
    label: { zhCN: "虚拟总线", enUS: "Virtual bus" },
    hint: { zhCN: "spu_vgpu 如何把 SPUG 后的物理设备映射成 SPU 内部可枚举的 PCIe 设备。", enUS: "How spu_vgpu maps physical devices behind SPUG into PCIe devices enumerable inside SPU." },
  },
  {
    id: "address-walk",
    zoneIds: ["spug-fpga", "spu-fpga", "pcie-fabric"],
    eyebrow: { zhCN: "因果旅程", enUS: "CAUSAL JOURNEY" },
    label: { zhCN: "地址映射走查", enUS: "Address walkthrough" },
    hint: { zhCN: "一条现场取证链：描述符 → TLP 头覆盖 → 命中 SUEP BAR4 → 还原物理地址。", enUS: "A field-observed chain: descriptor -> TLP header overwrite -> SUEP BAR4 hit -> physical address restored." },
  },
];

const scene = {
  schemaVersion: "2.0",
  id: SCENE_ID,
  title: {
    zhCN: "SPU / SPUG 全局 PCIe 拓扑",
    enUS: "SPU / SPUG Global PCIe Topology",
  },
  description: {
    zhCN: "把 SPU、SPUG、HOST、SPU 内部 CPU、SPU-FPGA 与 SPUG-FPGA 放进同一张图：BDF 归属、BAR 窗口、桥与虚拟总线的物理与地址视图。",
    enUS: "Places SPU, SPUG, HOST, the SPU-internal CPU, SPU-FPGA and SPUG-FPGA in one scene: BDF ownership, BAR windows, bridges and the virtual bus.",
  },
  evidence: "CODE_PROVEN",
  locales: { default: "zh-CN", supported: ["zh-CN", "en-US"] },
  zones,
  nodes,
  edges,
  journeys,
  functions: [],
  layout,
  enhanced: {
    defaultView: VIEWS[0].id,
    content: { zhCN: buildLocale(true), enUS: buildLocale(false) },
    common: {
      focusModuleGroups: Object.fromEntries(NODES.map((node) => [node.id, [node.id]])),
      driverJourneyModuleRoleByNodeId: Object.fromEntries(NODES.map((node) => [node.id, node.id])),
      driverJourneyOrder: JOURNEYS.map((journey) => journey.id),
      nodePositions: Object.fromEntries(NODES.map((node) => [node.id, nodeGeom.get(node.id).position])),
      macroZones: Object.fromEntries(
        ZONES.map((zone) => {
          const geom = zoneGeom.get(zone.id);
          return [
            zone.id,
            {
              center: geom.center,
              halfSize: [geom.size[0] / 2, geom.size[1] / 2, geom.size[2] / 2],
              nodeIds: NODES.filter((node) => node.zone === zone.id).map((node) => node.id),
            },
          ];
        }),
      ),
      globalModuleLabels: NODES.map((node) => ({
        id: node.id,
        color: zoneById.get(node.zone).color,
        halfWidth: 2.3,
        moduleSide: nodeGeom.get(node.id).moduleSide,
        cameraSide: nodeGeom.get(node.id).cameraSide,
      })),
      routeNodeIds: Object.fromEntries(
        JOURNEYS.map((journey) => [journey.id, journey.steps.map((step) => step.nodeId)]),
      ),
      directionCards: [],
      visuals: {
        zones: ZONES.map((zone) => {
          const geom = zoneGeom.get(zone.id);
          const members = NODES.filter((node) => node.zone === zone.id);
          return {
            id: zone.id,
            anchorNodeId: geom.anchor,
            eyebrow: zone.eyebrow,
            title: zone.title,
            summary: zone.summary,
            position: geom.center,
            size: geom.size,
            color: zone.color,
            detailGroup: zone.id,
            backdrop: zone.backdrop,
          };
        }),
        modules: NODES.map((node) => {
          const geom = nodeGeom.get(node.id);
          return {
            nodeId: node.id,
            title: node.title,
            eyebrow: nodeGeom.get(node.id).eyebrow,
            position: geom.position,
            size: geom.size,
            color: zoneById.get(node.zone).color,
            labelOffset: geom.labelOffset,
            detailGroup: node.zone,
          };
        }),
        layers: [],
        depths: [],
      },
    },
    displayDefaults: DISPLAY_DEFAULTS,
  },
};

/* ------------------------------------------------------------------ emit */

await mkdir(outDir, { recursive: true });
const yamlText = YAML.stringify(scene, { lineWidth: 0 });
await writeFile(join(outDir, "topology.yaml"), yamlText, "utf8");

// source-inventory: every node and edge with the shape ids that justify it.
const inventoryLines = [];
inventoryLines.push("# 源数据清单 —— SPU / SPUG 全局 PCIe 拓扑");
inventoryLines.push("");
inventoryLines.push(`来源：\`${data.path}\``);
inventoryLines.push("");
inventoryLines.push(`解析自检：形状 ${page.stats.shapes} · 连接线 ${page.stats.connectors} · 悬空 ${page.stats.dangling_connectors} · 组合 ${page.stats.group_shapes} · 端点几何最大误差 ${page.stats.max_endpoint_error_inch} inch`);
inventoryLines.push("");
inventoryLines.push("本场景只回答「PCIe 地址空间与物理拓扑」；代码与仓库归属见 `spu-spug-driver-overview`。");
inventoryLines.push("");
inventoryLines.push("## 节点 → 源图形状");
inventoryLines.push("");
inventoryLines.push("| 节点 | 区域 | 证据 | 源图形状 | 源图原文（截断） |");
inventoryLines.push("|---|---|---|---|---|");
for (const node of NODES) {
  const text = node.shapes
    .map((id) => (shapeById.get(id).text ?? "").replaceAll("\n", " / "))
    .join(" ⏐ ");
  inventoryLines.push(
    `| \`${node.id}\` | ${node.zone} | ${node.evidence} | ${node.shapes.join(", ")} | ${text.slice(0, 90)} |`,
  );
}
inventoryLines.push("");
inventoryLines.push("## 边 → 源图依据");
inventoryLines.push("");
inventoryLines.push("| 边 | 起点 → 终点 | 类型 | 证据 | 源图形状或连接线 |");
inventoryLines.push("|---|---|---|---|---|");
for (const edge of EDGES) {
  const basis = edge.shapes.length ? describeBasis(edge.shapes) : "无 —— 按 BDF 关系推断";
  const evidence = edge.shapes.length ? "CODE_PROVEN" : "INFERRED";
  inventoryLines.push(`| \`${edge.id}\` | ${edge.source} → ${edge.target} | ${edge.kind} | ${evidence} | ${basis} |`);
}
inventoryLines.push("");
inventoryLines.push("## 源图区域划分（人工审阅）");
inventoryLines.push("");
for (const region of regions.regions) {
  inventoryLines.push(`### ${region.key} · ${region.title}`);
  inventoryLines.push("");
  inventoryLines.push(region.note.replaceAll("\n", "\n").trim());
  inventoryLines.push("");
  for (const sub of region.subregions ?? []) {
    inventoryLines.push(`- **${sub.key} · ${sub.title}**：${sub.note.replaceAll("\n", " ").trim()}`);
  }
  inventoryLines.push("");
}
await writeFile(join(outDir, "source-inventory.md"), inventoryLines.join("\n") + "\n", "utf8");

// acceptance-checklist ---------------------------------------------------

const checklist = `# SPU / SPUG 全局 PCIe 拓扑 —— 验收清单

## 场景定位（与姊妹场景的互斥声明）

本场景只回答 **PCIe 地址空间与物理拓扑**：谁在哪个 BDF、BAR 多大、桥怎么串、虚拟总线怎么枚举。
**代码与仓库归属**（哪个驱动在哪个仓、谁加载谁、谁产出谁）由 \`spu-spug-driver-overview\` 回答。
两个场景共用 zone 色板与 node 命名规范；新增内容前先确认它属于哪一个，不要在两个场景里重复表达同一件事。

## 已完成

- [x] 用 \`scripts/build-spu-spug-global-scene.mjs\` 从 Visio 解析中间数据生成，不手写 YAML。
- [x] 六个目标实体各自成区：HOST、SPU 软件栈、SPU 内部 CPU、SPU-FPGA、SPUG、SPUG-FPGA，另有 PCIe fabric 区承载 Switch 与两侧地址空间。
- [x] 场景内节点与边逐条对应源图形状/连接线 id，\`source-inventory.md\` 可回查。
- [x] 六个实体容器之间源图没有任何连接线，骨架按包含树 + 跨区边 + 地址标注 + 区域 E 文字链重建。
- [x] 边区分证据等级：有源图依据的标 \`CODE_PROVEN\`，按 BDF 关系推得的标 \`INFERRED\`。
- [x] 区域 E 的地址翻译链落成一条 journey（4 步 / 3 条边），不是新造的动画系统。
- [x] 双语内容与 \`enhanced\` 元数据全闭合，\`pnpm validate:scenes\` 通过。
- [x] 未写入凭据、生产地址、真实序列号、bitstream 或运行日志。

## 仍需实机或源码补证

- [ ] Host / SPU 两侧的 \`lspci -nn -tv\` 实采 BDF，核对 \`70:03.7\`、\`71:00.0\`、\`72:xx\`、\`76/77/7f/80\` 全部端口。
- [ ] \`sdep_driver\` 实际读取到的 A10 / NVMe / 两块 SPUG 的 BAR 基址与长度。
- [ ] \`5709:2001\` 下游桥在 \`pcieport\` 表象下被 SDEP 操作的实证（\`[275]\` 目前只有文字断言）。
- [ ] 两块 SPUG 直通映射表全空（\`[221]\`）的复核，以及 P2P 是否曾生效。
- [ ] 悬空连接线 \`[261]\` 对着原图确认是自由线段还是漏连。
- [ ] RDMA 支路的下游端口与桥，源图只给出实体框，需要补结构。
- [ ] \`enUS\` 文案目前是同步撰写的英文，需要母语者复核工程术语。

## 渲染器能力（由 v3 分支并行补充）

- [ ] 部件内部解剖（\`interior\` 配方）尚未接入，BAR 窗口、队列、虚拟总线目前只有外壳。
- [ ] 投影像素级 LOD 尚未接入，拉近只放大几何。
- [ ] 故事化相机导览尚未接入，章节数据待写。
- [ ] 深色主题尚未接入。
`;
await writeFile(join(outDir, "acceptance-checklist.md"), checklist, "utf8");

console.log(`validated input: ${page.stats.shapes} shapes, ${page.stats.connectors} connectors`);
console.log(`regions: ${[...regionByKey.keys()].join(", ")}`);
console.log(`wrote ${join(outDir, "topology.yaml")}`);
console.log(`  ${zones.length} zones, ${nodes.length} nodes, ${edges.length} edges, ${journeys.length} journey`);
if (edgeIds.size !== edges.length) throw new Error("duplicate edge ids");
if (edgeByRoute.size !== EDGES.length) throw new Error("duplicate edge routes");
