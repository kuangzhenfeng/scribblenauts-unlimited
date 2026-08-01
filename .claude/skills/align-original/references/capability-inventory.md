# 能力清单

> 列举项目**当前**已实现能力，供差距分析对齐基准。**本文件是事实快照，随实现演进而更新**。每条附关键文件:行号。判据：是否可被玩家端到端体验。

> 维护规则：标注判定 — ✅ 已实现 / 🟡 部分 / ❌ 缺失。量化值以最新代码为准。每次能力变更后同步本文件。

## 一、词条与形容词

- ✅ 词条 660（animals 229 / elements 49 / misc 239 / objects 143）— `src/core/data/dictionary/entries/*.ts`
- ✅ 形容词 123（color 42 / size 15 / behavior 18 / state 25 / material 23）— `src/core/data/dictionary/adjectives/*.ts`
- ✅ 双语闭集分词（中/英输入解析，含别名命中）— `src/core/lex/`
- 🟡 词库规模 vs 原版 10000+（差距显著，靠 alias 扩充与 gen-content 持续扩充）

## 二、规则交互

- ✅ Effect 11 种（apply-state/remove-state/set-temperature/spawn/destroy/damage/heal/transform/add-flag/remove-flag/apply-impulse）— `src/core/rules/effects.ts:150-211`
- ✅ 规则 13 条（火×可燃、电×导体、电×肉体、锋利×可切、水×燃烧、冷×水、可食×饥饿、武器×生物、燃烧 tick、投射物×生物、投射物×可破坏、毒×生物、药水×解毒、热×冻结）— `src/core/data/dictionary/rules/rules.ts`
- ✅ RuleEngine：碰撞/接触/tick 三触发 + 反应链(深≤4) + 三重限流（非重入队列+冷却+链深/帧上限）— `src/core/rules/RuleEngine.ts`、`TagSet.ts`
- ✅ TagSet 五维：MaterialTag(13) / StateTag(10) / BehaviorTag(8) / FlagTag(16) / TemperatureTag
- 🟡 规则数 vs 原版数十种（缺爆炸链、容器收纳、攀爬、食用转化、魔法药水施加任意形容词等）

## 三、挑战/目标系统

- ✅ 8 种条件类型（object-present/object-destroyed/counter/entity-at/npc-state/sequence/all-of/any-of）— `src/core/game/GoalSystem.ts:117-143`
- ✅ 多阶段 stages、Starite(10 shard=1)、门槛解锁、存档恢复 — `GoalSystem.ts`

## 四、题库

- ✅ 约 1024 题（情境多答案 177 + 词条覆盖 660 + 形容词组合 187）— `src/core/data/questions/bank.ts`
- ✅ 三种题型（情境多答案 / 词条覆盖单答案 / 形容词组合）
- ✅ 双难度标注（CEFR 档 + 词频档），QuestionPicker 种子洗牌抽题 — `word-metadata.ts`、`QuestionPicker.ts`
- 🟡 题库 vs 原版开放词条自由解谜（本项目以闭集题库替代开放解谜自由度）

## 五、自定义物体

- ✅ `custom:` 前缀、IndexedDB 持久化、运行时注入词典索引 — `src/game/ObjectEditor.ts:46-71`、`src/ui/ObjectEditorUi.ts`
- ✅ 创建/更新/删除/复制、名称冲突校验、isModifiable 校验、外观覆盖
- 🟡 仅基础词条+形容词+颜色组装，缺原版多物体拼合+行为/移动/攻击分配+缩放/纹理工具

## 六、辅助系统

- ✅ 魔法背包（浏览/筛选/召唤/自定义管理）— `src/ui/BackpackPanel.ts`
- ✅ 物体编辑器 — `ObjectEditor.ts`、`ObjectEditorUi.ts`
- ✅ 世界地图（关卡节点/解锁/选关）— `src/ui/WorldMapOverlay.ts`
- ✅ Merit Board（关卡挑战进度）— `src/ui/MeritBoard.ts`
- ✅ Starite Vision（目标高亮开关）— `src/ui/StariteVision.ts`

## 七、关卡

- ✅ 5 主关（overworld-meadow/stage-cave/stage-snow/stage-desert/stage-volcano）+ quiz-arena，6 主题 — `src/core/data/levels/*.json`、`LevelManager.ts`
- 🟡 无显式传送门衔接（靠世界地图选关）；区域数 vs 原版约 39

## 八、装备/骑乘

- ✅ 三槽（hand/back/mount）：手持武器/远程射击/翅膀飞行/骑乘坐骑 — `src/game/PlayerController.ts:358-646`
- ✅ 锚点绑定、朝向同步、冷却、跨关安全解除旧世界附着

## 九、移动模式

- ✅ 8 状态 idle/walk/jump/fall/fly/swim/attack/dead 全声明驱动 — `src/core/entity/Entity.ts:33`、`PlayerController.ts`、`BehaviorSystem.ts`
- ✅ 附加 AI：wander/flee/follow/sleeping/poisoned/frozen/petrified — `src/game/BehaviorSystem.ts`

## 十、视觉与体验（原版对齐补充）

- ✅ sprite atlas 路线（统一 sprite+setTint，renderer===id），604 规格 — `scripts/sprite-specs.js`、`spriteRenderers.ts`
- ✅ GPT 双板背景（远板+近板视差）+ 程序化回退 — `Environment.ts`、`docs/background-prompts.md`
- ✅ 涂鸦纸片视觉、Starite 飞向 HUD、生成动效、Filter 后处理、合成音乐与音效
- ✅ 多设备适配、触屏虚拟摇杆/按钮、键盘焦点、reduced-motion

## 十一、叙事与结构（原版对齐补充）

- ✅ 基础入门卡（写词→召唤→帮 NPC→Starite 循环）+ Lily 解咒胜利卡
- 🟡 42 兄弟姐妹 avatar 解锁链（仅 Edwin 起点 + Lily 解咒，缺其余兄弟解锁与变装）
- ❌ 老乞丐=Edgar 乔装的反转叙事

## 十二、Object Shard 体系

- ❌ 七大类（Living/Food/Vehicle/Music/Weapon/Clothes/Misc）跨关非排他 Shard 任务体系 — `bank.ts` 仅关卡挑战，无独立 Object Shard 任务
