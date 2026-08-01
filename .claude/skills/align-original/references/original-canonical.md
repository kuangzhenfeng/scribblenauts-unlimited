# 原版核心设计（Canonical）

> 来源：原版 wiki / 官方资料 / walkthrough 整理。作为对齐基准，**非实现清单**。对齐时校验的是"原版设计意图是否被复现"，量化指标是参考而非硬性目标。

## 第一性原理

原版核心竞争力 = **"任意词都能召唤"的创造性解谜自由度** × **开放世界善意循环叙事**。

脱离这两点堆砌功能（如硬凑词条数）不构成对齐。每个复刻决策回扣到：它是否让玩家更自由地创造性地解谜？是否强化"帮助他人 → 获得感激 → Starite → 解救 Lily"的善意循环？

## 五维核心设计

### 维度一：词汇与召唤
- Objectnaut 引擎，10000+ 词条；Maxwell 魔法笔记本输入任意词 → 对应实体出现
- 形容词系统（承自 Super Scribblenauts），可**无限叠加**修改物体属性（giant happy purple flying...）
- 无预算限制，允许大量同屏物体
- 男女版 NPC 与动物；时间机器、街机等交互设施

### 维度二：规则涌现
- 物体间基于**属性标签**的深度交互，反应链可级联
- 典型交互链：火点燃可燃物（连锁燃烧）、水灭火、锋利切绳、电传导、冷源冻水成冰、武器伤害生物、爆炸与爆炸链、中毒与解毒、容器收纳、骑乘、攀爬、食用转化、魔法效果（药水施加任意形容词）
- 玩家通过组合物体与形容词**涌现式**解决问题，而非固定解法

### 维度三：开放世界
- 大开放 overworld 取代菜单选关；区域间经地图无缝衔接
- 数十个主题区域（约 39），**标点/文字主题命名**：Edwin's Farm、Capital City、The Under Line、Hyphen Heights、Full Stop Diner、Metaforest、Grave Manor、The Virgule Gallery、Sir Guillemet's Castle、Ruins of Ellipsis、Anaphora Falls、The Saurus Park、Bullet Point Bayou、The Listy Colon、Payper N. Penitentiary、Abian Sea Front、Pilcrow Peaks、Dusty Brush Canyon、Tomb of Onomatopoeia、Storybook Keep、Alliteration Abyss、Vowelcano、Palindromeda、Syntax Station、Kana Craters...
- 两形态关卡：**自包含多谜题关**（多个 puzzle 凑 1 Starite，类早期作品）+ **overworld 区域小任务**（→ Shard）
- 每关 3 首轮换曲目

### 维度四：善意循环叙事
- Maxwell 恶作剧给饥饿老乞丐**烂苹果** → 老人咒 **Lily 慢慢石化**
- 收集 **Starite**（诞生于他人幸福，靠帮助他人获得感激）→ 解除诅咒
- 老人即父亲 **Edgar 乔装**，全程是考验 Maxwell 向善
- **42 个兄弟姐妹**（Edwin 等），每完成一关解锁一个 **avatar**（变装系统）
- Edwin 农场教学起步；Lily 持魔法地球仪（旅行）

### 维度五：创作所有权
- **Object Editor**：组装多物体（如"带轮子的狗"）、分配属性（行为/移动/攻击）、缩放染色、命名保存再召唤
- 大量自定义物体槽位
- Avatar 变装（Maxwell in Disguise）

> Steam Workshop 在线分享/下载属 PC 版的社交延伸能力，但本项目不对标（见"不复刻范围"），创作所有权聚焦本地组装/保存/再召唤。

## Starite 与 Shard 体系
- **Starite**：主要收集物，完成帮助任务获得，累积解 Lily 诅咒；约 106 Starite 任务
- **Starite Shard**：overworld 小任务奖励；**10 shard = 1 Starite**
- **Object Shard**：跨关非排他任务，**7 大类约 217 个**：Living / Food / Vehicle / Music / Weapon / Clothes / Misc
- **Starite Vision**：蓝色滤镜高亮未完成 NPC 与任务

## 量化指标（对标参考，非硬性）
| 指标 | 原版 | 对齐判据 |
|---|---|---|
| 词条 | 10000+ | 常用召唤场景覆盖度 |
| 形容词 | 数百，无限叠加 | 可组合修改属性 |
| 同屏物体 | 无预算限制 | 不卡顿即可 |
| overworld 区域 | 约 39 | 区域覆盖与衔接连贯 |
| Starite 任务 | 约 106 | Starite 驱动力清晰 |
| Object Shards | 217（7 类） | 七大类任务体系存在 |
| 兄弟姐妹 + avatar | 42 | 叙事链与解锁机制 |
| 自定义物体槽位 | 大量 | 可组装/保存/再召唤 |
| 音轨 | 90 | 主题音乐覆盖 |

## 版本定位
**仅对标 PC 完整版**（含 Object Editor）。不考虑 Wii U / 3DS / iOS / Nintendo 版本差异——不把"某版本没有某能力"作为复刻内容，只对齐 PC 完整版能力集。Nintendo 联名角色（马里奥/塞尔达）因版权不纳入复刻范围。

## 不复刻范围
| 项目 | 原因 |
|---|---|
| Nintendo 联名角色（马里奥/塞尔达等） | 版权 |
| Wii U / 3DS / iOS 版本独有差异 | 只对标 PC 完整版 |
| Steam Workshop 在线分享/下载 | 聚焦本地创作，对标线上社区非核心 |
| 本地多人联机 | 非核心 |
