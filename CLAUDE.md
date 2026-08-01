# Scribblenauts Unlimited

## 项目指令

- 如果是在WSL中，请使用powershell运行windows命令，所有 Windows 相关测试、构建、运行和真实界面验证都改用 powershell.exe，需要启动浏览器进行验证时需要启动windows下的chrome浏览器而不是wsl下的浏览器
- 项目内容有修改时，需要同步更新README，README的更新遵循最小化更新原则
- 如果我要求你"构建并安装"，你需要构建->拷贝exe覆盖原release下的同版本exe->清除构建(默认不清除构建，除非我明确要求清除)->安装程序->启动程序
- 新增功能必须更新README.md
- README.md最小化更新
- 如后端代码变更，需要重新启动服务，请自行重启服务
- 如有必要，可以增加日志进行跟踪分析
- 无需考虑兼容问题
- 当需要生成图片时，可以调用codex的图像生成能力，使用`imagegen`技能
- 新增词汇时(新增renderer)，需要分析 `docs/sprite-prompts/README.md` 及对应分类提示词文件是否需要同步新增。renderer尽量进行复用，避免需要生成过多的新图，但也需要分析复用是否合理
- 网络搜索可以使用web-search-exa
- 时刻注意将“原版真正的核心设计”与当前项目已有能力对齐

## 前端设计规范

- 图标：统一使用 Lucide 图标，界面全程禁止使用表情符号。
- 设计标准：对标 Awwwards 顶级网站水准，达到 Awwwards、FWA、CSS Design Awards 每日最佳网站同等设计品质。
- 创意自由度：将浏览器视作交互式艺术画布，跳出传统布局框架，追求先锋视觉风格、实验性排版、流畅物理动效、极具冲击力的文字版式。
- 沉浸式体验：融合代码、高级渲染逻辑，打造统一完整的精品页面，做出突破常规 UI 认知、令人惊艳的数字交互体验。

## 基本原则

- 遵循工业级设计原则，按照主流工业级做法进行方案设计与实施

## 设计原则

- 核心基础：做技术决策时，别太看重开发成本，但代码的可读性和可维护性是第一优先级。在遵循下述原则的时候不要考虑首次开发成本，因为AI的开发效率非人所能比拟的，但后续的维护还是需要人工维护，因此可读性和可维护性极其重要
- 遵循剃刀原则（Occam's Razor）：如无必要勿增实体，在效果相同的前提下，选择假设/实体更少的方案
- 遵循YAGNI原则（You Aren't Gonna Need It）：不为未来可能的需求而设计和实现功能
- 遵循KISS原则（Keep It Simple, Stupid）：系统应保持尽可能简单，避免不必要的复杂性
- 遵循DRY原则（Don't Repeat Yourself）：不重复实现已有功能，优先复用既有实现

## 规范
- 默认中文，除非我要求你使用其他语言
- 必须严格遵循项目原有风格，包括但不限于代码风格、注释风格、日志风格等
- 遵循现代化工业级设计，按照主流工业级做法进行方案设计与实施
- 分析排查问题时遵循第一性原理，解决问题时遵循工业级根治原则
- 注释用中文，日志用英文
- 回答必须基于代码事实，反复验证，不确定必读代码，禁止猜测
- 对已由构造或生命周期保证有效的依赖，直接访问，避免保留冗余兜底分支
- 不要为了实现而写代码：先思考职责归属，模块只做自己该做的事，不因实现便利而侵入其他模块的职责边界
- 禁止主动提交代码，禁止使用git add、git commit、git push、git stash等指令
- 新增项目级skill时，需要同步更新.agents/skills/README.md中的技能列表
- 禁止使用脚本进行批量处理，除非你非常确定脚本的正确性和安全性
- 在我要求你重构代码时，不考虑改动量，仅考虑合理性、可维护性、可扩展性、可测试性
- 禁止推测意图，代码是唯一的事实来源，禁止基于不确定的意图进行任何代码修改
- 最小的改动，最大的效果
- 避免过度设计和过度封装。一切以简洁为原则，不做冗余的薄封装/薄委托
- 不创造新的术语，领域用语以项目根目录的`CONTEXT.md`为准
- 当要求你分析现有代码时，你需要从第一性原理出发，深度挖掘，分析其设计目的
- 当要求你进行设计时，你需要从第一性原理出发，深度挖掘，思考应该如何设计

## 日志系统

- 所有日志同时输出到控制台和 `logs/` 目录下的日志文件
- 日志级别：`debug` < `info` < `warn` < `error`，默认 `info`，可通过环境变量 `LOG_LEVEL=debug` 调整，但添加日志时除非我要求你用`debug`级别，否则禁止使用`debug`级别日志
- 日志文件按天切割，自动保留最近 7 天
- 排查问题时优先查看 `logs/` 下的日志文件

## Sprite 素材规范

**路线**：渲染单路由 sprite —— 所有对象统一 sprite + 运行期 `setTint` 染色（对齐行业做法：每对象一套美术 + tint，非每颜色变体画新图）；GPT 图生图替换时直接覆盖 atlas 文件。背景板、地面、平台、顶棚和传送门按背景板规范保留程序化绘制或缺图回退，环境装饰使用 Sprite atlas。vector paper-doll 路由已废弃删除。

**renderer===id 原则**：creature 词条的 `renderer` 直接等于自身 id（如 `dog`/`cat`/`dragon`），每物种一张独立 sprite atlas，不再共用家族 renderer。颜色由图本身表达，不用 setTint 中性灰底。

**同义词共享**：词条可通过 `zh.aliases`/`en.aliases` 扩充可识别词汇（不增 sprite），近义物种可共享同一 atlas（如 amulet 复用 gem、totem-mini 复用 totem）。词库 ≫ 独立美术资源。

**参数化颜色**：sprite 路径的对象经 `setTint` 实现（基础 sprite 用中性灰底，运行期染色）；独立图物种颜色由图本身表达，无需 params.bodyColor。

**Locomotion 状态（按原版）**：
`idle` | `walk` | `jump`（vy<0） | `fall`（vy≥0） | `fly` | `swim` | `attack` | `dead`

**GPT 基础风格提示词**（每条均需追加）：
```
Scribblenauts Unlimited 2D卡通游戏精灵图集，粗黑色描边3px，
平面卡通着色，鲜明饱和色彩，白色背景，无投影，
水平排列[N]帧，每帧尺寸精确为[W]x[H]px，所有帧角色比例一致
```

**标准帧规格**：

| 对象类型 | 帧数 N | 每帧尺寸 W×H | 帧序 |
|---|---|---|---|
| 主角（maxwell） | 8 | 64×96 | idle, walk×4, jump, fall, dead |
| 人形NPC（human 等） | 1 | 见各对象 | idle |
| 四足动物（dog/cat 等） | 1 | 见各对象 | idle |
| 小生物（bird/fish） | 5 | 48×48 | idle, fly/swim×4 |
| 载具（car） | 5 | 96×64 | idle, move×4 |
| 特效（fire/water/steam） | 4 | 48×64 | 循环帧 |
| 静态道具 | 1 | 见各对象 | 单帧 |

creature 单帧 idle：对齐现有 sprite 做法（penguin/snake/frog 等均单帧），形态区分度由"每物种独立图"解决；多帧动画（walk/fly/swim）后续按需补。

**帧尺寸与物理 size 的关系**：sprite 帧尺寸 ≠ 词条 `size`（物理刚体尺寸）。物理 `size` 精确驱动 Matter 刚体（碰撞壳/拾取范围），帧尺寸是视觉皮，二者职责分离。帧尺寸以「装下美术实际内容 + 描边/edge bleed 余量」为准，不套固定系数：
- 实心物体（冰箱/球/玻璃/砖）美术轮廓 ≈ 物理轮廓，帧 ≈ 物理 size（系数 ≈ 1.0~1.1），仅留描边 3px + edge bleed 2px 余量；
- 有装饰物体（剑护手/枪管/树冠/花瓣/高光）美术超出物理轮廓，帧按装饰实际范围放大（系数因物而异，1.3~2.7+），细长物窄方向放更大；
- 禁止套用「帧 = 物理 size × 1.6」统一公式——该系数取自 apple/meat/tree 等少数有装饰物体的偏置样本，套到实心物体会让视觉比碰撞大 60%、物体飘浮失真。

**静态道具帧尺寸**：对齐到 4 的倍数，细长物最小边 ≥ 16px。具体物件的帧尺寸以 `scripts/sprite-specs.js` 已落地 sprite 的实际规格为准（png=json=spec 三者一致），新增物件按上述原则估定，而非机械套系数。

**工作流**：
1. 以 `scripts/sprite-specs.js` 的帧规格和帧名为准，按 `docs/sprite-prompts/README.md` 及对应分类文件中的完整提示词向 GPT 生图（每个对象一张图）
2. 运行 `node scripts/prepare-sprite.js {atlasKey} <sourcePath>`，在原始分辨率移除从边界连通的中性灰白背景并生成精确尺寸的 `{atlasKey}_strip.png`
3. 运行 `node scripts/process-sprite.js {atlasKey}`，按每个帧独立扩展 2px 最近边缘颜色到透明 RGB 区域，避免 GPU 采样白边，输出 `{atlasKey}.png`
4. 运行 `node scripts/gen-atlas.js {atlasKey}` 生成 `{atlasKey}.json`
5. 刷新游戏，PreloadScene 自动加载，渲染器自动切换为该 sprite

透明处理依赖 ImageMagick 7 的 `magick` 命令；去背只处理从边界连通的中性灰白像素，保留内部白色细节和 Starite 的黄色发光边缘；禁止使用全图 `-transparent white`。

**批量生图**：对小物件（单帧、尺寸 ≤48px）可用 `scripts/gen-sprites-grid.sh` 一次生成一张含 N 个物件的网格图，再 `scripts/split-grid.js` 切割后走三步流水线；`scripts/process-all-sprites.sh` 可批量串联 `tmp/imagegen/` 下所有源图。

**文件路径**：`public/assets/sprites/{atlasKey}.png` + `.json`

**各对象完整提示词**：见 [`docs/sprite-prompts/`](docs/sprite-prompts/) 目录（按类别拆分）

## 背景板素材规范

远景背景用 GPT 生图双板替换程序化矢量远景层；地面/平台/顶棚/传送门保持程序化，环境装饰使用 Sprite atlas。

- **远板**：固定屏整图天空盒（`scrollFactor 0,0`，覆盖缩放铺满屏幕），含天空/远山/云/主题远景元素，1920×1080
- **近板**：水平无缝视差条带（`scrollFactor 0.5`，TileSprite 平铺），中景低丘，底部色衔接地面，1920×200，左右边缘须可拼接
- **路径**：`public/assets/backgrounds/bg-{far|near}-{theme}.png`（theme 取关卡 JSON 的 `theme` 字段：`jungle` / `cave` / `snow` / `desert` / `volcano`；`meadow` 无独立背景板时由 Environment 程序化回退）
- **加载**：PreloadScene 自动 `load.image`，文件不存在时静默跳过，Environment 回退程序化分层绘制
- **无需** `prepare-sprite.js` / `process-sprite.js` / `gen-atlas.js`（那是 sprite strip 透明处理流程；背景板为整幅不透明图，直接使用）
- **完整提示词**：见 [`docs/background-prompts.md`](docs/background-prompts.md)

## Agent规则

- 当在wsl中运行时，需要调用`powershell.exe xxx`来在windows中执行命令，比如`powershell.exe npm install`
- 当调用grill-me/grill-with-docs skill进行拷问时，必须使用交互式提问工具进行提问并给出推荐选项。在向我提问前必须先自行分析分析，如能够自行通过代码分析出结论且有足够把握，禁止向我提问
- 若当前使用模型不支持视觉，不要截图验证
