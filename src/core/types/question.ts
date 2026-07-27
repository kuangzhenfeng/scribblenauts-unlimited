/**
 * 题目类型 —— 题库驱动关卡的统一数据契约。
 *
 * 一个 Question 描述"玩家需要召唤什么物体来过关"的题目：
 * 单答案用 typeId + 可选形容词；多答案（情境题）用 answers 声明若干语义关联
 * 合格答案，任一即过关。双难度标注（CEFR / 词频）+ 双语故事化题面。
 *
 * 设计原则：
 * - 题目是纯数据，不含运行时逻辑；
 * - 难度双标注（cefr/freq）支持两种分档标准切换；
 * - 题面故事化（NPC 第一人称陈述困境/需求），不直白索物；
 * - 多答案题任一关联答案即过关，自由度高、挫败感低；
 * - 题目复用既有词条与形容词，不新增 sprite/物理/外观。
 *
 * 与 Challenge 的关系：Question 是题库层的静态题目定义；
 * QuestionPicker 在关卡加载时按难度抽题并装配为运行时 Challenge。
 */

/** 难度档：基础 / 进阶 / 大师 */
export type DifficultyTier = 1 | 2 | 3;

/** 难度分档标准：CEFR 等级 / 词频排名 */
export type DifficultyStandard = 'cefr' | 'frequency';

/**
 * 题目答案 —— 一个可接受的召唤物定义。
 *
 * 多答案题（情境题）用 answers: Answer[] 声明 2~6 个语义关联的合格答案，
 * 玩家召唤任一即过关；单答案题沿用 typeId + adjectives 快捷写法。
 */
export interface Answer {
  /** 目标词条 id（对应词典 DictEntry.id） */
  typeId: string;
  /** 形容词 id 列表（对应 AdjectiveEntry.id），可空 */
  adjectives?: string[];
}

/**
 * 题目。
 *
 * 两种写法：
 * - 单答案：用 typeId + adjectives（如组合题"红色的鸟"，adjectives=['red']）。
 * - 多答案：用 answers（如情境题"好冷"→ 火/燃烧的蜡烛/火把/灯），任一即过关。
 *
 * adjectives/answers 缺省即为纯名词单答案题。运行时 QuestionPicker 按是否有
 * answers 装配为 object-present 或 any-of；难度取所有相关词 id 的中位档（主体答案难度）。
 * cefr/freq 为该题在两种标准下的档位，运行时按玩家所选 standard 取对应字段。
 */
export interface Question {
  /** 全局唯一 id，如 'q-apple' / 'q-red-bird' / 'q-cold' */
  id: string;
  /** 单答案写法：目标词条 id（对应词典 DictEntry.id）；多答案题此字段可缺省 */
  typeId?: string;
  /** 单答案写法：形容词 id 列表（对应 AdjectiveEntry.id），可空 */
  adjectives?: string[];
  /** 多答案写法：2~6 个语义关联答案，任一即过关；有值时覆盖 typeId/adjectives */
  answers?: Answer[];
  /** CEFR 档：A1/A2=1，B1/B2=2，C1/C2=3 */
  cefr: DifficultyTier;
  /** 词频档：前5000=1，5000–20000=2，20000+=3 */
  freq: DifficultyTier;
  /** 题面：NPC 第一人称故事化需求陈述（如"好冷啊……能帮我弄点什么暖和的吗？"） */
  prompt: { zh: string; en: string };
  /** 操作提示（可选，如"（想想什么能帮到TA，召唤到身边）"） */
  hint?: { zh: string; en: string };
}
