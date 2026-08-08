# 能力清单

> 列举项目**当前**已实现能力，供差距分析对齐基准。**本文件是事实快照，随实现演进而更新**。每条附关键文件:行号。判据：是否可被玩家端到端体验。

> 维护规则：标注判定 — ✅ 已实现 / 🟡 部分 / ❌ 缺失。量化值以最新代码为准。每次能力变更后同步本文件。

## 一、词条与形容词

- ✅ 词条 660（animals 229 / elements 49 / misc 239 / objects 143）— `src/core/data/dictionary/entries/*.ts`
- ✅ 形容词 123（color 42 / size 15 / behavior 18 / state 25 / material 23）— `src/core/data/dictionary/adjectives/*.ts`
- ✅ 双语闭集分词（中/英输入解析，含别名命中）— `src/core/lex/`
- 🟡 词库规模 vs 原版 10000+（差距显著，靠 alias 扩充与 gen-content 持续扩充）

## 二、规则交互

- ✅ Effect 13 种（含范围爆炸、次级引爆与容器收纳）— `src/core/rules/effects.ts:150-250`
- ✅ 规则 16 条（在火、电、锋利、水、冷冻、进食、武器、投射物、毒药、热等规则外，新增火焰引爆爆炸物与容器收纳）— `src/core/data/dictionary/rules/rules.ts:13-255`
- ✅ RuleEngine：碰撞/接触/tick 三触发 + 反应链(深≤4) + 三重限流（非重入队列+冷却+链深/帧上限）— `src/core/rules/RuleEngine.ts`、`TagSet.ts`
- ✅ TagSet 五维：MaterialTag(13) / StateTag(10) / BehaviorTag(8) / FlagTag(17) / TemperatureTag
- 🟡 生成器对非 critical 实体设有 60 个硬上限，原版核心循环没有同等对象预算限制；规则仍缺攀爬、食用转化、魔法药水施加任意形容词等 — `src/game/Spawner.ts:43-87`
- ✅ 词条生命值数据驱动：普通人/狗 50、猫 30、章鱼 20、龙 50、宝箱 30，未声明词条按类别近似值兜底；伤害、治疗、死亡、Maxwell 重生与受伤对象局部四段生命圆点已贯通，常驻 HUD 不显示玩家血量 — `src/core/types/dictionary.ts`、`src/game/Spawner.ts`、`src/core/rules/effects.ts`、`src/game/PlayerController.ts`、`src/ui/EntityHealthDisplay.ts`、`src/ui/Hud.ts`、`src/engine/scenes/WorldScene.ts`

## 三、挑战/目标系统

- ✅ 8 种条件类型（object-present/object-destroyed/counter/entity-at/npc-state/sequence/all-of/any-of）— `src/core/game/GoalSystem.ts:117-143`
- ✅ 多阶段 stages、Starite(10 shard=1)、门槛解锁、存档恢复 — `GoalSystem.ts`
- 🟡 Starite 是挑战/跨关 Object Shard 兑换的持久化资源；关卡 Starite 有独立发光实体，完成门槛后飞向 HUD、摘除并同步地图进度；现已拆分 3 个 Starite 开放世界地图、60 个 Starite 解除 Lily 诅咒，41 个主区域使原版 PC 的 106 全收集目标可达，106 全收集专属里程碑卡已接入，但独立的家庭档案/结局镜头仍待补 — `src/core/game/GoalSystem.ts`、`src/engine/scenes/WorldScene.ts`、`src/core/game/StoryProgress.ts`

## 四、题库

- ✅ 1345 题（情境多答案 176 + 词条覆盖 660 + 形容词组合 509）— `src/core/data/questions/bank.ts:4191`
- ✅ 三种题型（情境多答案 / 词条覆盖单答案 / 形容词组合）
- ✅ 双难度标注（CEFR 档 + 词频档），QuestionPicker 种子洗牌抽题 — `word-metadata.ts`、`QuestionPicker.ts`
- 🟡 题库 vs 原版开放词条自由解谜（本项目以闭集题库替代开放解谜自由度）

## 五、自定义物体

- ✅ `custom:` 前缀、IndexedDB 持久化、运行时注入词典索引 — `src/game/ObjectEditor.ts:46-71`、`src/ui/ObjectEditorUi.ts`
- ✅ 创建/更新/删除/复制、名称冲突校验、isModifiable 校验、外观覆盖
- 🟡 编辑器已暴露基础词条+形容词+颜色+多部件锚点，保存后由 `Composite` 刚性连接并可再召唤；仍缺原版行为/移动/攻击分配、缩放/纹理工具与 Maxwell in Disguise 可玩闭环 — `src/game/ObjectEditor.ts`、`src/ui/ObjectEditorUi.ts`、`src/game/Spawner.ts`、`src/engine/physics/Composite.ts`

## 六、辅助系统

- ✅ 魔法背包（浏览/筛选/召唤/自定义管理）— `src/ui/BackpackPanel.ts`
- ✅ 物体编辑器 — `ObjectEditor.ts`、`ObjectEditorUi.ts`
- ✅ 世界地图（关卡节点/解锁/选关）— `src/ui/WorldMapOverlay.ts`
- ✅ Merit Board（关卡挑战进度）— `src/ui/MeritBoard.ts`
- ✅ Starite Vision（蓝色滤镜、未完成 Starite/碎片挑战与 NPC 目标、每帧世界坐标投影、屏幕标记、相机跳转、完成/切关刷新）— `src/ui/StariteVision.ts`、`src/engine/scenes/WorldScene.ts`

## 七、关卡

- ✅ 41 个主区域（含 3 个 overworld、故事书堡、齿轮站及新增主题区域）+ quiz-arena，6 个功能主题；主区域共有 81 个显式 transitions、175 个 authored 挑战、41 套独立远/近景背景与 41 个独立 `bgm`，挑战谜题/背景/音乐唯一性均有测试，区域传送与地图均读取 `unlockedLevels` — `src/core/data/levels/*.json`、`public/assets/backgrounds/`、`src/game/LevelManager.ts`、`src/engine/scenes/WorldScene.ts`、`tests/level-content.test.ts`、`tests/music.test.ts`
- 🟡 区域数量已覆盖原版 PC 约 39 个可游玩区域；首个 overworld 已补固定位置的 Edwin 农场引导 NPC，回文星窟与句法站进一步补充可回返的 cave overworld、双出口和多阶段小任务，但多数新增区域仍是复用主题的自包含切片，真正无缝 overworld 小任务密度仍不足 — `src/core/data/levels/overworld-meadow.json`、`src/core/data/levels/stage-palindromeda.json`、`src/core/data/levels/stage-syntax-station.json`、`src/game/LevelRandomizer.ts`

## 八、装备/骑乘

- ✅ 主动关系保留三类（hand/back/mount）：手持武器/远程射击/背部装备/骑乘坐骑 — `src/game/PlayerController.ts:402-620`
- ✅ 八个穿戴部位（face/head/body/hands/legs/feet/back/full-body），词条通过 `wearable` 声明部位与能力；同部位替换，全身套装与其他服装互斥 — `src/core/types/dictionary.ts`、`src/core/data/dictionary/entries/objects.ts`、`src/game/PlayerController.ts`
- ✅ 翅膀/喷气背包提供飞行，弹簧鞋提供跳跃增强；穿戴物禁用自身碰撞并在解除时恢复过滤、层级与 AI 接管标记
- ✅ 锚点绑定、朝向同步、冷却、面板单项/全部解除、跨关安全解除旧世界附着 — `src/ui/PlayerEquipmentPanel.ts`、`src/engine/scenes/WorldScene.ts`

## 九、移动模式

- ✅ 8 状态 idle/walk/jump/fall/fly/swim/attack/dead 全声明驱动 — `src/core/entity/Entity.ts:33`、`PlayerController.ts`、`BehaviorSystem.ts`
- ✅ 附加 AI：wander/flee/follow/sleeping/poisoned/frozen/petrified — `src/game/BehaviorSystem.ts`

## 十、视觉与体验（原版对齐补充）

- ✅ sprite atlas 路线（统一 sprite+setTint，renderer===id），604 规格 — `scripts/sprite-specs.js`、`spriteRenderers.ts`
- ✅ 每关独立 GPT 双板背景（远板+近板视差）+ 程序化回退 — `Environment.ts`、`PreloadScene.ts`、`docs/background-prompts.md`
- ✅ 涂鸦纸片视觉、Starite 飞向 HUD、生成动效、Filter 后处理、合成音乐与音效；10 个基础 mood + 每关独立生成乐谱 — `src/audio/scores.ts`、`src/engine/scenes/WorldScene.ts`
- ✅ 标题/选关/世界交互视觉节奏：暖金路线卡片、底部双层挑战条、Starite Vision 默认工具栏入口 — `LevelSelectScene.ts`、`SpeechBubble.ts`、`StariteVision.ts`、`WorldScene.ts`
- ✅ 多设备适配、触屏虚拟摇杆/按钮、键盘焦点、reduced-motion
- ✅ PC 键鼠操作：左键点地移动/点实体靠近使用/拖拽，F 统一交互，Q/E 旋转，O 编辑器，Enter/N 笔记本，B/V/M/J/I 面板，C/Numpad5 重置相机，小键盘平移，+/-/滚轮缩放；焦点丢失清理未完成拖拽 — `src/game/MousePicker.ts`、`src/game/PlayerController.ts`、`src/engine/render/Camera.ts`、`src/engine/scenes/WorldScene.ts`

## 十一、叙事与结构（原版对齐补充）

- ✅ 首次叙事卡（烂苹果→Lily 石化→帮助他人）接基础入门卡；3 Starite 开放世界地图里程碑、顶部 60 Starite Lily 解咒进度、60 Starite 胜利卡与 106 Starite 全收集家庭档案卡已接入，且地图入口在里程碑前受阻 — `src/core/game/StoryProgress.ts`、`src/ui/StoryIntroOverlay.ts`、`src/ui/ProgressPanel.ts`、`src/ui/VictoryOverlay.ts`、`src/engine/scenes/WorldScene.ts`
- 🟡 已有家庭头像板、40 个完成挑战槽对应的兄弟姐妹解锁、60 Lily 与 106/217 全收集父母资格计算，并将头像选择持久化后替换玩家的 Maxwell/human 外观；首关已加入固定位置的 Edwin 教学角色、Edwin 与一个兄弟 NPC 的家庭头像绑定及三阶段善意任务，其余兄弟 NPC 身份映射与原版独立 avatar 美术仍缺 — `src/core/data/levels/overworld-meadow.json`、`src/game/LevelRandomizer.ts`、`src/core/data/family/avatars.ts`、`src/ui/FamilyBoard.ts`、`src/core/data/save/SaveStore.ts`、`src/engine/scenes/WorldScene.ts`

## 十二、Object Shard 体系

- ✅ 八大类（Living/Food/Vehicle/Music/Tech/Weapon/Clothes/Misc）跨关非排他任务目录，共 217 个稳定任务；首次召唤词条完成任务，10 个 Object Shard 自动兑换 1 个 Starite — `src/core/data/starite/object-shards.ts`、`src/core/game/GoalSystem.ts`
- ✅ Object Shard 进度与普通挑战分源存档，支持跨关恢复、单关/换题重置保留兑换成果，并提供 `O` 键收集面板 — `src/core/types/save.ts`、`src/core/data/save/SaveStore.ts`、`src/ui/ObjectShardBoard.ts`
