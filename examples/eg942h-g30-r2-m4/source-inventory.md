# EG942H-G30 R2-M4 场景证据清单

本场景描述当前测试服务器的远程启动、带外管理和启动黑匣子架构。它不是主板原理图，也不把常见 BMC 设计自动当成本机已证实事实。

## 已纳入的本地资料

| 来源 | 用途 | 证据边界 |
|---|---|---|
| `../../../服务器的BMC-HOST管理.md` | BMC 通道、SOL、虚拟介质、启动实测 | 运行观察与操作记录 |
| `../../../测试服务器-R2-M4.md` | 服务器型号、Host 配置和连接背景 | 文档记录，变化项仍需现场复核 |
| `../../../r2-m4-shared-environment.json` | 实际环境别名与受控连接信息 | 不复制凭据、真实 IP、MAC、序列号到公开场景 |
| `external/eg942h-g30-boot-recorder/bmc_boot_recorder.py` | SOL/POST/SEL 采集与会话存储 | 外部管理节点代码已实现；不随此渲染仓库分发 |
| `external/eg942h-g30-boot-web/boot_web.py` | 黑匣子 Web 查询与人工分段 | 外部管理节点代码已实现；不随此渲染仓库分发 |
| EG942H-G30 产品资料 | 4U、双路海光、BMC 与扩展能力 | 产品级能力不等于每条主板走线已确认 |
| IPMI/BMC 实测 | IPMI 2.0、SOL、专用/共享通道、FRU、Virtual CDROM | `RUNTIME_OBSERVED` |
| 远程 ISO 启动实测 | MegaRAC API、NFSv3 中继、一次性 UEFI CD、Ubuntu Live | `RUNTIME_OBSERVED`；未安装或改写系统盘 |

## 证据等级

- `CODE_PROVEN`：现有管理节点程序中可直接核对的行为。
- `RTL_PROVEN`：产品/器件层面明确的硬件职责，不表示板级走线细节全部已知。
- `RUNTIME_OBSERVED`：在当前服务器上通过命令、日志、KVM、SOL 或启动结果观察到。
- `INFERRED`：符合常见服务器/BMC 架构，但仍需原理图、芯片资料或现场命令确认。

## 明确不公开

- BMC、Host、NAS、管理节点的真实 IP。
- 用户名、密码、会话 Cookie、CSRF Token、密钥。
- 完整 MAC、序列号、FRU 唯一标识。
- 公司 NAS 的真实共享路径。
- 未经确认的 BMC SoC 型号、Flash/DRAM 容量和主板网络端口绑定。

这些信息仍由上级目录的受控环境文件管理。渲染场景只使用 `BMC_DEDICATED_IP`、`MGMT_NODE`、`NAS_ISO_SOURCE` 等逻辑含义，不提供秘密。

## 当前最重要的推断项

1. BMC Shared LAN 到具体 Host LOM 的 NC-SI 绑定。
2. Host UART 到 BMC 的具体 UART 控制器、复用器和主板走线。
3. BMC KVM 视频捕获究竟使用哪种 VGA/PCIe/帧缓冲连接。
4. 电源、复位、POST Code 分别经 GPIO、eSPI、LPC 还是厂商逻辑实现。
5. 每个传感器、风扇、PSU、FRU 对应的 I²C/SMBus/IPMB 总线。
6. NVIDIA A10 与测试 NVMe 的实际 PCIe Root Port、NUMA、ACS/IOMMU 与 P2P 路径。
