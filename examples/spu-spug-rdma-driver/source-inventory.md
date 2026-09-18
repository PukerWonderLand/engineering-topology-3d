# SPU / SPUG RDMA 驱动拓扑证据清单

本场景依据 2026-09-01 的公司 RDMA 驱动架构审计文档制作，用于解释驱动、定制内核、SUEP 虚拟化与 SPUG 硬件状态之间的关系。

## 版本基线

| 组件 | 分支 | 审计基线 | 场景中的职责 |
|---|---|---|---|
| `nereus/spu-g` | `rdma_driver` | `bce7906f802061bab32f54f5aff2f201a95ecf9c` | SUEP、vSPUG/vBEP、RDMA 回调与 SPUG 寄存器 |
| `nereus/spu_kernel` | `hook_rdma` | `6d592372206154203d60cef8573402bdb8ec7a35` | `ib_umem` get/release 显式 Hook |
| `nereus/spu-g` | `main` | `cfc8071b0e41d279ad71077a962f942ea89c00b5` | 主线对照；RDMA 分支未包含其后续两个提交 |
| `nereus/spu_kernel` | `main` | `dfc2b592b73037c07ac51164080eeaeed615471f` | 内核主线对照 |

## 文档来源

- `README.md`：审计结论、版本组合与成熟度边界。
- `01_版本基线与修改范围.md`：分支、提交、修改文件与历史演进。
- `02_驱动架构与生命周期.md`：对象关系、probe、MR get/release、寄存器 ABI 和卸载顺序。
- `03_代码风格与风险审计.md`：P0/P1 风险、不能照搬的模式与整改优先级。
- `04_对NVMe驱动改造的直接启示.md`：统一 Region Manager、NVMe 生命周期与虚拟设备路由的目标架构。

文档原始位置为用户指定的 `E:\StayHungry\...\Nvme虚拟化\RDMA的驱动架构`。拓扑仓库只保存提炼后的关系和证据索引，不复制原始审计全文。

## 代码证据映射

| 拓扑模块 | 代码入口 | 证据等级 |
|---|---|---|
| RDMA Core / `ib_umem` | `spu_kernel/drivers/infiniband/core/umem.c` | `CODE_PROVEN` |
| RDMA Hook API/分派 | `spu_kernel/include/linux/suep_hook_rdma.h`、`spu_kernel/kernel/dma/suep_hook_rdma.c` | `CODE_PROVEN` |
| SUEP RDMA 回调 | `spu-g/spu_driver/suep_rdma_driver.c` | `CODE_PROVEN` |
| vSPUG/vBEP/虚拟 PCI | `spu-g/spu_driver/suep_virtual_device.c` | `CODE_PROVEN` |
| SUEP probe/remove | `spu-g/spu_driver/suep_driver.c` | `CODE_PROVEN` |
| Host 设备与 P2P 管理 | `spu-g/spu_driver/suep_host_dev_management.c` | `CODE_PROVEN` |
| SPUG MMIO ABI | `spu-g/spu_driver/suep_vspug_hardware_regs.c` | `CODE_PROVEN` |
| SPUG 密码数据面 | FPGA ABI/RTL 与寄存器契约 | `RTL_PROVEN`；仍需运行观测证明端到端效果 |
| 统一 DMA Region Manager | 审计提出的目标实现 | `INFERRED` |

## 必须保持的证据边界

- 驱动确实在 DMA map 完成后读取 DMA SG；这不自动证明所有 IOMMU/地址翻译组合都正确。
- Host 普通内存的 Bitmap set/clear 路径有代码证据；GDR peer 路径当前会跳过这张 Bitmap。
- 历史提交说明基础 RDMA Write 加解密曾通过，但不能据此宣称大 MR、多 MR、reset、热卸载和 GDR 已产品化验收。
- 统一 Region Manager、安全卸载顺序、页引用计数、generation 和 fail-closed 是目标架构，不是当前代码的既成事实。
