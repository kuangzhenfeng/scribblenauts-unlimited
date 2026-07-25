# 涂鸦冒险家 无限（中文复刻）

> 全新项目，以 Phaser 4 为引擎重制《涂鸦冒险家 无限》核心玩法，追求 Awwwards 级视觉。

## 项目定位

2D 涂鸦风文字解谜游戏。玩家在魔法笔记本输入任意词（中/英），对应物体即出现在游戏世界；可叠加形容词修改物体；物体间基于属性标签与规则引擎进行深度交互。

- 全部美术为程序化矢量绘制（Phaser Graphics），零位图素材
- 双语闭集分词（中/英输入解析，零通用 NLP 依赖）
- 声明式规则引擎 + 三重限流对抗反应链
- 程序化粒子（火/蒸汽/墨迹飞溅）+ Filter 后处理（Glow/Vignette/ColorMatrix）
- 涂鸦手绘纸片质感：手绘抖动笔触 + 纸片落地软影 + Camera 级纸纹颗粒，全手写字体 UI
- 分层视差环境：天空/远山/云/中景/地面/前景草丛，`setScrollFactor` 驱动，零 per-frame 重绘
- 生成动效：物体从笔记本飞出 + 墨迹飞溅 + pop-in 缩放（复用 `FxParticles.burst`）
- Maxwell 专属渲染器（罗纹帽/背包带/表情眼/走路 bounce/跳跃 squash/stretch）
- Starite 可见化：挑战完成时 5 角星从世界点飞向 HUD 进度面板

## 技术栈

| 层 | 技术 |
|---|---|
| 引擎 | Phaser 4.2.1（WebGL2 + 内置 Matter Physics） |
| 构建 | Vite 6 |
| 语言 | TypeScript 5（strict 全开） |
| 测试 | Vitest 2（node 环境，纯逻辑核心） |
| 路径别名 | `@` → `./src` |

## 运行

```bash
npm install        # 安装依赖（含 phaser）
npm run dev        # 启动开发服务 → http://localhost:5173
npm run build      # 类型检查 + 生产构建（dist/）
npm run preview    # 预览生产构建
npm test           # 运行纯逻辑单测
```

一键启动（自动检测并安装缺失依赖后启动开发服务）：

- macOS/Linux：`./start.sh`
- Windows：双击 `start.bat`

## 玩法

- **笔记本**：屏幕底部输入框，输入词回车生成物体（中/英均可）。例：`狗` / `dog` / `飞行的紫色的章鱼`。
- **形容词**：输入"基础词 + 形容词"组合，如`大的狗`、`飞行的紫色的章鱼`；选中实体后输入纯形容词（如`燃烧`）回车即对该实体施加。
- **规则交互**：火点燃可燃物（连锁燃烧）、水灭火、锋利武器切断绳子、冷源冻水成冰、武器伤害生物、带电物体电击肉体。
- **关卡**：overworld 草地区域 + 自包含关卡，经区域衔接传送。挑战由 NPC 发起，满足条件得 Starite/碎片。
- **物体编辑器**：按 `E` 打开，组合"基础词条 + 形容词 + 新名称"保存为自定义物体，之后输入该名即可生成。
- **玩家控制**：WASD/方向键移动，空格/W/↑跳跃，F 拾取面前物体，G 投掷/下坐骑，鼠标拖拽物体投掷。

## 架构分层

```
src/
├── core/            领域核心层（纯 TS，零 Phaser 依赖，可单测）
│   ├── lex/         双语闭集分词
│   ├── rules/       声明式规则引擎 + TagSet + TagIndex + effects
│   ├── data/        词典/形容词/规则/关卡 JSON + 存档
│   ├── entity/     Entity 抽象接口
│   ├── game/        GoalSystem（挑战评估）
│   └── types/       纯类型
├── engine/          Phaser 集成层
│   ├── scenes/      WorldScene（调度链）
│   ├── physics/     Matter 适配（碰撞/Constraint/Query）
│   └── render/      矢量渲染器（Graphics）+ Camera + EntityGraphics + Environment（分层视差）+ renderers（含 maxwell/starite/decor）
├── game/            游戏逻辑层（桥接 core 与 engine）
│   ├── Entity.ts    GameEntity（持 GameObject + Matter body）
│   ├── Spawner.ts PlayerController.ts MousePicker.ts
│   ├── BehaviorSystem.ts LevelManager.ts DialogSystem.ts
│   ├── AdjectiveSystem.ts ObjectEditor.ts
├── ui/              DOM 浮层（Notebook/Hud/ProgressPanel/SpeechBubble/...，涂鸦纸片风 + 手写字体 + 内联 Lucide 图标）
├── fx/              视觉增强（Filter/粒子/SpawnFx 生成动效/自定义 shader）
└── util/            日志（console，英文）
tests/               纯逻辑单测
```

核心层（`src/core`）零 Phaser 依赖，可在 node 环境单测；游戏层（`src/game`）桥接 core 与 engine；UI 用 DOM overlay 叠在 Phaser canvas 之上（中文 IME 必需）。

## 设计原则

- 奥卡姆/YAGNI/KISS/DRY：core 层只声明并实现真正用到的字段/触发器/effect
- 依赖注入消除全局单例（旧项目 effectDeps 全局变量已重构）
- 日志：console 封装 + 英文
- 领域用语见 `CONTEXT.md`
