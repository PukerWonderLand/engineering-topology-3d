# SPU / SPUG RDMA 场景验收清单

- [x] 使用用户指定的 5 份 RDMA 审计文档作为场景依据。
- [x] 展示 RDMA 用户态、RDMA core、`ib_umem`、`irdma`、定制 Hook、SUEP 回调之间的调用关系。
- [x] 展示 `pci_dev → vBEP → vSPUG` 的设备归属链。
- [x] 展示 SUEP probe、虚拟 PCI 总线、vSPUG/vBEP 创建与 RDMA 模式装配流程。
- [x] 展示 Host DRAM MR 从 DMA map、Bitmap set、事务执行到 release/unmap 的对称生命周期。
- [x] 把 GDR peer memory 的“已进入 Hook，但跳过 Host Bitmap”作为独立证据边界。
- [x] 把当前全局映射、Hook 注销、重叠 MR、边界检查与卸载次序风险明确标注。
- [x] 把统一 DMA Region Manager 标记为 `INFERRED` 目标架构，不伪装成现有实现。
- [ ] 在真实板卡上补充 MR register/release trace，并升级相关节点为 `RUNTIME_OBSERVED`。
- [ ] 验证大 MR、重叠 MR、GDR、reset、热卸载与故障注入路径。
- [ ] 根据现场 FPGA bitstream 与 ABI 冻结 Bitmap 地址域、容量、粒度和 generation。
