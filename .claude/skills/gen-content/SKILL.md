---
name: gen-content
description: 当需要新增游戏内容时使用 —— 生成词汇(含docs)、生成题库、生成sprite图、生成关卡。默认生成词汇；通过参数选择模式：word/question/sprite/level。
---

# gen-content

## 概述

新增游戏内容的四合一流程。按参数选择模式，默认 `word`（生成词汇）。每个模式独立可执行；一个完整新词条通常依次走完前三个模式（先词汇、再题库、最后 sprite）；新关卡则用 `level` 模式。

## 参数约定

调用本 skill 时通过 `args` 传入模式名，取首词匹配：

| args 首词 | 模式 | 说明 |
|---|---|---|
| 空 / `word` | 模式一：生成词汇（默认） | 新增 DictEntry + word-metadata + docs 提示词 |
| `question` | 模式二：生成题库 | 在 bank.ts 中新增题目 |
| `sprite` | 模式三：生成 sprite 图 | 走帧规格 + GPT 生图 + 三步流水线 |
| `level` | 模式四：生成关卡 | 新建关卡 JSON + 注册到 LEVEL_ORDER + 选关场景适配 |

## 执行流程

1. 解析参数 → 确定模式（见上表）
2. 执行对应模式的步骤
3. 完成后报告变更范围

---

## 模式一：生成词汇（word，默认）

### 适用场景

新增一个可被玩家召唤的游戏物体（生物/物品/元素/食物/武器/植物/载具/工具）。

### 执行步骤

1. **确定分类与 id** → 按 `category` 选 entries 文件（见下表）
2. **编写独立词条 DictEntry** → 追加到对应数组，参考同类词条的 `tags`/`physics`/`behaviors`
3. **补全可识别词 aliases** → 中英双语各补自然别名（见下文推荐数量与原则）
4. **补 word-metadata 难度** → 在 `WORD_METADATA` 中加 `{ cefr, freq }`（1-3 档）
5. **写 docs/sprite-prompts 提示词** → 仅当需要新 atlas 时（见复用判断）
6. **复用判断** → renderer 复用 / aliases 扩充 / setTint 染色（见下表）

### entries 文件选择

| category | 文件 | 典型词条 |
|---|---|---|
| `creature` | `src/core/data/dictionary/entries/animals.ts` | dog/cat/dragon/human |
| `object` / `tool` / `structure` / `magic` | `src/core/data/dictionary/entries/objects.ts` | box/fridge/tower/wand |
| `element` | `src/core/data/dictionary/entries/elements.ts` | fire/water/ice |
| `food` / `weapon` / `vehicle` / `plant` | `src/core/data/dictionary/entries/misc.ts` | apple/sword/car/tree |

### 独立词条与可识别词

一个"词汇"由**独立词条**和**可识别词（aliases）**两部分组成，二者必须同时生成：

- **独立词条**：`id`/`zh.name`/`en.name` + 物理/渲染/标签等，是可被召唤的主体
- **可识别词**：`zh.aliases`/`en.aliases`，是玩家输入时除 `name` 外也能命中的自然别称（如 狗→`['犬','狗狗']`、dog→`['hound']`）

### 别名推荐数量

基于 538 条词条的统计分布，别名数量遵循"自然、够用即可"原则，**禁止为了凑数硬造**：

| 语言 | 推荐数量 | 分布依据 | 取值原则 |
|---|---|---|---|
| `zh.aliases` | 2~3 个 | 97% 词条 2~4 个，中位 2~3 | 口语俗称、简称、繁体/异写、儿童用语 |
| `en.aliases` | 2~3 个 | 83% 词条 2~4 个，中位 2~3 | 同义词、复数/单数变体、学名/俗称 |

**不凑数原则**：只有自然存在的别称才写，没有就少写甚至留空（96 条 zh.aliases 为空、13 条 en.aliases 为空都是正常的）。宁缺毋滥，不为到达数量而硬造词。

### DictEntry 字段速查

```typescript
{
  id: 'xxx',                      // 全局唯一稳定标识
  zh: { name: 'XX', aliases: ['别名'] },
  en: { name: 'xxx', aliases: [] },
  category: 'creature' | 'object' | 'food' | 'weapon' | 'tool' | 'vehicle' | 'element' | 'plant' | 'structure' | 'magic',
  size: { width, height },        // 物理刚体尺寸（≠ sprite 帧尺寸）
  appearance: { renderer: 'xxx' },// renderer===id 原则
  physics: { shape, density, friction, restitution, ... },
  tags: tags([...], [...]),       // 各文件有局部 tags() 构造器
  behaviors: [...],               // creature 多为 wander/swim；object/food/weapon 为 []
  modifiable: { nature: false },  // creature 通常禁 nature；其余缺省全允许
  description: { zh, en },
}
```

### 复用判断

| 场景 | 处理 |
|---|---|
| 新物种需独立图 | `renderer===id`，在 `docs/sprite-prompts/{分类}.md` 写提示词 |
| 近义复用已有图 | `renderer` 指向被复用 id，不写 docs（如 amulet 复用 gem） |
| 仅扩充可识别词 | 只加 `zh.aliases`/`en.aliases`，不增 sprite |
| 参数化颜色对象 | 中性灰底 + 运行期 `setTint`，不新增 atlas |

### 关键文件

- `src/core/data/dictionary/entries/{animals,objects,elements,misc}.ts`
- `src/core/data/questions/word-metadata.ts`
- `docs/sprite-prompts/{characters,objects,food,weapons,nature,vehicles,effects,decor}.md`

---

## 模式二：生成题库（question）

### 适用场景

为已有词条新增题目，或新增情境多答案题。

### 执行步骤

1. **确定题目类型**（情境题 / 词条覆盖题 / 组合题）
2. **按类型编辑 bank.ts**
3. **难度由 word-metadata 派生**，确认目标词条已有元数据

### 三类题目新增方式

| 题型 | 位置 | 数据结构 |
|---|---|---|
| 情境多答案题 | `scenarios` 数组 | `{ suffix, prompt, hint, answers: [{ typeId, adjectives? }] }` |
| 词条覆盖题 | 自动派生 | 补 `categoryTemplates` 模板即可 |
| 形容词组合题 | `xxxCombos` 数组 | `{ adj, noun }` |

### 关键文件

- `src/core/data/questions/bank.ts`
- `src/core/data/questions/word-metadata.ts`

---

## 模式三：生成 sprite 图（sprite）

### 适用场景

为已有帧规格的 atlas 生成实际 sprite 图。

### 执行步骤

1. **确认 `sprite-specs.js` 已有帧规格**（没有则先加）
2. **取 `docs/sprite-prompts` 对应提示词** → GPT 生图到 `tmp/imagegen/{atlasKey}.png`
3. **三步流水线**：prepare → process → gen-atlas
4. **刷新游戏验证** → PreloadScene 自动加载

### 三步流水线命令

```bash
# 1. 去背+缩放（生成 _strip.png）
node scripts/prepare-sprite.js {atlasKey} tmp/imagegen/{atlasKey}.png

# 2. 边缘颜色扩展（生成最终 .png）
node scripts/process-sprite.js {atlasKey}

# 3. 生成 atlas JSON
node scripts/gen-atlas.js {atlasKey}
```

### 批量方式

| 场景 | 脚本 |
|---|---|
| 单个对象 | 手动跑三步 |
| 批量已有源图 | `scripts/process-all-sprites.sh` |
| 批量含 GPT 生图（网格） | `scripts/gen-sprites-grid.sh` |
| 批量含 GPT 生图（单图） | `scripts/gen-sprites-batch.sh` |

### 关键文件

- `scripts/sprite-specs.js`
- `docs/sprite-prompts/{对应分类}.md`
- `scripts/prepare-sprite.js` / `process-sprite.js` / `gen-atlas.js`

---

## 模式四：生成关卡（level）

### 适用场景

新增一个可游玩关卡（独立关卡 `self-contained` 或自由探索区 `overworld`）。

### 执行步骤

1. **新建关卡 JSON** → 放入 `src/core/data/levels/{level-id}.json`，构建期由 `import.meta.glob` 自动注册到 REGISTRY
2. **注册到 LEVEL_ORDER** → 在 `src/game/LevelManager.ts` 的 `LEVEL_ORDER` 数组追加 level-id（决定选关场景展示与解锁顺序）
3. **选关场景适配** → 在 `src/engine/scenes/LevelSelectScene.ts` 的 `THEME_META`（主题配色/图标/双语名）和 `LEVEL_TITLE`（关卡双语标题）中补条目
4. **新主题处理**（仅当 theme 不在现有 6 个中时）→ 见下表

### 关卡 JSON 字段速查

```jsonc
{
  "id": "stage-xxx",                 // 全局唯一，小写连字符
  "type": "self-contained",          // overworld=自由探索区；self-contained=独立关卡
  "theme": "cave",                   // jungle/cave/snow/desert/volcano/meadow
  "bounds": { "minX": -800, "minY": -200, "maxX": 800, "maxY": 600 }, // 世界边界
  "playerStart": { "x": -300, "y": 542 },
  "terrain": [ { "x": -500, "y": 160, "w": 220, "h": 24 } ],          // 额外平台（静态矩形，中心点坐标）
  "spawns": [ { "typeId": "stone", "x": -200, "y": 330, "layer": 0 } ], // typeId 须在词典中存在
  "npcs": [
    { "id": "npc-miner", "typeId": "human", "x": 0, "y": 320, "gender": "male",
      "drawParams": { "shirtColor": "#3b6ea5", "pantsColor": "#2b2b2b", "hat": "miner" } }
  ],
  "decorations": [ { "kind": "stalactite", "x": -500, "y": 0 } ],      // kind 须在渲染器中已注册
  "transitions": [ { "toLevelId": "overworld-meadow", "at": { /* AABB */ } } ], // 区域衔接
  "starite": { "x": 600, "y": 300 },                                   // Starite 飞出位置
  "challengeSlots": 3                                                  // 运行时从题库抽题数；quiz-arena 为 0
}
```

> `challenges` 数组运行时由 `QuestionPicker` 按 `challengeSlots` 从题库随机抽取并装配，JSON 中留空或省略即可。

### 新增关卡必改文件

| 文件 | 改什么 |
|---|---|
| `src/core/data/levels/{level-id}.json` | 新建关卡 JSON（放入即自动注册） |
| `src/game/LevelManager.ts` | `LEVEL_ORDER` 数组追加 level-id |
| `src/engine/scenes/LevelSelectScene.ts` | `THEME_META` + `LEVEL_TITLE` 补条目（用已有主题则 THEME_META 无需改） |

### 新主题判断

| 场景 | 处理 |
|---|---|
| 用已有主题（jungle/cave/snow/desert/volcano/meadow） | 仅改关卡 JSON + LEVEL_ORDER + 选关标题 |
| 新增主题 | 额外改 Environment.ts 的 `THEMES` 调色板 + PreloadScene 的 `BACKGROUND_PLATES` + `docs/background-prompts.md` 提示词 + 生成 `bg-far/bg-near-{theme}.png` |

### 背景板生成（新主题时）

按 `docs/background-prompts.md` 的提示词向 GPT 生图：
- 远板 `bg-far-{theme}.png`（1920×1080，固定屏天空盒，scrollFactor 0,0）
- 近板 `bg-near-{theme}.png`（1920×200，水平无缝视差条带，左右边缘可拼接）
- 放入 `public/assets/backgrounds/`，PreloadScene 自动加载，缺图时 Environment 程序化回退

### 关键文件

- `src/core/data/levels/*.json`
- `src/game/LevelManager.ts`
- `src/engine/scenes/LevelSelectScene.ts`
- `src/engine/render/Environment.ts`（`THEMES`）
- `src/engine/scenes/PreloadScene.ts`（`BACKGROUND_PLATES`）
- `docs/background-prompts.md`

---

| 错误做法 | 正确做法 |
|---|---|
| 套用「帧=物理size×1.6」统一公式 | 按「装下美术实际内容 + 描边 3px + edge bleed 2px 余量」估定，见 `sprite-specs.js` 已落地规格 |
| 全图 `-transparent white` 去背 | 用 `prepare-sprite.js` 的边界连通去背（保留内部白色细节） |
| 新增词条不补 `word-metadata` | 必须补 `cefr`/`freq`，否则 `getWordMeta` 回退最高档 `{3,3}` |
| 每个颜色变体画新图 | 参数化对象用中性灰底 + 运行期 `setTint` |
| 条目放在错误的 entries 文件 | 按 `category` 选文件（见 entries 文件选择表） |
| 关卡 JSON 手写 `challenges` | 运行时由 `QuestionPicker` 按 `challengeSlots` 抽题覆盖，JSON 留空即可 |
| 关卡 JSON 写完即生效 | 必须追加到 `LEVEL_ORDER`，否则不进选关场景与解锁顺序 |
| 关卡用新主题却不补调色板 | 新主题需同步改 `Environment.THEMES` + `BACKGROUND_PLATES` + 背景板提示词 |

---

## 完整新词条示例（三模式串联）

以新增"南瓜车"为例：

1. **模式一（word）**：在 `entries/objects.ts` 追加 DictEntry（category=`vehicle` 或 `magic`，renderer=`pumpkin-carriage`），在 `word-metadata.ts` 补难度，在 `docs/sprite-prompts/vehicles.md` 写提示词。
2. **模式二（question）**：在 `bank.ts` 的 `scenarios` 中找到"赶路困境"相关情境，把 `pumpkin-carriage` 加入 `answers`；或新增一个 `Scenario`。
3. **模式三（sprite）**：在 `sprite-specs.js` 加帧规格，取提示词向 GPT 生图，跑三步流水线。
