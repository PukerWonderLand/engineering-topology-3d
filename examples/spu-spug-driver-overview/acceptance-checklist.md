# SPU / SPUG 全驱动总览验收清单

## 已完成

- [x] 新增独立 `spu-spug-driver-overview` 场景，不覆盖 RDMA 专题。
- [x] 使用 SceneDefinition `2.0`，提供中文和英文内容。
- [x] 建立七个部署/所有权区域：Host 用户态、Host 内核、SPU FPGA、SPU 内核、SPU 用户态、SPUG FPGA、外部端点。
- [x] 提供运行位置、Git 仓库与产物、FPGA 交互、启动与卸载生命周期四个视图。
- [x] 明确 `sp37.ko` 同源模块在 Host 和 SPU 两侧的不同加载方式。
- [x] 明确 `spu-g` 同时产出 Host `sdep.ko` 与 SPU `spu_vgpu.ko`。
- [x] 明确 `spug_driver.c` 编入 `sdep.ko`，没有虚构独立现行 `spug.ko`。
- [x] 展示 SDEP、SUEP、SPU Function 0/1、SPUG bridge 与厂商 GPU 驱动之间的交互。
- [x] 区分代码控制链、PCIe 物理链、TLP payload、同步和生命周期边。
- [x] 提供五条因果旅程：SP37/PCS、SDEP/SUEP、GPU/DMA、SPUG 安全 TLP、卸载/回收。
- [x] 所有函数均包含 Trigger、Context、Consumes、Produces、State/Resource、Completion/Error 和适用的 Hardware effect。
- [x] 将 RDMA、NVMe/SM4、SStorage 和历史 XDMA 与基础主线分开。
- [x] 未写入凭据、生产地址、真实序列号、bitstream、Flash 镜像或运行日志。

## 仍需实机或源码补证

- [ ] 导出 Host/SPU 的 `uname -r`、kernel config、`lsmod`、`modinfo`、模块 vermagic/signature/SHA-256。
- [ ] 导出 `lspci -nn -tv/-vv`、实际 BDF、BAR、MSI-X、AER、IOMMU group 和 ACS 设置。
- [ ] 绑定 SPU/SPUG bit SHA-256、版本寄存器、源码/gitlink、工具/IP/XDC 与板卡 Revision。
- [ ] 核实 `5709:2001` DWC 变体是否由目标版本的 SDEP/SPUG bridge 管理代码直接绑定。
- [ ] 冻结生产模式：Host 原生 GPU 直连模式或 SPU SUEP 虚拟 GPU 模式。
- [ ] 补齐 `nereus/spu_tssd` 所有内核模块、适配器和服务产物名。
- [ ] 补齐 `nereus/kernelspace/spuinfo` 的最终模块/工具产物名与加载命令。
- [ ] 实测 SP37 H2C/C2H 边界、并发、reset、异常设备隔离和重连。
- [ ] 实测 SDEP/SUEP 虚拟设备创建、厂商驱动绑定、DMA 重定向和 P2P。
- [ ] 实测 SPUG Available/Nonsecure/Auth/Secure/Error 状态转换和失败关闭。
- [ ] 验证卸载、reset、热拔出、GPU 进程占用和故障注入下的严格逆序回收。

## V2 渲染器修复与功能保护

- [x] 场景初版采用 Scene-only；后续针对语义视图的通用渲染缺陷补充了渲染器级修复。
- [x] 适用范围为 `COMMON`、`GENERIC`、证据安全和场景包检查项。
- [x] 保留场景路由、场景下拉切换、双语、节点选择、Journey、函数契约、证据等级和布局能力。
- [x] 语义视图成员统一驱动节点透明度、区域可见性、相机取景、连线过滤和漂浮批注。
- [x] 初始全景仅保留区域级标签；节点批注按 `subLabelDistance` / `subLabelFadeRange` 随镜头拉近渐进浮现，视口内选中节点批注常驻。
- [x] 节点批注采用“距离渐隐 + 当前摄像机视口”双重门控；视锥外节点不进入批注碰撞布局，选中状态也不绕过视口限制。
- [x] 远景渐隐只会降低可见度，不会把已弱化的非相关节点或线条反向增亮。
- [x] 全驱动场景远景衰减起点按响应式全景取景距离调整为 `100`。
- [x] 渲染器修改包含防回归测试；未修改 `demo/`、`spec/`、构建配置或依赖。
- [x] 每个 Node 恰属一个 Zone，且每个 Node/Zone 均有布局。
- [x] 所有 `INFERRED` 边界在 Journey caveat 或证据清单中说明。
- [x] 场景包包含 `topology.yaml`、`source-inventory.md` 和 `acceptance-checklist.md`。
