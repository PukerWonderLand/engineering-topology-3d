# Engineering Topology 3D

这是一个面向工程系统的、带证据等级的交互式 3D 拓扑框架。它把物理设备、Linux/驱动层级、因果事务、数据流和证据边界放进同一个浏览器场景。

当前 `v0.1` 附带匿名化的 T113 ARM-XVC 参考实例，用于证明框架如何表达 x86 工具端、局域网、ARM 网关、USB/JTAG 链和 FPGA。该实例不是完整的 T113 部署教程，也不会连接或控制真实设备。

核心能力包括：距离 LOD、标签碰撞避让、模块聚焦、四类因果图、五条事务旅程、函数六接口契约、中英文切换和纯静态部署。

本地运行：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

检查和构建：

```bash
pnpm lint
pnpm test
```

公开示例已删除真实 IP、下载器序列号、本机绝对路径、凭据、BIT/MCS、日志和生产脚本。真实硬件操作前必须重新探测 USB、线缆、器件链与 Flash 身份。
