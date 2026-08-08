# 原版核心设计（Canonical）

> **活研究产物**：本文件由 `align-original` skill 第 1 步联网探索回写，不是写死的权威。原版游戏虽定型，但对"真正核心设计"的认知会随研究深化而精炼——每次使用 skill 前应联网验证、补来源、更新验证状态。
> 来源：官方 PC 商店页、Nintendo 官方产品稿、Steam 成就数据、PC 评测与 walkthrough/社区资料交叉整理。对齐时校验的是"原版设计意图是否被复现"，量化指标是参考而非硬性目标。
> 标注约定：✅ 已验证（一手来源）/ 🔶 有来源主张（二手）/ 💡 推断（待验证）。未标注者视为待验证，使用前应联网核实。

## 第一性原理

原版核心竞争力 = **"任意词都能召唤"的创造性解谜自由度** × **开放世界善意循环叙事**。 ✅

脱离这两点堆砌功能（如硬凑词条数）不构成对齐。每个复刻决策回扣到：它是否让玩家更自由地创造性地解谜？是否强化"帮助他人 → 获得感激 → Starite → 解救 Lily"的善意循环？

**设计意图（为什么这样设计，而非功能罗列）：**
- 为什么开放 overworld 而非菜单选关？→ 探索自由感，让玩家自主发现任务而非被动接题 💡
- 为什么 10 碎片换 1 Starite？→ 替代性进度，鼓励帮助每个人而非只做主线 💡
- 为什么烂苹果恶作剧起因？→ 给"帮助他人解咒"内在动机，善意循环的叙事引擎 💡
- 为什么 Object Editor 多物体拼合？→ 玩家创作所有权，从"解题者"升格为"造物者" 💡

> 上述"为什么"为推断层，使用 skill 时应联网回到一手来源验证设计意图。

## 五维核心设计

### 维度一：词汇与召唤
- Objectnaut 引擎，开发者曾以“数万词条”描述词汇规模 🔶；Maxwell 魔法笔记本输入词语 → 对应实体出现 ✅
- 形容词系统（承自 Super Scribblenauts），可**无限叠加**修改物体属性（giant happy purple flying...）✅
- 取消旧版预算条，但 PC/主机版实际约最多同时显示 60 个对象；核心是让玩家持续实验，而非字面无限 ✅
- 男女版 NPC 与动物；时间机器、街机等交互设施 🔶

### 维度二：规则涌现
- 物体间基于**属性标签**的深度交互，反应链可级联 ✅
- 典型交互链：火点燃可燃物（连锁燃烧）、水灭火、锋利切绳、电传导、冷源冻水成冰、武器伤害生物、爆炸与爆炸链、中毒与解毒、容器收纳、骑乘、攀爬、食用转化、魔法效果（药水施加任意形容词）🔶
- 玩家通过组合物体与形容词**涌现式**解决问题，而非固定解法 ✅
- 原版对象具有独立生命值而非统一耐久：普通人约 50、狗约 50、猫约 30、章鱼约 20、宝箱约 30；Maxwell 可以受伤并在生命耗尽后死亡。🔶（[Human](https://scribblenauts.fandom.com/wiki/Human_%28Object%29)、[Guide Dog](https://scribblenauts.fandom.com/wiki/Guide_Dog)、[Longcat](https://scribblenauts.fandom.com/wiki/Longcat)、[Octopus](https://scribblenauts.fandom.com/wiki/Octopus)、[Chest](https://scribblenauts.fandom.com/wiki/Chest)、[PC 玩家问答](https://gamefaqs.gamespot.com/boards/673042/scribblenauts-unlimited/64712519)）
- 原版 PC/主机常驻 HUD 主要承担 Notebook、Backpack、Starite Vision、地图与 Starite/Shard 进度，不把玩家生命做成左上角常驻心形/数字栏；对象生命属于世界内的局部反馈。🔶（[Nintendo 官方截图页](https://www.nintendo.com/es-es/Juegos/Juegos-de-Nintendo-3DS/Scribblenauts-Unlimited-700610.html)、[PC Gameplay Walkthrough](https://www.youtube.com/watch?v=v9ZlpuOLMlQ)）

### 维度三：开放世界
- 大开放 overworld 取代菜单选关；区域间经地图无缝衔接
- 数十个主题区域；官方 Wii U 宣传口径为 8 个世界/41 个关卡，PC 原版内容列表通常列约 39 个可游玩区域（平台/版本差异只作规模参考），并以**标点/文字主题命名**：Edwin's Farm、Capital City、The Under Line、Hyphen Heights、Full Stop Diner、Metaforest、Grave Manor、The Virgule Gallery、Sir Guillemet's Castle、Ruins of Ellipsis、Anaphora Falls、The Saurus Park、Bullet Point Bayou、The Listy Colon、Payper N. Penitentiary、Abian Sea Front、Pilcrow Peaks、Dusty Brush Canyon、Tomb of Onomatopoeia、Storybook Keep、Alliteration Abyss、Vowelcano、Palindromeda、Syntax Station、Kana Craters...
- 两形态关卡：**自包含多谜题关**（多个 puzzle 凑 1 Starite，类早期作品）+ **overworld 区域小任务**（→ Shard）
- 每关 3 首轮换曲目

### 维度四：善意循环叙事
- Maxwell 恶作剧给饥饿老乞丐**烂苹果** → 老人咒 **Lily 慢慢石化** 🔶（剧情资料有来源，官方产品页只直接确认 Lily 被诅咒）
- 收集 **Starite**（诞生于他人幸福，靠帮助他人获得感激）→ 解除诅咒；“帮助他人才能获得 Starite/Shards”由官方产品页确认 ✅，“诞生于幸福”的叙述为有来源主张 🔶
- 老人即父亲 **Edgar 乔装**，全程是考验 Maxwell 向善 🔶
- Edgar 与 Julie 共育 **42 个孩子**；Steam 官方描述确认 Maxwell 有 41 个兄弟姐妹（包括 Lily），制作人访谈确认帮助 40 个兄弟可解锁可玩 avatar ✅
- Edwin 农场教学起步；Lily 持魔法地球仪（旅行）🔶

### 维度五：创作所有权
- **Object Editor**：组装多物体（如"带轮子的狗"）、分配属性（行为/移动/攻击）、缩放染色、命名保存再召唤
- 大量自定义物体槽位
- Avatar 变装（Maxwell in Disguise）

> Steam Workshop 在线分享/下载属 PC 版的社交延伸能力，但本项目不对标（见"不复刻范围"），创作所有权聚焦本地组装/保存/再召唤。

## Starite 与 Shard 体系
- **Starite**：主要收集物，完成帮助任务获得，累积解 Lily 诅咒；PC Steam 成就记录 60 Starites 为 Lily 故事里程碑、106 Starites 为全收集
- **Starite Shard**：overworld 小任务奖励；**10 shard = 1 Starite**
- **Object Shard**：跨关非排他任务，**8 大类共 217 个**：Living / Food / Vehicle / Music / Tech / Weapon / Clothes / Misc
- **Starite Vision**：蓝色滤镜高亮未完成 NPC 与任务

## 血量与伤害

- **事实（有来源主张）**：Objectnaut 为对象保存独立生命值，普通实体的生命值会因对象类型而不同；受伤是规则交互的一部分，死亡后对象消失，Maxwell 则恢复继续探索。💡
- **显示约束**：生命反馈应贴近受伤对象，以短小的生命圆点表达剩余耐久；满血对象不常驻显示血条，常驻 HUD 继续聚焦 Notebook、背包与 Starite/Shard 进度，不引入玩家 RPG 血量栏。💡

## 量化指标（对标参考，非硬性）
| 指标 | 原版 | 对齐判据 |
|---|---|---|
| 词条 | 10000+ | 常用召唤场景覆盖度 |
| 形容词 | 数百，无限叠加 | 可组合修改属性 |
| 同屏物体 | 约 60（取消旧预算条） | 玩家可持续召唤实验，达到容量时有明确回收/反馈 |
| overworld 区域 | PC 约 39；官方 Wii U 口径 41 关卡/8 世界 | 区域覆盖与衔接连贯 |
| Starite 进度 | 60 为 Lily 故事里程碑；106 为 PC 全收集成就 | Starite 驱动力清晰，故事与全收集分层 |
| Object Shards | 217（8 类） | 八类任务体系存在 |
| 家庭 + avatar | 42 个孩子；40 个兄弟帮助成就，另有 Lily/父母里程碑 | 叙事链与解锁机制 |
| 自定义物体槽位 | 大量 | 可组装/保存/再召唤 |
| 音轨 | 90 | 主题音乐覆盖 |

## 版本定位
**仅对标 PC 完整版**（含 Object Editor）。不考虑 Wii U / 3DS / iOS / Nintendo 版本差异——不把"某版本没有某能力"作为复刻内容，只对齐 PC 完整版能力集。Nintendo 联名角色（马里奥/塞尔达）因版权不纳入复刻范围。

## 不复刻范围
| 项目 | 原因 |
|---|---|
| Nintendo 联名角色（马里奥/塞尔达等） | 版权 |
| Wii U / 3DS / iOS 版本独有差异 | 只对标 PC 完整版 |
| Steam Workshop 在线分享/下载 | 聚焦本地创作，对标线上社区非核心 |
| 本地多人联机 | 非核心 |

## 联网核验记录（2026-08-01）

- [Steam PC 商店页](https://store.steampowered.com/app/218680/Scribblenauts_Unlimited/)：确认 PC 版的开放世界、任意物体召唤、Object Creator、Magic Backpack、Starite Vision，以及“41 个兄弟姐妹（含 Lily）”的官方产品描述。
- [5TH Cell 制作人访谈](https://www.nintendoworldreport.com/interview/31785/scribblenauts-unlimited-wii-u-interview-with-5th-cell)：开发者把系列能力演进明确概括为“召唤任意物体 → 用形容词定制 → Unlimited 的开放世界与 Object Editor”，并说明大量词汇与任意形容词组合是自由度的基础；这是跨平台的一手设计说明，不把 Wii U 的具体数字外推到 PC。
- [PC 版评测](https://www.pocketgamer.com/scribblenauts-unlimited/review/)：二手资料确认开放区域同时容纳主线任务、短小的 NPC 支线和需要尝试组合物体的 Shard 任务；这支持“帮助更多人是替代性进度”的设计推断，但不单独证明开发者的原始意图。
- [Nintendo 官方新闻稿](https://www.nintendo.com/en-gb/News/2013/January/Imagination-rules-in-Scribblenauts-Unlimited-on-Wii-U-and-Nintendo-3DS-the-game-without-limits-702027.html)：确认开放宇宙、8 世界/41 关卡、Starite/Shards、Object Editor 的部件移动/缩放/物理属性/行为脚本，以及“帮助后得到 Starite”的体验闭环；这是 Wii U 宣传口径，不直接覆盖 PC 版本数字。
- [Steam PC 玩家指南](https://steamcommunity.com/sharedfiles/filedetails/?id=826659857) 与 [版本机制整理](https://en.wikipedia.org/wiki/Scribblenauts_Unlimited)：交叉确认取消旧预算条后仍以约 60 个对象为同屏容量，并确认形容词可连续叠加。
- [Steam 成就数据镜像](https://www.exophase.com/game/scribblenauts-unlimited-steam/achievements/)：确认 PC 的 60 Starites Lily 里程碑、106 Starites 全收集、40 个兄弟、217 个 Object Shards、8 个 Object Shard 分类和 Avatar/Object Editor 成就。
- [PC walkthrough 控制表](https://gamefaqs.gamespot.com/pc/678649-scribblenauts-unlimited/faqs/65412)：记录 PC 默认键位：A/D 或左右移动，W/S 或上下飞行/游泳，Space 跳跃，F 交互，Q/E 旋转物体，O 编辑器，Enter/N 笔记本，B/V/M 面板，以及小键盘相机、C/Numpad5 重置和 +/−/滚轮缩放；属于玩家指南二手来源，按功能事实采纳，不把其“R”条目的翻译当作当前项目需求。
- [PC 版预览报道](https://www.pcgamesn.com/scribblenauts-unlimited-coming-pc-steam-workshop-integration)：确认 PC 同时提供 WASD 与 click-to-move 两种 Maxwell 移动路径；这支持当前项目保留“键盘移动优先、鼠标点击目标作为替代路径”的输入模型。
- [PC 原版区域列表](https://scribblenauts.fandom.com/wiki/List_of_Scribblenauts_Unlimited_levels) 与 [Object Shards 分类表](https://scribblenauts.fandom.com/wiki/Object_Shards)：用于核对 PC 原版可游玩区域列表和 217 个 Shard 的分类明细；社区整理数字不替代官方产品描述。

## 联网核验记录（2026-08-02）

- [Steam PC 商店页](https://store.steampowered.com/app/218680/scribblenauts-unlimited/?l=english)：再次确认 PC 版的核心体验是 wide-open world、seamless free-roaming levels、召唤任意物体、Object Creator、Object Library、Merit Board/Starite Vision，以及通过 Maxwell 的家庭背景解释收集动力。✅
- [5th Cell 制作人访谈（Nintendo Life）](https://www.nintendolife.com/news/2012/09/interview_5th_cell_scribblenauts_unlimited)：一手说明“把标题页上玩家随时召唤并观察互动的沙盒感扩展为整个游戏”，再将目标散布到世界各处，让玩家探索时解决谜题而不进入选关菜单；并确认帮助 40 个兄弟可解锁可玩 avatar。✅
- [5th Cell 制作人访谈（Nintendo World Report）](https://www.nintendoworldreport.com/interview/31785/scribblenauts-unlimited-wii-u-interview-with-5th-cell)：一手说明 Objectnaut 的规模重点是“数万词条 × 任意形容词组合”，而非单一固定词条数字；同时说明形容词、开放世界、Object Editor 是逐代扩展自由度的三条主轴。✅
- [Nintendo 官方产品页](https://www.nintendo.com/en-gb/Games/Wii-U-games/Scribblenauts-Unlimited-701721.html)：在 Wii U 版本语境下进一步验证“帮助他人才能获得 Starite/Shards”的善意循环、开放世界作为个人游乐场、多答案式实验（简单或离谱的解法都可能有效），以及 Object Editor 对尺寸、物理属性和行为脚本的编辑范围。由于是 Wii U 页面，数字与平台专属功能不外推到 PC。✅
- [5th Cell 制作人访谈（Nintendo World Report）](https://www.nintendoworldreport.com/interview/31785/scribblenauts-unlimited)：补充确认开发者不会把“词条总数”当作唯一体验指标，而是强调数万词条、形容词组合、歧义词让玩家澄清，以及取消旧版预算计量器来支持持续实验；这是跨平台设计口径，不外推具体 PC 数字。✅
- [Nintendo 官方产品页](https://www.nintendo.com/en-gb/Games/Wii-U-games/Scribblenauts-Unlimited-701721.html)：明确列出 Object Editor 的颜色/纹理、部件移动、缩放、物理属性、行为脚本和命名能力；这使“创作所有权”应优先落在可观察的行为差异，而不是只扩充保存槽位。✅

### 本轮研究结论（对内容迭代的约束）

- **事实**：原版的目标分布在世界中，区域不是只容纳一组固定答案；制作人明确将“沙盒互动”变成全流程，并用多个分散目标承载探索。✅
- **事实**：原版内容的价值来自“任意物体/形容词组合”在任务情境中产生结果，而不是孤立词条数量；开发者还明确说歧义词应让玩家澄清，而非静默猜测。✅
- **事实**：官方产品页把“帮助他人才能得到 Starite/Shards”与“开放世界个人游乐场”放在同一体验描述里，说明碎片任务不是单纯收集 UI，而是开放探索的行为反馈。✅
- **推断**：当前项目新增内容的首选切片应是主题区域 + 多阶段挑战 + 多种合法召唤路径；复用现有词条/渲染器比无任务语境地扩充同义词更直接提升原版核心体验。💡
- **事实**：PC 成就口径把“带 3 个 Starite 给 Lily、解锁世界地图”“带 60 个 Starite 给 Lily”与“帮助 Maxwell 的 40 个兄弟”分成不同里程碑，不能用单一低门槛胜利替代完整主线。✅（[Steam 成就镜像](https://www.exophase.com/game/scribblenauts-unlimited-steam/achievements/)）
- **本轮实现结果**：当前项目已扩展到 41 个主区域、175 个 authored 挑战；直接奖励 109 Starite，叠加 217 个 Object Shard 兑换后可达 130 Starite，因此 60 Lily 阈值与 106 全收集目标都是可玩内容中的真实目标，而非仅改数字的不可达门槛。首关新增 Edwin 固定引导 NPC 与三阶段善意任务，回文星窟和句法站进一步补入可回返 overworld 与唯一挑战指纹。💡
- **本轮区域资产约束**：41 个主区域各自绑定唯一 `background` 与唯一 `bgm`；远板/近板资源不得跨区域复用，音乐由关卡键确定性生成独立旋律、和弦、节拍与配器，并由内容测试持续校验唯一性。✅

## 联网核验记录（2026-08-02，关卡内容迭代前复核）

- [Steam PC 商店页](https://store.steampowered.com/app/218680/scribblenauts-unlimited/?l=english)：官方产品文案把“seamless free-roaming levels”“summoning any object”“Object Creator”“Object Library”“Merit Board/Starite Vision”放在同一体验闭环，进一步支持“区域是游乐场、任务是分散反馈点”的内容判断。✅
- [5TH Cell 制作人访谈（Nintendo World Report）](https://www.nintendoworldreport.com/interview/31785/scribblenauts-unlimited-wii-u-interview-with-5th-cell)：一手明确把系列演进概括为召唤物体、形容词定制、Unlimited 的开放世界与 Object Editor，并强调数万词条与形容词组合的自由度；因此新增关卡应优先提供能被不同物体/形容词解决的情境，而不是只改 NPC 名称。✅
- [5TH Cell 访谈（Nintendojo）](https://www.nintendojo.com/features/interviews/interview-5th-cell)：制作人将新格式描述为“谜题 + 标题页沙盒”的结合，支持把重复进入关卡改造成可回返的开放区域，并让小任务成为探索过程的一部分。✅
- [PC 关卡 walkthrough](https://www.walkthroughking.com/text/scribblenautsunlimited.aspx)：二手关卡记录显示原版区域会把多个 Starite 任务与大量小碎片任务并置，任务语境横跨服务、修理、救援、表演、自然与恶作剧；它可用于校验内容密度与题材差异，但不作为原始设计意图的一手证据。🔶
- [Starite Shards 机制整理](https://scribblenauts.fandom.com/wiki/Starite_Shards)：补充确认普通碎片通常来自较小的帮助任务，10 个兑换完整 Starite；Object Shard 则是跨关、通过召唤/互动达成的另一类收集。🔶

### 本轮关卡迭代约束

- **事实**：开放区域与自包含多谜题关可以并存；前者承载探索中的短帮助任务，后者承载多阶段目标。✅
- **推断**：本项目不再机械增加同主题自包含关，而是优先加入可回返 overworld 区域；每个 authored challenge 必须拥有跨关唯一的条件指纹，并混用计数、区域、顺序、状态、规则结果或多答案条件。💡
- **非目标**：不新增 Nintendo 联名角色、不接入 Steam Workshop、不为追赶词条数字而生成脱离情境的对象。✅

## 联网核验记录（2026-08-02，穿戴关系复核）

- [Clothes Shards 机制整理](https://scribblenauts.fandom.com/wiki/Clothes_Shards)：原版服装不是 RPG 装备栏，而是可召唤、可附着到人物并产生行为差异的物体；资料列出弹簧鞋、香蕉服、雪鞋、救生衣、围裙等功能服装。🔶
- [原版服装分类](https://scribblenauts.fandom.com/wiki/Category%3ABody_Clothing)、[头部](https://scribblenauts.fandom.com/wiki/Category%3AHead_Clothing)、[脸部](https://scribblenauts.fandom.com/wiki/Bandit_Mask)、[脚部](https://scribblenauts.fandom.com/wiki/Category%3AFootwear)、[背部](https://scribblenauts.fandom.com/wiki/Category%3ADorsal_Clothing)：服装按身体部位组织，背部翅膀/背包、头部帽盔、脸部面具、身体服装、手部手套、腿部服装和脚部鞋类应作为独立关系理解。
- [List of suits](https://scribblenauts.fandom.com/wiki/List_of_suits)：全身套装会阻止其他服装同时生效，但不取代手持物关系；因此实现为 `full-body` 与其他穿戴部位互斥，hand/mount 独立保留。🔶
- [Jet Pack](https://scribblenauts.fandom.com/wiki/Jet_Pack)、[How to Fly](https://scribblenauts.fandom.com/wiki/How_to_Fly)、[Spring Shoes](https://scribblenauts.fandom.com/wiki/Spring_Shoes)：背部飞行装备和脚部跳跃装备是“穿戴位置 + 能力效果”的实例，不应由 UI 根据名称硬编码。

### 本轮实现结果

- **事实对齐**：当前项目保留 hand/back/mount 三类主动关系，并新增 face/head/body/hands/legs/feet/back/full-body 八个穿戴位；词条通过 `wearable` 元数据声明部位与 `fly`/`jump` 能力。
- **行为闭环**：PlayerController 负责同部位替换、全身套装冲突、附着锚点、碰撞过滤、渲染层、AI 接管标记、解除恢复和跨关清理；面板只读取快照并发出解除意图。
- **内容闭环**：已有帽子、面具、眼镜、鞋、手套、衣物、背包、翅膀等词条完成分类，并补充复用既有 `shoe`/`backpack` renderer 的 `spring-shoes` 与 `jetpack`，不新增美术路由。
