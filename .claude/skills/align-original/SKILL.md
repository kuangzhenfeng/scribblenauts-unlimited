---
name: align-original
description: 专门用于探索并彻底复刻《涂鸦冒险家 无限》PC 完整版、全面对齐当前项目能力时使用。对照原版核心设计基准核查项目现状，识别差距并产出可执行的消除策略，不替代诊断、内容生成或 harness 编排等更窄的技能。
---

# 对齐原版（Align Original）

## 概述

以**原版 PC 完整版核心设计**为基准，持续审视当前项目"是否复现了原版真正的核心"。这不是堆砌功能清单，而是回到第一性原理——原版靠什么打动玩家——并据此判断每个缺口是否值得填补。

核心原则：**对齐的是原版设计意图，不是量化指标的机械追赶**。词条数从 660 涨到 1000 但仍解决不了"玩家想召唤某个常用词却召唤不出"的痛点，不构成对齐。

## 版本定位

**仅对标 PC 完整版**（含 Object Editor）。不考虑 Wii U / 3DS / iOS / Nintendo 版本差异，不把"某版本没有某能力"作为复刻内容。Nintendo 联名角色因版权不纳入。Steam Workshop 等在线分享/社区能力不对标（聚焦本地创作所有权）。详见 [references/original-canonical.md](references/original-canonical.md) 的"不复刻范围"。

## 适用判断

| 场景 | 是否用本技能 |
|---|---|
| 要评估项目整体对齐原版的进度与缺口 | ✅ |
| 要决定下一个迭代该补哪块能力以更贴近原版 | ✅ |
| 要核对某功能是否偏离原版核心设计 | ✅ |
| 明确规格的单一功能开发 | ❌ 直接实现（或用 `gen-content`） |
| 跨边界高不确定性开发 | ❌ 用 `harness` 编排 |
| 生成词汇/题库/sprite/关卡内容 | ❌ 用 `gen-content` |
| 纯诊断 bug | ❌ 用 `diagnosing-bugs` |

## 原版核心设计（第一性原理）

**核心竞争力 = "任意词都能召唤"的创造性解谜自由度 × 开放世界善意循环叙事。** 脱离这两点堆砌功能不构成对齐。完整基准见 [references/original-canonical.md](references/original-canonical.md)，五维概述：

1. **词汇与召唤** — 10000+ 词条 + 无限叠加形容词；输入任意词即生成实体
2. **规则涌现** — 属性标签驱动的深度交互，反应链级联（火连锁、电传导、锋利切割、中毒解毒、爆炸链...）
3. **开放世界** — 大 overworld 取代菜单选关，约 39 个标点/文字主题区域无缝衔接，自包含关 + overworld 小任务两形态
4. **善意循环叙事** — Maxwell 烂苹果恶作剧 → Lily 石化诅咒 → 帮助他人得 Starite → 解咒 → 老人即父亲 Edgar 乔装考验；42 兄弟姐妹 avatar 解锁链
5. **创作所有权** — Object Editor 多物体拼合 + 行为分配 + 缩放染色 + 保存再召唤 + Avatar 变装（本地）

## 执行流程

### 1. 加载基准与现状

读取三个 reference，建立对齐基线：

| reference | 作用 |
|---|---|
| [original-canonical.md](references/original-canonical.md) | 原版 PC 完整版核心设计基准（事实来源） |
| [capability-inventory.md](references/capability-inventory.md) | 项目当前已实现能力快照 |
| [gap-checklist.md](references/gap-checklist.md) | 已识别差距与消除策略 |

> 三个 reference 是"活文档"：原版设计稳定不常变，能力清单与差距清单随实现演进。本 skill 使用前**必须先读代码核实现状**，不得直接信任清单快照。

### 2. 核实现状（防快照过期）

差距清单和能力清单可能滞后于代码。对每个待评估维度，先读对应源码确认实际状态：

| 维度 | 核查文件 |
|---|---|
| 词条/形容词规模 | `src/core/data/dictionary/entries/*.ts`、`adjectives/*.ts` |
| 规则与 effect | `src/core/rules/effects.ts`、`RuleEngine.ts`、`data/dictionary/rules/rules.ts` |
| 挑战系统 | `src/core/game/GoalSystem.ts` |
| 题库 | `src/core/data/questions/bank.ts`、`QuestionPicker.ts` |
| 自定义物体 | `src/game/ObjectEditor.ts`、`src/ui/ObjectEditorUi.ts` |
| 关卡 | `src/core/data/levels/*.json`、`src/game/LevelManager.ts` |
| 装备/骑乘/移动 | `src/game/PlayerController.ts`、`BehaviorSystem.ts`、`core/entity/Entity.ts` |
| 叙事 | `src/engine/scenes/TitleScene.ts`、`src/game/DialogSystem.ts`、`SaveStore` |

发现清单与代码不一致时，**先更新清单再继续**，避免下游基于过期事实决策。

### 3. 识别差距

对照基准判差距。对每个候选差距，问三个过滤问题：

| 过滤问题 | 不通过则 |
|---|---|
| 它冲击原版五维核心中的哪一维？ | 不冲击 → 非差距，归"已对齐"或 YAGNI |
| 原版有、项目无/弱？ | 原版也无 → 非差距 |
| 消除它能提升玩家"创造性解谜自由度"或"善意循环叙事"吗？ | 不能 → 降优先级 |

差距需记录：**差距 → 影响的复刻核心 → 消除策略 → 落点**。量化指标（词条数等）作参考，不硬性追赶。

### 4. 优先级排序

按对核心的冲击加权，非绝对量：

1. **叙事链断裂**（如诅咒起源、Edgar 反转、42 兄弟解锁链缺失）— 直接破坏善意循环核心，最高
2. **核心自由度**（词条覆盖、规则涌现、形容词叠加）— "任意词召唤+涌现交互"是命门，持续投入
3. **开放世界**（区域数、传送门衔接、Object Shard 体系）— 探索感与收集动力
4. **创作深度**（Object Editor 多物体拼合、行为分配）— Unlimited 版本标志
5. **解谜开放性**（闭集题库对开放解谜的折中）— 情境多答案已部分缓解

### 5. 产出消除策略

对每个要消除的差距，产出可执行的下一步：

- **能用既有 skill 的，委托出去**：词条/题库/sprite/关卡缺口 → `gen-content`；高不确定性跨模块实现 → `harness`。
- **本 skill 只产出"差距 + 策略 + 落点"，不直接写实现代码**。实现是 `gen-content` 或 `harness` 的事。
- 策略须说明：消除后玩家可观察到什么结果（非实现清单）、必须保持的不变量、非目标。

### 6. 更新清单与报告

- 消除策略确定后，回写 `gap-checklist.md` 的对应行（策略/落点）。
- 能力变更落地后，更新 `capability-inventory.md` 对应维度的判定与文件行号。
- 最终报告自包含：当前对齐进度（按维度）→ 重大缺口 → 推荐的下一切片 → 委托去向。

## 判断规则

### 量化指标 vs 设计意图

| 情况 | 处理 |
|---|---|
| 词条 660 但覆盖了 90% 常用召唤场景 | 指标落后但设计意图达成 → 不强制扩词库 |
| 词条 660 且玩家常遇"召唤不出" | 设计意图受损 → 扩充高频词，用 `gen-content` |
| 规则 13 条但覆盖核心交互链 | 指标落后但涌现深度够 → 按需扩 |
| 规则缺爆炸链/容器收纳等常用交互 | 涌现自由度受损 → 补规则 |

> 判据永远是"玩家能否创造性解谜"，不是数字。

### 不复刻范围

| 项目 | 原因 |
|---|---|
| Nintendo 联名角色（马里奥/塞尔达） | 版权 |
| Wii U / 3DS / iOS 版本独有差异 | 只对标 PC 完整版 |
| Steam Workshop 在线分享/下载 | 聚焦本地创作，对标线上社区非核心 |
| 本地多人联机 | 非核心 |

### 何为"已对齐"（勿重复造轮子）

以下已对齐原版核心，再次评估时**不重复认定为差距**：

- ✅ 笔记本召唤 + 形容词叠加核心循环
- ✅ Starite(10 shard=1) + 门槛解锁 + Lily 解咒胜利卡
- ✅ Object Editor 基础（custom: 前缀、保存、再召唤）
- ✅ 装备/骑乘三槽、8 状态移动、规则引擎三重限流
- ✅ sprite atlas 路线、双板背景、涂鸦纸片视觉、合成音乐音效、多设备适配
- ✅ 基础入门卡 + Starite Vision + Merit Board + 世界地图

## 常见误区

| 误区 | 正确做法 |
|---|---|
| 把"词条数追到 10000"当对齐目标 | 先核查常用召唤覆盖度，覆盖够则不强扩 |
| 信任清单快照而不读代码核实现状 | 清单可能滞后，使用前必读源码 |
| 把每个量化差距都标为高优先 | 按对核心冲击加权，非绝对量 |
| 本 skill 直接写实现代码 | 只产出差距+策略+落点，实现委托 gen-content/harness |
| 把闭集题库当成对齐失败 | 情境多答案题已保留开放性，是合理折中 |
| 把 Steam Workshop 缺失当差距 | 不在对标范围，聚焦本地创作所有权 |
| 重新认定为差距已对齐项（造轮子） | 已对齐清单见上，聚焦真正缺口 |

## 与其他技能的关系

```
align-original（基准对齐 + 差距识别）
  ├── gen-content（内容缺口：词条/题库/sprite/关卡）
  ├── harness（高不确定性跨模块实现：叙事链、Object Editor 扩展）
  └── 项目仓库指令（CLAUDE.md/CONTEXT.md）— 领域用语与素材规范
```

- 本 skill 是**编排入口**：识别"该补什么"，委托"怎么补"。
- `harness` 用于**实现路径本身高不确定性**的差距（如叙事链改造跨多模块）；`gen-content` 用于**规格明确**的内容扩充。
- 任何实现仍受仓库指令约束（领域用语以 `CONTEXT.md` 为准、sprite 规范、日志规范等）。
