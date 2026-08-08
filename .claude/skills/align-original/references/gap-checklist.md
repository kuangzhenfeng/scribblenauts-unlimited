# 差距清单

> 原版基准 ↔ 项目现状的缺口。**每项含：差距 → 影响的复刻核心 → 消除策略 → 落点**，作为 align-original skill 的产出模板。
> 优先级按"对核心自由度/叙事链的冲击"加权排序，非词条数等绝对量。

## 差距矩阵

| # | 维度 | 差距 | 复刻核心影响 | 消除策略 | 落点 |
|---|---|---|---|---|---|
| G1 | 叙事 | 🟡 已拆分 3 Starite 世界地图里程碑、60 Starite Lily 解咒里程碑和 106 Starite 全收集状态；106 全收集专属里程碑卡已接入，但独立的家庭档案/结局镜头仍缺 | 善意循环叙事完整性 | 保持 `StoryProgress` 与现有 Starite/Shard 发奖、胜利回调解耦；下一步补 106 全收集的独立家庭档案镜头，不改变 60 阈值的 Lily 主线语义 | `StoryProgress.ts`、`ProgressPanel.ts`、`VictoryOverlay.ts`、`WorldScene.ts`、`GoalSystem.ts` |
| G2 | 叙事 | 🟡 已接入 42 个孩子 + 父母的稳定头像目录、40 个完成挑战槽解锁链、60 Lily 与 106/217 全收集父母里程碑及本地选择存档；首关已补固定位置 Edwin 教学角色、Edwin 与一个兄弟 NPC 的家庭头像绑定及“食物→水→清除木箱”三阶段善意任务，其余兄弟 NPC 身份、原版独立头像美术仍缺 | 叙事驱动力与解锁奖励 | 保持资格计算与 UI/渲染分离；继续把新增区域 NPC 映射到家庭成员身份；不要把“每关一个 avatar”当作原版硬规则 | `src/core/data/levels/overworld-meadow.json`、`src/game/LevelRandomizer.ts`、`src/core/data/family/avatars.ts`、`SaveStore.ts`、`FamilyBoard.ts`、`WorldScene.ts` |
| G3 | 词库 | 词条 660 vs 10000+，常用词覆盖不足 | "任意词都能召唤"自由度 | gen-content 持续扩充高频常用词；alias 覆盖；非硬性追 10000 | `entries/*.ts`、`gen-content` skill |
| G4 | 规则 | 规则 16 条 vs 数十种；爆炸链与容器收纳已补齐，仍缺攀爬/食用转化/药水任意形容词 | 涌现式解谜深度 | 保持爆炸 effect 的范围与次级引爆限流、容器实体隐藏与取出闭环；下一步按既有 effect 契约补攀爬与食用转化，每条规则配测试 | `rules.ts`、`effects.ts`、`tests/` |
| G5 | 形容词 | 形容词 123 vs 数百，叠加深度受限 | 创造性修改属性 | 扩充 behavior/state/material 类形容词，校验可叠加组合 | `adjectives/*.ts` |
| G6 | 关卡 | 已扩展到 41 个主区域、81 个显式 transitions、175 个 authored 挑战；已有 3 个 overworld，41 个区域各有独立远/近景背景与独立音乐，回文星窟与句法站各有固定地标、双出口和独立谜题指纹 | 开放世界探索感与顺序解锁 | 传送入口读取 `unlockedLevels`、开放区域回返入口、跨关挑战/背景/音乐唯一性校验已完成；下一步继续把少量高价值自包含区域改造成有明确探索回路的 overworld 小任务区，不以堆数量代替内容 | `src/core/data/levels/*.json`、`public/assets/backgrounds/`、`src/core/data/levels/stage-palindromeda.json`、`src/core/data/levels/stage-syntax-station.json`、`src/game/LevelRandomizer.ts`、`LevelManager.ts`、`LevelSelectScene.ts`、`WorldScene.ts`、`tests/level-content.test.ts`、`tests/music.test.ts` |
| G7 | Object Shard | ✅ 已消除：八大类跨关 Shard 任务体系已落地 | 替代性收集动力与创造激励 | 八类任务目录 + 跨关首次召唤计数 + 10 换 1 Starite + 来源分离存档 | `src/core/data/starite/object-shards.ts`、`GoalSystem.ts`、`SaveStore.ts`、`ObjectShardBoard.ts` |
| G8 | Starite Vision | ✅ 已消除：蓝色滤镜、未完成 NPC/挑战目标与实时屏幕标记已接入 | 开放世界任务可发现性 | 以 GoalSystem/LevelManager 为数据源，按相机每帧投影并在完成/切关时刷新 | `StariteVision.ts`、`WorldScene.ts` |
| G9 | Object Editor | 已形成多部件词条+锚点输入、存档复制、再召唤与 `Composite` 刚性连接；仍缺行为/移动/攻击分配、缩放/纹理工具、Maxwell in Disguise 的可玩闭环 | 创作所有权深度 | 继续沿 `CustomObjectDef` 扩展行为与外观配置，复用现有实体 locomotion/攻击系统，补编辑器预览和 avatar 变装，并保持旧自定义物体可生成 | `ObjectEditor.ts`、`ObjectEditorUi.ts`、`Spawner.ts`、`Composite.ts`、`types/save.ts` |
| G10 | 题库 | 闭集题库替代开放解谜 | 开放解谜自由度 | 情境题保留开放性（多答案任一过关），弱化固定单答案 | `bank.ts` |
| G11 | 血量 | 原有伤害/死亡链存在，但生成器按类别粗略赋值，未体现原版对象的独立生命值差异，且此前把玩家血量错误做成常驻 HUD 栏 | 规则涌现中的受伤、治疗、死亡与 Maxwell 继续探索的可观察闭环 | ✅ 已消除：DictEntry 支持 `health`，Spawner 读取词条值并按类别兜底；伤害/治疗统一复用实体生命字段；受伤对象上方显示四段局部生命圆点，满血不显示，Maxwell 死亡后按原有重生路径恢复 | `src/core/types/dictionary.ts`、`src/game/Spawner.ts`、`src/core/rules/effects.ts`、`src/game/PlayerController.ts`、`src/ui/EntityHealthDisplay.ts`、`src/ui/Hud.ts`、`src/engine/scenes/WorldScene.ts` |

> Steam Workshop 在线分享不纳入对标（见 original-canonical.md 不复刻范围），创作所有权聚焦本地组装/保存/再召唤，对应 G9。

## 优先级判定原则

1. **叙事链断裂（G1/G2）** — 直接破坏原版善意循环核心，最高优先。
2. **核心自由度（G3/G4/G5）** — "任意词召唤 + 涌现交互"是原版命门；同屏 60 对象容量已与原版规模对齐，不再作为差距。
3. **开放世界（G6/G7）** — 探索感与收集动力，影响体验完整度。
4. **创作深度（G9）** — Object Editor 是 Unlimited 版本标志，影响创作自由。
5. **解谜开放性（G10）** — 闭集题库是对齐开放解谜的折中，情境多答案已部分缓解。

## 非差距（已对齐，勿重复造轮子）

- ✅ 笔记本召唤 + 形容词叠加（核心循环已实现）
- 🟡 Starite(10 shard=1) + 基础门槛解锁 + Lily 开场状态/进度/当前胜利卡已存在；原版 60 Starite 故事里程碑、106 全收集与家庭 avatar 解锁链见 G1/G2
- ✅ Object Editor 基础（custom: 前缀、保存、再召唤）
- ✅ 玩家召唤 60 个非 critical 实体的容量级别与原版 PC/主机约 60 对象显示规模对齐
- ✅ 装备/骑乘三类主动关系 + 八穿戴部位、8 状态移动、规则引擎三重限流
- ✅ sprite atlas 路线、双板背景、涂鸦纸片视觉、合成音乐音效、多设备适配
- ✅ 基础入门卡 + Starite Vision + Merit Board + 世界地图
- ✅ PC 键鼠操作语义与原版主键位对齐；相机小键盘/滚轮、选中物体 Q/E 旋转已补齐
- ✅ 世界交互 UI 节奏：挑战文本改为底部双层金色任务条，Starite Vision 默认收起为右上角工具栏入口，选关路线统一暖金纸片视觉
- ✅ Starite Vision 蓝色滤镜、任务/目标高亮、实时投影与切关刷新
