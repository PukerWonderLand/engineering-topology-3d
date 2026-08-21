# EG942H-G30 R2-M4 场景验收清单

## SceneDefinition 2.0

- [x] 场景位于 `examples/eg942h-g30-r2-m4/topology.yaml`。
- [x] 使用 `schemaVersion: "2.0"` 与完整 `enhanced` 数据。
- [x] 包含中英文标题、说明、视图和旅程。
- [x] 每个节点都有唯一 ID、区域、类型和证据等级。
- [x] 每条边都区分物理、控制、载荷、生命周期或同步语义。
- [x] 函数契约包含 trigger、context、consumes、produces、stateResource、completionError。
- [x] 每个节点和区域都有显式三维位置与尺寸。
- [x] EG942H 设备事实只写入场景知识包；通用 `src/` 改动仅用于元数据容错和渲染错误恢复。

## 架构完整性

- [x] 浏览器与 Windows 同步副本。
- [x] NAS 镜像源、管理节点镜像网关、本地缓存。
- [x] 黑匣子 Web、启动事件存储、BMC 适配层、启动编排器。
- [x] BMC Dedicated LAN 与 Shared LAN 分开建模。
- [x] BMC SoC、固件 Flash、独立 DRAM、MegaRAC 服务分开建模。
- [x] UART/SOL、USB 虚拟介质/HID、KVM 视频、管理总线、电源/复位/POST 分开建模。
- [x] UEFI、Virtual CDROM、CPU/DRAM、Ubuntu、Host LOM 分开建模。
- [x] A10 与本地 NVMe 只作为待现场确认的 GDS 测试设备，不宣称已完成 GDS。

## 关键旅程

- [x] 远程 ISO 一次性启动。
- [x] SOL 启动黑匣子采集。
- [x] 受控重启与 POST/SOL/SEL 观测。
- [x] BMC KVM 图形控制台。
- [x] 传感器、SEL 与 FRU。
- [x] Shared LAN / NC-SI 候选路径。
- [x] A10 + 本地 NVMe GDS 准备性确认。

## 安全与事实边界

- [x] 场景不包含用户名、密码、Token、真实 IP、完整 MAC 或序列号。
- [x] 标准 Redfish InsertMedia 失败与厂商 MegaRAC API 成功被区分。
- [x] 配置远程介质被描述为调用 BMC 内置能力，不描述为向 BMC 写入自定义程序。
- [x] BMC 内部 Flash/DRAM、NC-SI、板级 UART/USB/KVM/管理总线细节标为推断。
- [x] 远程 Ubuntu ISO 的结果限定为 Live 启动，未声称安装或写盘。

## 工具验证

- [x] `pnpm validate:scenes`：7 zones、29 nodes、33 edges。
- [x] `pnpm lint`：TypeScript 静态检查通过。
- [x] `pnpm build`：Vite 生产构建通过。
- [x] 旅程步骤中的 causal layer 均能解析到 `driverCausalLayerMeta`。
- [x] KVM、Shared LAN 和 GDS 三条旅程不再生成 `physical` 因果层。
- [x] plane、edge kind、lane、journey relation 与 camera HUD 引用经过增强校验。
- [x] 未知元数据具有运行时 fallback，顶层具有可恢复 Error Boundary。
- [x] 11 项 Node 回归测试全部通过。
- [x] Linux 构建已将 `eg942h-g30-r2-m4` 编译为根页面默认场景。
- [ ] Windows 浏览器打开 `?scene=eg942h-g30-r2-m4` 并完成人工视觉验收。
- [ ] Linux 浏览器打开根地址并完成人工视觉复检。
