# Sprite 提示词总览

> 每条提示词已包含完整描述（基础风格 + 对象描述 + strip 布局），可直接复制给 GPT 使用；帧规格和帧名以 `scripts/sprite-specs.js` 为准。
> 生成后先运行 `node scripts/prepare-sprite.js <atlasKey> <sourcePath>` 处理原始图透明背景，再运行 `node scripts/process-sprite.js <atlasKey>` 扩展每帧边缘颜色，最后运行 `node scripts/gen-atlas.js <atlasKey>` 生成 atlas JSON。

## 基础风格前缀

所有 sprite 默认共享以下美术风格；具体对象提示词可按对象需要覆盖描边宽度、轮廓颜色等细节：

```
《涂鸦冒险家无限》2D卡通游戏精灵图集，3像素粗黑色轮廓，
平涂阴影，鲜艳高饱和度颜色，白色背景，无投影，
水平排列[N]帧，每帧尺寸精确为[W]x[H]px，所有帧角色比例一致
```

参数化对象染色：sprite atlas + 运行期 `setTint` 整体染色，基础 sprite 用**中性灰底**（#9A9A9A 级）（对齐行业做法：每对象一套美术 + tint）。creature renderer===id：每物种一张独立 sprite atlas（单帧 idle），颜色由图本身表达，不共用家族 renderer。

> `unknown` 占位 atlas 已移除：词条的 `renderer` 直接指向自身 id（如 `couch`/`gem`/`crown`/`dog`/`cat`），运行时未注册专用 sprite 或 atlas 缺图时由 `EntityGraphics` 兜底绘制（按物体颜色/尺寸的矩形 + 粗黑描边 + 白色问号）。

## 分类索引

| 类别 | 文件 | 对象 |
|---|---|---|
| 角色与生物 | [characters.md](characters.md) | maxwell / dog / cat / tiger / dragon / human / ghost / bird / fish / starfish / ... |
| 载具 | [vehicles.md](vehicles.md) | car / wheel / bicycle / boat / plane / rocket / ufo / ... |
| 武器 | [weapons.md](weapons.md) | sword / knife / gun / bomb / bow / axe / spear / arrow / shield / mace / halberd / ... |
| 食物 | [food.md](food.md) | apple / meat / bread / mushroom / cheese / egg / carrot / banana / cake / grape / tomato / ... |
| 物品 | [objects.md](objects.md) | box / rope / fridge / wood / metal / glass / stone / ball / chair / table / couch / bed / crown / ... |
| 自然 | [nature.md](nature.md) | tree / flower / bush / grass / cactus / log / cloud / bamboo / sunflower / ... |
| 特效 | [effects.md](effects.md) | fire / water / steam / starite / lightning / tornado / rainbow / crystal / ... |
| 装饰 | [decor.md](decor.md) | fence / stalactite / lantern / totem / ruin-pillar / ... |

## 帧规格

帧尺寸 ≠ 词条 `size`（物理刚体尺寸）。物理 `size` 精确驱动 Matter 刚体（碰撞壳/拾取范围），帧尺寸是视觉皮。帧尺寸以「装下美术实际内容 + 描边/edge bleed 余量」为准，不套固定系数：

- 实心物体（冰箱/球/玻璃/砖）美术轮廓 ≈ 物理轮廓，帧 ≈ 物理 size（系数 ≈ 1.0~1.1），仅留描边 3px + edge bleed 2px 余量
- 有装饰物体（剑护手/枪管/树冠/花瓣/高光）美术超出物理轮廓，帧按装饰实际范围放大（系数因物而异，1.3~2.7+），细长物窄方向放更大
- 描边 3px + edge bleed 2px 需余量，物理 12px 宽的剑帧给到 32px 才不丢刃口
- 禁止套用「帧 = 物理 size × 1.6」统一公式——该系数取自 apple/meat/tree 等少数有装饰物体的偏置样本，套到实心物体会让视觉比碰撞大 60%、物体飘浮失真

**静态道具帧尺寸**：对齐到 4 的倍数，细长物最小边 ≥ 16px。具体物件的帧尺寸以 `scripts/sprite-specs.js` 已落地 sprite 的实际规格为准（png=json=spec 三者一致），新增物件按上述原则估定。

帧尺寸、帧数和帧名以 [`scripts/sprite-specs.js`](../../scripts/sprite-specs.js) 为准；本目录中的分类文件提供各对象的完整生图提示词。
