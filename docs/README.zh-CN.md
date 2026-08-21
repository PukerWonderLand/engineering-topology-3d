# Engineering Topology 3D

一个带证据等级的 3D 工程拓扑框架，用于直接在浏览器中呈现物理系统、软件栈、因果旅程和工程数据流。

[在线演示](https://pukerwonderland.github.io/engineering-topology-3d/) · [English README](../README.md) · [部署说明](deployment.md) · [AI 场景编写](ai-authoring.md) · [功能保护基线](feature-preservation-checklist.md) · [架构说明](architecture.md) · [安全边界](security-boundary.md)

## 项目为什么存在

传统工程图通常把硬件、软件、运行状态和证据拆分到不同文档中。Engineering Topology 3D 将它们放进同一个可导航场景，同时保持以下概念之间的明确区别：

- 物理拓扑与软件层级；
- 载荷流、控制流、同步关系与生命周期回滚；
- 源码直接证明的事实、运行时观测结果与显式推断；
- 全景标注与聚焦模式中的函数契约。

当前 `v0.2` 让所有领域共用同一个 SceneDefinition 2.0 增强型渲染器。匿名化的 T113 ARM-XVC 基线和 NVMe Bitmap 示例都能获得完整的系统索引、聚焦模式、标签、旅程、函数契约、证据模型、控制项、全屏行为和双语界面，不需要新增领域专用 React 页面。这些示例用于展示可视化模型，不是部署指南，也不是实时设备管理服务。

## 功能特性

- 使用 React Three Fiber 和 Three.js 实现实时 WebGL 拓扑。
- 面向区域、标签、板块和数据流的距离感知 LOD。
- 支持摄像机相对布局和模块相对布局的标签碰撞避让。
- 选中模块后按模块尺寸聚焦，而不是重置到整个场景中心。
- 五条因果旅程，以及四层可独立开关的因果图。
- 函数六接口契约：触发者、执行上下文、消费数据、产生数据、状态/资源、完成/错误。
- 证据等级：`CODE_PROVEN`、`RTL_PROVEN`、`RUNTIME_OBSERVED` 和 `INFERRED`。
- 中文和英文界面切换。
- 可部署到 GitHub Pages、Nginx 或任意对象存储的纯静态产物。
- 支持在构建时选择根页面默认场景，同时保留 `?scene=<scene-id>` URL 覆盖能力。
- 带版本号的 `SceneDefinition` Schema，以及 YAML 解析、关系校验和通用场景渲染器。
- 自动发现 `examples/<scene-id>/topology.yaml` 中的场景；通过 `?scene=<scene-id>` 打开。

## AI 知识适配快速开始

每个场景只有一个运行时知识文件：

```text
examples/<scene-id>/topology.yaml
```

修改已有场景时只编辑这个文件。适配新的知识领域时，只新增一个 `examples/<scene-id>/topology.yaml`。`source-inventory.md` 和 `acceptance-checklist.md` 用于记录证据及验收，不参与运行时渲染。

编写场景的 AI 应按以下顺序阅读：

1. [功能保护检查表](feature-preservation-checklist.md)：确定哪些已有能力不得回退。
2. [AI 场景编写指南](ai-authoring.md)：了解证据、实体、旅程、布局和公开边界。
3. [SceneDefinition Schema](../spec/scene-definition.schema.json)：确认 YAML 可以使用的正式字段。
4. `examples/` 中最接近目标领域的示例：只参考结构，不复制示例事实。

可以把下面的提示词直接交给另一个 AI：

```text
请把提供的工程资料适配为 Engineering Topology 3D 场景。

场景 ID：<scene-id>
资料路径或附件：<资料路径>
工程问题：<这个场景必须回答的问题>

本任务是“仅修改知识”的任务。唯一允许新增或修改的运行时知识文件是：
examples/<scene-id>/topology.yaml

禁止修改 src/、demo/、spec/、scripts/、tests/、package.json、
vite.config.ts、渲染组件、交互代码和 CSS。

修改前依次阅读：
1. docs/feature-preservation-checklist.md
2. docs/ai-authoring.md
3. spec/scene-definition.schema.json
4. 最接近目标领域的 examples/*/topology.yaml

必须通过 YAML 表达 zones、nodes、edges、functions、journeys、layout、
zhCN/enUS 和 evidence。严格区分 CODE_PROVEN、RTL_PROVEN、
RUNTIME_OBSERVED、INFERRED。不能从软件代码推断物理路径，不能把目标设计
升级为运行事实。不确定内容必须标记为 INFERRED，并在 caveat 中说明。

必须保留功能检查表中所有适用的 COMMON 和 GENERIC 功能。如果现有 Schema
无法表达必要能力，不得修改渲染器，也不得编造 Schema 不支持的字段；应将其
报告为框架能力缺口。

采用最小可行流程：先估计知识范围，再完成单个 YAML，随后运行：
pnpm validate:scenes
pnpm lint
pnpm build
只有验证失败或证据存在歧义时才扩大读取范围。

最终报告必须包含：变更文件、实体数量、证据边界、检查表适用范围、验证结果、
未验证事项，以及是否修改了 src/。
```

## 仓库结构

```text
engineering-topology-3d/
├── .github/                 # 工作流和社区模板
├── demo/                    # 浏览器入口
├── deploy/                  # 可移植的服务管理器模板
├── docs/                    # 架构、证据和部署说明
├── examples/
│   ├── t113-arm-xvc/        # 匿名化参考模型和验收说明
│   ├── nvme-bitmap/         # Schema 驱动的跨领域示例
│   └── eg942h-g30-r2-m4/    # 脱敏后的远程启动与 BMC 管理场景
├── public/                  # 公共静态资源
├── scripts/                 # 场景校验命令
├── spec/                    # 带版本号的 SceneDefinition JSON Schema
├── src/                     # 渲染器、交互、布局、数据和国际化源码
├── tests/                   # 小型契约测试和静态构建测试
├── LICENSE                  # 源代码使用 Apache-2.0 许可证
├── NOTICE                   # 文档和数据的许可证说明
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://127.0.0.1:4314/`。

如需让另一个 SceneDefinition 2.0 场景成为某次构建的根页面默认场景，可以设置 `VITE_DEFAULT_SCENE`；URL 查询参数仍具有更高优先级：

```bash
VITE_DEFAULT_SCENE=eg942h-g30-r2-m4 pnpm build
```

## 构建与检查

```bash
pnpm lint
pnpm validate:scenes
pnpm test
```

静态网站会输出到 `dist/`。资源地址使用相对路径，因此同一份输出可以部署在 GitHub 项目 Pages 的子路径下。

经过安全加固的 Linux systemd 部署方法、默认回环监听和显式局域网覆盖方式，请参阅[部署说明](deployment.md)。

## 参考示例边界

T113 示例有意只保留架构层信息。它不包含真实网络地址、JTAG 序列号、凭据、Bitstream、Flash 镜像、运行日志和生产部署脚本。执行任何硬件写操作前，都必须重新发现实际线缆、USB 链、FPGA 和 Flash 身份。

T113 参考场景位于默认地址。所有 SceneDefinition 2.0 场景都从 `examples/*/topology.yaml` 加载并进入同一个增强型渲染器；例如通过 `?scene=nvme-bitmap` 打开 NVMe Bitmap 场景。关于证据、建模、布局、国际化和校验契约，请参阅 [AI 场景编写指南](ai-authoring.md)。

## 参与贡献

欢迎依据 [Developer Certificate of Origin](https://developercertificate.org/) 参与贡献。请阅读 [CONTRIBUTING.md](../.github/CONTRIBUTING.md)，并使用 `git commit -s` 为提交添加签署信息。

## 许可证

- 源代码：[Apache License 2.0](../LICENSE)。
- 原创文档、知识模型和图示：[CC BY 4.0](../NOTICE)。
- 第三方依赖继续使用各自的许可证；参阅 [third-party-notices.md](legal/third-party-notices.md)。
