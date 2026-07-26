# 领域用语（Ubiquitous Language）

本文件为项目领域用语的唯一权威来源。代码命名、注释术语以此为准，禁止创造新术语。

| 中文术语 | 英文 | 含义 |
|---|---|---|
| 词条 | Dictionary Entry | 词典中一个可生成物体的定义 |
| 形容词 | Adjective | 修饰词条的修饰词（大小/颜色/行为/状态/材质/本性） |
| 实体 | Entity | 运行时生成在世界中的一个物体实例 |
| 属性标签 | Tag | 实体上的标签（材质/温度/状态/行为/标志） |
| TagSet | TagSet | 实体标签集合（双层：Set + bitmask 缓存） |
| 规则 | Rule | 声明式交互规则（火×可燃→燃烧） |
| 规则引擎 | Rule Engine | 匹配规则并派发 effect 的核心 |
| effect | Effect | 规则执行的动作（apply-state/spawn/damage/...） |
| 反应链 | Reaction Chain | 规则触发后级联触发其他规则（chainTag 限流） |
| 三重限流 | Triple Throttling | 非重入队列 + 冷却 + 链深度/帧上限 |
| 笔记本 | Notebook | Maxwell 的魔法笔记本，玩家输入入口 |
| 自动补全 | Autocomplete | 输入时实时前缀补全下拉 |
| 候选菜单 | Candidate Menu | 输入歧义时的多候选选择 UI |
| 附着/组合 | Attach / Composite | 多个实体用刚性 Constraint 粘合为一个组合体 |
| 关卡 | Level | overworld 区域或自包含关卡 |
| 挑战 | Challenge | NPC 给出的谜题任务（运行时由题库抽题装配） |
| 题目 | Question | 题库中一道召唤题的静态定义（目标词条 + 形容词 + 双难度标注） |
| 题库 | Question Bank | 800+ 题目集合，按难度档分3档 |
| 难度档 | Difficulty Tier | 基础/进阶/大师（1/2/3），决定题目词汇难度 |
| 难度标准 | Difficulty Standard | CEFR 等级 / 词频排名，两种分档标准可切换 |
| 题目槽位 | Challenge Slot | 关卡内一道题的位置，存档以 slot id 去重 |
| Starite | Starite | 完整星之碎块（解除石化诅咒） |
| Starite 碎片 | Starite Shard | 10 个换 1 Starite |
| 矢量渲染器 | Vector Renderer | 程序绘制一个物体类别的函数 |
| 笔记本输入 | Notebook Input | 玩家在笔记本中键入的文字 |
| 候选 | Candidate | 输入解析后的一种可能切分结果 |
| 移动模式 | Locomotion | 实体当前移动状态（idle/walk/fly/swim/attack） |
| 朝向 | Facing | 实体朝左(-1)/朝右(1) |
| 自定义物体 | Custom Object | 玩家在物体编辑器组合保存的词条（custom: 前缀） |
| Filter | Filter | Phaser 4 后处理滤镜（Glow/Vignette/ColorMatrix/...） |
| 粒子发射器 | Particle Emitter | 火/蒸汽/爆炸等粒子效果 |
