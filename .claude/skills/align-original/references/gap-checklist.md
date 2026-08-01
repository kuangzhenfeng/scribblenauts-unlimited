# 差距清单

> 原版基准 ↔ 项目现状的缺口。**每项含：差距 → 影响的复刻核心 → 消除策略 → 落点**，作为 align-original skill 的产出模板。
> 优先级按"对核心自由度/叙事链的冲击"加权排序，非词条数等绝对量。

## 差距矩阵

| # | 维度 | 差距 | 复刻核心影响 | 消除策略 | 落点 |
|---|---|---|---|---|---|
| G1 | 叙事 | 老乞丐=Edgar 乔装反转缺失 | 善意循环叙事完整性 | 开场烂苹果恶作剧 + 老人诅咒 Lily + 结尾揭示父亲 | `TitleScene`、`DialogSystem`、新增剧情脚本 |
| G2 | 叙事 | 42 兄弟姐妹 avatar 解锁链缺失（仅 Edwin+Lily） | 叙事驱动力与解锁奖励 | 每关末解锁一兄弟 avatar，累积触发 Lily 解咒里程碑 | `LevelManager`、`SaveStore`、`PlayerController`（avatar 变装） |
| G3 | 词库 | 词条 660 vs 10000+，常用词覆盖不足 | "任意词都能召唤"自由度 | gen-content 持续扩充高频常用词；alias 覆盖；非硬性追 10000 | `entries/*.ts`、`gen-content` skill |
| G4 | 规则 | 规则 13 条 vs 数十种，缺爆炸链/容器收纳/攀爬/食用转化/药水任意形容词 | 涌现式解谜深度 | 按规则引擎现有 effect 扩展，每条规则配测试 | `rules.ts`、`effects.ts`、`tests/` |
| G5 | 形容词 | 形容词 123 vs 数百，叠加深度受限 | 创造性修改属性 | 扩充 behavior/state/material 类形容词，校验可叠加组合 | `adjectives/*.ts` |
| G6 | 关卡 | 5 关 vs 约 39 区域，无传送门衔接 | 开放世界探索感 | 按 gen-content level 模式增关 + 区域传送门 transitions | `levels/*.json`、`LevelManager.ts`、`WorldScene.ts` |
| G7 | Object Shard | 七大类跨关 Shard 任务体系缺失 | 替代性收集动力与创造激励 | 新增 7 类 Object Shard 任务表 + 跨关计数 + 10 换 1 Starite | `bank.ts` 或新 `object-shards.ts`、`GoalSystem.ts` |
| G8 | Object Editor | 仅基础组装，缺多物体拼合/行为分配/缩放/纹理 | 创作所有权深度 | 扩展 ObjectEditor 支持多实体 Composite 拼合 + 行为属性 | `ObjectEditor.ts`、`ObjectEditorUi.ts` |
| G9 | 题库 | 闭集题库替代开放解谜 | 开放解谜自由度 | 情境题保留开放性（多答案任一过关），弱化固定单答案 | `bank.ts` |

> Steam Workshop 在线分享不纳入对标（见 original-canonical.md 不复刻范围），创作所有权聚焦本地组装/保存/再召唤，对应 G8。

## 优先级判定原则

1. **叙事链断裂（G1/G2）** — 直接破坏原版善意循环核心，最高优先。
2. **核心自由度（G3/G4/G5）** — "任意词召唤 + 涌现交互"是原版命门，持续投入。
3. **开放世界（G6/G7）** — 探索感与收集动力，影响体验完整度。
4. **创作深度（G8）** — Object Editor 是 Unlimited 版本标志，影响创作自由。
5. **解谜开放性（G9）** — 闭集题库是对齐开放解谜的折中，情境多答案已部分缓解。

## 非差距（已对齐，勿重复造轮子）

- ✅ 笔记本召唤 + 形容词叠加（核心循环已实现）
- ✅ Starite(10 shard=1) + 门槛解锁 + Lily 解咒胜利
- ✅ Object Editor 基础（custom: 前缀、保存、再召唤）
- ✅ 装备/骑乘三槽、8 状态移动、规则引擎三重限流
- ✅ sprite atlas 路线、双板背景、涂鸦纸片视觉、合成音乐音效、多设备适配
- ✅ 基础入门卡 + Starite Vision + Merit Board + 世界地图
