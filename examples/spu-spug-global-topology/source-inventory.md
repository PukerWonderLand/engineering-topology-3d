# 源数据清单 —— SPU / SPUG 全局 PCIe 拓扑

来源：`/mnt/kuluomi/e/StayHungry/努力吧少年/02_职业成长&学业进步/1_1_SPU机密计算/1_2_SPU&SPUG&驱动整体架构/SPU&SPUG的架构.vsdx`

解析自检：形状 164 · 连接线 62 · 悬空 1 · 组合 0 · 端点几何最大误差 0.0984 inch

本场景只回答「PCIe 地址空间与物理拓扑」；代码与仓库归属见 `spu-spug-driver-overview`。

## 节点 → 源图形状

| 节点 | 区域 | 证据 | 源图形状 | 源图原文（截断） |
|---|---|---|---|---|
| `host-business` | host | CODE_PROVEN | 469 | 业务阶段 |
| `host-platform` | host | CODE_PROVEN | 470, 450, 467, 464 | 平台阶段 ⏐ host_nms / 仓库：spu_libos/host_nms /  / Host 节点、网络与SPU管理 / 主要的对端：spu_nms / 准确的定位：L4 T |
| `host-userspace` | host | CODE_PROVEN | 507, 448 | 用户态 ⏐ host_pcs / pcie_server / 仓库：nereus_pcie / 封装 SP37 节点并向 client SO 提供 Unix Socket 服务 |
| `host-kernel` | host | CODE_PROVEN | 506, 446, 442, 472 | 内核 ⏐ sp37.ko / 仓库：kernelspace/spu_pcied / 绑定 `5709:1000`，BAR/MSI-X/DMA/字符设备 ⏐ sdep.ko / 仓库 |
| `host-numa` | host | RUNTIME_OBSERVED | 269 | Hygon CPU0 / NUMA Node 3 |
| `host-root-port` | host | CODE_PROVEN | 229 | 70:03.7 CPU PCIe Root Port / 驱动：pcieport |
| `host-addr-space` | host | CODE_PROVEN | 283, 291 | HOST系统环境的PCIE地址 ⏐ HOST系统环境的PCIE地址 |
| `pex-switch` | pcie-fabric | CODE_PROVEN | 230 | Broadcom PEX880xx PCIe Gen4 Switch |
| `pex-sub-switch` | pcie-fabric | CODE_PROVEN | 343, 366, 368 | 73:00.0 / 74:10.0 / GPU分支下级PEX Switch / 驱动：PCI核心/pcieport ⏐ 79:00.0 / 7a:00.0 / SPU分支下级PEX |
| `pex-downstream` | pcie-fabric | CODE_PROVEN | 340, 363, 367 | 72:00.0 顶层Switch Downstream Port / 驱动：pcieport ⏐ 72:04.0 顶层Switch Downstream Port / 驱动：pci |
| `pex-upstream` | pcie-fabric | CODE_PROVEN | 339 | 71:00.0 顶层Switch Upstream Port / 驱动：PCI核心/pcieport |
| `pex-mgmt` | pcie-fabric | CODE_PROVEN | 377 | 72:1c.0 / PEX Switch管理端口/管理Endpoint |
| `p2p` | pcie-fabric | RUNTIME_OBSERVED | 288 | P2P |
| `spu-addr-space` | pcie-fabric | CODE_PROVEN | 277, 293, 306 | SPU系统环境的PCIE地址 ⏐ SPU系统环境的PCIE地址 ⏐ SPU系统环境的PCIE地址 |
| `spug-nvme-branch` | spug | RUNTIME_OBSERVED | 370, 369, 373, 211 | HOST侧pcieport /  / 7f:00.0 NVMe侧SPUG上游桥端口 / VID:DID = 5709:2000 / 驱动：pcieport ⏐ Nvme侧pciep |
| `spug-gpu-branch` | spug | RUNTIME_OBSERVED | 347, 346, 359, 212 | HOST侧pcieport /  / 76:00.0 GPU侧SPUG上游桥端口 / VID:DID = 5709:2000 / 驱动：pcieport ⏐ GPU侧pciepor |
| `spug-rdma-branch` | spug | INFERRED | 213 | RDMA网卡 |
| `spug-fpga-nvme` | spug-fpga | RTL_PROVEN | 208, 327, 328, 329, 330, 331, 332, 335, 393, 394 | SPUG-FPGA ⏐ Bar0 ⏐ Bar1 ⏐ Bar2 ⏐ Bar4 ⏐ Bar0 / 16MiB控制寄存器窗口 ⏐ Bar1 / 1MiB下游Config/IO代理窗口 ⏐ |
| `spug-fpga-gpu` | spug-fpga | RTL_PROVEN | 345, 348, 349, 350, 351, 352, 353, 354, 355, 356 | SPUG-FPGA ⏐ Bar0 ⏐ Bar1 ⏐ Bar2 ⏐ Bar4 ⏐ Bar0 ⏐ Bar1 ⏐ Bar2 ⏐ Bar4 ⏐ 地址转换 |
| `spug-fpga-rdma` | spug-fpga | INFERRED | 214 | SPUG-FPGA |
| `spu-fpga` | spu-fpga | RTL_PROVEN | 206 | SPU-FPGA |
| `suep-upstream` | spu-fpga | CODE_PROVEN | 383 | 02:00.1 SUEP / 驱动：suep_driver |
| `sdep-downstream` | spu-fpga | CODE_PROVEN | 378 | EDP / HOST侧Endpoint / 7b:00.1 SDEP数据/控制Function / VID:DID = 5709:1001 / 驱动：sdep_driver |
| `sp37-downstream` | spu-fpga | CODE_PROVEN | 303, 304 | 02:00.0 SP37 / 驱动：sp37 ⏐ SP37 / HOST侧Endpoint / 7b:00.0 SP37控制Function / VID:DID = 5709:10 |
| `bar-suep-pool` | spu-fpga | RTL_PROVEN | 408, 410, 412, 414, 416 | Bar0 / SUEP控制、映射表、NTB、vSPUG窗口 ⏐ Bar1 / 虚拟设备32位BAR地址池 ⏐ Bar2 / 较小64位虚拟BAR地址池 ⏐ Bar2 / 大型64位 |
| `bar-sdep-pool` | spu-fpga | RTL_PROVEN | 400, 402, 404 | Bar0 / SDEP控制、NTB、映射和设备管理 ⏐ Bar1 / 安全源代理、描述符和回退Payload窗口 ⏐ Bar2 / 大型Host侧地址映射/DMA重定向窗口 |
| `bar-sp37-pool` | spu-fpga | RTL_PROVEN | 396, 398, 406 | Bar0 / SP37协议、状态、中断和控制寄存器 ⏐ Bar2 / SP37协议、状态、中断和控制寄存器 ⏐ Bar0 / SPU侧SP37控制和NTB使能 |
| `spu-fpga-addr-trans` | spu-fpga | RTL_PROVEN | 323 | 地址转换 |
| `spu-cpu` | spu-cpu | RUNTIME_OBSERVED | 268 | SPU Hygon CPU |
| `spu-root-port` | spu-cpu | CODE_PROVEN | 264 | 00:03.1 PCIe Root Port |
| `spu-vbus-f0` | spu-cpu | CODE_PROVEN | 387 | spu_vgpu创建的虚拟PCI Bus f0 |
| `spu-vgpu-a10` | spu-cpu | CODE_PROVEN | 388 | f0:00.0 虚拟A10 / 保留物理A10的10de:2236身份 / 驱动：Nvidia / BAR映射到SUEP的大地址窗口 |
| `spu-vgpu-nvme` | spu-cpu | CODE_PROVEN | 389 | f0:01.0 虚拟Samsung NVMe / 保留物理NVMe的144d:a808身份驱动：nvme-gds / BAR映射到SUEP窗口 |
| `spu-ep-direct` | spu-cpu | CODE_PROVEN | 265 | EP端口-直连 |
| `spu-business` | spu-sw | CODE_PROVEN | 599 | 业务层 |
| `spu-userspace` | spu-sw | CODE_PROVEN | 583 | 用户态 |
| `spu-kernel` | spu-sw | CODE_PROVEN | 207 | 内核部分 |
| `spu-kernel-custom` | spu-sw | CODE_PROVEN | 477, 513, 514 | SPU定制内核-spu_kernel / 仓库：spu_kernel / hook_dma/hook_rdma和系统能力 ⏐ Hook_dma / spu_vgpu决定是否把原DM |
| `spu-sp37` | spu-sw | CODE_PROVEN | 423 | sp37.ko is_spu=1 / 仓库：kernelspace/spu_pcied /  / SPU与Host之间最底层的PCIe“串口/网线驱动”。 / sp37只负责可靠搬 |
| `spu-vgpu` | spu-sw | CODE_PROVEN | 437 | spu_vgpu.ko / 仓库：spu-g / 准确定位 / 它是SPU侧SUEP驱动和PCIe设备虚拟化控制器， / 负责把Host/SPUG后的GPU、NVMe、RNIC等设 |

## 边 → 源图依据

| 边 | 起点 → 终点 | 类型 | 证据 | 源图形状或连接线 |
|---|---|---|---|---|
| `host-scan-root` | host-kernel → host-root-port | control | CODE_PROVEN | 形状 [446] sp37.ko / 仓库：kernelspace/spu_pcied / 绑定 `5709:1000`，BAR/MSI-X/DMA/字符设备 |
| `root-to-fabric` | host-root-port → pex-switch | physical | INFERRED | 无 —— 按 BDF 关系推断 |
| `fabric-upstream` | pex-switch → pex-sub-switch | physical | CODE_PROVEN | 连接线 [374] 363→366；连接线 [375] 367→368；连接线 [376] 340→343 |
| `fabric-to-nvme-bridge` | pex-sub-switch → spug-nvme-branch | physical | CODE_PROVEN | 形状 [366] 79:00.0 / 7a:00.0 / SPU分支下级PEX Switch / 驱动：PCI核心/pcieport；形状 [368] 7c:00.0 / 7d:10.0 / GPU分支下级PEX Switch / 驱动：PCI核心/pcieport |
| `fabric-to-gpu-bridge` | pex-sub-switch → spug-gpu-branch | physical | CODE_PROVEN | 连接线 [233] 343→347；形状 [343] 73:00.0 / 74:10.0 / GPU分支下级PEX Switch / 驱动：PCI核心/pcieport |
| `nvme-bridge-to-spug-fpga` | spug-nvme-branch → spug-fpga-nvme | physical | CODE_PROVEN | 连接线 [285] 369→277；连接线 [287] 369→278；连接线 [284] 283→370 |
| `gpu-bridge-to-spug-fpga` | spug-gpu-branch → spug-fpga-gpu | physical | CODE_PROVEN | 连接线 [390] 346→359 |
| `spug-fpga-to-spu-fpga-proxy` | spug-fpga-nvme → spu-fpga-addr-trans | payload | CODE_PROVEN | 形状 [295] SPUG-FPGA；形状 [296] SPUG FPGA会生成两类TLP： /  / 描述符： / → SDEP BAR1 + 0x1000～0x1700 / → 携带原始地址、长度、类型、Tag /  / 真实请求/数据： / → SDEP BAR1 + 0x80000～0xf0000；形状 [298] SPU-FPGA从描述符取回： / 原地址 = 0X3c000400000 /  / 然后覆盖代理TLP头里的地址： / s_spu_rq_tdata(63 downto 0) <= s_spu_rq_real_addr; /  / 它再把RQ送到SPU侧PCIe接口 |
| `addr-trans-to-suep-bar` | spu-fpga-addr-trans → bar-suep-pool | payload | CODE_PROVEN | 形状 [298] SPU-FPGA从描述符取回： / 原地址 = 0X3c000400000 /  / 然后覆盖代理TLP头里的地址： / s_spu_rq_tdata(63 downto 0) <= s_spu_rq_real_addr; /  / 它再把RQ送到SPU侧PCIe接口；形状 [300] 命中SUEP BAR4；形状 [301] 恢复后的： / 0x3c000400000 /  / 落在SUEP BAR4范围： / 0x3c000000000～0x3dfffffffff /  / SUEP识别它属于虚拟A10 BAR1，然后计算： / 物理地址 / = 物理A10 BAR1+ (当前虚拟地址 - 虚拟A10 BAR1) / = 0x34000000000+ (0x3c000400000 - 0x3c000000000) / = 0x34000400000 /  / 该翻译公式直接出现在[SPU-FPGA BAR4虚拟到物理映射 |
| `suep-bar-to-ep` | bar-suep-pool → spu-ep-direct | payload | CODE_PROVEN | 连接线 [308] 414→306 |
| `ep-to-root-port` | spu-ep-direct → spu-root-port | physical | CODE_PROVEN | 连接线 [421] 264→265 |
| `root-port-to-vbus` | spu-root-port → spu-vbus-f0 | physical | CODE_PROVEN | 连接线 [420] 387→264 |
| `vbus-to-virtual-a10` | spu-vbus-f0 → spu-vgpu-a10 | physical | CODE_PROVEN | 连接线 [420] 387→264 |
| `vbus-to-virtual-nvme` | spu-vbus-f0 → spu-vgpu-nvme | physical | CODE_PROVEN | 连接线 [420] 387→264 |
| `spu-sw-drives-vgpu` | spu-vgpu → spu-vbus-f0 | control | CODE_PROVEN | 形状 [437] spu_vgpu.ko / 仓库：spu-g / 准确定位 / 它是SPU侧SUEP驱动和PCIe设备虚拟化控制器， / 负责把Host/SPUG后的GPU、NVMe、RNIC等设备映射成SPU内部可枚举的PCIe设备。 /  / 绑定FPGA-SPU侧的：5709:1001 /  / 向上： / Linux PCI Core / NVIDIA驱动 / nvme-pci / RDMA驱动 / hook_dma/hook_rdma / 用户态spuctl/管理脚本 /  / 向下： / SUEP PCIe Function / SPU FPGA BAR与NTB寄存器 /  / 核心数据： / 设备身份 / 物理BDF / 虚拟BDF / Vendor/Device ID / Class Code / PCIe能力 / 设备代际和在线状态 /  / BAR资源 / 物理BAR基址和大小 / SPU虚拟BAR基址和大小 / BAR Mask / 32/64位BAR类型 / Prefetchable属性 / 映射表项；形状 [387] spu_vgpu创建的虚拟PCI Bus f0 |
| `sdep-to-host-addr` | bar-sdep-pool → host-addr-space | payload | CODE_PROVEN | 连接线 [321] 404→291 |
| `sp37-pair` | spu-sp37 → sp37-downstream | control | CODE_PROVEN | 形状 [423] sp37.ko is_spu=1 / 仓库：kernelspace/spu_pcied /  / SPU与Host之间最底层的PCIe“串口/网线驱动”。 / sp37只负责可靠搬运字节和硬件控制。 /  / 绑定设备： / Vendor ID = 0x5709 / Device ID = 0x1000 /  / 字符设备： / /dev/sp37_h2c_0 SPU向Host方向写 / /dev/sp37_c2h_0 SPU接收Host方向数据 / /dev/sp37_efuse0 FPGA eFuse/身份材料 /  / sysfs: / fpga_version / fpga_control / spu_serial / spu_rand / spu_fan_control / spu_hw_ver / spu_has_key /  / 核心数据： / DMA Ring Buffer基址 / Buffer大小（默认1 MiB，可调整） / 读写指针 / 消息长度 / MSI-X向量 / 超时状态 / FPGA协议头和Payload /  / 基本过程：；形状 [304] SP37 / HOST侧Endpoint / 7b:00.0 SP37控制Function / VID:DID = 5709:1000 / 驱动：sp37 |
| `host-kernel-to-sdep` | host-kernel → sdep-downstream | control | CODE_PROVEN | 形状 [442] sdep.ko / 仓库：spu-g / 绑定 `5709:1001`，扫描SPUG/GPU拓扑、NTB管理、P2P和工作模式；形状 [378] EDP / HOST侧Endpoint / 7b:00.1 SDEP数据/控制Function / VID:DID = 5709:1001 / 驱动：sdep_driver |

## 源图区域划分（人工审阅）

### A · SPU 软件栈（业务层 / 用户态 / 内核）

图左半部分的软件分层：- 业务层 `599`（y≈123~151）→ 用户态 `583`（y≈96~122）→ 内核部分 `207`（y≈75~95）；最左还有一条 `内存 479`（x≈34，是全高标注条）。
三层是**显式的容器矩形**（Visio 里画上去的大框），包含关系可靠。


### B · SPU-FPGA 寄存器与 BAR 窗口

图正中 y≈52~60 的一条带：SPU-FPGA `206` 容器 + `地址转换 323` + 三组 BAR 表。
· SUEP 上行侧（HOST 看到的 SUEP 卡）：Bar0 256MiB / Bar1 512MiB / Bar2 4GiB / Bar2 128GiB / ROM 16MiB
· SDEP 下行侧：Bar0 4MiB / Bar1 4MiB / Bar2 32GiB
· SP37 下行侧：Bar0 128KiB ×2 / Bar2 64KiB
上行 Endpoint（`02:00.0 SP37`、`02:00.1 SUEP`）与下行 Endpoint（`7b:00.0 SP37`、`7b:00.1 EDP`）也归到这里，因为它们和 BAR 表是一一对应的。


### D · HOST 侧软件栈

图下方的 HOST `205` 大框（y≈8~35），内部按 `内核 / 用户态 / 平台阶段 / 业务阶段` 四段分层；左侧 `内存 228` 是 Host 侧内存标注条。


### E · 地址映射走查（TLP 代理链路）

图最右列 y≈36~46 的 6 个说明框，串起一条真实抓到的地址翻译链：
SPUG-FPGA 发描述符 → SPU-FPGA 取回原始地址并覆盖 TLP 头 → 命中 SUEP BAR4 → 还原出物理地址。
这是一次**现场取证记录**，不是结构定义。


### F · 游离标注

不属于任何框、也不在任何空间带里的孤立标注（多半是画图时留下的散件，**看图时留意**）。


### C · SPUG 与 PCIe 端到端拓扑

图中/右部剩余的全部内容，按**列**切分子区：SPU 内部虚拟总线 → NVMe 支路 → GPU 支路 → RDMA 支路 → PCIe Switch/根端口 → 驱动视角注解。

- **C1 · SPU 内部 PCIe 地址空间与虚拟设备总线**：`spu_vgpu` 在 SPU 内部造出来的一条虚拟 PCI 总线 `f0`：`f0:00.0 虚拟A10`（保留 10de:2236）/ `f0:01.0 虚拟Samsung NVMe`（保留 144d:a808），接到 `00:03.1 PCIe Root Port` 与 `EP端口-直连`；紫色小块 `SPU系统环境的PCIE地址` 是地址语义标注。
- **C2 · NVMe 支路（NVMe 侧 SPUG 与其上下游桥）**：`Nvme 211` 容器给出物理 NVMe（`81:00.0 物理Samsung NVMe`，144d:a808，Host 侧无驱动=所有权已交给 SPU）； `Nvme侧pcieport 369`（80:00.0，5709:2001 下游桥）与 `HOST侧pcieport 370`（7f:00.0，5709:2000 上游桥）； `SPUG-FPGA 208` 内部是 Bar0/Bar1/Bar2/Bar4 的地址转换表与说明。
- **C3 · GPU 支路（GPU 侧 SPUG 与其上下游桥）**：`GPU 212` 容器给出物理 A10（`78:00.0 物理NVIDIA A10`，10de:2236，Host 侧无驱动）； `GPU侧pcieport 346`（77:00.0）与 `HOST侧pcieport 347`（76:00.0）；`SPUG-FPGA 345` 内部同样是 BAR 地址转换表。
- **C4 · RDMA 支路**：最右列 `RDMA网卡 213` 与 `SPUG-FPGA 214`。
- **C5 · PCIe Switch 与 Host 根端口**：`Broadcom PEX880xx PCIe Gen4 Switch 230`（71:00.0 上游 / 72:00.0·72:04.0·72:08.0 下游 / 72:1c.0 管理口）， 三条下级 PEX Switch 支路（73·74 / 79·7a / 7c·7d），以及 Host 根端口 `70:03.7 CPU PCIe Root Port`、`Hygon CPU0 / NUMA Node 3`。 `288 P2P`、`291/283 HOST系统环境的PCIE地址` 是地址语义标注。
- **C6 · 驱动视角与端到端注解**：旁注性质的说明框：`sdep_driver / nvme-gds` 在 Host 与 SPU 两侧分别能看到什么、动态 DMA 地址从哪里来、 以及 `pcieport` 表象下 SDEP 实际仍操作了 SPUG BAR 的事实。

