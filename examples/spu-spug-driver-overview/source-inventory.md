# SPU / SPUG 全驱动总览证据清单

本场景回答四个问题：驱动属于哪个 Git 仓库、加载在 Host 还是 SPU、通过什么接口使用，以及 SPU FPGA/SPUG FPGA 与哪个驱动交互。

## 场景与版本基线

| 对象 | 基线 | 用途 |
|---|---|---|
| 拓扑框架 | `develop/v2@b18b755b775b20a9b1fba06e4686abb3bbadd734` | SceneDefinition 2.0 与增强渲染器 |
| 候选软件组合 | `nereus/build main@787249c30aedb645974dc7bc223bf57e734eda98`，tag `20260702_3` | 驱动、PCS、TSSD、平台服务的候选 gitlink 组合 |
| SPU Server 组合 | `nereus/spu_server/trunk@edab1a5abc69776a6001a5ed88a79800fe3e60e9` | 七个服务 gitlink 的固定组合 |
| FPGA 组合 | `yanghao/spu_spug_pcieip@6b6fcd9d3b87ca338bfa1f65e54517b1857ad4ef` | SPU、SPUG、DWC 与 PCIe base IP 的候选组合 |

这些组合是代码和 gitlink 事实，不是某台生产机器的运行真值。

## 主资料

原始派生资料目录：

`E:\StayHungry\努力吧少年\02_职业成长&学业进步\1_1_SPU机密计算\1_2_SPU&SPUG&驱动整体架构`

Linux 只读挂载：

`/mnt/kuluomi/e/StayHungry/努力吧少年/02_职业成长&学业进步/1_1_SPU机密计算/1_2_SPU&SPUG&驱动整体架构`

本场景重点使用：

- `00-阅读导航与一页结论.md`
- `03-仓库映射/106仓库系统位置映射.md|csv|json`
- `04-SPU-SPUG总体架构.md`
- `05-硬件与FPGA架构.md`
- `06-软件驱动与启动架构.md`
- `07-接口版本与依赖矩阵.md`
- `09-证据边界与未决问题.md`
- `Driver_src/` 中的 `spu-g` 驱动源码快照、Makefile、systemd 和加载脚本
- `02-证据清单/Drawio抽取/SPUG程序代码结构-结构化.md`
- `02-证据清单/Drawio抽取/软件结构SPU与SPUG-结构化.md`

## 仓库—驱动—加载位置映射

| Git 仓库 | 可确认产物 | 加载位置 | 证据等级 | 场景节点 |
|---|---|---|---|---|
| `nereus/kernelspace/spu_pcied` | `sp37.ko` | Host；SPU 使用 `is_spu=1` | `CODE_PROVEN` | `host-sp37`、`spu-sp37` |
| `nereus/kernelspace/spu_connect` | `spu_connect.ko` | SPU | `CODE_PROVEN` | `spu-connect` |
| `nereus/kernelspace/spuinfo` | 设备信息辅助模块/工具 | SPU | 仓库职责已证明，最终 `.ko` 名待源码补采 | 未单独建主节点，归入 SPU 启动资料 |
| `nereus/spu-g/sdep_driver` | `sdep.ko`，包含 `spug_driver.c` 等对象 | Host | `CODE_PROVEN` | `host-sdep`、`host-spug-subdriver` |
| `nereus/spu-g/spu_driver` | `spu_vgpu.ko` / SUEP | SPU | `CODE_PROVEN` | `spu-vgpu` |
| `nereus/spu-g/config` | `spug.service`、`start_spug.sh`、`upstreamctl` | SPU 用户态 | `CODE_PROVEN` | `spu-gpu-loader` |
| `nereus/spu_kernel` | 定制内核、`hook_dma`、`hook_rdma` | SPU 内核本体 | `CODE_PROVEN` | `spu-kernel-hooks` |
| `nereus/spu_blk_bridge` | `hblkd_end.ko`、`sblkd_end.ko` | Host、SPU | `CODE_PROVEN`，可选/实验 | `host-block`、`spu-block` |
| `nereus/spu_tssd` | TSSD/TES/keyring/integrity 及适配器 | SPU | 总体职责已证明；精确模块产物清单待补 | `spu-security-adapters` |
| `nereus/kernelspace/xdma` | 旧 Linux XDMA 驱动 | Host、SPU | 历史 | 仅证据说明，不进入主场景 |
| `nereus/kernelspace/xdma_windows` | Windows XDMA 驱动/样例 | Windows 测试机 | 历史/实验 | 仅证据说明，不进入主场景 |
| `nereus/spugdriver` | 旧 SPUG 驱动 | Host/SPU | 已废弃并合入 `spu-g` | 仅证据说明，禁止与现行驱动同时加载 |

## `spu-g` 代码级证据

| 事实 | 代码入口 | 结论 |
|---|---|---|
| Host 模块名 | `Driver_src/sdep_driver/Makefile` | `obj-m := sdep.o`，最终生成 `sdep.ko` |
| SPUG 管理编入 SDEP | `sdep-objs` 包含 `spug_driver.o`、`spug_sysfs.o` | 当前不是独立现行 `spug.ko` |
| SDEP PCI ID | `sdep_driver.c`、`sdep_driver.h` | 绑定 `5709:1001` |
| SPUG bridge PCI ID | `spug_driver.c`、`spug_driver.h` | 当前 ID 表包含 `5709:2000` |
| DWC 变体 | `spug_driver.h` | 定义 `5709:2001`，但当前 `spug_pci_ids[]` 未纳入，需核实 |
| SPU 模块名 | `Driver_src/spu_driver/Makefile` | `obj-m := spu_vgpu.o` |
| SUEP PCI ID | `spu_upstream_driver.c` | SPU 侧绑定 `5709:1001` |
| 虚拟设备 | `suep_virtual_device.c` | 创建虚拟 PCI 总线、vSPUG/vBEP 并选择 config/DMA 模式 |
| SPUG 扫描 | `sdep_host_dev_management.c` | 发现 SPUG 后调用 `spug_driver_init(child_node->pdev)` |
| SPU 加载厂商驱动 | `config/start_spug.sh` | 可加载 NVIDIA、寒武纪或天数智芯模块 |
| Host GPU 模块处理 | `sdep_config/remove_gpu_driver.sh` | 当前实际操作大多被注释，并打印 `do nothing for now` |

## FPGA 证据

| FPGA 仓库 | 场景职责 | 证据等级 |
|---|---|---|
| `qiongyu/fpga_spu` | SP37 Function 0、Function 1/NTB、协议、SM2/GCM、EEPROM、Recovery、可选 SStorage | `RTL_PROVEN` |
| `nereus_fpga/spug_fpga` | 上游 EP、下游 RP、RQ/RC/CQ/CC、状态、认证、密钥与加解密 | `RTL_PROVEN` |
| `wuhaocheng/dwc_pcie` | SPUG DWC PCIe 控制器与适配 | `RTL_PROVEN` |
| `nereus_fpga/pcie_base_ip` | Type-1 配置空间和 PCIe 基础逻辑 | `RTL_PROVEN` |
| `yanghao/spu_spug_pcieip` | 固定上述 FPGA gitlink 的候选 wrapper | `CODE_PROVEN`，不证明实际 bit |

## 证据边界

- `CODE_PROVEN` 证明源码、Makefile、PCI ID、脚本和接口存在，不证明机器当前加载成功。
- `RTL_PROVEN` 证明 RTL 模块与寄存器合同存在，不证明当前板卡烧写了对应 bit。
- 本场景没有使用 `RUNTIME_OBSERVED`：尚无目标机器的 `lspci`、`lsmod`、`modinfo`、AER、IOMMU、systemd、bit hash 和 trace。
- 原生 GPU 驱动在 SPU 虚拟化模式下的加载脚本有代码证据；Host 直连/非虚拟模式与生产模式选择仍为 `INFERRED`。
- `5709:2001` 是接口/变体事实，但当前驱动快照是否直接绑定它仍为 `INFERRED`。
- TSSD 内核适配器的完整 `.ko` 列表、SPUInfo 最终产物名仍需读取对应仓库源码。
- 完整跨 Host/SPU 的卸载、reset、热拔出逆序是目标架构，需故障注入与运行 trace 验证。
- RDMA 专题保留在相邻 `spu-spug-driver` 场景；NVMe/SM4 与 SStorage 不被描述成基础主线能力。

## 安全与公开边界

- 场景不保存凭据、私钥、生产 IP、真实 SN/BDF、bitstream、Flash 镜像或生产日志。
- 所有硬件操作前必须重新发现板卡、BDF、IOMMU group、bit hash、GPU/VBIOS、内核与模块身份。
- 历史仓库中出现过的安全材料应视为需要轮换，不得复制到拓扑或验收记录。

