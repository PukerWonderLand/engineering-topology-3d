# 当前功能基线与 AI 变更保护检查表

本文是 Engineering Topology 3D `v0.2` 的功能基线。任何 AI、自动化工具或贡献者在适配新知识、重构渲染器、修改交互或调整构建方式时，都必须先确定变更范围，再逐项复核对应功能。不得以“新页面可以打开”代替功能保持验收。

## 1. 使用规则

范围标记：

- `COMMON`：增强参考页与通用场景共同依赖的能力；
- `ENHANCED`：默认 URL 下的 T113 ARM-XVC 增强参考页；
- `GENERIC`：通过 `?scene=<scene-id>` 打开的 Schema/YAML 通用场景；
- `REPO`：仓库、构建、测试、发布、安全和社区治理能力。

表中的“基线”表示当前代码已经具备该能力。“变更后复核”必须由执行变更的 AI 重新确认，不能因为基线已经打勾而跳过验收。

适用规则：

1. 只新增 `examples/<scene-id>/` 时，至少复核 `COMMON`、`GENERIC`、证据和场景包检查项。
2. 修改 `src/Generic*`、`scene-definition.ts`、`scene-loader.ts` 或 Schema 时，复核全部 `COMMON` 和 `GENERIC` 项。
3. 修改 `TopologyExplorer.tsx`、`PhysicalTopology3D.tsx`、布局、样式或国际化时，复核全部 `COMMON` 和 `ENHANCED` 项。
4. 修改依赖、构建、工作流或部署配置时，复核全部 `REPO` 项。
5. 如果某项有意删除或降级，必须在 PR/交付报告中列出功能 ID、原因、替代方案和用户确认，不能静默删除。

## 1.1 可直接交给 AI 的知识适配提示词

下面的提示词用于新增或更新知识场景。它把运行时写入范围限制为一个 `topology.yaml`，避免 AI 为了适配领域知识而修改通用渲染器。

```text
你正在为 Engineering Topology 3D 适配新的工程知识。

场景 ID：<scene-id>
源资料：<本地路径、附件或已经提供的文本>
要回答的工程问题：
1. <问题一>
2. <问题二>
3. <问题三>

任务模式：Knowledge-only / Scene-only。

唯一允许新增或修改的运行时知识文件：
examples/<scene-id>/topology.yaml

禁止修改：
- src/
- demo/
- spec/
- scripts/
- tests/
- package.json
- vite.config.ts
- 渲染组件、镜头、标签、交互、样式和构建架构

开始前必须依次读取：
1. docs/feature-preservation-checklist.md
2. docs/ai-authoring.md
3. spec/scene-definition.schema.json
4. 与目标领域最接近的 examples/*/topology.yaml

执行顺序：
Estimate：先从资料中识别证据、边界、实体、函数、事务旅程和布局规模。
Execute：只在 topology.yaml 中实现最小完整 SceneDefinition。
Expand：只有 Schema 校验失败、引用不闭合或证据有歧义时才扩大读取范围。

建模要求：
- zones 表达物理、部署、所有权或故障边界；
- nodes 表达具有稳定职责、状态或数据转换作用的实体；
- edges 区分 payload、control、sync、lifecycle、physical；
- functions 必须填写 Trigger、Context、Consumes、Produces、
  State/Resource、Completion/Error，可选 Hardware effect；
- journeys 必须回答明确问题，只引用真正参与该事务的步骤和边；
- layout 必须包含全部 Zone、Node 和默认镜头；
- 所有用户可见内容同时提供 zhCN 和 enUS；
- 严格区分 CODE_PROVEN、RTL_PROVEN、RUNTIME_OBSERVED、INFERRED；
- 不得从软件实现推断物理路径，不得把目标设计冒充运行事实；
- 未闭环事实标记 INFERRED，并在 journey caveat 中明确说明；
- 不得写入凭据、生产 IP、客户名、真实序列号、私有源码、BIT/MCS、
  Flash 镜像或生产日志。

功能保护要求：
- 必须复核本检查表中所有适用的 COMMON 和 GENERIC 项；
- 只增加知识不能造成已有场景、双语、选择、Journey、函数契约、证据、
  布局、构建和静态发布能力回退；
- 如果 Schema 无法表达某项知识，不得修改渲染器或增加未定义字段，
  必须在最终报告中列为“框架能力缺口”。

完成后执行：
pnpm validate:scenes
pnpm lint
pnpm build

最终报告必须包含：
- 实际修改的文件；
- Zone / Node / Edge / Function / Journey 数量；
- 各证据等级及仍为 INFERRED 的边界；
- 本检查表的适用范围和复核结果；
- 三条验证命令及结果；
- 未执行检查及原因；
- 是否修改 src/，正确答案应为“否”。
```

现有场景更新时，把 `<scene-id>` 替换为现有目录名并只编辑该目录中的 `topology.yaml`。新领域适配时，新建一个 `examples/<scene-id>/topology.yaml`；示例文件只提供结构，不能复制其中的工程事实。

## 2. 当前数量基线

| ID | 范围 | 当前基线 | 基线 | 变更后复核 |
|---|---|---:|:---:|:---:|
| BASE-01 | ENHANCED | 3 个系统平面：x86 工具端、T113 ARM-XVC、USB/JTAG/FPGA 物理端 | ✅ | ⬜ |
| BASE-02 | ENHANCED | 17 个可选节点 | ✅ | ⬜ |
| BASE-03 | ENHANCED | 36 条业务/物理边：3 组公共 7 边路径加 15 条领域边 | ✅ | ⬜ |
| BASE-04 | ENHANCED | 3 条主通道：KU15P、690T、HEALTH | ✅ | ⬜ |
| BASE-05 | ENHANCED | 4 种拓扑边：LAN、VIRTUAL、USB、DEBUG | ✅ | ⬜ |
| BASE-06 | ENHANCED | 6 个视图：全景、x86、T113、KU15P、690T、健康恢复 | ✅ | ⬜ |
| BASE-07 | ENHANCED | 5 条黄金事务旅程、34 个事务操作站、29 条旅程因果边 | ✅ | ⬜ |
| BASE-08 | ENHANCED | 4 个因果层、9 种事务关系、7 类执行上下文 | ✅ | ⬜ |
| BASE-09 | ENHANCED | 3 棵存储/资料树，共 11 个资料入口 | ✅ | ⬜ |
| BASE-10 | ENHANCED | 4 个镜头预设、13 个持久化显示参数 | ✅ | ⬜ |
| BASE-11 | GENERIC | 2 个跨领域场景包：T113 ARM-XVC、NVMe Bitmap | ✅ | ⬜ |
| BASE-12 | COMMON | 中文、英文两种界面语言 | ✅ | ⬜ |

数量不是越多越好，但变更后数量下降必须确认是有意调整，而不是导入、过滤或数据丢失。

## 3. 页面入口与场景路由

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| ENTRY-01 | COMMON | 使用 React 浏览器入口挂载静态应用 | ✅ | ⬜ |
| ENTRY-02 | ENHANCED | 默认 URL 打开增强 T113 ARM-XVC 参考页面 | ✅ | ⬜ |
| ENTRY-03 | GENERIC | `?scene=<scene-id>` 打开指定 Schema 场景 | ✅ | ⬜ |
| ENTRY-04 | GENERIC | 场景下拉框可在已发现场景之间切换 | ✅ | ⬜ |
| ENTRY-05 | GENERIC | 可从通用场景返回增强参考页面 | ✅ | ⬜ |
| ENTRY-06 | COMMON | 3D 主渲染器按需动态加载，加载期间显示明确状态 | ✅ | ⬜ |
| ENTRY-07 | GENERIC | 未找到指定 ID 时回退到已加载场景，而不是空白崩溃 | ✅ | ⬜ |
| ENTRY-08 | GENERIC | 没有任何有效场景时显示明确错误信息 | ✅ | ⬜ |

## 4. 增强参考页的信息组织与导航

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| NAV-01 | ENHANCED | 顶栏显示项目名称、页面范围和证据口径 | ✅ | ⬜ |
| NAV-02 | ENHANCED | 显示已验证平台、主链和 690T 未证明边界三项运行事实 | ✅ | ⬜ |
| NAV-03 | ENHANCED | `ALL` 恢复物理全景、等轴镜头、标注和默认事务状态 | ✅ | ⬜ |
| NAV-04 | ENHANCED | `CLR` 清除节点/边选择、路径和聚焦状态 | ✅ | ⬜ |
| NAV-05 | ENHANCED | 系统树按三个平面列出全部模块，可点击定位节点 | ✅ | ⬜ |
| NAV-06 | ENHANCED | 存储树列出复盘资料、T113 运行资料和硬件发布边界 | ✅ | ⬜ |
| NAV-07 | ENHANCED | 系统树与存储树可切换 | ✅ | ⬜ |
| NAV-08 | ENHANCED | 全屏模式仍保留系统索引 | ✅ | ⬜ |
| NAV-09 | ENHANCED | 全屏系统索引可用侧边箭头收起和展开 | ✅ | ⬜ |
| NAV-10 | ENHANCED | 移动端可分别打开/关闭系统树和详情抽屉 | ✅ | ⬜ |
| NAV-11 | ENHANCED | 顶部搜索覆盖中英文标题、标签、接口、脚本、端口、设备节点和路径 | ✅ | ⬜ |
| NAV-12 | ENHANCED | 搜索最多显示 8 个候选结果 | ✅ | ⬜ |
| NAV-13 | ENHANCED | 搜索框按 Enter 可选中首个结果 | ✅ | ⬜ |
| NAV-14 | ENHANCED | 可清空搜索并关闭候选列表 | ✅ | ⬜ |
| NAV-15 | ENHANCED | 6 个架构视图会共同过滤节点和边 | ✅ | ⬜ |
| NAV-16 | ENHANCED | 当前视图显示可见节点和边数量 | ✅ | ⬜ |
| NAV-17 | ENHANCED | 视图切换会清除旧路径并恢复全局标注 | ✅ | ⬜ |

## 5. 3D 场景、物理结构和基础交互

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| 3D-01 | COMMON | React Three Fiber、Three.js、Drei/WebGL 实时 3D 渲染 | ✅ | ⬜ |
| 3D-02 | ENHANCED | x86 工具、LAN、T113、USB Hub、JTAG 和 FPGA 使用独立空间结构呈现 | ✅ | ⬜ |
| 3D-03 | ENHANCED | 服务器、网关板、USB/JTAG/FPGA 具有物理外形和层级外壳 | ✅ | ⬜ |
| 3D-04 | ENHANCED | Layer Frame 显示系统层级框 | ✅ | ⬜ |
| 3D-05 | ENHANCED | Depth Guide 显示网络、Namespace、USB/硬件语义深度 | ✅ | ⬜ |
| 3D-06 | COMMON | 左键拖动旋转、右键平移、滚轮缩放 | ✅ | ⬜ |
| 3D-07 | ENHANCED | 等轴、正视、俯视、深度四个镜头预设 | ✅ | ⬜ |
| 3D-08 | ENHANCED | 短点选择与长按/拖动旋转分离 | ✅ | ⬜ |
| 3D-09 | ENHANCED | 长按阈值 220 ms、拖动阈值 4 px，镜头变化会取消误点击 | ✅ | ⬜ |
| 3D-10 | ENHANCED | 点击空白清除选择，聚焦模式下点击空白不误退出 | ✅ | ⬜ |
| 3D-11 | ENHANCED | 节点和主管道均可单独选择 | ✅ | ⬜ |
| 3D-12 | ENHANCED | 双击模块进入隔离聚焦 | ✅ | ⬜ |
| 3D-13 | ENHANCED | 未选中对象透明弱化，相关对象提高可见度 | ✅ | ⬜ |
| 3D-14 | ENHANCED | 选中节点不透明、高对比、白色发光边缘并慢速脉冲 | ✅ | ⬜ |
| 3D-15 | ENHANCED | 选中主管道具有白色发光包络和脉冲效果 | ✅ | ⬜ |
| 3D-16 | ENHANCED | 选中函数点和事务站具有放大、白色发光与脉冲 | ✅ | ⬜ |
| 3D-17 | ENHANCED | 使用需求驱动渲染 `frameloop="demand"`，避免静止时持续占用 | ✅ | ⬜ |
| 3D-18 | ENHANCED | DPR 限制为 1–1.25，兼顾清晰度与 GPU 开销 | ✅ | ⬜ |
| 3D-19 | ENHANCED | 按需动画循环在数据流、选择或聚焦时恢复刷新 | ✅ | ⬜ |

## 6. 管道、数据流和边过滤

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| FLOW-01 | ENHANCED | KU15P 已验证链、690T 待验证链、健康恢复链使用独立颜色 | ✅ | ⬜ |
| FLOW-02 | ENHANCED | 主管道使用三维曲线、实体管径和方向箭头 | ✅ | ⬜ |
| FLOW-03 | ENHANCED | 主管道上有沿曲线运行的流向 Token | ✅ | ⬜ |
| FLOW-04 | ENHANCED | 可独立打开或关闭流向动画 | ✅ | ⬜ |
| FLOW-05 | ENHANCED | 主管道粗细支持 1.0×–6.0× 连续调节 | ✅ | ⬜ |
| FLOW-06 | ENHANCED | 提供 1×、3×、4.5×、6× 快捷预设 | ✅ | ⬜ |
| FLOW-07 | ENHANCED | 管道粗细只影响三条主管道，不放大函数互动细线 | ✅ | ⬜ |
| FLOW-08 | ENHANCED | LAN、VIRTUAL、USB、DEBUG 四类边可独立显示/隐藏 | ✅ | ⬜ |
| FLOW-09 | ENHANCED | 点击边后显示两端实体、协议合同、证据等级和边描述 | ✅ | ⬜ |
| FLOW-10 | ENHANCED | 推断路径与已证明路径具有可区分的视觉语义 | ✅ | ⬜ |
| FLOW-11 | ENHANCED | 方向卡可快速选择关键业务通道 | ✅ | ⬜ |

## 7. 标签、碰撞、LOD 与 HUD

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| LABEL-01 | ENHANCED | 全局模块标注总开关，可显示未选中模块名称和基本作用 | ✅ | ⬜ |
| LABEL-02 | ENHANCED | `L` 快捷键切换全局标注 | ✅ | ⬜ |
| LABEL-03 | ENHANCED | 支持“模块周边”和“摄像机两侧”两种标签布局 | ✅ | ⬜ |
| LABEL-04 | ENHANCED | 模块周边模式从模块投影锚点寻找最近空位 | ✅ | ⬜ |
| LABEL-05 | ENHANCED | 摄像机模式强制使用左右安全区，避免占据画面中心 | ✅ | ⬜ |
| LABEL-06 | ENHANCED | 标签之间执行矩形碰撞求解 | ✅ | ⬜ |
| LABEL-07 | ENHANCED | 标签会避让选择 HUD、镜头按钮、图例、设置面板和帮助栏等 UI 障碍物 | ✅ | ⬜ |
| LABEL-08 | ENHANCED | 视口不足时支持多列排布和全视口回退布局 | ✅ | ⬜ |
| LABEL-09 | ENHANCED | 语言、窗口、面板尺寸变化后重新测量标签障碍物 | ✅ | ⬜ |
| LABEL-10 | ENHANCED | 标签通过强关联连接线指回真实模块锚点 | ✅ | ⬜ |
| LABEL-11 | ENHANCED | 选中标签连接线更粗，并显示锚点脉冲 | ✅ | ⬜ |
| LABEL-12 | ENHANCED | 模块标签距离支持 0.6×–2.4× 调节 | ✅ | ⬜ |
| LABEL-13 | ENHANCED | 模块标签大小支持 0.6×–1.6× 调节，碰撞算法使用实际缩放尺寸 | ✅ | ⬜ |
| LABEL-14 | ENHANCED | 标签连接线粗细支持 0.5×–6.0× 调节 | ✅ | ⬜ |
| LABEL-15 | ENHANCED | 按摄像机到各自大区表面的距离计算子标签可见度 | ✅ | ⬜ |
| LABEL-16 | ENHANCED | 子标签隐藏距离支持 10–70 调节 | ✅ | ⬜ |
| LABEL-17 | ENHANCED | 子标签渐隐范围支持 2–20 调节 | ✅ | ⬜ |
| LABEL-18 | ENHANCED | 透明度过低的标签先退出碰撞求解 | ✅ | ⬜ |
| LABEL-19 | ENHANCED | 选中模块标签始终显示，不被距离 LOD 隐藏 | ✅ | ⬜ |
| LABEL-20 | ENHANCED | 大区标题承担远景 LOD 主标题职责 | ✅ | ⬜ |
| LABEL-21 | ENHANCED | 远景衰减起点支持 15–100 调节 | ✅ | ⬜ |
| LABEL-22 | ENHANCED | 板块透明度使用所属大区表面距离计算 | ✅ | ⬜ |
| LABEL-23 | ENHANCED | 数据流透明度使用曲线位置/中点距离计算 | ✅ | ⬜ |
| LABEL-24 | ENHANCED | 最远板块不透明度具有 8%–80% 可调下限，不会意外完全消失 | ✅ | ⬜ |
| LABEL-25 | ENHANCED | 最远数据流不透明度支持 0%–100% 调节 | ✅ | ⬜ |
| LABEL-26 | ENHANCED | 摄像机锁定 HUD 显示当前视图、选择对象和主管道状态 | ✅ | ⬜ |
| LABEL-27 | ENHANCED | HUD 前方距离支持 0.6–2.4 调节 | ✅ | ⬜ |
| LABEL-28 | ENHANCED | HUD 信息固定在视口安全区，不随模型漂移遮挡主体 | ✅ | ⬜ |

## 8. 模块聚焦、函数和事务因果图

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| FOCUS-01 | ENHANCED | 聚焦镜头以目标模块/旅程包围盒为中心，不回到全景中心 | ✅ | ⬜ |
| FOCUS-02 | ENHANCED | 根据视口纵横比和目标包围盒计算 100% 适配距离 | ✅ | ⬜ |
| FOCUS-03 | ENHANCED | 聚焦时隐藏无关全景几何，使用独立局部坐标场景 | ✅ | ⬜ |
| FOCUS-04 | ENHANCED | 左上角聚焦详情 HUD，不用大面板遮住 3D 主体 | ✅ | ⬜ |
| FOCUS-05 | ENHANCED | 可退出聚焦并返回全景 | ✅ | ⬜ |
| FOCUS-06 | ENHANCED | 五条事务：KU15P、690T、启动、恢复、Flash 门禁 | ✅ | ⬜ |
| FOCUS-07 | ENHANCED | 四层因果图：Payload、Control、Sync、Lifecycle | ✅ | ⬜ |
| FOCUS-08 | ENHANCED | 四层因果图可独立开关，但至少保留一个层 | ✅ | ⬜ |
| FOCUS-09 | ENHANCED | 事务站按执行上下文、模块角色和语义层布局 | ✅ | ⬜ |
| FOCUS-10 | ENHANCED | 函数、数据、状态、硬件、事件、完成使用不同 3D 几何语义 | ✅ | ⬜ |
| FOCUS-11 | ENHANCED | 事务边支持 PAYLOAD、CALL、QUEUE、STATE、MMIO、IRQ、WAIT、ERROR、LIFECYCLE | ✅ | ⬜ |
| FOCUS-12 | ENHANCED | 不同事务关系具有固定颜色、线型、方向和标签 | ✅ | ⬜ |
| FOCUS-13 | ENHANCED | 选中事务站会同步高亮相关边和详情契约 | ✅ | ⬜ |
| FOCUS-14 | ENHANCED | 流向动画开启时，旅程边上显示沿因果方向移动的 Token | ✅ | ⬜ |
| FOCUS-15 | ENHANCED | 函数六接口：Trigger、Context、Consumes、Produces、State/Resource、Completion/Error | ✅ | ⬜ |
| FOCUS-16 | ENHANCED | 可选 Hardware effect 展示 MMIO、USB/JTAG、设备可见副作用 | ✅ | ⬜ |
| FOCUS-17 | ENHANCED | 每个事务站显示证据等级和可选源码入口 | ✅ | ⬜ |
| FOCUS-18 | ENHANCED | 每条旅程显示摘要和证据边界 caveat | ✅ | ⬜ |
| FOCUS-19 | ENHANCED | 非事务模块仍可显示真实脚本、服务和证据入口 | ✅ | ⬜ |
| FOCUS-20 | ENHANCED | 函数点直接显示真实函数/脚本名称，不使用 F1/F2 编号 | ✅ | ⬜ |
| FOCUS-21 | ENHANCED | 函数互动支持 CALL、DATA、IRQ、CONTROL 语义 | ✅ | ⬜ |
| FOCUS-22 | ENHANCED | 点击函数点或互动线可切换当前函数 | ✅ | ⬜ |
| FOCUS-23 | ENHANCED | 聚焦批注 UI 支持 0.6×–1.6× 缩放 | ✅ | ⬜ |
| FOCUS-24 | ENHANCED | 聚焦详情文字支持 0.8×–1.8× 缩放，详情面板保持独立滚动 | ✅ | ⬜ |
| FOCUS-25 | ENHANCED | 没有脚本入口的物理模块仍可聚焦，并显示明确空状态 | ✅ | ⬜ |

## 9. 选择详情、相邻关系和路径分析

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| DETAIL-01 | ENHANCED | 未选择时显示操作提示 | ✅ | ⬜ |
| DETAIL-02 | ENHANCED | 节点详情显示平面、层级、ID、职责和证据等级 | ✅ | ⬜ |
| DETAIL-03 | ENHANCED | 节点详情显示接口和协议标签 | ✅ | ⬜ |
| DETAIL-04 | ENHANCED | 节点详情显示脚本、服务、源码或证据入口 | ✅ | ⬜ |
| DETAIL-05 | ENHANCED | 节点详情显示运行目录、设备节点、用途和可信度 | ✅ | ⬜ |
| DETAIL-06 | ENHANCED | 节点详情显示运行状态/能力边界说明 | ✅ | ⬜ |
| DETAIL-07 | ENHANCED | 节点详情列出最多 10 个相邻节点并支持跳转 | ✅ | ⬜ |
| DETAIL-08 | ENHANCED | 边详情显示类型、证据、源节点、目标节点、描述和协议 | ✅ | ⬜ |
| DETAIL-09 | ENHANCED | 可把选中节点设为路径起点 | ✅ | ⬜ |
| DETAIL-10 | ENHANCED | 可选择终点并在当前视图/边过滤条件下计算跨层路径 | ✅ | ⬜ |
| DETAIL-11 | ENHANCED | 找到路径时高亮节点和边并显示跳数 | ✅ | ⬜ |
| DETAIL-12 | ENHANCED | 无路径时明确显示“当前过滤下无路径” | ✅ | ⬜ |
| DETAIL-13 | ENHANCED | 可独立清除路径 | ✅ | ⬜ |

## 10. 键盘、全屏、响应式与设置持久化

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| UX-01 | ENHANCED | `R` 恢复标注全景 | ✅ | ⬜ |
| UX-02 | ENHANCED | `L` 切换全局标注 | ✅ | ⬜ |
| UX-03 | ENHANCED | `F` 进入或退出 3D 视口全屏 | ✅ | ⬜ |
| UX-04 | ENHANCED | `Esc` 按优先级关闭设置、退出聚焦或清除选择 | ✅ | ⬜ |
| UX-05 | ENHANCED | 输入框、文本框和可编辑区域不会误触全局快捷键 | ✅ | ⬜ |
| UX-06 | ENHANCED | 使用浏览器 Fullscreen API 并同步真实全屏状态 | ✅ | ⬜ |
| UX-07 | ENHANCED | 浏览器拒绝全屏时不会使页面崩溃 | ✅ | ⬜ |
| UX-08 | ENHANCED | 设置面板可打开、关闭，并提供每项说明和实时数值 | ✅ | ⬜ |
| UX-09 | ENHANCED | 提供一键恢复显示默认值 | ✅ | ⬜ |
| UX-10 | ENHANCED | 13 个显示参数写入 localStorage，刷新后恢复 | ✅ | ⬜ |
| UX-11 | COMMON | 布局适配桌面和移动端 | ✅ | ⬜ |
| UX-12 | COMMON | 主要按钮、开关、导航和面板具有 ARIA 名称/状态 | ✅ | ⬜ |

## 11. 中英文国际化

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| I18N-01 | COMMON | 支持 `zh-CN` 和 `en-US` | ✅ | ⬜ |
| I18N-02 | ENHANCED | 顶栏和设置面板均可切换语言 | ✅ | ⬜ |
| I18N-03 | ENHANCED | 语言选择写入 localStorage | ✅ | ⬜ |
| I18N-04 | ENHANCED | 切换语言保留镜头、选择、聚焦和事务状态 | ✅ | ⬜ |
| I18N-05 | ENHANCED | 切换语言同步更新 `<html lang>`、页面标题和 meta description | ✅ | ⬜ |
| I18N-06 | ENHANCED | 语言切换后触发标签尺寸和碰撞重新计算 | ✅ | ⬜ |
| I18N-07 | ENHANCED | 搜索同时匹配中文和英文表达 | ✅ | ⬜ |
| I18N-08 | GENERIC | SceneDefinition 的标题、描述、Zone、Node、Edge、Journey 均要求中英文 | ✅ | ⬜ |
| I18N-09 | REPO | 中英文 README 保持相同章节、功能和命令信息 | ✅ | ⬜ |

## 12. Schema、YAML 与通用场景能力

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| SCHEMA-01 | GENERIC | `SceneDefinition` 使用版本号 `2.0` | ✅ | ⬜ |
| SCHEMA-02 | GENERIC | 场景覆盖 locales、zones、nodes、edges、journeys、functions、layout | ✅ | ⬜ |
| SCHEMA-03 | GENERIC | Zone 表达部署、所有权、故障或物理边界 | ✅ | ⬜ |
| SCHEMA-04 | GENERIC | Node 支持 actor、application、service、driver、protocol、buffer、device、hardware、data、state | ✅ | ⬜ |
| SCHEMA-05 | GENERIC | Edge 支持 payload、control、sync、lifecycle、physical | ✅ | ⬜ |
| SCHEMA-06 | GENERIC | Evidence 支持 CODE_PROVEN、RTL_PROVEN、RUNTIME_OBSERVED、INFERRED | ✅ | ⬜ |
| SCHEMA-07 | GENERIC | Function 保存所属模块、证据、源码和六接口契约 | ✅ | ⬜ |
| SCHEMA-08 | GENERIC | Journey Step 可引用节点或函数 | ✅ | ⬜ |
| SCHEMA-09 | GENERIC | Journey 保存步骤、参与边、摘要和可选 caveat | ✅ | ⬜ |
| SCHEMA-10 | GENERIC | Layout 保存 Zone/Node 位置、尺寸、镜头和可选显示参数 | ✅ | ⬜ |
| SCHEMA-11 | GENERIC | Vite 在构建时发现 `examples/*/topology.yaml` | ✅ | ⬜ |
| SCHEMA-12 | GENERIC | YAML 解析失败时返回带来源的 SceneValidationError | ✅ | ⬜ |
| SCHEMA-13 | GENERIC | AJV 2020 严格校验字段、类型、枚举和附加属性 | ✅ | ⬜ |
| SCHEMA-14 | GENERIC | 校验重复场景 ID | ✅ | ⬜ |
| SCHEMA-15 | GENERIC | 校验 Zone、Node、Edge、Function 和 Journey 的悬空引用 | ✅ | ⬜ |
| SCHEMA-16 | GENERIC | 校验 Node 与 Zone 所有权冲突 | ✅ | ⬜ |
| SCHEMA-17 | GENERIC | 校验每个 Node 和 Zone 均有布局 | ✅ | ⬜ |
| SCHEMA-18 | GENERIC | 标准化后建立 node/zone/edge/function/layout 快速索引 Map | ✅ | ⬜ |

## 13. 通用 3D 页面当前能力

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| GEN-01 | GENERIC | 渲染 Zone 半透明空间外壳和三段式 Zone 标题 | ✅ | ⬜ |
| GEN-02 | GENERIC | 根据 SceneDefinition 渲染 Node 3D 方块 | ✅ | ⬜ |
| GEN-03 | GENERIC | 根据 Layout 渲染 Node 尺寸和绝对位置 | ✅ | ⬜ |
| GEN-04 | GENERIC | 根据 Node 或 Zone 颜色渲染模块 | ✅ | ⬜ |
| GEN-05 | GENERIC | 渲染带 kind 和 evidence 的节点标签 | ✅ | ⬜ |
| GEN-06 | GENERIC | 节点可通过 3D 方块、标签和左侧索引选择 | ✅ | ⬜ |
| GEN-07 | GENERIC | 选中节点不透明、发光并缓慢缩放脉冲 | ✅ | ⬜ |
| GEN-08 | GENERIC | 渲染 Edge 折线、颜色、虚线和透明度 | ✅ | ⬜ |
| GEN-09 | GENERIC | 选择 Journey 后粗线高亮该旅程的 Edge | ✅ | ⬜ |
| GEN-10 | GENERIC | Journey 中的 Node 或 Function 会激活所属模块 | ✅ | ⬜ |
| GEN-11 | GENERIC | 左侧按 Zone 展示场景索引 | ✅ | ⬜ |
| GEN-12 | GENERIC | 右侧显示选中节点类型、证据、标题、描述和接口 | ✅ | ⬜ |
| GEN-13 | GENERIC | 右侧列出选中模块的全部函数契约 | ✅ | ⬜ |
| GEN-14 | GENERIC | Journey 标签可切换，右侧显示当前摘要和 caveat | ✅ | ⬜ |
| GEN-15 | GENERIC | 使用 Scene Layout 中的 camera position、target 和 fov | ✅ | ⬜ |
| GEN-16 | GENERIC | OrbitControls 带阻尼旋转、平移和缩放 | ✅ | ⬜ |
| GEN-17 | GENERIC | 场景级中英文切换 | ✅ | ⬜ |

注意：`GENERIC` 当前没有完整复用增强页的标签碰撞、距离 LOD、路径搜索、全屏索引、函数级独立 3D 站点和全部显示滑块。不得把 `ENHANCED` 功能误写为所有 YAML 场景已经具备的功能。

## 14. 证据、安全和公开边界

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| SAFE-01 | COMMON | 明确区分源码事实、RTL 事实、运行观测和推断 | ✅ | ⬜ |
| SAFE-02 | COMMON | 推断不自动升级为运行事实 | ✅ | ⬜ |
| SAFE-03 | ENHANCED | 690T/ProCISE 远程路径明确标为未证明 | ✅ | ⬜ |
| SAFE-04 | ENHANCED | KU15P 已验证结果不外推为 690T 事实 | ✅ | ⬜ |
| SAFE-05 | ENHANCED | XVC 明文、无认证、无加密的可信网络边界明确展示 | ✅ | ⬜ |
| SAFE-06 | COMMON | 公开内容不包含凭据、生产 IP、客户名、真实序列号和私有日志 | ✅ | ⬜ |
| SAFE-07 | COMMON | 公开内容不包含 BIT/MCS、Flash 镜像或生产部署脚本 | ✅ | ⬜ |
| SAFE-08 | COMMON | 使用 `EXAMPLE_IP`、`PROBE_A` 等显式占位符 | ✅ | ⬜ |
| SAFE-09 | COMMON | 真实硬件操作前要求重新发现 IP、USB、线缆、器件链和 Flash 身份 | ✅ | ⬜ |
| SAFE-10 | GENERIC | 每个场景包包含 source-inventory 和 acceptance-checklist | ✅ | ⬜ |
| SAFE-11 | GENERIC | `INFERRED` 内容在 Journey caveat 或资料清单中说明未闭环边界 | ✅ | ⬜ |
| SAFE-12 | COMMON | 项目只做知识可视化，不在浏览器中连接或控制真实设备 | ✅ | ⬜ |

## 15. 构建、静态发布和仓库治理

| ID | 范围 | 功能 | 基线 | 变更后复核 |
|---|---|---|:---:|:---:|
| REPO-01 | REPO | Node.js 22.13+、pnpm 锁定依赖 | ✅ | ⬜ |
| REPO-02 | REPO | `pnpm dev` 启动本地开发服务器 | ✅ | ⬜ |
| REPO-03 | REPO | `pnpm lint` 执行 TypeScript 静态检查 | ✅ | ⬜ |
| REPO-04 | REPO | `pnpm validate:scenes` 校验全部场景 | ✅ | ⬜ |
| REPO-05 | REPO | `pnpm build` 输出纯静态 `dist/` | ✅ | ⬜ |
| REPO-06 | REPO | `pnpm test` 串联场景校验、构建和契约测试 | ✅ | ⬜ |
| REPO-07 | REPO | `pnpm preview` 本地预览构建产物 | ✅ | ⬜ |
| REPO-08 | REPO | 静态资源使用相对路径，支持 GitHub 项目 Pages 子路径 | ✅ | ⬜ |
| REPO-09 | REPO | 运行时不依赖 Node 服务、数据库、设备代理或凭据 | ✅ | ⬜ |
| REPO-10 | REPO | CI 在 push/PR 上安装依赖、检查类型并运行测试 | ✅ | ⬜ |
| REPO-11 | REPO | GitHub Pages 工作流在 main 构建并部署 `dist/` | ✅ | ⬜ |
| REPO-12 | REPO | 静态构建测试检查 HTML、JS、CSS 和敏感地址 | ✅ | ⬜ |
| REPO-13 | REPO | 契约测试保护五条 Journey、证据、LOD、碰撞、聚焦、全屏和语言控制 | ✅ | ⬜ |
| REPO-14 | REPO | 契约测试保护 Schema 通用导入边界和 README 中英文一致性 | ✅ | ⬜ |
| REPO-15 | REPO | Apache-2.0 源码许可证、CC BY 4.0 原创文档/模型声明 | ✅ | ⬜ |
| REPO-16 | REPO | 第三方依赖许可说明 | ✅ | ⬜ |
| REPO-17 | REPO | CODEOWNERS、Dependabot、Issue 模板、PR 模板、SECURITY、GOVERNANCE、行为准则齐全 | ✅ | ⬜ |
| REPO-18 | REPO | 贡献要求遵守 DCO 并使用 `git commit -s` | ✅ | ⬜ |

## 16. AI 交付时必须报告

任何 AI 完成知识适配或框架修改后，最终报告必须包含：

```text
变更模式：Scene-only / Generic framework / Enhanced reference / Build & deployment
适用检查范围：COMMON / ENHANCED / GENERIC / REPO
新增或修改的功能 ID：
重新复核通过的功能 ID：
未复核的功能 ID及原因：
有意删除或降级的功能 ID：
新增场景的 Zone / Node / Edge / Function / Journey 数量：
证据等级分布：
仍为 INFERRED 的边界：
执行的命令与结果：
未执行的检查及原因：
是否修改 src/：
```

验收原则：只要适用范围内存在未说明的功能缺失，就不能称为“完整适配成功”。
