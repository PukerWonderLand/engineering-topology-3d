import { localizedProxy } from "./i18n/locale-context";

export type ViewKey = "overview" | "host" | "fpga" | "c2s" | "s2c" | "spu";
export type PlaneKey = "host" | "fpga" | "spu";
export type EdgeKind = "LAN" | "VIRTUAL" | "USB" | "DEBUG";
export type EvidenceKind = "code" | "target" | "inference";
export type FlowLane = "KU15P" | "X690T" | "HEALTH";

export interface CodeRef { name: string; path: string; note: string; }
export type FunctionInteractionKind = "CALL" | "DATA" | "IRQ" | "CONTROL";
export interface FunctionInteraction { source: number; target: number; label: string; kind: FunctionInteractionKind; note: string; }

export type DriverJourneyId = "send" | "receive" | "init" | "wait" | "remove";
export type DriverCausalLayer = "payload" | "control" | "sync" | "lifecycle";
export type DriverContextLane = "IPC" | "PCS_TX" | "PCS_RX" | "SYSCALL" | "KERNEL" | "IRQ" | "FPGA";
export type DriverStepKind = "function" | "data" | "state" | "hardware" | "event" | "completion";
export type DriverEvidenceLevel = "CODE_PROVEN" | "RTL_PROVEN" | "RUNTIME_OBSERVED" | "INFERRED";
export type DriverJourneyRelation = "PAYLOAD" | "CALL" | "QUEUE" | "STATE" | "MMIO" | "IRQ" | "WAIT" | "ERROR" | "LIFECYCLE";
export type DriverModuleRole = "CLIENT" | "PCS" | "PCIE_UTILS" | "SP37" | "FPGA";

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
  moduleRole: DriverModuleRole;
  contextLane: DriverContextLane;
  layers: DriverCausalLayer[];
  kind: DriverStepKind;
  evidence: DriverEvidenceLevel;
  source?: string;
  contract?: DriverFunctionContract;
}

export interface DriverJourneyEdge {
  source: string;
  target: string;
  label: string;
  relation: DriverJourneyRelation;
  layer: DriverCausalLayer;
}

export interface DriverJourney {
  id: DriverJourneyId;
  title: string;
  shortTitle: string;
  summary: string;
  caveat: string;
  steps: DriverJourneyStep[];
  edges: DriverJourneyEdge[];
}

export interface PathRef { path: string; role: string; confidence: "code" | "candidate"; }

export interface NodeData {
  title: string;
  plane: PlaneKey;
  layer: string;
  kind: "client" | "network" | "host" | "vm" | "container" | "service" | "device" | "target";
  description: string;
  evidence: EvidenceKind;
  core?: boolean;
  tags?: string[];
  interfaces?: string[];
  codeRefs?: CodeRef[];
  paths?: PathRef[];
  views?: ViewKey[];
  runtimeNote?: string;
}

export interface EdgeData { kind: EdgeKind; lane: FlowLane; description: string; evidence: EvidenceKind; protocol?: string; }
export interface TopologyNode { id: string; label: string; subLabel?: string; fill?: string; size?: number; labelVisible?: boolean; data: NodeData; }
export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  fill?: string;
  dashed?: boolean;
  interpolation?: string;
  arrowPlacement?: string;
  data: EdgeData;
}

const materialRoot = "ARM_XVC技术复盘_复现SOP与发布资料_20260731";

export const planeMeta = localizedProxy<Record<PlaneKey, { label: string; short: string; color: string }>>({
  host: { label: "x86 工程设备 / FPGA 工具链", short: "X86 / TOOLS", color: "#2878c7" },
  fpga: { label: "T113 ARMv7 / XVC 网关", short: "T113 / XVC", color: "#7657c8" },
  spu: { label: "USB Hub / JTAG / FPGA 实板", short: "PHYSICAL", color: "#168f7b" },
});

export const edgeMeta = localizedProxy<Record<EdgeKind, { color: string; label: string }>>({
  LAN: { color: "#22b8cf", label: "可信局域网 / XVC TCP" },
  VIRTUAL: { color: "#8a61d1", label: "ARM 用户态 / 服务控制" },
  USB: { color: "#f4a62a", label: "USB / FTDI / MPSSE" },
  DEBUG: { color: "#5f86df", label: "JTAG TAP / FPGA / Flash" },
});

export const laneMeta = localizedProxy<Record<FlowLane, { color: string; label: string; summary: string }>>({
  KU15P: { color: "#2f83e7", label: "XVC · TCP 10200", summary: "Vivado 2019.1 → XCKU15P · 已验证" },
  X690T: { color: "#8a61d1", label: "690T · 目标链路", summary: "ProCISE → XC7VX690T · 远程路径未验证" },
  HEALTH: { color: "#13a681", label: "健康 / 恢复控制", summary: "manager → native IDCODE → 单实例恢复" },
});

function n(id: string, label: string, data: NodeData): TopologyNode {
  return { id, label, subLabel: data.layer, fill: planeMeta[data.plane].color, size: data.core ? 24 : 16, labelVisible: Boolean(data.core), data };
}

function e(id: string, source: string, target: string, kind: EdgeKind, lane: FlowLane, description: string, protocol: string, evidence: EvidenceKind = "code"): TopologyEdge {
  return { id, source, target, label: lane, fill: laneMeta[lane].color, dashed: evidence === "inference", interpolation: "curved", arrowPlacement: "end", data: { kind, lane, description, evidence, protocol } };
}

const hostRefs: CodeRef[] = [
  { name: "Vivado 2019.1 / hw_server", path: `${materialRoot}/01_第一性原理_完整逻辑链与技术审查.md`, note: "KU15P 已完成枚举、BIT、历史 ILA/VIO 与双 Vivado 并行验证。" },
  { name: "run-dual-xvc-gate.ps1", path: `${materialRoot}/reproduction-kit/client/run-dual-xvc-gate.ps1`, note: "在 x86 工程机上编排两路 XVC IDCODE/BYPASS 与持续连接门禁。" },
  { name: "ProCISE boundary", path: `${materialRoot}/03_技术难点_能力边界与后续任务评估.md`, note: "690T 正式工具属于 ProCISE；当前复盘包没有证明 ProCISE 原生远程 XVC。" },
];

const gatewayRefs: CodeRef[] = [
  { name: "xvc-gateway-multi-manager", path: `${materialRoot}/reproduction-kit/board/xvc-gateway-multi-manager`, note: "验证实例名、serial、端口、runtime 唯一性，并启停独立 supervisor。" },
  { name: "xvc-gateway-supervisor", path: `${materialRoot}/reproduction-kit/board/xvc-gateway-supervisor`, note: "维护单实例进程、日志、PID、锁与退出恢复。" },
  { name: "openFPGALoader-xvc", path: `${materialRoot}/reproduction-kit/source/scripts/build-openfpgaloader-armv7.sh`, note: "ARM EABI5 静态构建，连接 XVC、libftdi/libusb 与 FTDI MPSSE。" },
  { name: "native IDCODE health", path: `${materialRoot}/reproduction-kit/source/xvc-healthcheck-native.c`, note: "只在实例空闲时执行低开销真实 IDCODE 检查。" },
];

const evidenceRefs: CodeRef[] = [
  { name: "evidence baseline", path: `${materialRoot}/SOURCE_BASELINE.md`, note: "双 KU15P、资源、Flash 与冷启动事实均回链到相邻生产包原始日志。" },
  { name: "validation report", path: `${materialRoot}/VALIDATION_REPORT.md`, note: "文本、脚本、YAML、PDF 和发布边界已完成独立校验。" },
  { name: "capability boundary", path: `${materialRoot}/03_技术难点_能力边界与后续任务评估.md`, note: "第三路、双 XVC+UART、24 h/7 d、Docker/PVE、690T 远程路径均不可声称已验证。" },
];

export const functionInteractions = localizedProxy<Record<string, FunctionInteraction[]>>({
  "host-client": [
    { source: 0, target: 1, label: "调用工具链", kind: "CALL", note: "工程人员在 x86 设备上选择 Vivado 或 ProCISE，而不是把桌面工具安装到 T113。" },
  ],
  "host-pcs": [
    { source: 0, target: 1, label: "本机 hw_server", kind: "CALL", note: "Vivado 通过本机 hw_server 连接 xilinx-xvc 网关。" },
    { source: 1, target: 2, label: "工具边界", kind: "CONTROL", note: "690T/700T 仍归 ProCISE；远程 XVC 能力必须单独验证。" },
  ],
  "fpga-c2s": [
    { source: 0, target: 1, label: "创建实例", kind: "CALL", note: "manager 校验唯一配置后启动各自 supervisor。" },
    { source: 1, target: 2, label: "隔离运行态", kind: "CONTROL", note: "每根 JTAG 独占 PID、锁、端口、日志和 runtime。" },
  ],
  "fpga-s2c": [
    { source: 0, target: 1, label: "XVC shift", kind: "DATA", note: "openFPGALoader 把 TMS/TDI 向量转换为 FTDI MPSSE 操作并返回 TDO。" },
    { source: 1, target: 2, label: "单客户端", kind: "CONTROL", note: "同一物理 JTAG 同时只允许一个活跃客户端。" },
  ],
  "fpga-spu-ep": [
    { source: 0, target: 1, label: "空闲检查", kind: "CALL", note: "活跃会话期间跳过探测，避免 health 插入 TAP shift。" },
  ],
});

export const focusModuleGroups: Record<string, string[]> = {
  "fpga-c2s": ["fpga-host-sp37", "fpga-c2s", "fpga-s2c", "fpga-spu-sp37", "fpga-spu-ep"],
  "spu-pcs": ["spu-root", "spu-pcs", "spu-sp37", "spu-pcie-utils", "spu-client", "spu-spug"],
};

export const driverJourneyModuleRoleByNodeId: Record<string, DriverModuleRole> = {
  "host-client": "CLIENT", "host-pcs": "CLIENT", "host-pcie-utils": "PCS", "host-sp37": "PCS", "host-root": "PCS",
  "fpga-host-ep": "PCIE_UTILS", "fpga-host-sp37": "PCIE_UTILS", "fpga-c2s": "SP37", "fpga-s2c": "SP37", "fpga-spu-sp37": "SP37", "fpga-spu-ep": "SP37",
  "spu-root": "FPGA", "spu-pcs": "FPGA", "spu-sp37": "FPGA", "spu-pcie-utils": "FPGA", "spu-client": "FPGA", "spu-spug": "FPGA",
};
export const driverJourneyModuleIds = Object.keys(driverJourneyModuleRoleByNodeId);

export const driverCausalLayerMeta = localizedProxy<Record<DriverCausalLayer, { label: string; short: string; color: string; description: string }>>({
  payload: { label: "XVC 与 JTAG 数据", short: "DATA", color: "#2f83e7", description: "XVC 命令、TMS/TDI/TDO、BIT、IDCODE 或 BYPASS 真正经过的路径。" },
  control: { label: "服务控制", short: "CTRL", color: "#7c879b", description: "x86 工具、SysV、manager、supervisor 与维护命令。" },
  sync: { label: "健康与恢复", short: "SYNC", color: "#e2ad24", description: "单客户端锁、空闲 health、断线重连和单实例故障隔离。" },
  lifecycle: { label: "生命周期与安全门禁", short: "LIFE", color: "#dc496c", description: "ABI、USB 身份、Flash 备份、Program/Verify、冷启动与回滚。" },
});

export const driverJourneyRelationMeta = localizedProxy<Record<DriverJourneyRelation, { color: string; label: string; dashed: boolean }>>({
  PAYLOAD: { color: "#2f83e7", label: "数据", dashed: false }, CALL: { color: "#7c879b", label: "调用", dashed: false },
  QUEUE: { color: "#20a8a0", label: "转交", dashed: false }, STATE: { color: "#8a61d1", label: "状态", dashed: false },
  MMIO: { color: "#f29a1f", label: "设备作用", dashed: false }, IRQ: { color: "#e84855", label: "设备事件", dashed: false },
  WAIT: { color: "#e2ad24", label: "等待/恢复", dashed: true }, ERROR: { color: "#d9485f", label: "失败/回滚", dashed: true },
  LIFECYCLE: { color: "#dc496c", label: "生命周期", dashed: false },
});

const contract = (trigger: string, context: string, consumes: string, produces: string, stateResource: string, completionError: string, hardwareEffect?: string): DriverFunctionContract =>
  ({ trigger, context, consumes, produces, stateResource, completionError, hardwareEffect });

const kuSteps: DriverJourneyStep[] = [
  { id: "ku-vivado", title: "Vivado 2019.1 / local hw_server", shortTitle: "Vivado", moduleRole: "CLIENT", contextLane: "IPC", layers: ["payload", "control"], kind: "function", evidence: "RUNTIME_OBSERVED", source: hostRefs[0].path, contract: contract("工程师打开 xilinx-xvc target", "x86 Windows 进程", "T113 IP、TCP 10200、BIT/LTX", "XVC 会话", "hw_server target / client socket", "枚举、Program 或 debug core 门禁失败") },
  { id: "ku-lan", title: "可信 LAN / VLAN / ACL", shortTitle: "Trusted LAN", moduleRole: "PCS", contextLane: "PCS_TX", layers: ["payload", "lifecycle"], kind: "data", evidence: "CODE_PROVEN" },
  { id: "ku-manager", title: "xvc-gateway-multi-manager", shortTitle: "manager", moduleRole: "PCIE_UTILS", contextLane: "KERNEL", layers: ["control", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[0].path, contract: contract("SysV 启动或运维 start", "T113 Buildroot root", "实例配置与唯一性", "supervisor A", "instance/serial/port/runtime", "重复身份或端口则拒绝启动") },
  { id: "ku-xvc", title: "openFPGALoader XVC · TCP 10200", shortTitle: "XVC 10200", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["payload", "control", "sync"], kind: "function", evidence: "RUNTIME_OBSERVED", source: gatewayRefs[2].path, contract: contract("单客户端连接 10200", "ARMv7 用户态", "getinfo/settck/shift", "FTDI MPSSE 与 TDO", "TAP 状态、socket、USB fd", "断线后复位生命周期并重新监听", "libftdi/libusb → FTDI MPSSE") },
  { id: "ku-hub", title: "T113 USB Host → powered hub", shortTitle: "USB Hub", moduleRole: "FPGA", contextLane: "IRQ", layers: ["payload", "sync"], kind: "hardware", evidence: "RUNTIME_OBSERVED" },
  { id: "ku-cable", title: "Digilent HS2 · probe A", shortTitle: "JTAG A", moduleRole: "FPGA", contextLane: "IRQ", layers: ["payload", "lifecycle"], kind: "hardware", evidence: "RUNTIME_OBSERVED" },
  { id: "ku-fpga", title: "XCKU15P · IDCODE 0x04a56093", shortTitle: "KU15P", moduleRole: "FPGA", contextLane: "FPGA", layers: ["payload"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
];

const xSteps: DriverJourneyStep[] = [
  { id: "x-procise", title: "ProCISE · 690T 正式工具", shortTitle: "ProCISE", moduleRole: "CLIENT", contextLane: "IPC", layers: ["payload", "control", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: hostRefs[2].path, contract: contract("工程师选择 690T BIT/MCS", "x86 工程设备", "器件、下载器和镜像", "本地 JTAG 操作请求", "ProCISE session", "远程 XVC 协议不受当前证据支持") },
  { id: "x-lan", title: "候选远程通道", shortTitle: "Remote boundary", moduleRole: "PCS", contextLane: "PCS_TX", layers: ["payload", "lifecycle"], kind: "data", evidence: "INFERRED" },
  { id: "x-manager", title: "第二实例配置 / 独立故障域", shortTitle: "instance B", moduleRole: "PCIE_UTILS", contextLane: "KERNEL", layers: ["control", "sync", "lifecycle"], kind: "state", evidence: "CODE_PROVEN" },
  { id: "x-service", title: "XVC/JTAG B · TCP 10201", shortTitle: "service B", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["payload", "control"], kind: "function", evidence: "INFERRED", source: gatewayRefs[2].path, contract: contract("候选 690T 远程会话", "T113 ARMv7", "远程 shift 请求", "下载器操作", "独立 port/serial/runtime", "当前复盘只验证双 KU15P；690T 必须重做全套门禁") },
  { id: "x-hub", title: "独立供电 USB 扩展坞", shortTitle: "USB Hub", moduleRole: "FPGA", contextLane: "IRQ", layers: ["payload", "sync"], kind: "hardware", evidence: "INFERRED" },
  { id: "x-cable", title: "第二只 JTAG 下载器", shortTitle: "JTAG B", moduleRole: "FPGA", contextLane: "IRQ", layers: ["payload", "lifecycle"], kind: "hardware", evidence: "INFERRED" },
  { id: "x-fpga", title: "XC7VX690T · 待实机门禁", shortTitle: "690T", moduleRole: "FPGA", contextLane: "FPGA", layers: ["payload", "lifecycle"], kind: "completion", evidence: "INFERRED" },
];

const initSteps: DriverJourneyStep[] = [
  { id: "init-boot", title: "T113 Linux 5.4.61 / Buildroot boot", shortTitle: "T113 boot", moduleRole: "PCS", contextLane: "KERNEL", layers: ["lifecycle"], kind: "event", evidence: "RUNTIME_OBSERVED" },
  { id: "init-sysv", title: "S95xvc-gateway", shortTitle: "SysV init", moduleRole: "PCIE_UTILS", contextLane: "KERNEL", layers: ["control", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: `${materialRoot}/reproduction-kit/board/S95xvc-gateway` },
  { id: "init-validate", title: "manager validate unique identities", shortTitle: "validate", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["control", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[0].path, contract: contract("系统启动", "T113 root", "两份实例配置", "唯一性报告", "instance/serial/port/runtime/log", "任意重复则不启动") },
  { id: "init-a", title: "supervisor A / TCP 10200", shortTitle: "A ready", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["control", "sync"], kind: "state", evidence: "RUNTIME_OBSERVED" },
  { id: "init-b", title: "supervisor B / TCP 10201", shortTitle: "B ready", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["control", "sync"], kind: "state", evidence: "RUNTIME_OBSERVED" },
  { id: "init-health", title: "native IDCODE health", shortTitle: "health", moduleRole: "SP37", contextLane: "IRQ", layers: ["sync"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[3].path, contract: contract("实例空闲且到达检查周期", "T113 ARM 用户态", "USB serial 与 IDCODE", "健康状态", "health file / active session", "活跃会话直接跳过，失败只标记对应实例") },
  { id: "init-ready", title: "双 KU15P 服务恢复", shortTitle: "READY", moduleRole: "FPGA", contextLane: "FPGA", layers: ["lifecycle"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
];

const waitSteps: DriverJourneyStep[] = [
  { id: "wait-disconnect", title: "client/USB 断开", shortTitle: "disconnect", moduleRole: "FPGA", contextLane: "IRQ", layers: ["sync"], kind: "event", evidence: "RUNTIME_OBSERVED" },
  { id: "wait-supervisor", title: "supervisor observes exit", shortTitle: "observe", moduleRole: "SP37", contextLane: "KERNEL", layers: ["control", "sync"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[1].path, contract: contract("XVC 子进程退出", "T113 supervisor", "PID/exit/signal", "单实例状态", "PID/log/runtime/lock", "清理后重启对应实例，不影响另一实例") },
  { id: "wait-tap", title: "reset session / TAP lifecycle", shortTitle: "reset", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["sync", "lifecycle"], kind: "state", evidence: "CODE_PROVEN" },
  { id: "wait-other", title: "other JTAG remains online", shortTitle: "isolation", moduleRole: "PCIE_UTILS", contextLane: "PCS_RX", layers: ["sync"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
  { id: "wait-rematch", title: "serial identity rematch", shortTitle: "serial match", moduleRole: "SP37", contextLane: "IRQ", layers: ["sync", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[0].path, contract: contract("设备重新枚举", "T113 manager", "FTDI serial", "目标实例映射", "USB sysfs / config", "serial 不唯一则拒绝恢复") },
  { id: "wait-recover", title: "restart affected instance", shortTitle: "recover", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["control", "sync"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
];

const flashSteps: DriverJourneyStep[] = [
  { id: "flash-authorize", title: "明确授权 + 锁定唯一 serial", shortTitle: "authorize", moduleRole: "CLIENT", contextLane: "IPC", layers: ["control", "lifecycle"], kind: "event", evidence: "CODE_PROVEN" },
  { id: "flash-stop", title: "停止目标实例 / 保持另一实例", shortTitle: "isolate", moduleRole: "SP37", contextLane: "KERNEL", layers: ["control", "sync", "lifecycle"], kind: "function", evidence: "CODE_PROVEN", source: gatewayRefs[0].path },
  { id: "flash-backup", title: "完整读取 64 MiB Flash + 双端 SHA-256", shortTitle: "backup", moduleRole: "SP37", contextLane: "SYSCALL", layers: ["payload", "lifecycle"], kind: "data", evidence: "RUNTIME_OBSERVED" },
  { id: "flash-match", title: "MT25QU512 JEDEC / MCS / 地址门禁", shortTitle: "match", moduleRole: "FPGA", contextLane: "FPGA", layers: ["control", "lifecycle"], kind: "hardware", evidence: "RUNTIME_OBSERVED" },
  { id: "flash-program", title: "Erase / Program 100%", shortTitle: "Program", moduleRole: "FPGA", contextLane: "FPGA", layers: ["payload", "lifecycle"], kind: "hardware", evidence: "RUNTIME_OBSERVED" },
  { id: "flash-verify", title: "readback Verify 100%", shortTitle: "Verify", moduleRole: "FPGA", contextLane: "FPGA", layers: ["payload", "sync"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
  { id: "flash-cold", title: "冷启动自动 / 命令恢复分账", shortTitle: "cold boot 1/3", moduleRole: "CLIENT", contextLane: "PCS_RX", layers: ["sync", "lifecycle"], kind: "completion", evidence: "RUNTIME_OBSERVED" },
];

const chainEdges = (ids: string[], relation: DriverJourneyRelation, layer: DriverCausalLayer): DriverJourneyEdge[] =>
  ids.slice(0, -1).map((source, index) => ({ source, target: ids[index + 1], label: index === 0 ? relation : "NEXT", relation, layer }));

export const driverJourneys = localizedProxy<Record<DriverJourneyId, DriverJourney>>({
  send: { id: "send", title: "KU15P 远程 XVC 事务", shortTitle: "KU15P 已验证", summary: "x86 Vivado 经可信 LAN、T113 XVC、USB Hub 和 Digilent 到达 XCKU15P。", caveat: "这是当前资料中真正板级验证的主链；实时运行前仍要重新探测 IP、serial、IDCODE 与器件。", steps: kuSteps, edges: chainEdges(kuSteps.map((step) => step.id), "PAYLOAD", "payload") },
  receive: { id: "receive", title: "690T / ProCISE 架构边界", shortTitle: "690T 待验证", summary: "保留 x86 ProCISE、T113、USB Hub、第二下载器和 XC7VX690T 的目标物理链路。", caveat: "当前复盘基线验证的是双 KU15P，不是 690T；ProCISE 原生远程 XVC 未被证明，所以整条 690T 远程链使用推断证据。", steps: xSteps, edges: chainEdges(xSteps.map((step) => step.id), "PAYLOAD", "payload") },
  init: { id: "init", title: "T113 双实例启动", shortTitle: "启动", summary: "Buildroot SysV 启动 manager，校验唯一身份后建立两个独立 supervisor 和 health。", caveat: "示例网关地址仅用于建模，部署时必须重新发现；Buildroot 整包 SD/NAND 尚未交付。", steps: initSteps, edges: chainEdges(initSteps.map((step) => step.id), "LIFECYCLE", "lifecycle") },
  wait: { id: "wait", title: "单实例断线与恢复", shortTitle: "恢复", summary: "客户端或 USB 断开只清理对应实例，另一根 JTAG 保持服务，serial 重匹配后再恢复。", caveat: "复盘证明 Linux reboot 后双实例恢复；USB 热插拔完全无扰和 24 h/7 d 稳定仍未完成。", steps: waitSteps, edges: chainEdges(waitSteps.map((step) => step.id), "WAIT", "sync") },
  remove: { id: "remove", title: "Flash Program / Verify / 冷启动", shortTitle: "Flash 门禁", summary: "先备份和双端哈希，再匹配 JEDEC/MCS，完成 Program、readback Verify 与冷启动分账。", caveat: "MT25QU512 Program/Verify 已通过；冷自动启动和命令启动目前都只有 PASS 1/3，不能称为稳定通过。", steps: flashSteps, edges: chainEdges(flashSteps.map((step) => step.id), "LIFECYCLE", "lifecycle") },
});
export const driverJourneyOrder: DriverJourneyId[] = ["send", "receive", "init", "wait", "remove"];

const allViews: ViewKey[] = ["overview", "host", "fpga", "c2s", "s2c", "spu"];
const commonTags = ["T113", "ARMv7", "XVC", "JTAG", "USB", "trusted-lan"];

export const topologyNodes = localizedProxy<TopologyNode[]>([
  n("host-client", "Engineering Operator", { title: "FPGA 工程师 / CI 验收端", plane: "host", layer: "L5 Client / Automation", kind: "client", description: "发起远程调试、BIT/ILA/VIO、IDCODE/BYPASS 或维护门禁；不把返回码当成硬件事实。", evidence: "code", core: true, tags: [...commonTags, "PowerShell", "Tcl"], interfaces: ["TCP 10200", "TCP 10201"], codeRefs: hostRefs, views: allViews }),
  n("host-pcs", "FPGA Toolchain", { title: "x86 FPGA 工具设备", plane: "host", layer: "L4 Vivado / ProCISE", kind: "host", description: "安装 Vivado 2019.1、hw_server、ProCISE、PowerShell、Python 与 WSL；桌面工具留在 x86，不移植到 T113。", evidence: "code", core: true, tags: [...commonTags, "x86-64", "Vivado", "ProCISE"], interfaces: ["xilinx-xvc", "local hw_server"], codeRefs: hostRefs, views: allViews, runtimeNote: "KU15P 用 Vivado；690T/700T 正式 BIT/MCS 用 ProCISE。" }),
  n("host-pcie-utils", "Client Harness", { title: "本机 hw_server / 门禁脚本", plane: "host", layer: "L3 Local Orchestration", kind: "service", description: "每根 XVC 使用独立本机 hw_server；自动化脚本负责 IDCODE/BYPASS、双路并发、Flash 与冷启动分账。", evidence: "code", tags: [...commonTags, "hw_server", "gate"], interfaces: ["34001", "34002"], codeRefs: hostRefs, views: allViews }),
  n("host-sp37", "Trusted LAN", { title: "可信实验室 LAN / VLAN / ACL", plane: "host", layer: "L2 Network Security", kind: "network", description: "XVC 明文、无认证、无加密，只允许通过可信 LAN、VLAN/ACL、VPN 或 SSH tunnel 使用。", evidence: "code", core: true, tags: [...commonTags, "VPN", "ACL"], interfaces: ["Ethernet / TCP"], codeRefs: evidenceRefs, views: allViews }),
  n("host-root", "x86 Ethernet", { title: "x86 网口 / TCP 客户端", plane: "host", layer: "L1 Physical NIC", kind: "device", description: "把本地 FPGA 工具与示例 T113 网关连接；真实部署必须重新发现地址。", evidence: "target", tags: [...commonTags, "NIC"], interfaces: ["TCP 10200", "TCP 10201"], views: allViews }),

  n("fpga-host-ep", "T113 Ethernet", { title: "T113 以太网接口", plane: "fpga", layer: "Z0 LAN / TCP", kind: "network", description: "接收 XVC TCP；示例地址不作为固定配置。", evidence: "target", tags: [...commonTags, "EXAMPLE_IP"], interfaces: ["TCP 10200", "TCP 10201"], codeRefs: evidenceRefs, views: allViews }),
  n("fpga-host-sp37", "T113 Platform", { title: "TLT113-MiniEVM · ARMv7", plane: "fpga", layer: "Z1 Linux 5.4.61 / Buildroot", kind: "host", description: "双核 1.2 GHz、232 MiB、ARM EABI5 arm-linux-gnueabi、glibc 2.25、可写 UBIFS。", evidence: "target", core: true, tags: [...commonTags, "Buildroot 2019.02.1", "UBIFS"], interfaces: ["USB Host", "Ethernet"], codeRefs: evidenceRefs, views: allViews }),
  n("fpga-c2s", "Gateway Control", { title: "SysV / multi-manager / supervisors", plane: "fpga", layer: "Z2 Service Control", kind: "service", description: "每根 JTAG 独立拥有实例配置、PID、锁、端口、runtime、日志和 health 状态。", evidence: "code", core: true, tags: [...commonTags, "SysV", "manager"], interfaces: ["validate", "status", "health"], codeRefs: gatewayRefs, paths: [{ path: "/etc/xvc-gateway.d", role: "实例配置候选目录", confidence: "candidate" }, { path: "/run/xvc-gateway", role: "运行态候选目录", confidence: "candidate" }], views: allViews }),
  n("fpga-s2c", "XVC A", { title: "openFPGALoader XVC A · 10200", plane: "fpga", layer: "Z3 KU15P Service", kind: "service", description: "已验证单客户端 XVC、TAP 生命周期、FTDI MPSSE、双路并发与 Vivado 业务。", evidence: "target", core: true, tags: [...commonTags, "KU15P", "10200"], interfaces: ["getinfo", "settck", "shift"], codeRefs: gatewayRefs, views: ["overview", "fpga", "c2s"] }),
  n("fpga-spu-sp37", "XVC/JTAG B", { title: "第二实例 · TCP 10201", plane: "fpga", layer: "Z3 690T Candidate", kind: "service", description: "软件结构允许第二独立实例，但当前包的 10201 实证对象仍是 KU15P-B；映射 690T 必须重新验证 backend、工具协议和板级门禁。", evidence: "inference", core: true, tags: [...commonTags, "690T", "10201"], interfaces: ["candidate XVC/JTAG"], codeRefs: [hostRefs[2], gatewayRefs[0]], views: ["overview", "fpga", "s2c"] }),
  n("fpga-spu-ep", "Native Health", { title: "原生 IDCODE 健康检查", plane: "fpga", layer: "Z3 Health / Recovery", kind: "service", description: "静态 C checker 在实例空闲时读取真实 IDCODE；活跃会话跳过，避免扰动 TAP。", evidence: "code", core: true, tags: [...commonTags, "IDCODE", "health"], interfaces: ["15 s idle check"], codeRefs: [gatewayRefs[3]], views: ["overview", "fpga", "spu"] }),

  n("spu-root", "T113 USB Host", { title: "T113 USB Host Controller", plane: "spu", layer: "H0 USB Root", kind: "device", description: "ARM Linux 通过 usbfs/libusb 掌握下载器；CPU、root hub 调度和供电是扩容边界。", evidence: "target", core: true, tags: [...commonTags, "usbfs", "libusb"], interfaces: ["/dev/bus/usb"], codeRefs: gatewayRefs, views: allViews }),
  n("spu-pcs", "Powered USB Hub", { title: "独立供电 USB 扩展坞", plane: "spu", layer: "H1 USB Hub / Power", kind: "device", description: "连接两只 JTAG 下载器并承担供电/调度共享；第三、第四路前必须实测 USB host controller 与电源余量。", evidence: "inference", core: true, tags: [...commonTags, "powered hub"], interfaces: ["USB upstream", "USB port A", "USB port B"], views: allViews }),
  n("spu-sp37", "Digilent A", { title: "JTAG 下载器 A · Digilent HS2", plane: "spu", layer: "H2 FTDI / MPSSE", kind: "device", description: "示例下载器 A 绑定 ku15p-a 与 TCP 10200；运行前必须重新探测身份。", evidence: "target", tags: [...commonTags, "0403:6014", "PROBE_A"], interfaces: ["USB", "JTAG"], views: ["overview", "c2s", "spu"] }),
  n("spu-pcie-utils", "JTAG B", { title: "JTAG 下载器 B · 690T 候选", plane: "spu", layer: "H2 FTDI / MPSSE", kind: "device", description: "模型预留第二物理下载器到 690T；当前实证对象是 KU15P-B，不能直接当成 690T 现场事实。", evidence: "inference", tags: [...commonTags, "candidate"], interfaces: ["USB", "JTAG"], views: ["overview", "s2c", "spu"] }),
  n("spu-client", "KU15P", { title: "Xilinx XCKU15P FPGA", plane: "spu", layer: "H3 FPGA / Flash", kind: "target", description: "已验证 IDCODE 0x04a56093、BIT、历史 4 ILA/9 VIO、双 Vivado 并发和 MT25QU512 Program/Verify。", evidence: "target", core: true, tags: [...commonTags, "XCKU15P", "MT25QU512"], interfaces: ["JTAG TAP", "SPI-over-JTAG"], codeRefs: evidenceRefs, views: ["overview", "c2s", "spu"], runtimeNote: "冷自动启动与显式命令启动当前各 PASS 1/3。" }),
  n("spu-spug", "XC7VX690T", { title: "Xilinx XC7VX690T FPGA", plane: "spu", layer: "H3 FPGA Target", kind: "target", description: "用户要求纳入的 690T 目标芯片。正式 BIT/MCS 属于 ProCISE；T113 远程 XVC/下载链在本资料中尚未验证。", evidence: "inference", core: true, tags: [...commonTags, "XC7VX690T", "ProCISE"], interfaces: ["JTAG TAP"], codeRefs: [hostRefs[2], evidenceRefs[2]], views: ["overview", "s2c", "spu"] }),
]);

const commonRoute = (prefix: string, lane: FlowLane): TopologyEdge[] => [
  e(`${prefix}-operator-tool`, "host-client", "host-pcs", "VIRTUAL", lane, "工程师选择对应 FPGA 工具链。", lane === "X690T" ? "ProCISE" : "Vivado / gate"),
  e(`${prefix}-tool-client`, "host-pcs", "host-pcie-utils", "VIRTUAL", lane, "本机工具或验收脚本建立独立会话。", "local process / hw_server"),
  e(`${prefix}-client-lan`, "host-pcie-utils", "host-sp37", "LAN", lane, "XVC 只进入可信网络边界。", "VLAN / ACL / VPN"),
  e(`${prefix}-lan-nic`, "host-sp37", "host-root", "LAN", lane, "x86 网口发送 TCP 流量。", "Ethernet"),
  e(`${prefix}-nic-t113`, "host-root", "fpga-host-ep", "LAN", lane, "局域网到达 T113 以太网接口。", laneMeta[lane].label, lane === "X690T" ? "inference" : "code"),
  e(`${prefix}-t113-linux`, "fpga-host-ep", "fpga-host-sp37", "VIRTUAL", lane, "Buildroot 网络栈把会话交给 ARM 用户态。", "Linux TCP"),
  e(`${prefix}-linux-manager`, "fpga-host-sp37", "fpga-c2s", "VIRTUAL", lane, "SysV/manager 维护实例生命周期。", "SysV / PID / lock"),
];

export const topologyEdges = localizedProxy<TopologyEdge[]>([
  ...commonRoute("ku15p", "KU15P"),
  e("ku15p-manager-xvc", "fpga-c2s", "fpga-s2c", "VIRTUAL", "KU15P", "manager 把 10200 交给独立 XVC A。", "supervisor A"),
  e("ku15p-xvc-usb", "fpga-s2c", "spu-root", "USB", "KU15P", "openFPGALoader 经 libusb/libftdi 控制 T113 USB Host。", "USB / FTDI"),
  e("ku15p-usb-hub", "spu-root", "spu-pcs", "USB", "KU15P", "USB Host 通过扩展坞连接下载器。", "powered USB hub"),
  e("ku15p-hub-cable", "spu-pcs", "spu-sp37", "USB", "KU15P", "按运行时重新探测的唯一身份选择下载器 A。", "FTDI identity"),
  e("ku15p-cable-fpga", "spu-sp37", "spu-client", "DEBUG", "KU15P", "MPSSE 驱动 KU15P JTAG TAP。", "TCK/TMS/TDI/TDO"),

  ...commonRoute("x690t", "X690T"),
  e("x690t-manager-service", "fpga-c2s", "fpga-spu-sp37", "VIRTUAL", "X690T", "目标第二实例；当前 690T 远程协议未验证。", "candidate supervisor B", "inference"),
  e("x690t-service-usb", "fpga-spu-sp37", "spu-root", "USB", "X690T", "候选 ARM 服务访问 USB Host。", "USB / cable backend", "inference"),
  e("x690t-usb-hub", "spu-root", "spu-pcs", "USB", "X690T", "扩展坞为第二下载器提供物理连接。", "powered USB hub", "inference"),
  e("x690t-hub-cable", "spu-pcs", "spu-pcie-utils", "USB", "X690T", "选择 690T 对应下载器身份。", "serial must re-probe", "inference"),
  e("x690t-cable-fpga", "spu-pcie-utils", "spu-spug", "DEBUG", "X690T", "候选下载器连接 XC7VX690T JTAG TAP。", "JTAG", "inference"),

  ...commonRoute("health", "HEALTH"),
  e("health-manager-check", "fpga-c2s", "fpga-spu-ep", "VIRTUAL", "HEALTH", "manager 在空闲窗口触发原生 health。", "idle-only IDCODE"),
  e("health-check-usb", "fpga-spu-ep", "spu-root", "USB", "HEALTH", "checker 经 USB 读取目标 IDCODE。", "native C / libftdi"),
  e("health-usb-hub", "spu-root", "spu-pcs", "USB", "HEALTH", "health 使用同一物理 Hub，但不在活跃会话中插入 shift。", "session-aware"),
  e("health-hub-cable", "spu-pcs", "spu-sp37", "USB", "HEALTH", "按 serial 定位实例 A；B 路采用相同独立模型。", "serial identity"),
  e("health-cable-target", "spu-sp37", "spu-client", "DEBUG", "HEALTH", "真实 IDCODE 决定健康状态。", "IDCODE / BYPASS"),
]);

export const c2sEdgeIds = topologyEdges.filter((edge) => edge.data.lane === "KU15P").map((edge) => edge.id);
export const s2cEdgeIds = topologyEdges.filter((edge) => edge.data.lane === "X690T").map((edge) => edge.id);
export const uartEdgeIds = topologyEdges.filter((edge) => edge.data.lane === "HEALTH").map((edge) => edge.id);

export const viewOptions = localizedProxy<{ id: ViewKey; label: string; hint: string }[]>([
  { id: "overview", label: "物理全景", hint: "x86 工具设备、可信 LAN、T113、USB Hub、双下载器与 KU15P/690T" },
  { id: "host", label: "x86 工具端", hint: "工程师 → Vivado/ProCISE → 本机 hw_server/门禁 → LAN" },
  { id: "fpga", label: "T113 ARM", hint: "Ethernet → Buildroot → manager/supervisor → XVC / health" },
  { id: "c2s", label: "KU15P 已验证", hint: "Vivado → XVC 10200 → Digilent A → XCKU15P" },
  { id: "s2c", label: "690T 待验证", hint: "ProCISE / 远程协议边界 → 第二下载器 → XC7VX690T" },
  { id: "spu", label: "健康与恢复", hint: "manager → native IDCODE → USB Hub → 单实例状态与恢复" },
]);

export const systemTree = localizedProxy([
  { label: planeMeta.host.label, plane: "host" as PlaneKey, nodes: ["host-client", "host-pcs", "host-pcie-utils", "host-sp37", "host-root"] },
  { label: planeMeta.fpga.label, plane: "fpga" as PlaneKey, nodes: ["fpga-host-ep", "fpga-host-sp37", "fpga-c2s", "fpga-s2c", "fpga-spu-sp37", "fpga-spu-ep"] },
  { label: planeMeta.spu.label, plane: "spu" as PlaneKey, nodes: ["spu-root", "spu-pcs", "spu-sp37", "spu-pcie-utils", "spu-client", "spu-spug"] },
]);

export const storageTrees = localizedProxy([
  { id: "review-files", label: "复盘 / SOP / 证据基线", plane: "host" as PlaneKey, roots: [
    { path: `${materialRoot}/README.md`, role: "复盘包入口与能力矩阵", nodeId: "host-client" },
    { path: `${materialRoot}/01_第一性原理_完整逻辑链与技术审查.md`, role: "架构、物理事实和 G0-G11 逻辑链", nodeId: "host-pcs" },
    { path: `${materialRoot}/02_跨电脑跨AI完整复现SOP.md`, role: "跨机器复现、停止条件与验收顺序", nodeId: "host-pcie-utils" },
    { path: `${materialRoot}/SOURCE_BASELINE.md`, role: "生产包哈希和原始证据索引", nodeId: "host-sp37" },
  ] },
  { id: "gateway-files", label: "T113 / Gateway Runtime", plane: "fpga" as PlaneKey, roots: [
    { path: `${materialRoot}/reproduction-kit/board/xvc-gateway-multi-manager`, role: "多实例唯一性和生命周期管理", nodeId: "fpga-c2s" },
    { path: `${materialRoot}/reproduction-kit/board/xvc-gateway-supervisor`, role: "单实例进程、日志、锁和恢复", nodeId: "fpga-c2s" },
    { path: `${materialRoot}/reproduction-kit/source/scripts/build-openfpgaloader-armv7.sh`, role: "ARMv7 openFPGALoader 构建入口", nodeId: "fpga-s2c" },
    { path: `${materialRoot}/reproduction-kit/source/xvc-healthcheck-native.c`, role: "低开销空闲 IDCODE 健康检查", nodeId: "fpga-spu-ep" },
  ] },
  { id: "hardware-files", label: "硬件 / 发布边界", plane: "spu" as PlaneKey, roots: [
    { path: `${materialRoot}/MANIFEST.yaml`, role: "T113、双 KU15P、资源和 NOT_CLAIMED 结构化事实", nodeId: "spu-client" },
    { path: `${materialRoot}/VALIDATION_REPORT.md`, role: "交付包校验与边界", nodeId: "spu-root" },
    { path: `${materialRoot}/03_技术难点_能力边界与后续任务评估.md`, role: "690T、第三路、热插拔和长期稳定性边界", nodeId: "spu-spug" },
  ] },
]);

export const runtimeFacts = localizedProxy([
  { label: "已验证平台", value: "T113 ARMv7 + 双 KU15P", tone: "good" },
  { label: "主链", value: "TCP 10200 / 10201 · SERIAL BIND", tone: "good" },
  { label: "690T 口径", value: "PROCISE · REMOTE NOT PROVEN", tone: "warn" },
]);
