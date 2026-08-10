# T113 ARM-XVC 3D 架构验收清单

## 信息模型

- [x] x86 工具端、可信 LAN、T113、USB Hub、双 JTAG 和 KU15P/690T 可独立选择。
- [x] T113 平台、ABI、Buildroot 和内存按匿名化资料表达。
- [x] 每路实例保留设备身份、端口、PID、锁、runtime 和 health 独占语义。
- [x] KU15P/Vivado 与 690T/ProCISE 工具分流明确。
- [x] 690T 远程链标为 INFERRED，不冒充双 KU15P 实证。

## 三维呈现

- [x] 使用 React Three Fiber / Three.js / WebGL 实时渲染。
- [x] x86、T113 和物理硬件形成稳定三层空间。
- [x] USB 扩展坞是独立三维模块。
- [x] KU15P、690T 和 health 三条链使用独立颜色。
- [x] 支持模块聚焦、相机适配、标签碰撞避让和全屏系统索引。

## 事务与证据

- [x] 提供 KU15P XVC、690T 边界、初始化、恢复、Flash/冷启动五条旅程。
- [x] 提供数据、控制、同步、生命周期四类因果层。
- [x] 服务函数保留 Trigger、Context、Consumes、Produces、State/Resource、Completion/Error 六接口。
- [x] 冷启动 PASS 1/3、第三路、双 XVC+UART、长期稳定性和公网安全边界均明确。

## 自动验证

- [x] TypeScript 通过。
- [x] TypeScript 静态检查通过。
- [x] Vite 静态构建通过。
- [x] 静态页面与领域契约测试通过。
