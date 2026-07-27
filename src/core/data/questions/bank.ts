/**
 * 题库 —— 800+ 题目的静态定义与难度查询。
 *
 * 三层结构，全部故事化题面（NPC 第一人称陈述困境/需求，不直白索物）：
 *
 * A. 情境多答案题（situationalQuestions）：核心创新。NPC 陈述一个生活困境
 *    （"好冷""天黑""饿""渴""怪物挡路"…），不点名目标物体；answers 声明
 *    2~6 个语义关联的合格答案（同功能/同场景/同类），玩家召唤任一即过关。
 *    难度取所有 answer 词 id 的中位档（主体答案难度，非最高档）。
 *
 * B. 词条覆盖单答案题（nounQuestions）：由 allEntries() 全量派生，保证 538
 *    词条每个至少有一道题。题面套用 category 的故事化模板（第一人称情境
 *    + 点名目标词条），单答案 typeId。难度从 word-metadata 派生。
 *
 * C. 形容词组合题（comboQuestions）：手工精选 adj+noun 组合（颜色×物/
 *    行为×生物/状态×物/材质×物/size×物），题面故事化点名"形容词+名词"，
 *    单答案 typeId+adjectives，GoalSystem 形容词超集校验。
 *
 * 难度双标注（cefr/freq）从 word-metadata 派生，运行时按玩家所选 standard 过滤。
 */

import type { Question, DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { allEntries } from '@/core/data/dictionary/Dictionary';
import { getWordMeta } from './word-metadata';

/** 取多个词 id 的 CEFR 中位档（主体答案难度）；偶数个取中间两档平均后四舍五入 */
function medianTier(ids: string[]): DifficultyTier {
  const tiers = ids.map(id => getWordMeta(id).cefr).sort((a, b) => a - b);
  const n = tiers.length;
  if (n === 0) return 1;
  const mid = n % 2 === 1 ? tiers[(n - 1) / 2] : (tiers[n / 2 - 1] + tiers[n / 2]) / 2;
  return Math.round(mid) as DifficultyTier;
}
/** 取多个词 id 的词频中位档（主体答案难度）；偶数个取中间两档平均后四舍五入 */
function medianFreq(ids: string[]): DifficultyTier {
  const tiers = ids.map(id => getWordMeta(id).freq).sort((a, b) => a - b);
  const n = tiers.length;
  if (n === 0) return 1;
  const mid = n % 2 === 1 ? tiers[(n - 1) / 2] : (tiers[n / 2 - 1] + tiers[n / 2]) / 2;
  return Math.round(mid) as DifficultyTier;
}

/**
 * 基于种子字符串稳定选取模板数组中的一项。
 *
 * 同一种子永远命中同一模板，保证题面不随刷新/重载抖动；
 * 不同种子在数组上均匀散布，让同类词条题面多样化。
 * 纯哈希取模，无 Math.random 依赖。
 */
function pickTemplate<T>(tpls: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const len = tpls.length;
  return tpls[((h % len) + len) % len];
}

// ---- A. 情境多答案题 ----
//
// 每条为一个生活困境场景：NPC 第一人称陈述需求，不点名目标；answers 为
// 2~6 个语义关联合格答案，任一即过关。难度取所有 answer 词 id 的中位档（主体答案难度）。
// 覆盖食物/武器/工具/动物/元素/载具/光源/防具/容器/自然物等多类情境。

interface Scenario {
  /** 题 id 后缀（最终 id = `q-sit-${suffix}`，需全局唯一） */
  suffix: string;
  /** 双语故事化题面（NPC 第一人称困境陈述） */
  prompt: { zh: string; en: string };
  /** 双语操作提示（不列具体答案，引导玩家联想） */
  hint: { zh: string; en: string };
  /** 2~6 个语义关联答案 */
  answers: { typeId: string; adjectives?: string[] }[];
}

const scenarios: Scenario[] = [
  // ---- 温度困境 ----
  {
    suffix: 'cold-night',
    prompt: {
      zh: '呜……夜里冷得手指都僵了，能帮我弄点什么暖和暖和吗？',
      en: 'Brrr... my fingers are stiff with cold tonight. Can you get me something to warm up?',
    },
    hint: { zh: '（想想什么能带来暖意，召唤到TA身边）', en: '(think of something warm, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'candle', adjectives: ['burning'] },
      { typeId: 'torch' },
      { typeId: 'lamp' },
      { typeId: 'lantern' },
      { typeId: 'ember' },
    ],
  },
  {
    suffix: 'beating-heat',
    prompt: {
      zh: '这日头毒得要把人烤化了，有什么能让我凉快凉快吗？',
      en: 'The sun is melting me — anything to help me cool down?',
    },
    hint: { zh: '（想想什么能驱散酷热，召唤到TA身边）', en: '(think of something cooling, summon it near)' },
    answers: [
      { typeId: 'fan' },
      { typeId: 'water' },
      { typeId: 'ice' },
      { typeId: 'snow' },
      { typeId: 'rain' },
      { typeId: 'wind' },
    ],
  },

  // ---- 饥渴困境 ----
  {
    suffix: 'starving',
    prompt: {
      zh: '肚子饿得咕咕直叫，能给我弄点吃的吗？什么都行！',
      en: 'My stomach is growling — can you get me something to eat? Anything!',
    },
    hint: { zh: '（想想什么能填饱肚子，召唤到TA身边）', en: '(think of something edible, summon it near)' },
    answers: [
      { typeId: 'apple' },
      { typeId: 'bread' },
      { typeId: 'meat' },
      { typeId: 'cake' },
      { typeId: 'cookie' },
      { typeId: 'cheese' },
    ],
  },
  {
    suffix: 'parched',
    prompt: {
      zh: '嗓子干得冒烟，渴死我了……能弄点喝的吗？',
      en: 'My throat is parched — I am dying of thirst. Can you get me something to drink?',
    },
    hint: { zh: '（想想什么能解渴，召唤到TA身边）', en: '(think of something drinkable, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'juice' },
      { typeId: 'tea' },
      { typeId: 'coffee' },
      { typeId: 'milk' },
      { typeId: 'water-food' },
    ],
  },
  {
    suffix: 'sweet-tooth',
    prompt: {
      zh: '嘴里总没滋味，馋点甜的……能帮我找点甜食吗？',
      en: 'I have a craving for something sweet — can you find me a treat?',
    },
    hint: { zh: '（想想什么又是甜又是吃的，召唤到TA身边）', en: '(think of something sweet, summon it near)' },
    answers: [
      { typeId: 'candy' },
      { typeId: 'chocolate' },
      { typeId: 'honey' },
      { typeId: 'jam' },
      { typeId: 'cookie' },
      { typeId: 'cake' },
    ],
  },
  {
    suffix: 'fruit-craving',
    prompt: {
      zh: '好想吃口新鲜水果，嘴里淡出鸟来了……能给我弄点吗？',
      en: 'I am dying for some fresh fruit — can you get me any?',
    },
    hint: { zh: '（想想什么长在树上、又是水果，召唤到TA身边）', en: '(think of a fruit, summon it near)' },
    answers: [
      { typeId: 'apple' },
      { typeId: 'banana' },
      { typeId: 'orange-fruit' },
      { typeId: 'grape' },
      { typeId: 'cherry' },
      { typeId: 'pear' },
    ],
  },

  // ---- 光照困境 ----
  {
    suffix: 'lost-in-dark',
    prompt: {
      zh: '天黑得伸手不见五指，我连路都看不清了……能帮我弄点亮光吗？',
      en: 'It is pitch black — I cannot see the road. Can you bring me some light?',
    },
    hint: { zh: '（想想什么能发光照亮，召唤到TA身边）', en: '(think of a light source, summon it near)' },
    answers: [
      { typeId: 'lamp' },
      { typeId: 'candle' },
      { typeId: 'torch' },
      { typeId: 'lantern' },
      { typeId: 'light' },
      { typeId: 'fire' },
    ],
  },
  {
    suffix: 'signal-fire',
    prompt: {
      zh: '我在这荒野里迷了路，得弄点什么升空好让人瞧见来救我……',
      en: 'I am lost in this wilderness — I need something to signal for rescue...',
    },
    hint: { zh: '（想想什么能升空发信号，召唤到TA身边）', en: '(think of something that flies or signals, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'torch' },
      { typeId: 'balloon-hot' },
      { typeId: 'rocket' },
      { typeId: 'smoke' },
      { typeId: 'lightning' },
    ],
  },

  // ---- 危险困境 ----
  {
    suffix: 'monster-block',
    prompt: {
      zh: '前面有头怪物挡着路！我得找样家伙防身……',
      en: 'A monster is blocking the road! I need a weapon to defend myself...',
    },
    hint: { zh: '（想想什么能当武器防身，召唤到TA身边）', en: '(think of a weapon, summon it near)' },
    answers: [
      { typeId: 'sword' },
      { typeId: 'bow' },
      { typeId: 'spear' },
      { typeId: 'axe' },
      { typeId: 'gun' },
      { typeId: 'bomb' },
    ],
  },
  {
    suffix: 'beast-attack',
    prompt: {
      zh: '林子里有野兽冲我龇牙！快给我弄样能打退它的家伙！',
      en: 'A beast in the woods is baring its teeth at me! Get me something to fight it off!',
    },
    hint: { zh: '（想想什么能击退野兽，召唤到TA身边）', en: '(think of something to repel a beast, summon it near)' },
    answers: [
      { typeId: 'sword' },
      { typeId: 'knife' },
      { typeId: 'arrow' },
      { typeId: 'shield' },
      { typeId: 'mace' },
      { typeId: 'fire' },
    ],
  },
  {
    suffix: 'shield-needed',
    prompt: {
      zh: '箭矢从四面飞来！我得找样东西挡一挡……',
      en: 'Arrows are raining down! I need something to shield myself...',
    },
    hint: { zh: '（想想什么能挡住攻击，召唤到TA身边）', en: '(think of something to block with, summon it near)' },
    answers: [
      { typeId: 'shield' },
      { typeId: 'armor' },
      { typeId: 'helmet' },
      { typeId: 'door' },
      { typeId: 'box' },
      { typeId: 'stone' },
    ],
  },

  // ---- 赶路困境 ----
  {
    suffix: 'long-journey',
    prompt: {
      zh: '路太远了，靠这两条腿走到天黑也到不了……能给我弄样代步的吗？',
      en: 'The road is too far to walk — can you get me something to ride?',
    },
    hint: { zh: '（想想什么能载人赶路，召唤到TA身边）', en: '(think of a ride, summon it near)' },
    answers: [
      { typeId: 'car' },
      { typeId: 'bicycle' },
      { typeId: 'horse' },
      { typeId: 'carriage' },
      { typeId: 'bus' },
      { typeId: 'motorcycle' },
    ],
  },
  {
    suffix: 'cross-river',
    prompt: {
      zh: '河水湍急，我过不去……能帮我弄样能浮在水上的东西吗？',
      en: 'The river is too swift to wade — can you get me something that floats?',
    },
    hint: { zh: '（想想什么能渡水，召唤到TA身边）', en: '(think of something to cross water, summon it near)' },
    answers: [
      { typeId: 'boat' },
      { typeId: 'raft' },
      { typeId: 'bridge' },
      { typeId: 'submarine' },
      { typeId: 'log' },
      { typeId: 'wood' },
    ],
  },
  {
    suffix: 'need-to-fly',
    prompt: {
      zh: '悬崖太高下不去，要是能飞过去就好了……能帮我弄样能上天的吗？',
      en: 'The cliff is too high — if only I could fly across. Can you get me something that flies?',
    },
    hint: { zh: '（想想什么能载人升空，召唤到TA身边）', en: '(think of something that flies, summon it near)' },
    answers: [
      { typeId: 'plane' },
      { typeId: 'helicopter' },
      { typeId: 'rocket' },
      { typeId: 'balloon-hot' },
      { typeId: 'ufo' },
      { typeId: 'pegasus' },
    ],
  },

  // ---- 工具困境 ----
  {
    suffix: 'cut-rope',
    prompt: {
      zh: '我被绳子捆住了！快给我弄样能把绳子弄断的东西！',
      en: 'I am tied up with rope! Get me something to cut it!',
    },
    hint: { zh: '（想想什么能割断绳索，召唤到TA身边）', en: '(think of something sharp, summon it near)' },
    answers: [
      { typeId: 'knife' },
      { typeId: 'sword' },
      { typeId: 'axe' },
      { typeId: 'saw' },
      { typeId: 'dagger' },
      { typeId: 'scissors' },
    ],
  },
  {
    suffix: 'break-rock',
    prompt: {
      zh: '这块大石头堵死路了，得弄样家伙把它凿开……',
      en: 'This boulder blocks the way — I need something to break it apart...',
    },
    hint: { zh: '（想想什么能碎石开路，召唤到TA身边）', en: '(think of something to break rock, summon it near)' },
    answers: [
      { typeId: 'pickaxe' },
      { typeId: 'hammer' },
      { typeId: 'chisel' },
      { typeId: 'dynamite' },
      { typeId: 'tnt' },
      { typeId: 'bomb' },
    ],
  },
  {
    suffix: 'dig-hole',
    prompt: {
      zh: '得在这挖个坑埋东西，可手里没家伙……能给我弄样能挖土的吗？',
      en: 'I need to dig a hole here but have no tool — can you get me something to dig with?',
    },
    hint: { zh: '（想想什么能掘土，召唤到TA身边）', en: '(think of a digging tool, summon it near)' },
    answers: [
      { typeId: 'shovel' },
      { typeId: 'trowel' },
      { typeId: 'pickaxe' },
      { typeId: 'shovel' },
      { typeId: 'saw' },
      { typeId: 'drill' },
    ],
  },
  {
    suffix: 'reach-high',
    prompt: {
      zh: '树上的果子够不着……能给我弄样能爬高的东西吗？',
      en: 'I cannot reach the fruit up the tree — can you get me something to climb?',
    },
    hint: { zh: '（想想什么能助人攀高，召唤到TA身边）', en: '(think of something to climb, summon it near)' },
    answers: [
      { typeId: 'ladder' },
      { typeId: 'stairs' },
      { typeId: 'rope' },
      { typeId: 'chain' },
      { typeId: 'vine' },
      { typeId: 'elevator' },
    ],
  },
  {
    suffix: 'open-crate',
    prompt: {
      zh: '这箱子死活撬不开……能给我弄样能撬开它的工具吗？',
      en: 'I cannot pry this crate open — can you get me a tool to lever it?',
    },
    hint: { zh: '（想想什么能撬开容器，召唤到TA身边）', en: '(think of a prying tool, summon it near)' },
    answers: [
      { typeId: 'hammer' },
      { typeId: 'hammer' },
      { typeId: 'axe' },
      { typeId: 'saw' },
      { typeId: 'chisel' },
      { typeId: 'screwdriver' },
    ],
  },

  // ---- 收纳困境 ----
  {
    suffix: 'carry-goods',
    prompt: {
      zh: '这些东西我两手抱不下，能给我弄样能装能扛的吗？',
      en: 'I cannot carry all this in my arms — can you get me something to hold it?',
    },
    hint: { zh: '（想想什么能装运物品，召唤到TA身边）', en: '(think of a container, summon it near)' },
    answers: [
      { typeId: 'box' },
      { typeId: 'basket' },
      { typeId: 'barrel' },
      { typeId: 'bucket' },
      { typeId: 'crate' },
      { typeId: 'suitcase' },
    ],
  },
  {
    suffix: 'store-treasure',
    prompt: {
      zh: '这些宝贝可不能丢了，得找样东西把它们锁起来藏好……',
      en: 'I cannot lose these treasures — I need something to lock them away...',
    },
    hint: { zh: '（想想什么能上锁藏物，召唤到TA身边）', en: '(think of a lockable container, summon it near)' },
    answers: [
      { typeId: 'chest' },
      { typeId: 'cupboard' },
      { typeId: 'wardrobe' },
      { typeId: 'drawer' },
      { typeId: 'shelf' },
      { typeId: 'coffin' },
    ],
  },

  // ---- 自然/环境困境 ----
  {
    suffix: 'green-yard',
    prompt: {
      zh: '院子里光秃秃的太难看，能帮我弄点花草树木点缀点缀吗？',
      en: 'The yard is too bare — can you get me some plants to liven it up?',
    },
    hint: { zh: '（想想什么是花草树木，召唤到TA身边）', en: '(think of a plant, summon it near)' },
    answers: [
      { typeId: 'tree' },
      { typeId: 'flower' },
      { typeId: 'bush' },
      { typeId: 'rose' },
      { typeId: 'sunflower' },
      { typeId: 'pine' },
    ],
  },
  {
    suffix: 'shelter-storm',
    prompt: {
      zh: '暴风雨要来了！我得找样东西挡挡风遮遮雨……',
      en: 'A storm is coming! I need something to shelter from the rain...',
    },
    hint: { zh: '（想想什么能遮风挡雨，召唤到TA身边）', en: '(think of a shelter, summon it near)' },
    answers: [
      { typeId: 'tent' },
      { typeId: 'cottage' },
      { typeId: 'umbrella-rain' },
      { typeId: 'umbrella' },
      { typeId: 'coat' },
      { typeId: 'door' },
    ],
  },
  {
    suffix: 'put-out-fire',
    prompt: {
      zh: '着火啦！快给我弄样能灭火的东西！',
      en: 'Fire! Get me something to put it out!',
    },
    hint: { zh: '（想想什么能克火，召唤到TA身边）', en: '(think of something to quench fire, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'ice' },
      { typeId: 'snow' },
      { typeId: 'rain' },
      { typeId: 'sand' },
      { typeId: 'mist' },
    ],
  },
  {
    suffix: 'need-wood',
    prompt: {
      zh: '我要生火搭棚子，可手里没木头……能给我弄点木料吗？',
      en: 'I need to build a fire and a shelter but have no wood — can you get me some?',
    },
    hint: { zh: '（想想什么能当木料，召唤到TA身边）', en: '(think of something wooden, summon it near)' },
    answers: [
      { typeId: 'wood' },
      { typeId: 'log' },
      { typeId: 'tree' },
      { typeId: 'wood' },
      { typeId: 'barrel' },
      { typeId: 'box' },
    ],
  },

  // ---- 伙伴/生物困境 ----
  {
    suffix: 'lonely-child',
    prompt: {
      zh: '女儿一个人在家怪孤单的，能给她弄个伴儿吗？什么活的小家伙都行。',
      en: 'My daughter is lonely at home — can you get her a little companion? Any living thing.',
    },
    hint: { zh: '（想想什么能当宠物伙伴，召唤到TA身边）', en: '(think of a pet, summon it near)' },
    answers: [
      { typeId: 'dog' },
      { typeId: 'cat' },
      { typeId: 'rabbit' },
      { typeId: 'bird' },
      { typeId: 'hamster' },
      { typeId: 'fish' },
    ],
  },
  {
    suffix: 'guard-home',
    prompt: {
      zh: '夜里老丢东西，我想养个能看家护院的……能帮我弄一只吗？',
      en: 'Things keep going missing at night — I want a guard animal. Can you get me one?',
    },
    hint: { zh: '（想想什么能看家，召唤到TA身边）', en: '(think of a guard animal, summon it near)' },
    answers: [
      { typeId: 'dog' },
      { typeId: 'wolf' },
      { typeId: 'bear' },
      { typeId: 'tiger' },
      { typeId: 'lion' },
      { typeId: 'eagle' },
    ],
  },
  {
    suffix: 'catch-mouse',
    prompt: {
      zh: '屋里老鼠闹得凶！能给我弄个会抓老鼠的来吗？',
      en: 'Mice are running rampant in the house! Can you get me something that catches mice?',
    },
    hint: { zh: '（想想什么会捉老鼠，召唤到TA身边）', en: '(think of a mouser, summon it near)' },
    answers: [
      { typeId: 'cat' },
      { typeId: 'snake' },
      { typeId: 'owl' },
      { typeId: 'fox' },
      { typeId: 'dog' },
    ],
  },
  {
    suffix: 'plow-field',
    prompt: {
      zh: '春耕了，地里还得拉犁，能给我弄头能干活的牲口吗？',
      en: 'It is plowing season — can you get me a draft animal to pull the plow?',
    },
    hint: { zh: '（想想什么能拉犁耕地，召唤到TA身边）', en: '(think of a draft animal, summon it near)' },
    answers: [
      { typeId: 'cow' },
      { typeId: 'horse' },
      { typeId: 'donkey' },
      { typeId: 'mule' },
      { typeId: 'cow' },
      { typeId: 'camel' },
    ],
  },

  // ---- 渔猎困境 ----
  {
    suffix: 'go-fishing',
    prompt: {
      zh: '我想去河边钓几条鱼，可手里没家伙……能给我弄样能钓鱼的吗？',
      en: 'I want to fish by the river but have no gear — can you get me something to fish with?',
    },
    hint: { zh: '（想想什么能钓鱼，召唤到TA身边）', en: '(think of fishing gear, summon it near)' },
    answers: [
      { typeId: 'fishingrod' },
      { typeId: 'net' },
      { typeId: 'worm' },
      { typeId: 'shrimp' },
      { typeId: 'fish' },
      { typeId: 'boat' },
    ],
  },
  {
    suffix: 'hunt-game',
    prompt: {
      zh: '冬天没存粮了，我想上山打猎……能给我弄样能猎兽的吗？',
      en: 'Winter stores are low — I want to hunt. Can you get me something to hunt with?',
    },
    hint: { zh: '（想想什么能猎兽，召唤到TA身边）', en: '(think of hunting gear, summon it near)' },
    answers: [
      { typeId: 'bow' },
      { typeId: 'gun' },
      { typeId: 'spear' },
      { typeId: 'crossbow' },
      { typeId: 'arrow' },
      { typeId: 'knife' },
    ],
  },

  // ---- 衣物困境 ----
  {
    suffix: 'need-coat',
    prompt: {
      zh: '出门才发觉忘了带外套，风直往脖子里灌……能给我弄件御寒的吗？',
      en: 'I stepped out without a coat and the wind is biting — can you get me something to keep warm?',
    },
    hint: { zh: '（想想什么能穿在身上御寒，召唤到TA身边）', en: '(think of warm clothing, summon it near)' },
    answers: [
      { typeId: 'coat' },
      { typeId: 'robe' },
      { typeId: 'shirt' },
      { typeId: 'pants' },
      { typeId: 'scarf' },
      { typeId: 'boot' },
    ],
  },
  {
    suffix: 'rainy-day',
    prompt: {
      zh: '说下雨就下雨，我可不想淋成落汤鸡……能给我弄样挡雨的吗？',
      en: 'It just started pouring — I do not want to get soaked. Can you get me something for the rain?',
    },
    hint: { zh: '（想想什么能挡雨，召唤到TA身边）', en: '(think of rain gear, summon it near)' },
    answers: [
      { typeId: 'umbrella-rain' },
      { typeId: 'umbrella' },
      { typeId: 'coat' },
      { typeId: 'hat-top' },
      { typeId: 'boot' },
      { typeId: 'tent' },
    ],
  },

  // ---- 家居困境 ----
  {
    suffix: 'need-seat',
    prompt: {
      zh: '站了一整天腿都酸了，真想找样东西坐下歇歇……',
      en: 'I have been standing all day — I just want something to sit on...',
    },
    hint: { zh: '（想想什么能坐，召唤到TA身边）', en: '(think of something to sit on, summon it near)' },
    answers: [
      { typeId: 'chair' },
      { typeId: 'couch' },
      { typeId: 'bed' },
      { typeId: 'chair' },
      { typeId: 'box' },
      { typeId: 'stone' },
    ],
  },
  {
    suffix: 'need-rest',
    prompt: {
      zh: '困得眼皮直打架，可这荒郊野岭的……能给我弄样能躺下睡一觉的吗？',
      en: 'I can barely keep my eyes open, but I am in the middle of nowhere — can you get me something to sleep on?',
    },
    hint: { zh: '（想想什么能躺卧休息，召唤到TA身边）', en: '(think of something to sleep on, summon it near)' },
    answers: [
      { typeId: 'bed' },
      { typeId: 'couch' },
      { typeId: 'pillow' },
      { typeId: 'rug' },
      { typeId: 'tent' },
      { typeId: 'bed' },
    ],
  },
  {
    suffix: 'read-by-night',
    prompt: {
      zh: '这书太好看了放不下，可天黑了看不清字……能给我弄样能照亮书页的吗？',
      en: 'This book is too good to put down, but it is dark — can you get me something to read by?',
    },
    hint: { zh: '（想想什么能照亮书本，召唤到TA身边）', en: '(think of a reading light, summon it near)' },
    answers: [
      { typeId: 'lamp' },
      { typeId: 'candle' },
      { typeId: 'torch' },
      { typeId: 'lantern' },
      { typeId: 'clamp-lamp' },
      { typeId: 'light' },
    ],
  },
  {
    suffix: 'tell-time',
    prompt: {
      zh: '我总把握不准时辰，能给我弄样能看时间的东西吗？',
      en: 'I can never tell the time — can you get me something to track it?',
    },
    hint: { zh: '（想想什么能计时，召唤到TA身边）', en: '(think of a timepiece, summon it near)' },
    answers: [
      { typeId: 'clock' },
      { typeId: 'watch' },
      { typeId: 'phone' },
      { typeId: 'radio' },
      { typeId: 'computer' },
    ],
  },

  // ---- 魔法/神秘困境 ----
  {
    suffix: 'summon-sage',
    prompt: {
      zh: '老朽钻研的咒语还差样法器才能成……能帮我寻件有灵力的物件吗？',
      en: 'My spell lacks a focus to complete — can you find me something with mystical power?',
    },
    hint: { zh: '（想想什么能当法器，召唤到TA身边）', en: '(think of a magical focus, summon it near)' },
    answers: [
      { typeId: 'wand' },
      { typeId: 'crystal-ball' },
      { typeId: 'amulet' },
      { typeId: 'totem-mini' },
      { typeId: 'staff-weapon' },
      { typeId: 'scroll' },
    ],
  },
  {
    suffix: 'break-curse',
    prompt: {
      zh: '我这身子被咒了好些年……听说样样圣物能破咒，能帮我寻一件吗？',
      en: 'I have been cursed for years — they say holy objects can break it. Can you find me one?',
    },
    hint: { zh: '（想想什么能破咒，召唤到TA身边）', en: '(think of something to break a curse, summon it near)' },
    answers: [
      { typeId: 'amulet' },
      { typeId: 'potion' },
      { typeId: 'crystal-shard' },
      { typeId: 'totem-mini' },
      { typeId: 'scroll' },
      { typeId: 'altar' },
    ],
  },
  {
    suffix: 'need-treasure',
    prompt: {
      zh: '国王让我献上一样稀世珍宝才肯放人……能帮我弄件值钱的宝物吗？',
      en: 'The king demands a rare treasure before he releases me — can you get me something precious?',
    },
    hint: { zh: '（想想什么又是宝又是值钱，召唤到TA身边）', en: '(think of a treasure, summon it near)' },
    answers: [
      { typeId: 'gem' },
      { typeId: 'diamond' },
      { typeId: 'pearl' },
      { typeId: 'crown' },
      { typeId: 'scepter' },
      { typeId: 'trophy' },
    ],
  },

  // ---- 艺术/装饰困境 ----
  {
    suffix: 'adorn-wall',
    prompt: {
      zh: '这面墙光秃秃的真没味，能给我弄样能挂上墙点缀的吗？',
      en: 'This wall is so bare — can you get me something to hang and decorate it?',
    },
    hint: { zh: '（想想什么能挂墙装饰，召唤到TA身边）', en: '(think of wall decor, summon it near)' },
    answers: [
      { typeId: 'painting' },
      { typeId: 'poster' },
      { typeId: 'frame' },
      { typeId: 'mirror' },
      { typeId: 'sculpture' },
      { typeId: 'clock' },
    ],
  },
  {
    suffix: 'beautify-table',
    prompt: {
      zh: '桌上空落落的，能给我弄点什么摆上去好看吗？',
      en: 'The table is too empty — can you get me something to display on it?',
    },
    hint: { zh: '（想想什么能摆桌观赏，召唤到TA身边）', en: '(think of table decor, summon it near)' },
    answers: [
      { typeId: 'vase' },
      { typeId: 'flower' },
      { typeId: 'rose' },
      { typeId: 'sculpture' },
      { typeId: 'trophy' },
      { typeId: 'candle' },
    ],
  },

  // ---- 通讯/信息困境 ----
  {
    suffix: 'send-message',
    prompt: {
      zh: '我得给远方的人捎个信儿，可没人替我跑腿……能给我弄样能传信的吗？',
      en: 'I need to send word afar but have no one to run it — can you get me something to send a message?',
    },
    hint: { zh: '（想想什么能传讯，召唤到TA身边）', en: '(think of something to send word, summon it near)' },
    answers: [
      { typeId: 'phone' },
      { typeId: 'radio' },
      { typeId: 'computer' },
      { typeId: 'paper' },
      { typeId: 'bird' },
      { typeId: 'boat' },
    ],
  },
  {
    suffix: 'lost-way',
    prompt: {
      zh: '我在这林子里转了三天也找不到北……能给我弄样能指路的吗？',
      en: 'I have wandered this forest for three days — can you get me something to show the way?',
    },
    hint: { zh: '（想想什么能指引方向，召唤到TA身边）', en: '(think of a wayfinder, summon it near)' },
    answers: [
      { typeId: 'compass-tool' },
      { typeId: 'scroll' },
      { typeId: 'sign' },
      { typeId: 'torch' },
      { typeId: 'light' },
      { typeId: 'phone' },
    ],
  },

  // ---- 健康/伤病困境 ----
  {
    suffix: 'wounded',
    prompt: {
      zh: '我伤得厉害，血流不止……能给我弄样能救伤救命的东西吗？',
      en: 'I am badly wounded and bleeding — can you get me something to heal me?',
    },
    hint: { zh: '（想想什么能疗伤救命，召唤到TA身边）', en: '(think of a remedy, summon it near)' },
    answers: [
      { typeId: 'potion' },
      { typeId: 'scroll' },
      { typeId: 'amulet' },
      { typeId: 'crystal-shard' },
      { typeId: 'honey' },
      { typeId: 'totem-mini' },
    ],
  },
  {
    suffix: 'fever-chill',
    prompt: {
      zh: '烧得我浑身滚烫直打摆子……能给我弄点什么让我退烧发汗的吗？',
      en: 'I am burning with fever and shaking — can you get me something to break the fever?',
    },
    hint: { zh: '（想想什么能解热退烧，召唤到TA身边）', en: '(think of a fever remedy, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'ice' },
      { typeId: 'snow' },
      { typeId: 'potion' },
      { typeId: 'tea' },
      { typeId: 'soup' },
    ],
  },

  // ---- 工艺/制作困境 ----
  {
    suffix: 'forge-weapon',
    prompt: {
      zh: '铁匠铺还缺样打铁的家伙，能帮我寻来吗？',
      en: 'My smithy is short a tool for working iron — can you find me one?',
    },
    hint: { zh: '（想想什么能锻铁，召唤到TA身边）', en: '(think of a smithing tool, summon it near)' },
    answers: [
      { typeId: 'hammer' },
      { typeId: 'anvil' },
      { typeId: 'bellows' },
      { typeId: 'whetstone' },
      { typeId: 'pliers' },
      { typeId: 'chisel' },
    ],
  },
  {
    suffix: 'sew-cloth',
    prompt: {
      zh: '我想给女儿缝件衣裳，可手里没家伙……能给我弄样能缝衣的吗？',
      en: 'I want to sew a dress for my daughter but have no tools — can you get me something to sew with?',
    },
    hint: { zh: '（想想什么能缝衣，召唤到TA身边）', en: '(think of a sewing tool, summon it near)' },
    answers: [
      { typeId: 'needle' },
      { typeId: 'thread' },
      { typeId: 'scissors' },
      { typeId: 'spool' },
      { typeId: 'loom' },
      { typeId: 'robe' },
    ],
  },
  {
    suffix: 'measure-up',
    prompt: {
      zh: '要锯木头做家具，可手里没样能量尺寸的……能给我弄样吗？',
      en: 'I need to saw wood for furniture but have nothing to measure with — can you get me something?',
    },
    hint: { zh: '（想想什么能量尺寸，召唤到TA身边）', en: '(think of a measuring tool, summon it near)' },
    answers: [
      { typeId: 'ruler' },
      { typeId: 'level' },
      { typeId: 'compass-tool' },
      { typeId: 'chain' },
      { typeId: 'thread' },
    ],
  },

  // ---- 元素/炼金困境 ----
  {
    suffix: 'alchemy-fire',
    prompt: {
      zh: '炼金炉里还差一样火属的原料，这炉子就点不着……能帮我搜集吗？',
      en: 'My alchemy furnace lacks a fire-aspect reagent — it will not ignite. Can you gather one?',
    },
    hint: { zh: '（想想什么属火，召唤到TA身边）', en: '(think of something fiery, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'ember' },
      { typeId: 'lava' },
      { typeId: 'magma' },
      { typeId: 'spark' },
      { typeId: 'coal' },
    ],
  },
  {
    suffix: 'alchemy-water',
    prompt: {
      zh: '这剂药还差一样水属的引子，能帮我弄点吗？',
      en: 'This draught still needs a water-aspect reagent — can you get me some?',
    },
    hint: { zh: '（想想什么属水，召唤到TA身边）', en: '(think of something watery, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'ice' },
      { typeId: 'snow' },
      { typeId: 'rain' },
      { typeId: 'mist' },
      { typeId: 'frost' },
    ],
  },
  {
    suffix: 'alchemy-earth',
    prompt: {
      zh: '法阵还差一样土属的材料才能成……能帮我弄点吗？',
      en: 'My circle still needs an earth-aspect material to complete — can you get me some?',
    },
    hint: { zh: '（想想什么属土石，召唤到TA身边）', en: '(think of something earthy, summon it near)' },
    answers: [
      { typeId: 'stone' },
      { typeId: 'sand' },
      { typeId: 'clay' },
      { typeId: 'ore' },
      { typeId: 'coal' },
      { typeId: 'crystal' },
    ],
  },
  {
    suffix: 'alchemy-air',
    prompt: {
      zh: '这阵法要一样属风的东西才灵动……能帮我弄点吗？',
      en: 'This spell needs something airy to give it motion — can you get me some?',
    },
    hint: { zh: '（想想什么属风，召唤到TA身边）', en: '(think of something airy, summon it near)' },
    answers: [
      { typeId: 'wind' },
      { typeId: 'cloud-element' },
      { typeId: 'mist' },
      { typeId: 'fan' },
      { typeId: 'bird' },
      { typeId: 'balloon' },
    ],
  },

  // ---- 温度/气候困境（扩展）----
  {
    suffix: 'freezing-river',
    prompt: {
      zh: '刚蹚过那条冰河，腿脚都没知觉了……能帮我弄点什么回暖的吗？',
      en: 'I just waded through that icy river and cannot feel my legs — can you get me something to warm back up?',
    },
    hint: { zh: '（想想什么能驱寒回暖，召唤到TA身边）', en: '(think of something warming, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'ember' },
      { typeId: 'torch' },
      { typeId: 'lamp' },
      { typeId: 'soup' },
      { typeId: 'tea' },
    ],
  },
  {
    suffix: 'snowed-in',
    prompt: {
      zh: '一夜大雪把门堵得死死的，出不去也进不来……能帮我弄样能开路的吗？',
      en: 'Snow piled so high overnight the door is buried shut — can you get me something to dig out?',
    },
    hint: { zh: '（想想什么能铲雪破冰，召唤到TA身边）', en: '(think of something to clear snow, summon it near)' },
    answers: [
      { typeId: 'shovel' },
      { typeId: 'pickaxe' },
      { typeId: 'hammer' },
      { typeId: 'fire' },
      { typeId: 'lava' },
    ],
  },
  {
    suffix: 'dry-air',
    prompt: {
      zh: '这屋里干得嗓子都要裂了，鼻血直淌……能帮我弄点能润润空气的吗？',
      en: 'The air in here is so dry my throat cracks and my nose bleeds — can you get me something to moisten it?',
    },
    hint: { zh: '（想想什么能增湿润燥，召唤到TA身边）', en: '(think of something moist, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'mist' },
      { typeId: 'rain' },
      { typeId: 'cloud-element' },
      { typeId: 'dew' },
    ],
  },

  // ---- 饥渴/饮食困境（扩展）----
  {
    suffix: 'breakfast',
    prompt: {
      zh: '一大早空着肚就得出门，可没东西垫底连路都走不动……能给我弄点早饭吗？',
      en: 'I have to leave on an empty stomach and cannot even walk — can you get me some breakfast?',
    },
    hint: { zh: '（想想什么能当早餐，召唤到TA身边）', en: '(think of a breakfast food, summon it near)' },
    answers: [
      { typeId: 'bread' },
      { typeId: 'egg' },
      { typeId: 'milk' },
      { typeId: 'coffee' },
      { typeId: 'cheese' },
    ],
  },
  {
    suffix: 'picnic',
    prompt: {
      zh: '说好带孩子们去野餐，可篮子还是空的……能帮我弄点能带出门吃的吗？',
      en: 'I promised the children a picnic but the basket is empty — can you get me something to bring along?',
    },
    hint: { zh: '（想想什么能野餐果腹，召唤到TA身边）', en: '(think of picnic food, summon it near)' },
    answers: [
      { typeId: 'bread' },
      { typeId: 'cheese' },
      { typeId: 'apple' },
      { typeId: 'water-food' },
      { typeId: 'cake' },
      { typeId: 'cookie' },
    ],
  },
  {
    suffix: 'feast',
    prompt: {
      zh: '今儿家里办大事，桌上总不能寒碜……能帮我弄点能撑席面的硬菜好酒吗？',
      en: 'We are hosting a big occasion tonight — the table cannot look poor. Can you get me some hearty fare?',
    },
    hint: { zh: '（想想什么能上席面，召唤到TA身边）', en: '(think of feast fare, summon it near)' },
    answers: [
      { typeId: 'meat' },
      { typeId: 'fish' },
      { typeId: 'chicken' },
      { typeId: 'soup' },
      { typeId: 'pie' },
      { typeId: 'wine' },
    ],
  },
  {
    suffix: 'child-thirsty',
    prompt: {
      zh: '小崽子跑了一头汗回来，嚷着渴得不行……能给我弄点能给他喝的吗？',
      en: 'The little one came back drenched in sweat, wailing for a drink — can you get me something for him?',
    },
    hint: { zh: '（想想什么能给孩子解渴，召唤到TA身边）', en: '(think of a child\'s drink, summon it near)' },
    answers: [
      { typeId: 'juice' },
      { typeId: 'milk' },
      { typeId: 'water' },
      { typeId: 'tea' },
      { typeId: 'coconut' },
    ],
  },
  {
    suffix: 'seafood-craving',
    prompt: {
      zh: '住在海边却好久没沾过海味了，馋得心里发慌……能给我弄点海鲜吗？',
      en: 'I live by the sea but have not tasted any seafood in ages — can you get me some?',
    },
    hint: { zh: '（想想什么又是海里又是能吃的，召唤到TA身边）', en: '(think of seafood, summon it near)' },
    answers: [
      { typeId: 'fish' },
      { typeId: 'shrimp' },
      { typeId: 'crab' },
      { typeId: 'lobster' },
      { typeId: 'oyster' },
      { typeId: 'clam' },
    ],
  },
  {
    suffix: 'meat-craving',
    prompt: {
      zh: '嘴里淡出鸟来，就想大口啃点肉……能给我弄点荤腥吗？',
      en: 'I am craving something hearty — I just want to sink my teeth into meat. Can you get me some?',
    },
    hint: { zh: '（想想什么又是肉又是能吃的，召唤到TA身边）', en: '(think of meat, summon it near)' },
    answers: [
      { typeId: 'meat' },
      { typeId: 'fish' },
      { typeId: 'chicken' },
      { typeId: 'duck' },
      { typeId: 'goose' },
    ],
  },
  {
    suffix: 'bake-cake',
    prompt: {
      zh: '想给娘亲亲手烤个寿桃糕，可料不全……能帮我弄点烘焙要用的东西吗？',
      en: 'I want to bake a cake for my mother myself but lack the ingredients — can you get me something for baking?',
    },
    hint: { zh: '（想想什么能入糕饼，召唤到TA身边）', en: '(think of a baking ingredient, summon it near)' },
    answers: [
      { typeId: 'egg' },
      { typeId: 'butter' },
      { typeId: 'milk' },
      { typeId: 'honey' },
      { typeId: 'jam' },
    ],
  },
  {
    suffix: 'brew-drink',
    prompt: {
      zh: '客人上门了，总不能让人干坐着……能帮我弄样能冲泡招待的吗？',
      en: 'A guest has arrived — I cannot let them sit dry. Can you get me something to brew for them?',
    },
    hint: { zh: '（想想什么能冲泡待客，召唤到TA身边）', en: '(think of a brewed drink, summon it near)' },
    answers: [
      { typeId: 'tea' },
      { typeId: 'coffee' },
      { typeId: 'milk' },
      { typeId: 'water' },
      { typeId: 'juice' },
      { typeId: 'wine' },
    ],
  },

  // ---- 光照困境（扩展）----
  {
    suffix: 'power-outage',
    prompt: {
      zh: '啪一下全黑了，电也断了，孩子们吓得直哭……能帮我弄点亮光压压惊吗？',
      en: 'Everything went black at once — the power is out and the children are crying. Can you bring some light?',
    },
    hint: { zh: '（想想什么能在断电时发光，召唤到TA身边）', en: '(think of an off-grid light, summon it near)' },
    answers: [
      { typeId: 'candle' },
      { typeId: 'lamp' },
      { typeId: 'torch' },
      { typeId: 'lantern' },
      { typeId: 'fire' },
      { typeId: 'light' },
    ],
  },
  {
    suffix: 'cave-dark',
    prompt: {
      zh: '探洞探到一半，头灯灭了，四周黑得像墨……能帮我弄样能照亮洞穴的吗？',
      en: 'Halfway into the cave my lamp died — it is black as ink around me. Can you get me something to light the way?',
    },
    hint: { zh: '（想想什么能照亮洞穴，召唤到TA身边）', en: '(think of a cave light, summon it near)' },
    answers: [
      { typeId: 'torch' },
      { typeId: 'lamp' },
      { typeId: 'lantern' },
      { typeId: 'fire' },
      { typeId: 'light' },
      { typeId: 'crystal-ball' },
    ],
  },

  // ---- 危险困境（扩展）----
  {
    suffix: 'dragon-slay',
    prompt: {
      zh: '恶龙盘在山头上，村里人都不敢出门……能帮我弄件能屠龙的利器吗？',
      en: 'A dragon coils on the hilltop and the village cowers behind closed doors. Can you get me a dragon-slaying weapon?',
    },
    hint: { zh: '（想想什么能斩龙除害，召唤到TA身边）', en: '(think of a hero\'s weapon, summon it near)' },
    answers: [
      { typeId: 'sword' },
      { typeId: 'bow' },
      { typeId: 'spear' },
      { typeId: 'shield' },
      { typeId: 'arrow' },
      { typeId: 'bomb' },
    ],
  },
  {
    suffix: 'siege-defense',
    prompt: {
      zh: '敌兵围城了！城头上要什么没什么……能帮我弄点能守城的家伙吗？',
      en: 'The enemy is at the walls and the battlements are bare — can you get me something to hold the city?',
    },
    hint: { zh: '（想想什么能守城御敌，召唤到TA身边）', en: '(think of siege gear, summon it near)' },
    answers: [
      { typeId: 'shield' },
      { typeId: 'armor' },
      { typeId: 'helmet' },
      { typeId: 'bow' },
      { typeId: 'arrow' },
      { typeId: 'cannon' },
    ],
  },
  {
    suffix: 'monster-lair',
    prompt: {
      zh: '宝贝被怪物拖进巢穴里了，我得闯进去夺回来……能帮我弄样能闯怪物窝的吗？',
      en: 'A monster dragged my treasure into its lair — I must go in after it. Can you get me something to raid the lair?',
    },
    hint: { zh: '（想想什么能闯巢穴斗怪，召唤到TA身边）', en: '(think of raiding gear, summon it near)' },
    answers: [
      { typeId: 'sword' },
      { typeId: 'axe' },
      { typeId: 'torch' },
      { typeId: 'shield' },
      { typeId: 'bomb' },
      { typeId: 'fire' },
    ],
  },
  {
    suffix: 'bandit-road',
    prompt: {
      zh: '听说前头那条道上有强人劫道，我非过不可……能帮我弄样能防身的吗？',
      en: 'They say bandits haunt the road ahead, but I must pass. Can you get me something to defend myself?',
    },
    hint: { zh: '（想想什么能对付强人，召唤到TA身边）', en: '(think of a self-defense weapon, summon it near)' },
    answers: [
      { typeId: 'sword' },
      { typeId: 'knife' },
      { typeId: 'gun' },
      { typeId: 'bow' },
      { typeId: 'spear' },
      { typeId: 'shield' },
    ],
  },
  {
    suffix: 'haunted-house',
    prompt: {
      zh: '搬进这宅子才知道闹鬼，夜里邪门得很……能帮我弄样能镇宅辟邪的吗？',
      en: 'I only learned this house is haunted after moving in — the nights are unholy. Can you get me something to ward it?',
    },
    hint: { zh: '（想想什么能镇邪辟祟，召唤到TA身边）', en: '(think of a warding charm, summon it near)' },
    answers: [
      { typeId: 'amulet' },
      { typeId: 'potion' },
      { typeId: 'scroll' },
      { typeId: 'wand' },
      { typeId: 'crystal-shard' },
      { typeId: 'totem-mini' },
    ],
  },
  {
    suffix: 'swarm-bugs',
    prompt: {
      zh: '成群的虫子铺天盖地扑过来，扑都扑不及……能帮我弄样能驱散虫群的吗？',
      en: 'A swarm is descending on me thick as a cloud — I cannot swat them fast enough. Can you get me something to drive them off?',
    },
    hint: { zh: '（想想什么能驱散虫群，召唤到TA身边）', en: '(think of a swarm deterrent, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'torch' },
      { typeId: 'bomb' },
      { typeId: 'smoke' },
      { typeId: 'scroll' },
    ],
  },
  {
    suffix: 'trap-scout',
    prompt: {
      zh: '前头机关重重，我可不想踩中陷阱……能帮我弄样能探路避险的吗？',
      en: 'The path ahead is laced with traps — I do not want to spring one. Can you get me something to scout safely?',
    },
    hint: { zh: '（想想什么能探机关避险，召唤到TA身边）', en: '(think of a scouting aid, summon it near)' },
    answers: [
      { typeId: 'torch' },
      { typeId: 'lamp' },
      { typeId: 'scroll' },
      { typeId: 'compass-tool' },
      { typeId: 'sign' },
      { typeId: 'light' },
    ],
  },

  // ---- 赶路困境（扩展）----
  {
    suffix: 'mountain-cross',
    prompt: {
      zh: '这山陡得没处下脚，得翻过去送急信……能帮我弄样能攀崖翻山的吗？',
      en: 'The mountain is too sheer to climb on foot, but I must cross it with an urgent letter. Can you get me something to scale it?',
    },
    hint: { zh: '（想想什么能攀岩翻山，召唤到TA身边）', en: '(think of a climbing aid, summon it near)' },
    answers: [
      { typeId: 'ladder' },
      { typeId: 'rope' },
      { typeId: 'stairs' },
      { typeId: 'elevator' },
      { typeId: 'helicopter' },
    ],
  },
  {
    suffix: 'sea-voyage',
    prompt: {
      zh: '要渡海去对岸做买卖，可连条船都没有……能帮我弄样能下海远航的吗？',
      en: 'I must cross the sea to trade, but I have no vessel. Can you get me something to voyage in?',
    },
    hint: { zh: '（想想什么能渡海远航，召唤到TA身边）', en: '(think of a sea vessel, summon it near)' },
    answers: [
      { typeId: 'boat' },
      { typeId: 'raft' },
      { typeId: 'submarine' },
      { typeId: 'barrel' },
      { typeId: 'wood' },
    ],
  },
  {
    suffix: 'desert-cross',
    prompt: {
      zh: '要穿过那片大沙漠，日头毒、水也没了……能帮我弄样能助我横渡的吗？',
      en: 'I must cross that desert — the sun is merciless and my water is gone. Can you get me something to help me cross?',
    },
    hint: { zh: '（想想什么能助人穿沙渡漠，召唤到TA身边）', en: '(think of desert crossing gear, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'umbrella-rain' },
      { typeId: 'tent' },
      { typeId: 'camel' },
      { typeId: 'coat' },
    ],
  },
  {
    suffix: 'jungle-trek',
    prompt: {
      zh: '密林里藤蔓缠得连下脚的缝都没有……能帮我弄样能劈开藤障开路的吗？',
      en: 'The jungle is so overgrown I cannot find a place to step. Can you get me something to hack a path through?',
    },
    hint: { zh: '（想想什么能劈藤开路，召唤到TA身边）', en: '(think of a trail-cutting tool, summon it near)' },
    answers: [
      { typeId: 'axe' },
      { typeId: 'sword' },
      { typeId: 'knife' },
      { typeId: 'saw' },
    ],
  },
  {
    suffix: 'snow-travel',
    prompt: {
      zh: '雪深得没过膝盖，徒步是别想了……能帮我弄样能在雪地赶路的吗？',
      en: 'The snow is knee-deep and deeper — walking is out of the question. Can you get me something to travel the snow?',
    },
    hint: { zh: '（想想什么能雪地代步御寒，召唤到TA身边）', en: '(think of snow travel gear, summon it near)' },
    answers: [
      { typeId: 'sleigh' },
      { typeId: 'coat' },
      { typeId: 'boot' },
      { typeId: 'tent' },
      { typeId: 'fire' },
    ],
  },

  // ---- 工具困境（扩展）----
  {
    suffix: 'hammer-nail',
    prompt: {
      zh: '修栅栏就差把钉子敲进去，可手边没家伙……能给我弄样能砸钉子的吗？',
      en: 'I am fixing the fence and just need to drive the nails, but I have no tool. Can you get me something to hammer them?',
    },
    hint: { zh: '（想想什么能砸击钉物，召唤到TA身边）', en: '(think of a striking tool, summon it near)' },
    answers: [
      { typeId: 'hammer' },
      { typeId: 'stone' },
      { typeId: 'club' },
    ],
  },
  {
    suffix: 'tighten-bolt',
    prompt: {
      zh: '这螺帽松了，轮子都快掉了……能给我弄样能拧紧螺栓的吗？',
      en: 'The bolt is loose and the wheel is about to come off — can you get me something to tighten it?',
    },
    hint: { zh: '（想想什么能拧转螺栓，召唤到TA身边）', en: '(think of a turning tool, summon it near)' },
    answers: [
      { typeId: 'wrench' },
      { typeId: 'pliers' },
      { typeId: 'screwdriver' },
      { typeId: 'hammer' },
    ],
  },
  {
    suffix: 'measure-length',
    prompt: {
      zh: '裁料得先量准尺寸，可没家伙量……能给我弄样能度量长短的吗？',
      en: 'I need to measure the cloth before cutting but have nothing to gauge it. Can you get me something to measure with?',
    },
    hint: { zh: '（想想什么能量度长短，召唤到TA身边）', en: '(think of a measuring tool, summon it near)' },
    answers: [
      { typeId: 'ruler' },
      { typeId: 'chain' },
      { typeId: 'thread' },
      { typeId: 'rope' },
      { typeId: 'level' },
    ],
  },
  {
    suffix: 'start-fire',
    prompt: {
      zh: '柴都码好了，就差样能引火的东西……能帮我弄点引火的吗？',
      en: 'The wood is stacked and ready — I only lack something to kindle it. Can you get me something to start the fire?',
    },
    hint: { zh: '（想想什么能引火助燃，召唤到TA身边）', en: '(think of a fire starter, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'ember' },
      { typeId: 'spark' },
      { typeId: 'torch' },
      { typeId: 'candle' },
      { typeId: 'coal' },
    ],
  },
  {
    suffix: 'write-letter',
    prompt: {
      zh: '得给远方的老母报个平安，可连写字的家伙都没有……能给我弄样能写信的吗？',
      en: 'I must write my mother far away that I am safe, but I lack even something to write with. Can you get me something to write on?',
    },
    hint: { zh: '（想想什么能书写记事，召唤到TA身边）', en: '(think of writing material, summon it near)' },
    answers: [
      { typeId: 'paper' },
      { typeId: 'book' },
      { typeId: 'scroll' },
      { typeId: 'computer' },
    ],
  },
  {
    suffix: 'tie-down',
    prompt: {
      zh: '车上的货直晃荡，得绑牢些……能给我弄样能捆扎固定的吗？',
      en: 'The load on the cart keeps shifting — I must lash it down. Can you get me something to tie with?',
    },
    hint: { zh: '（想想什么能捆扎系物，召唤到TA身边）', en: '(think of a binding, summon it near)' },
    answers: [
      { typeId: 'rope' },
      { typeId: 'chain' },
      { typeId: 'thread' },
      { typeId: 'vine' },
    ],
  },
  {
    suffix: 'water-garden',
    prompt: {
      zh: '大旱天，园子里的花都蔫了……能给我弄样能引水浇灌的吗？',
      en: 'In this drought the garden is wilting — can you get me something to water it?',
    },
    hint: { zh: '（想想什么能引水浇灌，召唤到TA身边）', en: '(think of a watering tool, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'sprinkler' },
      { typeId: 'hose' },
      { typeId: 'bucket' },
      { typeId: 'trowel' },
    ],
  },

  // ---- 收纳困境（扩展）----
  {
    suffix: 'pack-clothes',
    prompt: {
      zh: '要搬家了，一柜子衣裳不知怎么装……能给我弄样能装箱打包的吗？',
      en: 'We are moving and I do not know how to carry a whole wardrobe. Can you get me something to pack it in?',
    },
    hint: { zh: '（想想什么能装衣打包，召唤到TA身边）', en: '(think of a luggage, summon it near)' },
    answers: [
      { typeId: 'suitcase' },
      { typeId: 'box' },
      { typeId: 'chest' },
      { typeId: 'wardrobe' },
      { typeId: 'drawer' },
      { typeId: 'backpack' },
    ],
  },
  {
    suffix: 'serve-drink',
    prompt: {
      zh: '客人来了，总不能让人对着水桶喝……能给我弄样能盛酒待客的器皿吗？',
      en: 'A guest has come — I cannot hand them the bucket. Can you get me a vessel to serve drink in?',
    },
    hint: { zh: '（想想什么能盛酒待客，召唤到TA身边）', en: '(think of a serving vessel, summon it near)' },
    answers: [
      { typeId: 'barrel' },
      { typeId: 'bucket' },
      { typeId: 'basket' },
      { typeId: 'vase' },
    ],
  },
  {
    suffix: 'keep-fresh',
    prompt: {
      zh: '这大热天的，剩菜剩饭没处放就馊了……能给我弄样能保鲜防腐的吗？',
      en: 'In this heat the leftovers will spoil with nowhere to keep them. Can you get me something to preserve food?',
    },
    hint: { zh: '（想想什么能保鲜冷藏，召唤到TA身边）', en: '(think of a preserver, summon it near)' },
    answers: [
      { typeId: 'fridge' },
      { typeId: 'ice' },
      { typeId: 'snow' },
      { typeId: 'water' },
      { typeId: 'frost' },
    ],
  },
  {
    suffix: 'hide-stuff',
    prompt: {
      zh: '这几样东西不能让人瞧见，得找个地方藏严实……能给我弄样能藏物的吗？',
      en: 'I must keep these out of sight — can you get me somewhere to hide them?',
    },
    hint: { zh: '（想想什么能藏物隐秘，召唤到TA身边）', en: '(think of a hiding place, summon it near)' },
    answers: [
      { typeId: 'chest' },
      { typeId: 'box' },
      { typeId: 'barrel' },
      { typeId: 'crate' },
      { typeId: 'coffin' },
      { typeId: 'drawer' },
    ],
  },

  // ---- 自然/环境困境（扩展）----
  {
    suffix: 'flower-bed',
    prompt: {
      zh: '想在窗下弄个花圃，可连花苗都没有……能帮我弄点能栽进花圃的吗？',
      en: 'I want a flower bed under the window but lack the plants. Can you get me something to plant in it?',
    },
    hint: { zh: '（想想什么能入花圃观赏，召唤到TA身边）', en: '(think of a garden flower, summon it near)' },
    answers: [
      { typeId: 'flower' },
      { typeId: 'rose' },
      { typeId: 'tulip' },
      { typeId: 'sunflower' },
      { typeId: 'lily' },
      { typeId: 'daisy' },
    ],
  },
  {
    suffix: 'plant-trees',
    prompt: {
      zh: '村口那片树全砍光了，夏天连个遮荫都没……能帮我弄点能栽成荫的吗？',
      en: 'The trees at the village edge are all felled — no shade left for summer. Can you get me something to plant for shade?',
    },
    hint: { zh: '（想想什么能栽树成荫，召唤到TA身边）', en: '(think of a shade tree, summon it near)' },
    answers: [
      { typeId: 'tree' },
      { typeId: 'oak' },
      { typeId: 'pine' },
      { typeId: 'willow' },
      { typeId: 'palm' },
      { typeId: 'bamboo' },
    ],
  },
  {
    suffix: 'trim-lawn',
    prompt: {
      zh: '院子里的草长得比人还高，都没处下脚了……能给我弄样能割草修坪的吗？',
      en: 'The grass in the yard is taller than I am — there is no place to step. Can you get me something to cut it?',
    },
    hint: { zh: '（想想什么能割草修坪，召唤到TA身边）', en: '(think of a cutting tool, summon it near)' },
    answers: [
      { typeId: 'scythe' },
      { typeId: 'saw' },
      { typeId: 'knife' },
      { typeId: 'axe' },
    ],
  },
  {
    suffix: 'clean-spill',
    prompt: {
      zh: '一壶水全泼地上了，得赶紧擦干免得滑倒……能给我弄样能吸水擦地的吗？',
      en: 'I spilled a whole pot of water and must wipe it before someone slips. Can you get me something to soak it up?',
    },
    hint: { zh: '（想想什么能吸水擦干，召唤到TA身边）', en: '(think of something absorbent, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'paper' },
      { typeId: 'rug' },
    ],
  },
  {
    suffix: 'pest-rid',
    prompt: {
      zh: '地里害虫把庄稼啃得精光……能给我弄样能除虫保苗的吗？',
      en: 'Pests have stripped the field bare — can you get me something to rid them?',
    },
    hint: { zh: '（想想什么能除虫灭害，召唤到TA身边）', en: '(think of a pest killer, summon it near)' },
    answers: [
      { typeId: 'fire' },
      { typeId: 'smoke' },
      { typeId: 'bomb' },
      { typeId: 'scroll' },
    ],
  },

  // ---- 伙伴/生物困境（扩展）----
  {
    suffix: 'riding-mount',
    prompt: {
      zh: '路远马乏，我这头老骡也歇了脚……能给我弄匹能骑的坐骑吗？',
      en: 'The road is long and my old mule has given out — can you get me a mount to ride?',
    },
    hint: { zh: '（想想什么能当坐骑骑乘，召唤到TA身边）', en: '(think of a mount, summon it near)' },
    answers: [
      { typeId: 'horse' },
      { typeId: 'camel' },
      { typeId: 'donkey' },
      { typeId: 'mule' },
      { typeId: 'pegasus' },
      { typeId: 'unicorn' },
    ],
  },
  {
    suffix: 'hatch-pet',
    prompt: {
      zh: '孩子想养只从蛋孵出来的小家伙，亲眼瞧它出壳……能给我弄个能孵的蛋吗？',
      en: 'My child wants to watch something hatch from an egg. Can you get me an egg to incubate?',
    },
    hint: { zh: '（想想什么能孵化小生命，召唤到TA身边）', en: '(think of an egg, summon it near)' },
    answers: [
      { typeId: 'egg' },
      { typeId: 'bird' },
      { typeId: 'chicken' },
      { typeId: 'duck' },
      { typeId: 'goose' },
    ],
  },
  {
    suffix: 'farm-stock',
    prompt: {
      zh: '新置了个牧场，可棚里空空如也……能帮我弄几头能养的家畜吗？',
      en: 'I just built a farm but the pens are empty — can you get me some livestock?',
    },
    hint: { zh: '（想想什么能当家畜饲养，召唤到TA身边）', en: '(think of livestock, summon it near)' },
    answers: [
      { typeId: 'cow' },
      { typeId: 'pig' },
      { typeId: 'sheep' },
      { typeId: 'goat' },
      { typeId: 'chicken' },
      { typeId: 'horse' },
    ],
  },
  {
    suffix: 'tank-fish',
    prompt: {
      zh: '买了只空鱼缸搁那儿怪冷清的……能给我弄点能养在缸里的吗？',
      en: 'I bought an empty tank and it looks forlorn — can you get me something to keep in it?',
    },
    hint: { zh: '（想想什么能养在鱼缸观赏，召唤到TA身边）', en: '(think of a tank pet, summon it near)' },
    answers: [
      { typeId: 'fish' },
      { typeId: 'shrimp' },
      { typeId: 'crab' },
      { typeId: 'seahorse' },
      { typeId: 'jellyfish' },
    ],
  },
  {
    suffix: 'exotic-pet',
    prompt: {
      zh: '寻常猫狗都养腻了，想弄只稀罕的镇镇场子……能帮我寻一只吗？',
      en: 'I am tired of common cats and dogs — I want something rare to show off. Can you find me one?',
    },
    hint: { zh: '（想想什么又是活物又是稀罕，召唤到TA身边）', en: '(think of an exotic creature, summon it near)' },
    answers: [
      { typeId: 'dragon' },
      { typeId: 'unicorn' },
      { typeId: 'phoenix' },
      { typeId: 'pegasus' },
      { typeId: 'wyvern' },
      { typeId: 'griffin' },
    ],
  },

  // ---- 渔猎困境（扩展）----
  {
    suffix: 'fish-bait',
    prompt: {
      zh: '竿都支好了，就差样能挂在钩上引鱼上钩的……能给我弄点鱼饵吗？',
      en: 'The rod is rigged — I only need something on the hook to lure a bite. Can you get me some bait?',
    },
    hint: { zh: '（想想什么能当鱼饵诱鱼，召唤到TA身边）', en: '(think of bait, summon it near)' },
    answers: [
      { typeId: 'worm' },
      { typeId: 'shrimp' },
      { typeId: 'fish-food' },
      { typeId: 'fish' },
      { typeId: 'bread' },
    ],
  },
  {
    suffix: 'trap-beast',
    prompt: {
      zh: '有头野兽祸害庄稼，我想活捉了它……能给我弄样能设陷阱擒兽的吗？',
      en: 'A beast is ravaging the fields and I want to take it alive. Can you get me something to trap it with?',
    },
    hint: { zh: '（想想什么能设陷擒兽，召唤到TA身边）', en: '(think of a trap, summon it near)' },
    answers: [
      { typeId: 'net' },
      { typeId: 'rope' },
      { typeId: 'box' },
      { typeId: 'barrel' },
      { typeId: 'crate' },
    ],
  },
  {
    suffix: 'night-hunt',
    prompt: {
      zh: '那头害兽只在夜里出来，我得摸黑去猎……能给我弄样能夜猎的吗？',
      en: 'The nuisance beast only comes out at night — I must hunt in the dark. Can you get me something for night hunting?',
    },
    hint: { zh: '（想想什么能夜猎照明杀兽，召唤到TA身边）', en: '(think of night hunting gear, summon it near)' },
    answers: [
      { typeId: 'torch' },
      { typeId: 'lamp' },
      { typeId: 'bow' },
      { typeId: 'gun' },
      { typeId: 'spear' },
      { typeId: 'arrow' },
    ],
  },

  // ---- 衣物困境（扩展）----
  {
    suffix: 'formal-wear',
    prompt: {
      zh: '要赴个正经场合，总不能邋里邋遢的……能给我弄件能见客的正装吗？',
      en: 'I am called to a formal occasion and cannot go unkempt. Can you get me something proper to wear?',
    },
    hint: { zh: '（想想什么能当正装见客，召唤到TA身边）', en: '(think of formal wear, summon it near)' },
    answers: [
      { typeId: 'shirt' },
      { typeId: 'pants' },
      { typeId: 'tie' },
      { typeId: 'coat' },
      { typeId: 'dress' },
      { typeId: 'shoe' },
    ],
  },
  {
    suffix: 'winter-clothes',
    prompt: {
      zh: '要往北边去，听说冻得能掉耳朵……能给我弄套能扛冻的冬装吗？',
      en: 'I am heading north where they say ears freeze off — can you get me winter clothes to withstand it?',
    },
    hint: { zh: '（想想什么能御寒过冬，召唤到TA身边）', en: '(think of winter wear, summon it near)' },
    answers: [
      { typeId: 'coat' },
      { typeId: 'scarf' },
      { typeId: 'boot' },
      { typeId: 'hat-top' },
      { typeId: 'glove' },
      { typeId: 'pants' },
    ],
  },
  {
    suffix: 'head-cover',
    prompt: {
      zh: '日头毒得头皮发烫，总得遮一遮……能给我弄样能戴在头上的吗？',
      en: 'The sun is scorching my scalp — I must cover it. Can you get me something to wear on my head?',
    },
    hint: { zh: '（想想什么能戴头遮顶，召唤到TA身边）', en: '(think of headwear, summon it near)' },
    answers: [
      { typeId: 'hat-top' },
      { typeId: 'cap' },
      { typeId: 'helmet' },
      { typeId: 'crown-flower' },
      { typeId: 'crown' },
      { typeId: 'mask' },
    ],
  },

  // ---- 家居困境（扩展）----
  {
    suffix: 'furnish-room',
    prompt: {
      zh: '新房空荡荡的，连把椅子都没有……能给我弄样能布置屋子的吗？',
      en: 'The new house is bare — not even a chair. Can you get me something to furnish it?',
    },
    hint: { zh: '（想想什么能布置家居，召唤到TA身边）', en: '(think of furniture, summon it near)' },
    answers: [
      { typeId: 'chair' },
      { typeId: 'table' },
      { typeId: 'bed' },
      { typeId: 'couch' },
      { typeId: 'shelf' },
      { typeId: 'drawer' },
    ],
  },
  {
    suffix: 'cook-meal',
    prompt: {
      zh: '要开伙做饭了，灶房里却连样能用的炊具都没有……能给我弄样能做饭的吗？',
      en: 'It is time to cook but the kitchen has no working appliance. Can you get me something to cook with?',
    },
    hint: { zh: '（想想什么能炊煮做饭，召唤到TA身边）', en: '(think of a cooking appliance, summon it near)' },
    answers: [
      { typeId: 'oven' },
      { typeId: 'microwave' },
      { typeId: 'toaster' },
      { typeId: 'fridge' },
    ],
  },
  {
    suffix: 'watch-show',
    prompt: {
      zh: '今晚有场好戏，可没家伙看……能给我弄样能看节目的吗？',
      en: 'There is a fine show tonight but nothing to watch it on. Can you get me something to watch with?',
    },
    hint: { zh: '（想想什么能收看节目，召唤到TA身边）', en: '(think of a viewing device, summon it near)' },
    answers: [
      { typeId: 'tv' },
      { typeId: 'computer' },
      { typeId: 'phone' },
      { typeId: 'radio' },
      { typeId: 'camera' },
    ],
  },
  {
    suffix: 'room-light',
    prompt: {
      zh: '这屋子里暗沉沉的，待久了眼都疼……能给我弄样能照亮屋子的吗？',
      en: 'The room is so dim my eyes ache from staying in it. Can you get me something to light it?',
    },
    hint: { zh: '（想想什么能照明满屋，召唤到TA身边）', en: '(think of room lighting, summon it near)' },
    answers: [
      { typeId: 'lamp' },
      { typeId: 'light' },
      { typeId: 'candle' },
      { typeId: 'lantern' },
      { typeId: 'torch' },
      { typeId: 'fire' },
    ],
  },

  // ---- 魔法/神秘困境（扩展）----
  {
    suffix: 'cast-spell',
    prompt: {
      zh: '这咒语就差样法媒才能发动……能帮我寻件能施法的媒介吗？',
      en: 'My spell needs a focus to fire — can you find me something to cast through?',
    },
    hint: { zh: '（想想什么能当施法媒介，召唤到TA身边）', en: '(think of a spell focus, summon it near)' },
    answers: [
      { typeId: 'wand' },
      { typeId: 'scroll' },
      { typeId: 'staff-weapon' },
      { typeId: 'crystal-ball' },
      { typeId: 'amulet' },
      { typeId: 'potion' },
    ],
  },
  {
    suffix: 'divine-future',
    prompt: {
      zh: '我夜观星象却看不真切，得借样法器才能窥见天机……能帮我寻一件吗？',
      en: 'I read the stars but the signs are unclear — I need an instrument to divine the future. Can you find me one?',
    },
    hint: { zh: '（想想什么能占卜知未来，召唤到TA身边）', en: '(think of a divining tool, summon it near)' },
    answers: [
      { typeId: 'crystal-ball' },
      { typeId: 'scroll' },
      { typeId: 'amulet' },
      { typeId: 'totem-mini' },
      { typeId: 'compass-tool' },
    ],
  },
  {
    suffix: 'banish-undead',
    prompt: {
      zh: '坟地里亡灵作祟，搅得四邻不宁……能帮我弄样能驱逐亡灵的吗？',
      en: 'Undead stir in the graveyard and trouble the neighborhood. Can you get me something to banish them?',
    },
    hint: { zh: '（想想什么能驱逐亡灵，召唤到TA身边）', en: '(think of an undead ward, summon it near)' },
    answers: [
      { typeId: 'amulet' },
      { typeId: 'scroll' },
      { typeId: 'wand' },
      { typeId: 'potion' },
      { typeId: 'crystal-shard' },
      { typeId: 'fire' },
    ],
  },
  {
    suffix: 'enchant-item',
    prompt: {
      zh: '想给这把剑附个魔，可手里没附魔的材料……能帮我弄样能附魔的吗？',
      en: 'I want to enchant this blade but lack the reagent. Can you get me something to enchant with?',
    },
    hint: { zh: '（想想什么能附魔注灵，召唤到TA身边）', en: '(think of an enchanting reagent, summon it near)' },
    answers: [
      { typeId: 'wand' },
      { typeId: 'crystal-shard' },
      { typeId: 'amulet' },
      { typeId: 'scroll' },
      { typeId: 'gem' },
      { typeId: 'diamond' },
    ],
  },
  {
    suffix: 'holy-relic',
    prompt: {
      zh: '祭坛上还差件圣物才能开光……能帮我寻一件有灵性的圣物吗？',
      en: 'The altar still lacks a holy relic to consecrate it. Can you find me a sacred object?',
    },
    hint: { zh: '（想想什么又是圣又是灵，召唤到TA身边）', en: '(think of a holy relic, summon it near)' },
    answers: [
      { typeId: 'amulet' },
      { typeId: 'totem-mini' },
      { typeId: 'scroll' },
      { typeId: 'altar' },
      { typeId: 'crystal-shard' },
      { typeId: 'potion' },
    ],
  },
  {
    suffix: 'summon-storm',
    prompt: {
      zh: '要召一场风雨涤荡这污浊之地……能帮我弄样能掀起风云的吗？',
      en: 'I would summon a storm to cleanse this foul place. Can you get me something to stir up the weather?',
    },
    hint: { zh: '（想想什么能掀起风云，召唤到TA身边）', en: '(think of a storm aspect, summon it near)' },
    answers: [
      { typeId: 'wind' },
      { typeId: 'cloud-element' },
      { typeId: 'rain' },
      { typeId: 'lightning' },
      { typeId: 'tornado' },
    ],
  },

  // ---- 艺术/装饰困境（扩展）----
  {
    suffix: 'paint-scene',
    prompt: {
      zh: '想把眼前这山水画下来，可没家伙落笔……能给我弄样能作画的吗？',
      en: 'I want to paint this landscape before me but have nothing to work with. Can you get me something to paint on?',
    },
    hint: { zh: '（想想什么能作画留影，召唤到TA身边）', en: '(think of painting material, summon it near)' },
    answers: [
      { typeId: 'painting' },
      { typeId: 'paper' },
      { typeId: 'book' },
      { typeId: 'frame' },
    ],
  },
  {
    suffix: 'garden-statue',
    prompt: {
      zh: '园子中央空着一座台，总得立尊像镇镇场面……能帮我弄尊能立在园中的吗？',
      en: 'The pedestal in the garden stands empty — it needs a figure. Can you get me something to set upon it?',
    },
    hint: { zh: '（想想什么能立像装饰，召唤到TA身边）', en: '(think of a statue, summon it near)' },
    answers: [
      { typeId: 'statue' },
      { typeId: 'sculpture' },
      { typeId: 'gargoyle' },
      { typeId: 'trophy' },
      { typeId: 'altar' },
      { typeId: 'pillar' },
    ],
  },
  {
    suffix: 'festive-decor',
    prompt: {
      zh: '今儿过节，屋里屋外总得添点喜气……能帮我弄点能装点节庆的吗？',
      en: 'It is a festival today — the place needs some cheer. Can you get me something to decorate for the occasion?',
    },
    hint: { zh: '（想想什么能装点节庆，召唤到TA身边）', en: '(think of festive decor, summon it near)' },
    answers: [
      { typeId: 'balloon' },
      { typeId: 'flower' },
      { typeId: 'rose' },
      { typeId: 'lamp' },
      { typeId: 'candle' },
      { typeId: 'light' },
    ],
  },
  {
    suffix: 'table-centerpiece',
    prompt: {
      zh: '宴客的桌中央光秃秃的，得摆样东西撑场面……能帮我弄样能摆桌心的吗？',
      en: 'The guest table has a bare center — it needs a centerpiece. Can you get me something to display there?',
    },
    hint: { zh: '（想想什么能摆桌心撑场面，召唤到TA身边）', en: '(think of a centerpiece, summon it near)' },
    answers: [
      { typeId: 'vase' },
      { typeId: 'flower' },
      { typeId: 'rose' },
      { typeId: 'candle' },
      { typeId: 'sculpture' },
      { typeId: 'trophy' },
    ],
  },

  // ---- 通讯/信息困境（扩展）----
  {
    suffix: 'call-help',
    prompt: {
      zh: '出了事得赶紧叫人来救，可没家伙传话……能给我弄样能呼救的吗？',
      en: 'I must call for rescue at once but have no way to send word. Can you get me something to call for help?',
    },
    hint: { zh: '（想想什么能呼救求援，召唤到TA身边）', en: '(think of a distress signal, summon it near)' },
    answers: [
      { typeId: 'phone' },
      { typeId: 'radio' },
      { typeId: 'computer' },
      { typeId: 'tv' },
    ],
  },
  {
    suffix: 'record-event',
    prompt: {
      zh: '这景儿太难得了，得留个影记下来……能给我弄样能记录留存的吗？',
      en: 'This sight is too rare to lose — I must record it. Can you get me something to capture it with?',
    },
    hint: { zh: '（想想什么能记录留存，召唤到TA身边）', en: '(think of a recording tool, summon it near)' },
    answers: [
      { typeId: 'paper' },
      { typeId: 'book' },
      { typeId: 'scroll' },
      { typeId: 'camera' },
      { typeId: 'phone' },
      { typeId: 'computer' },
    ],
  },
  {
    suffix: 'broadcast-news',
    prompt: {
      zh: '有条要紧的消息得让全城都知道……能给我弄样能广而告之的吗？',
      en: 'There is urgent news the whole city must hear. Can you get me something to broadcast it?',
    },
    hint: { zh: '（想想什么能广播传讯，召唤到TA身边）', en: '(think of a broadcast tool, summon it near)' },
    answers: [
      { typeId: 'radio' },
      { typeId: 'tv' },
      { typeId: 'phone' },
      { typeId: 'computer' },
    ],
  },

  // ---- 健康/伤病困境（扩展）----
  {
    suffix: 'get-medicine',
    prompt: {
      zh: '病了好几天，总得弄点药才扛得住……能给我弄样能治病救急的吗？',
      en: 'I have been ill for days and need medicine to pull through. Can you get me a remedy?',
    },
    hint: { zh: '（想想什么能治病救急，召唤到TA身边）', en: '(think of a remedy, summon it near)' },
    answers: [
      { typeId: 'potion' },
      { typeId: 'scroll' },
      { typeId: 'amulet' },
      { typeId: 'honey' },
      { typeId: 'tea' },
    ],
  },
  {
    suffix: 'rest-recover',
    prompt: {
      zh: '病来如山倒，得好好躺几天将养……能给我弄样能安养休息的吗？',
      en: 'The illness hit hard — I must rest up for days. Can you get me something to recover on?',
    },
    hint: { zh: '（想想什么能安养休息，召唤到TA身边）', en: '(think of a resting place, summon it near)' },
    answers: [
      { typeId: 'bed' },
      { typeId: 'couch' },
      { typeId: 'pillow' },
      { typeId: 'tent' },
      { typeId: 'rug' },
    ],
  },
  {
    suffix: 'clean-wound',
    prompt: {
      zh: '伤口沾了泥，不洗净要发炎的……能给我弄样能清洗包扎的吗？',
      en: 'The wound is dirty — it will fester if not cleansed. Can you get me something to clean and bind it?',
    },
    hint: { zh: '（想想什么能清洗伤口，召唤到TA身边）', en: '(think of a wound cleanser, summon it near)' },
    answers: [
      { typeId: 'water' },
      { typeId: 'paper' },
      { typeId: 'rug' },
    ],
  },

  // ---- 工艺/制作困境（扩展）----
  {
    suffix: 'build-house',
    prompt: {
      zh: '一家老小还露宿着呢，得赶紧搭个能住人的……能给我弄样能起屋建房的吗？',
      en: 'My family is still sleeping rough — I must raise a shelter at once. Can you get me something to build with?',
    },
    hint: { zh: '（想想什么能起屋建房，召唤到TA身边）', en: '(think of building material, summon it near)' },
    answers: [
      { typeId: 'wood' },
      { typeId: 'brick' },
      { typeId: 'stone' },
      { typeId: 'door' },
      { typeId: 'window' },
      { typeId: 'glass' },
    ],
  },
  {
    suffix: 'carve-stone',
    prompt: {
      zh: '要刻一通碑，可手里没家伙下凿……能给我弄样能雕凿石碑的吗？',
      en: 'I must carve a stele but have no tool to cut the stone. Can you get me something to carve with?',
    },
    hint: { zh: '（想想什么能雕凿刻石，召唤到TA身边）', en: '(think of a carving tool, summon it near)' },
    answers: [
      { typeId: 'chisel' },
      { typeId: 'hammer' },
      { typeId: 'pickaxe' },
      { typeId: 'file' },
      { typeId: 'knife' },
      { typeId: 'drill' },
    ],
  },
  {
    suffix: 'bind-book',
    prompt: {
      zh: '散页攒了一摞，想订成册子保存……能给我弄样能装订成书的吗？',
      en: 'I have a stack of loose pages and want to bind them into a volume. Can you get me something to bind with?',
    },
    hint: { zh: '（想想什么能装订成册，召唤到TA身边）', en: '(think of binding material, summon it near)' },
    answers: [
      { typeId: 'paper' },
      { typeId: 'book' },
      { typeId: 'thread' },
      { typeId: 'needle' },
      { typeId: 'scroll' },
    ],
  },
  {
    suffix: 'forge-armor',
    prompt: {
      zh: '上阵前总得有副甲护身，可铁匠铺还差家伙……能给我弄样能锻甲的吗？',
      en: 'I need armor before the battle, but the smithy lacks tools. Can you get me something to forge armor with?',
    },
    hint: { zh: '（想想什么能锻铁打甲，召唤到TA身边）', en: '(think of a smithing tool, summon it near)' },
    answers: [
      { typeId: 'hammer' },
      { typeId: 'anvil' },
      { typeId: 'whetstone' },
      { typeId: 'bellows' },
      { typeId: 'pliers' },
    ],
  },
  {
    suffix: 'build-fence',
    prompt: {
      zh: '菜园子老被糟蹋，得围起来拦一拦……能给我弄样能圈地做围栏的吗？',
      en: 'The garden keeps getting raided — I must fence it in. Can you get me something to make a fence with?',
    },
    hint: { zh: '（想想什么能圈地做围栏，召唤到TA身边）', en: '(think of fencing, summon it near)' },
    answers: [
      { typeId: 'fence-stone' },
      { typeId: 'wood' },
      { typeId: 'rope' },
      { typeId: 'chain' },
    ],
  },

  // ---- 元素/炼金困境（扩展）----
  {
    suffix: 'transmute-metal',
    prompt: {
      zh: '想把这块凡铁炼成真金，炉里还差样引子……能帮我弄点炼金的原料吗？',
      en: 'I would transmute this base iron into gold, but the crucible lacks a reagent. Can you gather some alchemy material?',
    },
    hint: { zh: '（想想什么能入炉炼金，召唤到TA身边）', en: '(think of an alchemy reagent, summon it near)' },
    answers: [
      { typeId: 'ore' },
      { typeId: 'coal' },
      { typeId: 'mercury' },
      { typeId: 'sulfur' },
      { typeId: 'quartz' },
      { typeId: 'crystal' },
    ],
  },
  {
    suffix: 'brew-poison',
    prompt: {
      zh: '要配一剂毒药除害兽，可还差样毒材……能帮我弄点能入毒的吗？',
      en: 'I must brew a poison to rid the vermin, but lack a toxic reagent. Can you get me something poisonous?',
    },
    hint: { zh: '（想想什么能入毒制剂，召唤到TA身边）', en: '(think of a toxic reagent, summon it near)' },
    answers: [
      { typeId: 'potion' },
      { typeId: 'mushroom' },
      { typeId: 'snake' },
      { typeId: 'scroll' },
    ],
  },
  {
    suffix: 'conjure-light',
    prompt: {
      zh: '要凭空召一束光来照彻暗室……能帮我弄样能生光的吗？',
      en: 'I would conjure a light from nothing to fill this dark room. Can you get me something luminous?',
    },
    hint: { zh: '（想想什么能生光照彻，召唤到TA身边）', en: '(think of a light source, summon it near)' },
    answers: [
      { typeId: 'light' },
      { typeId: 'fire' },
      { typeId: 'ember' },
      { typeId: 'spark' },
      { typeId: 'lamp' },
      { typeId: 'candle' },
    ],
  },
  {
    suffix: 'raise-dead',
    prompt: {
      zh: '亡灵法师要行那起尸之术，还差样媒介……能帮我弄样能役使亡灵的吗？',
      en: 'The necromancer would raise the dead but lacks a medium. Can you get me something to command the departed?',
    },
    hint: { zh: '（想想什么能役使亡灵，召唤到TA身边）', en: '(think of a necromantic medium, summon it near)' },
    answers: [
      { typeId: 'scroll' },
      { typeId: 'wand' },
      { typeId: 'skeleton' },
      { typeId: 'zombie' },
      { typeId: 'coffin' },
      { typeId: 'altar' },
    ],
  },

  // ---- 教育/学习困境 ----
  {
    suffix: 'study-material',
    prompt: {
      zh: '明儿就要科考了，可连本能翻的书都没有……能给我弄样能温书的吗？',
      en: 'The exam is tomorrow and I have not even a book to review. Can you get me something to study from?',
    },
    hint: { zh: '（想想什么能温书备考，召唤到TA身边）', en: '(think of study material, summon it near)' },
    answers: [
      { typeId: 'book' },
      { typeId: 'scroll' },
      { typeId: 'paper' },
      { typeId: 'computer' },
      { typeId: 'phone' },
    ],
  },
  {
    suffix: 'teach-tool',
    prompt: {
      zh: '要给蒙童开蒙，可手里没样能教的物件……能给我弄样能当教具的吗？',
      en: 'I must teach the children but have nothing to teach with. Can you get me something to use as a teaching aid?',
    },
    hint: { zh: '（想想什么能当教具授业，召唤到TA身边）', en: '(think of a teaching aid, summon it near)' },
    answers: [
      { typeId: 'book' },
      { typeId: 'paper' },
      { typeId: 'scroll' },
      { typeId: 'computer' },
    ],
  },

  // ---- 娱乐/游戏困境 ----
  {
    suffix: 'play-toy',
    prompt: {
      zh: '小家伙哭闹着要玩意儿哄……能给我弄样能逗孩子玩的吗？',
      en: 'The little one is wailing for a plaything — can you get me something to amuse a child?',
    },
    hint: { zh: '（想想什么能逗孩子玩耍，召唤到TA身边）', en: '(think of a plaything, summon it near)' },
    answers: [
      { typeId: 'ball' },
      { typeId: 'balloon' },
      { typeId: 'book' },
      { typeId: 'robot' },
    ],
  },
  {
    suffix: 'sport-gear',
    prompt: {
      zh: '约了人比试一场，可连样能上场的东西都没有……能给我弄样能竞技的吗？',
      en: 'I arranged a match but have nothing to compete with. Can you get me something to play a sport?',
    },
    hint: { zh: '（想想什么能竞技运动，召唤到TA身边）', en: '(think of sports gear, summon it near)' },
    answers: [
      { typeId: 'ball' },
      { typeId: 'bicycle' },
      { typeId: 'car' },
      { typeId: 'boat' },
    ],
  },

  // ---- 农业/种植困境 ----
  {
    suffix: 'harvest-crop',
    prompt: {
      zh: '麦熟透了再不割就糟蹋了，可手里没家伙……能给我弄样能收割的吗？',
      en: 'The wheat is ripe and will spoil if not cut now, but I have no tool. Can you get me something to harvest with?',
    },
    hint: { zh: '（想想什么能收割庄稼，召唤到TA身边）', en: '(think of a harvesting tool, summon it near)' },
    answers: [
      { typeId: 'scythe' },
      { typeId: 'saw' },
      { typeId: 'knife' },
      { typeId: 'axe' },
    ],
  },
  {
    suffix: 'store-harvest',
    prompt: {
      zh: '收上来的粮食没处放，总不能堆地上烂掉……能给我弄样能囤粮的吗？',
      en: 'The harvest has nowhere to go — I cannot leave it to rot on the ground. Can you get me something to store grain in?',
    },
    hint: { zh: '（想想什么能囤粮收储，召唤到TA身边）', en: '(think of a storage bin, summon it near)' },
    answers: [
      { typeId: 'barrel' },
      { typeId: 'box' },
      { typeId: 'crate' },
      { typeId: 'chest' },
      { typeId: 'basket' },
    ],
  },

  // ---- 金融/交易困境 ----
  {
    suffix: 'pay-debt',
    prompt: {
      zh: '债主逼上门了，总得拿出样值钱的抵债……能给我弄样能抵账的吗？',
      en: 'The creditor is at the door — I must pay with something of worth. Can you get me something valuable?',
    },
    hint: { zh: '（想想什么又是值钱又是能抵账，召唤到TA身边）', en: '(think of a valuable, summon it near)' },
    answers: [
      { typeId: 'coin' },
      { typeId: 'gem' },
      { typeId: 'diamond' },
      { typeId: 'pearl' },
      { typeId: 'ring' },
    ],
  },
  {
    suffix: 'trade-goods',
    prompt: {
      zh: '要赶集做买卖，可货还没装车……能给我弄样能载货跑商的吗？',
      en: 'I must get to market but the goods are not loaded. Can you get me something to haul trade goods in?',
    },
    hint: { zh: '（想想什么能载货贩运，召唤到TA身边）', en: '(think of a cargo carrier, summon it near)' },
    answers: [
      { typeId: 'box' },
      { typeId: 'crate' },
      { typeId: 'barrel' },
      { typeId: 'wagon' },
      { typeId: 'cart' },
      { typeId: 'suitcase' },
    ],
  },
];

const situationalQuestions: Question[] = scenarios.map((s) => {
  const answers = s.answers;
  const ids = answers.flatMap((a) => [a.typeId, ...(a.adjectives ?? [])]);
  return {
    id: `q-sit-${s.suffix}`,
    answers,
    cefr: medianTier(ids),
    freq: medianFreq(ids),
    prompt: s.prompt,
    hint: s.hint,
  };
});

// ---- B. 词条覆盖单答案题 ----
//
// 由 allEntries() 全量派生，保证 538 词条每个至少有一道题。
// 题面套用 category 的故事化模板（第一人称情境 + 点名目标词条），
// 不再是"给我一个X"。难度从 word-metadata 派生。

/** category → 双语故事化题面模板，{name} 处填入词条双语名 */
const categoryTemplates: Record<string, { zh: string; en: string; hintZh: string; hintEn: string }[]> = {
  creature: [
    {
      zh: '小女一直缠着要一只{name}当伙伴，能帮我把TA请到身边来吗？',
      en: 'My little girl has been begging for a {name} as a companion — can you bring one to her?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '村口老祠堂的壁画上画着一只{name}，我从未亲眼见过……能帮我唤一只来瞧瞧吗？',
      en: 'The old shrine mural shows a {name}, but I have never seen one in the flesh — can you summon one for me?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '我家那口子说，若能亲眼见到一只{name}在院中走动，此生便无憾了……能帮我们圆这个梦吗？',
      en: 'My spouse says that to see a {name} walking the yard would fulfill a lifelong wish — can you make it come true?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '孩子作文里写了一种叫{name}的活物，先生非说世上没有……能帮我证明给他看吗？',
      en: 'My child wrote about a {name} in class, but the teacher insists no such creature exists — can you prove him wrong?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '驯兽师的笼子空了一格，正缺一只{name}凑满展品……能帮我寻一只来吗？',
      en: 'The menagerie has an empty cage meant for a {name} — can you find one to fill it?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '夜里老听见外头有{name}的动静，却总见不着真身……能帮我把它唤到眼前吗？',
      en: 'I hear a {name} rustling outside each night but never catch sight of it — can you call it forth for me?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '游方艺人说，他的戏法正缺一只{name}才变得出来……能帮我唤一只来吗？',
      en: 'The traveling conjurer says his trick needs a {name} to perform — can you summon one?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '族长说今年祭祖要献一只{name}为礼，可猎户迟迟没送来……能帮我弄一只来吗？',
      en: 'The elder says the ancestors\' rite calls for a {name}, but the hunter has not delivered — can you get me one?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '客栈来了一位怪客，点名要见一只{name}才肯歇脚……能帮我唤一只来打发他吗？',
      en: 'A strange guest at the inn will not rest until he sees a {name} — can you summon one to appease him?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '先生教的《山海经》里写到{name}，孩子们怎么也想象不出它的样子……能帮我唤一只来让他们开开眼吗？',
      en: 'The classic describes a {name}, but the children cannot picture it — can you summon one to show them?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老爹爹卧床多日，说梦里总有一只{name}来引路，我想替他真见上一面……能帮我唤一只来吗？',
      en: 'My father, bedridden for weeks, dreams a {name} comes to guide him — I would let him see one in the flesh. Can you summon it?',
      hintZh: '（召唤一只{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  food: [
    {
      zh: '我尝过{name}的滋味后就再忘不掉，能帮我弄一份来吗？',
      en: 'I cannot forget the taste of {name} — can you get me one?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '娘亲卧病在床，只念叨着想喝口{name}吊的命……能帮我弄些来吗？',
      en: 'My mother is bedridden and craves a taste of {name} — can you bring her some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '远客登门，我想拿{name}待客，可灶上什么都没有……能帮我弄一份来吗？',
      en: 'A guest has arrived and I would serve {name}, but the kitchen is bare — can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '孩子从邻家闻见{name}的香味，回来馋得直哭……能帮我弄一份堵住这张小嘴吗？',
      en: 'The child smelled {name} next door and came home in tears — can you get some to quiet him?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '赶了三天的路，满脑子就剩一个念头：好想再吃一口{name}……能帮我弄到吗？',
      en: 'Three days on the road, and one thought will not leave me: I ache for a bite of {name} — can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老饕说这世上若没尝过{name}算白活了，我想补上这一课……能帮我弄一份吗？',
      en: 'The gourmand says a life without tasting {name} is a life wasted — I would make up the lesson. Can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '集上卖{name}的摊子排起长龙，轮到我时偏偏卖光了……能帮我弄一份来吗？',
      en: 'The market stall selling {name} had a queue to the sky — when my turn came, it was sold out. Can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '太医嘱咐每日须进一份{name}调养身子，可药铺断了货……能帮我弄一份来吗？',
      en: 'The court physician prescribes a daily {name} to mend me, but the apothecary is out — can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '亡母生前最擅长做{name}，每逢忌日我都想再尝一口她的手艺……能帮我弄一份来吗？',
      en: 'My late mother made the finest {name}; on her memorial day I ache for a taste of her craft — can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邻家孩子带了{name}来分，自家孩子眼巴巴瞧着，我脸上挂不住……能帮我弄一份来吗？',
      en: 'The neighbor\'s child shared {name} with everyone — mine watched empty-handed, and I was shamed. Can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '行脚僧化缘只肯收{name}旁的一概不要，我正犯愁……能帮我弄一份来吗？',
      en: 'The wandering monk will accept only {name} and nothing else in his alms — can you get me some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  weapon: [
    {
      zh: '听老兵说{name}是把利器，能让我见识见识吗？',
      en: 'The veterans say a {name} is a fine weapon — can you show me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '刀剑铺的掌柜夸口说{name}削铁如泥，我偏不信……能帮我弄一把来试试吗？',
      en: 'The smith boasts a {name} cuts iron like clay — I do not believe him. Can you get me one to test?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '比武大会就差样趁手的兵刃，我想选{name}下场……能帮我弄一把来吗？',
      en: 'The tournament awaits and I would enter with a {name} — can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '山贼夜里要来，我想在门后搁一把{name}壮胆……能帮我弄一把来吗？',
      en: 'Brigands are coming tonight — I would keep a {name} by the door for courage. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '祖传的{name}当年随爷爷丢了在战场上，我想再寻一把祭他……能帮我弄一把来吗？',
      en: 'My grandfather lost his {name} on the battlefield — I would find another to honor him. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '铸剑名师说，他平生最得意的便是{name}，我想亲眼一睹……能帮我弄一把来吗？',
      en: 'The master smith calls the {name} his proudest work — I would behold one. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '官府出了告示，凡献上一把{name}者赏银百两……能帮我弄一把来吗？',
      en: 'The magistrate posted a notice: a hundred taers of silver for a {name} — can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '师弟与我赌气，说他能空手夺我的{name}，我想带一把去会会他……能帮我弄一把来吗？',
      en: 'My junior bets he can snatch a {name} from my bare hands — I would bring one to test him. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '镖局招镖师，考的便是能使{name}，我想去碰碰运气……能帮我弄一把来吗？',
      en: 'The escort house hires those who can wield a {name} — I would try my luck. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '戏文里的英雄都使一把{name}闯荡江湖，孩子做梦都想要一把……能帮我弄一把来吗？',
      en: 'In every tale the heroes roam with a {name} — my child dreams of one. Can you get me one?',
      hintZh: '（召唤一把{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  plant: [
    {
      zh: '院子里正好缺一株{name}点缀，能帮我种上一株吗？',
      en: 'The yard could use a {name} — can you plant one for me?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '亡妻生前最爱{name}，我想在坟前种一株年年陪她……能帮我弄一株来吗？',
      en: 'My late wife loved {name} — I would plant one by her grave to keep her company. Can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '花匠说{name}最难伺候，我偏要亲手养一株试试……能帮我弄一株来吗？',
      en: 'The gardener says {name} is impossible to tend — I insist on trying myself. Can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '女儿班上演节目，正缺一株{name}做布景……能帮我弄一株来吗？',
      en: 'My daughter\'s play needs a {name} for the set — can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老中医配药正缺一株{name}做引子……能帮我寻一株来吗？',
      en: 'The herbalist lacks a {name} for his prescription — can you find him one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '花会上要评"花魁"，我想拿{name}去比一比……能帮我弄一株来吗？',
      en: 'The flower fair will crown a queen of blooms — I would enter a {name}. Can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '远客说敝乡样样都好，独缺一株{name}，引为憾事……能帮我弄一株来让他开开眼吗？',
      en: 'A guest from afar says our village lacks only a {name} — can you get me one to show him?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '书上说{name}能驱蚊辟虫，夏日院中正缺一株……能帮我弄一株来吗？',
      en: 'The old book says {name} wards off insects — my summer yard needs one. Can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '族谱里记着祖宅前原有株{name}，后来枯了，我想补种一株……能帮我弄一株来吗？',
      en: 'The family chronicle records a {name} before the ancestral hall, long since withered — I would replant one. Can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '画师说要写生{name}，可满城寻不着一株……能帮我弄一株来吗？',
      en: 'The painter would sketch a {name} but cannot find one in all the town — can you get me one?',
      hintZh: '（召唤一株{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  vehicle: [
    {
      zh: '听说{name}能代步赶路，能给我弄一辆试试吗？',
      en: 'They say a {name} is good for travel — can you get me one to try?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邻家小子攒钱买了辆{name}，天天显摆，我可不甘落人后……能帮我弄一辆来吗？',
      en: 'The neighbor\'s boy bought a {name} and shows it off daily — I cannot be outdone. Can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '要赶在日落前把急信送到百里之外，非得借辆{name}不可……能帮我弄一辆来吗？',
      en: 'I must deliver this urgent letter a hundred li away before sundown — only a {name} will do. Can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '集上有人押了一辆{name}在当铺，我正想赎回来……能帮我弄一辆同款的吗？',
      en: 'A {name} sits pawned at the market — I would reclaim one like it. Can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '孩子嚷着非要坐{name}过把瘾，哭得我心都软了……能帮我弄一辆来吗？',
      en: 'The child will not stop wailing until he rides a {name} — can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邮差说他这趟送信非得有辆{name}才赶得及……能帮我弄一辆来吗？',
      en: 'The postman says only a {name} can make his rounds in time — can you get him one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '相士说我命中宜乘{name}出行，方能转运……能帮我弄一辆来吗？',
      en: 'The fortune-teller says my luck turns only if I travel by {name} — can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老东家出殡，孝子们要扶{name}送最后一程……能帮我弄一辆来吗？',
      en: 'The old master\'s funeral procession needs a {name} for the final journey — can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '游商说他这批货非得用{name}才装得下……能帮我弄一辆来吗？',
      en: 'The peddler says only a {name} can carry this load — can you get him one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '迎亲的正日子，可迎亲的{name}还没着落，媒婆急得团团转……能帮我弄一辆来吗？',
      en: 'The wedding day is here but the bridal {name} is nowhere — the matchmaker is frantic. Can you get me one?',
      hintZh: '（召唤一辆{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  element: [
    {
      zh: '炼金术士急需{name}作为原料，能帮我搜集一些吗？',
      en: 'The alchemist needs {name} as a reagent — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '法阵中央还差一份{name}才能启动……能帮我弄来吗？',
      en: 'The summoning circle lacks {name} at its heart to ignite — can you bring some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老祖传的丹方里，{name}是最后一味没凑齐的……能帮我弄来吗？',
      en: 'My ancestor\'s elixir recipe lacks only {name} — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '书上说{name}能化百毒，我正想试试……能帮我弄来吗？',
      en: 'The old tome says {name} can neutralize any poison — I would test it. Can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '炉火不旺，师父说加份{name}就能催起来……能帮我弄来吗？',
      en: 'The furnace is sluggish — my master says {name} would stir it up. Can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '封印古魔的石碑上刻着，须以{name}镇之方可永封……能帮我弄来吗？',
      en: 'The seal-stone warns the demon is bound only by {name} — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '观星台上，司天监说今夜正缺一份{name}才能测出星轨……能帮我弄来吗？',
      en: 'The astrologer on the tower needs {name} to read the stars tonight — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '异乡客说，他家乡以{name}为圣物，离了它便诸事不顺……能帮我弄来吗？',
      en: 'The stranger calls {name} sacred in his homeland — without it nothing goes right. Can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老方丈说，开光须以{name}沐佛，否则不灵……能帮我弄来吗？',
      en: 'The abbot says the consecration must bathe the Buddha in {name} — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '机关术士造的铜人差一份{name}作动力便能启动……能帮我弄来吗？',
      en: 'The artificer\'s automaton lacks only {name} to awaken — can you gather some?',
      hintZh: '（召唤一份{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  object: [
    {
      zh: '书桌上还缺一样{name}，能帮我补上吗？',
      en: 'My desk is missing a {name} — can you complete it for me?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '搬新家，正缺一样{name}才像个样子……能帮我弄一样来吗？',
      en: 'We just moved in and the place needs a {name} to feel like home — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邻家陈设样样比我家强，就这{name}他家没有……能帮我弄一样来压他一头吗？',
      en: 'The neighbor outshines us in everything — except they lack a {name}. Can you get me one to best them?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '孩子打碎了传家的{name}，老人气得直哆嗦……能帮我弄一样来赔吗？',
      en: 'The child shattered our heirloom {name} and grandpa is shaking with anger — can you get me one to replace it?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '当铺掌柜说，若能拿出一样{name}便肯收我为徒……能帮我弄一样来吗？',
      en: 'The pawnbroker will take me as apprentice if I can produce a {name} — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '夜里总觉着屋里少了样{name}才完整，翻来覆去睡不踏实……能帮我补上吗？',
      en: 'Something about the room feels incomplete without a {name} — I cannot sleep. Can you complete it for me?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '古董商说，若能拿出一样{name}，他便肯出十倍价钱收我的货……能帮我弄一样来吗？',
      en: 'The antiquarian will pay tenfold for my wares if I can show a {name} — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '风水先生看了宅子，说正堂须摆一样{name}才压得住煞气……能帮我弄一样来吗？',
      en: 'The geomancer says the hall needs a {name} to quell the ill qi — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '嫁妆单子上少了一样{name}，婆家定要笑话我家寒酸……能帮我弄一样来吗？',
      en: 'The dowry list lacks a {name} — my in-laws will mock us as poor. Can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老友远道来访，我想送他一样{name}作念想，可寻遍了也没……能帮我弄一样来吗？',
      en: 'An old friend visits from afar and I would gift a {name} as a keepsake — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '赌坊里有人押了一样{name}做注，我偏想赢过来……能帮我弄一样来凑本吗？',
      en: 'A gambler staked a {name} — I would win it from him. Can you get me one to stake?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '县太爷雅好古物，听说谁献上一样{name}便有赏……能帮我弄一样来吗？',
      en: 'The magistrate fancies curios and rewards any who offer a {name} — can you get me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
  tool: [
    {
      zh: '木匠活还差一样{name}，能帮我寻来吗？',
      en: 'My carpentry is short a {name} — can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '师父说想出师，得先自备一样{name}……能帮我寻来吗？',
      en: 'My master says I must bring my own {name} to graduate — can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邻匠借了我的{name}死活不还，我想再弄一样接着干活……能帮我寻来吗？',
      en: 'My neighbor borrowed my {name} and will not return it — I need another to keep working. Can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '孩子把我的{name}拿去玩了，不知丢哪儿了……能帮我再寻一样来吗？',
      en: 'The child took my {name} and lost it knows where — can you find me another?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '听说用{name}干活比旁的都利索，我想试试……能帮我寻一样来吗？',
      en: 'They say a {name} works smoother than any other tool — I would try it. Can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '官府征工匠修城墙，自带{name}者日给双工钱……能帮我寻一样来吗？',
      en: 'The magistrate hires masons for the wall — those with their own {name} earn double. Can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '老匠人临终传我一本册子，说{name}的用法只在书上……能帮我寻一样来照着练吗？',
      en: 'The old craftsman left me a manual — the use of {name} is written there. Can you find me one to practice with?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '邻家的{name}是出了名的好使，我想比一比自家的差在哪儿……能帮我寻一样来吗？',
      en: 'The neighbor\'s {name} is famously fine — I would compare mine against it. Can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '荒年里修屋的活多得干不完，独缺一样{name}……能帮我寻一样来吗？',
      en: 'In these hard years repair work is endless, yet I lack a {name} — can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
    {
      zh: '徒弟出师考的便是能使{name}，我想先让他练练手……能帮我寻一样来吗？',
      en: 'The apprentice\'s graduation turns on wielding a {name} — I would let him practice. Can you find me one?',
      hintZh: '（召唤一样{name}到TA身边）',
      hintEn: '(summon a {name} near)',
    },
  ],
};

const nounQuestions: Question[] = allEntries().map((entry) => {
  const meta = getWordMeta(entry.id);
  const tpls = categoryTemplates[entry.category] ?? categoryTemplates.object;
  const tpl = tpls.length === 1 ? tpls[0] : pickTemplate(tpls, entry.id);
  const zhName = entry.zh.name;
  const enName = entry.en.name;
  return {
    id: `q-${entry.id}`,
    typeId: entry.id,
    cefr: meta.cefr,
    freq: meta.freq,
    prompt: {
      zh: tpl.zh.replace('{name}', zhName),
      en: tpl.en.replace('{name}', enName),
    },
    hint: {
      zh: tpl.hintZh.replace('{name}', zhName),
      en: tpl.hintEn.replace('{name}', enName),
    },
  };
});

// ---- C. 形容词组合题 ----
//
// 保留现有 adj+noun 组合数据（颜色×物/行为×生物/状态×物/材质×物/size×物），
// 题面故事化点名"形容词+名词"（形容词是组合题的题眼，必须保留）。
// 单答案 typeId+adjectives，GoalSystem 形容词超集校验。

interface Combo {
  adj: string;
  noun: string;
}
// 颜色 × 常见名词（120 道，覆盖各档）
const colorCombos: Combo[] = [
  { adj: 'red', noun: 'bird' }, { adj: 'blue', noun: 'bird' }, { adj: 'green', noun: 'bird' },
  { adj: 'yellow', noun: 'bird' }, { adj: 'black', noun: 'bird' }, { adj: 'white', noun: 'bird' },
  { adj: 'red', noun: 'cat' }, { adj: 'black', noun: 'cat' }, { adj: 'white', noun: 'cat' },
  { adj: 'brown', noun: 'dog' }, { adj: 'black', noun: 'dog' }, { adj: 'white', noun: 'dog' },
  { adj: 'gray', noun: 'elephant' }, { adj: 'pink', noun: 'pig' }, { adj: 'gold', noun: 'fish' },
  { adj: 'red', noun: 'flower' }, { adj: 'yellow', noun: 'flower' }, { adj: 'purple', noun: 'flower' },
  { adj: 'white', noun: 'flower' }, { adj: 'blue', noun: 'flower' }, { adj: 'orange', noun: 'flower' },
  { adj: 'red', noun: 'apple' }, { adj: 'green', noun: 'apple' }, { adj: 'yellow', noun: 'apple' },
  { adj: 'red', noun: 'car' }, { adj: 'blue', noun: 'car' }, { adj: 'black', noun: 'car' },
  { adj: 'white', noun: 'car' }, { adj: 'green', noun: 'car' }, { adj: 'gold', noun: 'car' },
  { adj: 'red', noun: 'balloon' }, { adj: 'blue', noun: 'balloon' }, { adj: 'green', noun: 'balloon' },
  { adj: 'yellow', noun: 'balloon' }, { adj: 'pink', noun: 'balloon' }, { adj: 'purple', noun: 'balloon' },
  { adj: 'red', noun: 'book' }, { adj: 'blue', noun: 'book' }, { adj: 'green', noun: 'book' },
  { adj: 'red', noun: 'hat-top' }, { adj: 'blue', noun: 'hat-top' }, { adj: 'black', noun: 'hat-top' },
  { adj: 'red', noun: 'shirt' }, { adj: 'blue', noun: 'shirt' }, { adj: 'green', noun: 'shirt' },
  { adj: 'black', noun: 'shoe' }, { adj: 'brown', noun: 'shoe' }, { adj: 'red', noun: 'shoe' },
  { adj: 'red', noun: 'rose' }, { adj: 'white', noun: 'rose' }, { adj: 'yellow', noun: 'rose' },
  { adj: 'red', noun: 'crown' }, { adj: 'gold', noun: 'crown' }, { adj: 'silver', noun: 'crown' },
  { adj: 'red', noun: 'door' }, { adj: 'blue', noun: 'door' }, { adj: 'green', noun: 'door' },
  { adj: 'red', noun: 'umbrella-rain' }, { adj: 'blue', noun: 'umbrella-rain' }, { adj: 'yellow', noun: 'umbrella-rain' },
  // 扩充：更多颜色×物组合
  { adj: 'red', noun: 'ball' }, { adj: 'blue', noun: 'ball' }, { adj: 'green', noun: 'ball' },
  { adj: 'yellow', noun: 'ball' }, { adj: 'white', noun: 'ball' }, { adj: 'black', noun: 'ball' },
  { adj: 'red', noun: 'box' }, { adj: 'blue', noun: 'box' }, { adj: 'green', noun: 'box' },
  { adj: 'yellow', noun: 'box' }, { adj: 'white', noun: 'box' }, { adj: 'black', noun: 'box' },
  { adj: 'red', noun: 'chair' }, { adj: 'blue', noun: 'chair' }, { adj: 'green', noun: 'chair' },
  { adj: 'brown', noun: 'chair' }, { adj: 'white', noun: 'chair' }, { adj: 'black', noun: 'chair' },
  { adj: 'red', noun: 'table' }, { adj: 'blue', noun: 'table' }, { adj: 'green', noun: 'table' },
  { adj: 'brown', noun: 'table' }, { adj: 'white', noun: 'table' }, { adj: 'black', noun: 'table' },
  { adj: 'red', noun: 'key' }, { adj: 'blue', noun: 'key' }, { adj: 'green', noun: 'key' },
  { adj: 'gold', noun: 'key' }, { adj: 'silver', noun: 'key' }, { adj: 'white', noun: 'key' },
  { adj: 'gold', noun: 'coin' }, { adj: 'silver', noun: 'coin' }, { adj: 'brown', noun: 'coin' },
  { adj: 'red', noun: 'gem' }, { adj: 'blue', noun: 'gem' }, { adj: 'green', noun: 'gem' },
  { adj: 'purple', noun: 'gem' }, { adj: 'white', noun: 'gem' }, { adj: 'black', noun: 'gem' },
  { adj: 'red', noun: 'tower' }, { adj: 'blue', noun: 'tower' }, { adj: 'green', noun: 'tower' },
  { adj: 'white', noun: 'tower' }, { adj: 'black', noun: 'tower' }, { adj: 'yellow', noun: 'tower' },
  { adj: 'red', noun: 'sign' }, { adj: 'blue', noun: 'sign' }, { adj: 'green', noun: 'sign' },
  { adj: 'white', noun: 'sign' }, { adj: 'black', noun: 'sign' }, { adj: 'yellow', noun: 'sign' },
  { adj: 'red', noun: 'scroll' }, { adj: 'blue', noun: 'scroll' }, { adj: 'black', noun: 'scroll' },
  { adj: 'red', noun: 'vase' }, { adj: 'blue', noun: 'vase' }, { adj: 'green', noun: 'vase' },
  { adj: 'red', noun: 'barrel' }, { adj: 'blue', noun: 'barrel' }, { adj: 'white', noun: 'barrel' },
  { adj: 'red', noun: 'ring' }, { adj: 'blue', noun: 'ring' }, { adj: 'green', noun: 'ring' },
  { adj: 'gold', noun: 'ring' }, { adj: 'silver', noun: 'ring' }, { adj: 'white', noun: 'ring' },
  { adj: 'red', noun: 'gate' }, { adj: 'blue', noun: 'gate' }, { adj: 'gold', noun: 'gate' },
];

// 生僻颜色 × 常见名词（25 道，大师档）
const rareColorCombos: Combo[] = [
  { adj: 'crimson', noun: 'bird' }, { adj: 'crimson', noun: 'rose' }, { adj: 'scarlet', noun: 'flower' },
  { adj: 'navy', noun: 'car' }, { adj: 'navy', noun: 'hat-top' }, { adj: 'violet', noun: 'flower' },
  { adj: 'indigo', noun: 'bird' }, { adj: 'turquoise', noun: 'fish' }, { adj: 'teal', noun: 'bird' },
  { adj: 'magenta', noun: 'balloon' }, { adj: 'maroon', noun: 'car' }, { adj: 'ivory', noun: 'cat' },
  { adj: 'coral', noun: 'flower' }, { adj: 'salmon', noun: 'fish' }, { adj: 'khaki', noun: 'pants' },
  { adj: 'lavender', noun: 'flower' }, { adj: 'peach', noun: 'balloon' }, { adj: 'skyblue', noun: 'car' },
  { adj: 'olive', noun: 'shirt' }, { adj: 'amber', noun: 'gem' }, { adj: 'sienna', noun: 'dog' },
  { adj: 'chartreuse', noun: 'bird' }, { adj: 'plum', noun: 'hat-top' }, { adj: 'marigold', noun: 'flower' },
  { adj: 'royalblue', noun: 'crown' },
  // 扩充：更多生僻颜色×物组合
  { adj: 'crimson', noun: 'apple' }, { adj: 'crimson', noun: 'flower' }, { adj: 'scarlet', noun: 'rose' },
  { adj: 'navy', noun: 'book' }, { adj: 'navy', noun: 'shirt' }, { adj: 'violet', noun: 'gem' },
  { adj: 'indigo', noun: 'flower' }, { adj: 'turquoise', noun: 'bird' }, { adj: 'teal', noun: 'fish' },
  { adj: 'magenta', noun: 'flower' }, { adj: 'maroon', noun: 'hat-top' }, { adj: 'ivory', noun: 'door' },
  { adj: 'coral', noun: 'balloon' }, { adj: 'salmon', noun: 'shirt' }, { adj: 'khaki', noun: 'hat-top' },
  { adj: 'lavender', noun: 'balloon' }, { adj: 'peach', noun: 'flower' }, { adj: 'skyblue', noun: 'door' },
  { adj: 'olive', noun: 'pants' }, { adj: 'amber', noun: 'ball' }, { adj: 'sienna', noun: 'cat' },
  { adj: 'chartreuse', noun: 'flower' }, { adj: 'plum', noun: 'dress' }, { adj: 'marigold', noun: 'balloon' },
  { adj: 'royalblue', noun: 'car' }, { adj: 'crimson', noun: 'car' }, { adj: 'scarlet', noun: 'car' },
  { adj: 'navy', noun: 'door' }, { adj: 'violet', noun: 'balloon' }, { adj: 'indigo', noun: 'car' },
  { adj: 'turquoise', noun: 'flower' }, { adj: 'teal', noun: 'car' }, { adj: 'magenta', noun: 'bird' },
  { adj: 'maroon', noun: 'shirt' }, { adj: 'ivory', noun: 'shirt' }, { adj: 'coral', noun: 'fish' },
  { adj: 'salmon', noun: 'flower' }, { adj: 'khaki', noun: 'shirt' }, { adj: 'lavender', noun: 'bird' },
  { adj: 'peach', noun: 'car' }, { adj: 'skyblue', noun: 'hat-top' }, { adj: 'olive', noun: 'hat-top' },
  { adj: 'amber', noun: 'flower' }, { adj: 'sienna', noun: 'horse' }, { adj: 'chartreuse', noun: 'car' },
  { adj: 'plum', noun: 'flower' }, { adj: 'marigold', noun: 'car' }, { adj: 'royalblue', noun: 'book' },
];

// 行为形容词 × 生物（50 道）
const behaviorCombos: Combo[] = [
  { adj: 'flying', noun: 'dog' }, { adj: 'flying', noun: 'cat' }, { adj: 'flying', noun: 'horse' },
  { adj: 'flying', noun: 'pig' }, { adj: 'flying', noun: 'cow' }, { adj: 'flying', noun: 'elephant' },
  { adj: 'flying', noun: 'monkey' }, { adj: 'flying', noun: 'rabbit' }, { adj: 'flying', noun: 'human' },
  { adj: 'swimming', noun: 'dog' }, { adj: 'swimming', noun: 'cat' }, { adj: 'swimming', noun: 'bird' },
  { adj: 'swimming', noun: 'horse' }, { adj: 'swimming', noun: 'human' }, { adj: 'swimming', noun: 'pig' },
  { adj: 'aggressive', noun: 'dog' }, { adj: 'aggressive', noun: 'cat' }, { adj: 'aggressive', noun: 'bird' },
  { adj: 'aggressive', noun: 'rabbit' }, { adj: 'aggressive', noun: 'sheep' }, { adj: 'aggressive', noun: 'cow' },
  { adj: 'friendly', noun: 'dog' }, { adj: 'friendly', noun: 'cat' }, { adj: 'friendly', noun: 'wolf' },
  { adj: 'friendly', noun: 'bear' }, { adj: 'friendly', noun: 'tiger' }, { adj: 'friendly', noun: 'lion' },
  { adj: 'friendly', noun: 'dragon' }, { adj: 'friendly', noun: 'snake' },
  { adj: 'scared', noun: 'dog' }, { adj: 'scared', noun: 'cat' }, { adj: 'scared', noun: 'mouse' },
  { adj: 'scared', noun: 'rabbit' }, { adj: 'scared', noun: 'bird' },
  { adj: 'sleepy', noun: 'cat' }, { adj: 'sleepy', noun: 'dog' }, { adj: 'sleepy', noun: 'bear' },
  { adj: 'sleepy', noun: 'human' }, { adj: 'sleepy', noun: 'pig' },
  { adj: 'hungry', noun: 'dog' }, { adj: 'hungry', noun: 'bear' }, { adj: 'hungry', noun: 'lion' },
  { adj: 'hungry', noun: 'tiger' }, { adj: 'hungry', noun: 'wolf' },
  { adj: 'fast', noun: 'dog' }, { adj: 'fast', noun: 'horse' }, { adj: 'fast', noun: 'cheetah' },
  { adj: 'slow', noun: 'turtle' }, { adj: 'slow', noun: 'snail' },
  // 扩充：更多行为×生物组合
  { adj: 'flying', noun: 'fish' }, { adj: 'flying', noun: 'bird' }, { adj: 'flying', noun: 'snake' },
  { adj: 'flying', noun: 'frog' }, { adj: 'flying', noun: 'mouse' }, { adj: 'flying', noun: 'tiger' },
  { adj: 'swimming', noun: 'fish' }, { adj: 'swimming', noun: 'turtle' }, { adj: 'swimming', noun: 'snake' },
  { adj: 'swimming', noun: 'frog' }, { adj: 'swimming', noun: 'bear' }, { adj: 'swimming', noun: 'duck' },
  { adj: 'aggressive', noun: 'wolf' }, { adj: 'aggressive', noun: 'bear' }, { adj: 'aggressive', noun: 'tiger' },
  { adj: 'aggressive', noun: 'lion' }, { adj: 'aggressive', noun: 'dragon' }, { adj: 'aggressive', noun: 'snake' },
  { adj: 'friendly', noun: 'human' }, { adj: 'friendly', noun: 'rabbit' }, { adj: 'friendly', noun: 'mouse' },
  { adj: 'friendly', noun: 'horse' }, { adj: 'friendly', noun: 'cow' }, { adj: 'friendly', noun: 'pig' },
  { adj: 'scared', noun: 'sheep' }, { adj: 'scared', noun: 'chicken' },
  { adj: 'scared', noun: 'pig' }, { adj: 'scared', noun: 'human' }, { adj: 'scared', noun: 'wolf' },
  { adj: 'sleepy', noun: 'rabbit' }, { adj: 'sleepy', noun: 'cow' },
  { adj: 'sleepy', noun: 'sheep' }, { adj: 'sleepy', noun: 'wolf' }, { adj: 'sleepy', noun: 'tiger' },
  { adj: 'hungry', noun: 'cat' }, { adj: 'hungry', noun: 'pig' },
  { adj: 'hungry', noun: 'human' }, { adj: 'hungry', noun: 'dragon' }, { adj: 'hungry', noun: 'cow' },
  { adj: 'fast', noun: 'bird' }, { adj: 'fast', noun: 'cat' }, { adj: 'fast', noun: 'human' },
  { adj: 'fast', noun: 'car' }, { adj: 'fast', noun: 'fish' },
  { adj: 'slow', noun: 'bear' }, { adj: 'slow', noun: 'pig' }, { adj: 'slow', noun: 'cow' },
];

// 状态形容词 × 物（40 道）
const stateCombos: Combo[] = [
  { adj: 'frozen', noun: 'apple' }, { adj: 'frozen', noun: 'meat' }, { adj: 'frozen', noun: 'fish' },
  { adj: 'frozen', noun: 'sword' }, { adj: 'frozen', noun: 'stone' }, { adj: 'frozen', noun: 'water' },
  { adj: 'frozen', noun: 'flower' }, { adj: 'frozen', noun: 'book' },
  { adj: 'burning', noun: 'tree' }, { adj: 'burning', noun: 'wood' }, { adj: 'burning', noun: 'box' },
  { adj: 'burning', noun: 'chair' }, { adj: 'burning', noun: 'book' }, { adj: 'burning', noun: 'barrel' },
  { adj: 'burning', noun: 'table' }, { adj: 'burning', noun: 'log' },
  { adj: 'wet', noun: 'cat' }, { adj: 'wet', noun: 'dog' }, { adj: 'wet', noun: 'human' },
  { adj: 'wet', noun: 'book' }, { adj: 'wet', noun: 'paper' },
  { adj: 'hot', noun: 'soup' }, { adj: 'hot', noun: 'tea' }, { adj: 'hot', noun: 'coffee' },
  { adj: 'hot', noun: 'stone' }, { adj: 'hot', noun: 'apple' },
  { adj: 'cold', noun: 'water' }, { adj: 'cold', noun: 'milk' }, { adj: 'cold', noun: 'stone' },
  { adj: 'cold', noun: 'meat' }, { adj: 'cold', noun: 'ice' },
  { adj: 'glowing', noun: 'gem' }, { adj: 'glowing', noun: 'crystal-ball' }, { adj: 'glowing', noun: 'stone' },
  { adj: 'glowing', noun: 'mushroom' }, { adj: 'glowing', noun: 'fish' },
  { adj: 'rotten', noun: 'apple' }, { adj: 'rotten', noun: 'meat' }, { adj: 'rotten', noun: 'egg' },
  { adj: 'rotten', noun: 'bread' }, { adj: 'rotten', noun: 'fish' },
  // 扩充：更多状态×物组合（已去重，不与上文同数组重复）
  { adj: 'frozen', noun: 'cat' }, { adj: 'frozen', noun: 'dog' }, { adj: 'frozen', noun: 'bird' },
  { adj: 'frozen', noun: 'tree' }, { adj: 'frozen', noun: 'ice' }, { adj: 'frozen', noun: 'pig' },
  { adj: 'burning', noun: 'cottage' }, { adj: 'burning', noun: 'car' },
  { adj: 'burning', noun: 'boat' }, { adj: 'burning', noun: 'bridge' }, { adj: 'burning', noun: 'door' },
  { adj: 'wet', noun: 'shirt' }, { adj: 'wet', noun: 'coin' },
  { adj: 'hot', noun: 'lava' }, { adj: 'hot', noun: 'fire' }, { adj: 'hot', noun: 'sand' },
  { adj: 'hot', noun: 'metal' }, { adj: 'hot', noun: 'oven' },
  { adj: 'cold', noun: 'wind' }, { adj: 'cold', noun: 'snow' }, { adj: 'cold', noun: 'sword' }, { adj: 'cold', noun: 'tea' },
  { adj: 'glowing', noun: 'fire' }, { adj: 'glowing', noun: 'light' }, { adj: 'glowing', noun: 'lamp' },
  { adj: 'glowing', noun: 'torch' }, { adj: 'glowing', noun: 'crystal' },
  { adj: 'rotten', noun: 'tree' }, { adj: 'rotten', noun: 'wood' }, { adj: 'rotten', noun: 'log' },
];

// 材质形容词 × 物（40 道）
const materialCombos: Combo[] = [
  { adj: 'golden', noun: 'apple' }, { adj: 'golden', noun: 'sword' }, { adj: 'golden', noun: 'crown' },
  { adj: 'golden', noun: 'key' }, { adj: 'golden', noun: 'coin' }, { adj: 'golden', noun: 'ring' },
  { adj: 'golden', noun: 'egg' }, { adj: 'golden', noun: 'ball' },
  { adj: 'wooden', noun: 'sword' }, { adj: 'wooden', noun: 'shield' }, { adj: 'wooden', noun: 'box' },
  { adj: 'wooden', noun: 'chair' }, { adj: 'wooden', noun: 'table' }, { adj: 'wooden', noun: 'barrel' },
  { adj: 'wooden', noun: 'horse' }, { adj: 'wooden', noun: 'car' },
  { adj: 'stone', noun: 'sword' }, { adj: 'stone', noun: 'shield' }, { adj: 'stone', noun: 'box' },
  { adj: 'stone', noun: 'chair' }, { adj: 'stone', noun: 'table' }, { adj: 'stone', noun: 'door' },
  { adj: 'stone', noun: 'golem' },
  { adj: 'metallic', noun: 'box' }, { adj: 'metallic', noun: 'ball' }, { adj: 'metallic', noun: 'dog' },
  { adj: 'metallic', noun: 'bird' }, { adj: 'metallic', noun: 'cat' },
  { adj: 'rubber', noun: 'ball' }, { adj: 'rubber', noun: 'duck' }, { adj: 'rubber', noun: 'dog' },
  { adj: 'glassy', noun: 'apple' }, { adj: 'glassy', noun: 'ball' }, { adj: 'glassy', noun: 'bird' },
  { adj: 'diamond', noun: 'sword' }, { adj: 'diamond', noun: 'gem' }, { adj: 'diamond', noun: 'ring' },
  { adj: 'crystal', noun: 'gem' }, { adj: 'crystal', noun: 'apple' }, { adj: 'crystal', noun: 'bird' },
  // 扩充：更多材质×物组合
  { adj: 'golden', noun: 'necklace' },
  { adj: 'golden', noun: 'door' }, { adj: 'golden', noun: 'gate' }, { adj: 'golden', noun: 'trophy' },
  { adj: 'wooden', noun: 'crate' }, { adj: 'wooden', noun: 'boat' },
  { adj: 'wooden', noun: 'ladder' }, { adj: 'wooden', noun: 'fence-stone' }, { adj: 'wooden', noun: 'sign' },
  { adj: 'stone', noun: 'tower' }, { adj: 'stone', noun: 'castle' }, { adj: 'stone', noun: 'bridge' },
  { adj: 'stone', noun: 'pillar' }, { adj: 'stone', noun: 'statue' },
  { adj: 'metallic', noun: 'car' }, { adj: 'metallic', noun: 'sword' }, { adj: 'metallic', noun: 'robot' },
  { adj: 'metallic', noun: 'shield' }, { adj: 'metallic', noun: 'armor' }, { adj: 'metallic', noun: 'door' },
  { adj: 'rubber', noun: 'boot' },
  { adj: 'glassy', noun: 'window' }, { adj: 'glassy', noun: 'door' }, { adj: 'glassy', noun: 'vase' },
  { adj: 'glassy', noun: 'barrel' }, { adj: 'glassy', noun: 'box' }, { adj: 'glassy', noun: 'mirror' },
  { adj: 'diamond', noun: 'crown' }, { adj: 'diamond', noun: 'necklace' },
  { adj: 'crystal', noun: 'crown' }, { adj: 'crystal', noun: 'wand' },
];

// size 形容词 × 物（47 道）
const sizeCombos: Combo[] = [
  { adj: 'big', noun: 'cat' }, { adj: 'big', noun: 'dog' }, { adj: 'big', noun: 'bird' },
  { adj: 'big', noun: 'fish' }, { adj: 'big', noun: 'apple' }, { adj: 'big', noun: 'car' },
  { adj: 'big', noun: 'tree' }, { adj: 'big', noun: 'stone' }, { adj: 'big', noun: 'box' },
  { adj: 'big', noun: 'castle' },
  { adj: 'small', noun: 'cat' }, { adj: 'small', noun: 'dog' }, { adj: 'small', noun: 'bird' },
  { adj: 'small', noun: 'fish' }, { adj: 'small', noun: 'car' }, { adj: 'small', noun: 'tree' },
  { adj: 'small', noun: 'apple' }, { adj: 'small', noun: 'stone' },
  { adj: 'giant', noun: 'cat' }, { adj: 'giant', noun: 'dog' }, { adj: 'giant', noun: 'bird' },
  { adj: 'giant', noun: 'snake' }, { adj: 'giant', noun: 'human' },
  { adj: 'giant', noun: 'apple' }, { adj: 'giant', noun: 'tree' },
  { adj: 'tiny', noun: 'elephant' }, { adj: 'tiny', noun: 'cat' }, { adj: 'tiny', noun: 'dog' },
  { adj: 'tiny', noun: 'bird' }, { adj: 'tiny', noun: 'human' }, { adj: 'tiny', noun: 'car' },
  { adj: 'enormous', noun: 'elephant' }, { adj: 'enormous', noun: 'tree' }, { adj: 'enormous', noun: 'stone' },
  { adj: 'enormous', noun: 'box' }, { adj: 'enormous', noun: 'apple' },
  { adj: 'massive', noun: 'stone' }, { adj: 'massive', noun: 'box' }, { adj: 'massive', noun: 'table' },
  { adj: 'massive', noun: 'tower' }, { adj: 'massive', noun: 'gate' },
  { adj: 'tall', noun: 'human' }, { adj: 'tall', noun: 'tree' }, { adj: 'tall', noun: 'tower' },
  { adj: 'long', noun: 'rope' }, { adj: 'long', noun: 'snake' }, { adj: 'long', noun: 'sword' },
  // 扩充：更多 size×物组合（已去重，不与上文同数组重复）
  { adj: 'big', noun: 'cottage' }, { adj: 'big', noun: 'bear' }, { adj: 'big', noun: 'table' },
  { adj: 'small', noun: 'mouse' }, { adj: 'small', noun: 'pig' },
  { adj: 'giant', noun: 'spider' }, { adj: 'giant', noun: 'squid' },
  { adj: 'giant', noun: 'stone' }, { adj: 'giant', noun: 'bear' },
  { adj: 'tiny', noun: 'mouse' },
  { adj: 'enormous', noun: 'cottage' },
  { adj: 'enormous', noun: 'dog' }, { adj: 'enormous', noun: 'bear' },
  { adj: 'massive', noun: 'door' },
  { adj: 'massive', noun: 'pillar' }, { adj: 'massive', noun: 'castle' },
  { adj: 'tall', noun: 'pillar' }, { adj: 'tall', noun: 'giant' }, { adj: 'tall', noun: 'door' },
  { adj: 'long', noun: 'bridge' }, { adj: 'long', noun: 'chain' }, { adj: 'long', noun: 'vine' },
];

const allCombos: Combo[] = [
  ...colorCombos, ...rareColorCombos, ...behaviorCombos,
  ...stateCombos, ...materialCombos, ...sizeCombos,
];

// 形容词中文名（用于题面），按 id 映射
const adjZhName: Record<string, string> = {
  red: '红', orange: '橙', yellow: '黄', green: '绿', cyan: '青', blue: '蓝', purple: '紫',
  pink: '粉', black: '黑', white: '白', gold: '金', brown: '棕', silver: '银', gray: '灰',
  crimson: '绯红', navy: '藏青', lime: '青绿', magenta: '品红', tan: '棕褐', ivory: '象牙',
  scarlet: '猩红', maroon: '褐红', violet: '紫罗兰', indigo: '靛蓝', turquoise: '绿松',
  teal: '凫青', olive: '橄榄', marigold: '金盏', coral: '珊瑚', salmon: '鲑红', khaki: '卡其',
  plum: '梅紫', lavender: '薰衣草', mint: '薄荷', peach: '桃粉', skyblue: '天蓝',
  royalblue: '宝蓝', chocolate: '巧克力色', sienna: '赭石', chartreuse: '黄绿',
  'cyan-bright': '亮青', 'magenta-bright': '亮品红', amber: '琥珀', 'crimson-red': '深红', 'amber-dark': '焦琥珀',
  flying: '飞行', swimming: '游泳', aggressive: '凶猛', friendly: '友好', scared: '胆小',
  sleepy: '嗜睡', hungry: '饥饿', brave: '勇敢', crazy: '疯狂', lazy: '懒惰',
  fast: '快速', slow: '缓慢', immobile: '静止', loyal: '忠诚', wild: '野性', gentle: '温顺',
  frozen: '冰冻', burning: '燃烧', wet: '湿润', hot: '炎热', cold: '寒冷', glowing: '发光',
  rotten: '腐烂', golden: '金质', wooden: '木质', stone: '石质', metallic: '金属',
  rubber: '橡胶', glassy: '玻璃', diamond: '钻石', crystal: '水晶', big: '大', small: '小',
  giant: '巨大', tiny: '微小', enormous: '庞大', massive: '巨型', tall: '高', long: '长',
};

/** 类别 → 组合题双语故事化题面模板，{adj}/{name} 处填入形容词与名词双语名 */
const comboTemplates: Record<string, { zh: string; en: string; hintZh: string; hintEn: string }[]> = {
  color: [
    {
      zh: '我想画一只{adj}的{name}当模特，能帮我唤来一只吗？',
      en: 'I want to paint a {adj} {name} as a model — can you summon one for me?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '女儿非要一只{adj}的{name}摆在床头陪她睡，能帮我弄一只来吗？',
      en: 'My daughter insists on a {adj} {name} by her pillow to sleep — can you get her one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '听说{adj}的{name}最是吉利，我想请一只镇宅……能帮我弄一只来吗？',
      en: 'They say a {adj} {name} brings good fortune — I would keep one to ward the house. Can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '婚房里要摆一对{adj}的{name}才喜庆，能帮我弄一只来凑数吗？',
      en: 'The bridal chamber needs a pair of {adj} {name} for luck — can you get me one to match?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '老画师说{adj}的{name}最难调色，我偏要试一试……能帮我唤一只来吗？',
      en: 'The old painter says a {adj} {name} is the hardest to mix — I insist on trying. Can you summon one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '戏台上的行头正缺一样{adj}的{name}做道具，能帮我弄一只来吗？',
      en: 'The stage lacks a {adj} {name} as a prop — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '绣娘要绣一幅{adj}的{name}作样，可没实物对照总绣不像……能帮我弄一只来吗？',
      en: 'The embroideress would stitch a {adj} {name} but lacks a model — can you get her one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '私塾先生教认色，正缺一样{adj}的{name}做教具……能帮我弄一只来吗？',
      en: 'The schoolmaster teaches colors and needs a {adj} {name} as a teaching aid — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '相士说我命中忌黑宜{adj}色，须见一只{adj}的{name}方能化解……能帮我弄一只来吗？',
      en: 'The seer says my stars shun black and favor {adj} — a {adj} {name} would break the curse. Can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '茶楼说书人正讲一段{adj}的{name}的传奇，听客都想亲眼看一眼……能帮我弄一只来吗？',
      en: 'The teahouse bard tells a tale of a {adj} {name}, and the patrons ache to see one — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '庙会上猜灯谜，谜底正是{adj}的{name}，掌柜说要拿出实物才给彩头……能帮我弄一只来吗？',
      en: 'The temple-fair riddle\'s answer is a {adj} {name} — the stallkeeper demands the real thing for the prize. Can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
  rareColor: [
    {
      zh: '听说{adj}色的{name}世间少见，能帮我寻一只来开开眼吗？',
      en: 'They say a {adj} {name} is a rare sight — can you find one for me?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '宫里传话说，谁献上一只{adj}的{name}便封侯……能帮我寻一只来吗？',
      en: 'The palace proclaims: he who offers a {adj} {name} shall be made a lord — can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '藏书里画着一只{adj}的{name}，标注"世所罕见"，我想亲眼看一眼……能帮我寻一只来吗？',
      en: 'An old bestiary depicts a {adj} {name}, marked "exceedingly rare" — I would see one with my own eyes. Can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '相士说，命中若得见一只{adj}的{name}，运势便会转……能帮我寻一只来吗？',
      en: 'The fortune-teller says my luck turns the moment I behold a {adj} {name} — can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '拍卖行正在征集{adj}的{name}，说是能拍出天价……能帮我寻一只来吗？',
      en: 'The auction house seeks a {adj} {name}, said to fetch a fortune — can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '老收藏家临终遗愿，便是再见一眼{adj}的{name}……能帮我寻一只来吗？',
      en: 'The old collector\'s dying wish is to behold a {adj} {name} once more — can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '博物苑正缺一件{adj}的{name}做镇苑之宝，院长急得到处张罗……能帮我寻一只来吗？',
      en: 'The museum lacks a {adj} {name} for its crown jewel — the director is at his wits\' end. Can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '戏班要演一出{adj}的{name}的故事，正缺活物上台亮相……能帮我寻一只来吗？',
      en: 'The troupe stages a tale of a {adj} {name} and needs one live on stage — can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '游商说他走过天涯海角，独没见过{adj}的{name}……能帮我寻一只来让他开开眼吗？',
      en: 'The peddler has roamed the world yet never seen a {adj} {name} — can you find me one to show him?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '画圣的名作里绘着一只{adj}的{name}，世人皆欲亲睹真容……能帮我寻一只来吗？',
      en: 'The master\'s opus depicts a {adj} {name} — all the world would see its true form. Can you find me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
  behavior: [
    {
      zh: '驯兽师夸口说他训练得出{adj}的{name}，我想亲眼瞧瞧……能弄一只来吗？',
      en: 'The tamer boasted he can train a {adj} {name} — I want to see it. Can you get one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '马戏班正缺一只{adj}的{name}压轴，班主急得团团转……能帮我弄一只来吗？',
      en: 'The circus lacks a {adj} {name} for the finale — the ringmaster is frantic. Can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '孩子作文里写他养了一只{adj}的{name}，先生非说世上没有……能帮我证明给他看吗？',
      en: 'My child wrote of a {adj} {name} he keeps, but the teacher calls it fantasy — can you prove him wrong?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '猎户说，若有一只{adj}的{name}相助，今冬的猎获便能翻倍……能帮我弄一只来吗？',
      en: 'The hunter says a {adj} {name} would double his winter take — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '邻家新得了一只{adj}的{name}，我家孩子眼馋得不行……能帮我弄一只来吗？',
      en: 'The neighbors got a {adj} {name}, and my child is green with envy — can you get us one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '牧人说他那群{name}里，就缺一只{adj}的做头羊……能帮我弄一只来吗？',
      en: 'The herder says his flock of {name} lacks a {adj} one to lead — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '将军坐骑厩中正缺一匹{adj}的{name}，才能配得上他的威仪……能帮我弄一只来吗？',
      en: 'The general\'s stable lacks a {adj} {name} to match his bearing — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '驯兽经上说，{adj}的{name}最难驯服，驯兽师偏要挑战……能帮我弄一只来吗？',
      en: 'The bestiary says a {adj} {name} is the hardest to tame — the trainer insists on the challenge. Can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '御苑里样样都有，独缺一只{adj}的{name}点缀，圣上不悦……能帮我弄一只来吗？',
      en: 'The imperial garden has everything but a {adj} {name}, and His Majesty is displeased — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '客栈掌柜说，若有一只{adj}的{name}镇店，客人便会络绎不绝……能帮我弄一只来吗？',
      en: 'The innkeeper swears a {adj} {name} by the door draws guests without end — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
  state: [
    {
      zh: '厨房里要一样{adj}的{name}才成这道菜，能帮我弄来吗？',
      en: 'This recipe calls for a {adj} {name} — can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '药方上写着，须用一份{adj}的{name}入药……能帮我弄来吗？',
      en: 'The prescription demands a {adj} {name} — can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '实验台上正缺一份{adj}的{name}做样本……能帮我弄来吗？',
      en: 'The bench lacks a {adj} {name} for the experiment — can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '老道士炼丹正缺一份{adj}的{name}做药引……能帮我弄来吗？',
      en: 'The old alchemist needs a {adj} {name} for his elixir — can you get him one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '藏家说，{adj}的{name}比寻常的值钱十倍，我想亲眼瞧瞧……能帮我弄来吗？',
      en: 'The collector says a {adj} {name} is worth ten times the common kind — I would see it. Can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '祭祀大典上，须以一份{adj}的{name}献于神前，司仪正四处寻……能帮我弄来吗？',
      en: 'The rite demands a {adj} {name} offered to the gods — the officiant searches far and wide. Can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '老饕说，{adj}的{name}风味殊异，寻常的不可同日而语……能帮我弄来吗？',
      en: 'The gourmand swears a {adj} {name} is a cut above the ordinary — can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '县太爷断案，正缺一样{adj}的{name}做物证……能帮我弄来吗？',
      en: 'The magistrate needs a {adj} {name} as evidence — can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '机关盒的钥匙正是一样{adj}的{name}，缺它便打不开……能帮我弄来吗？',
      en: 'The puzzle box\'s key is a {adj} {name} — without it the box will not yield. Can you get me one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '炼蛊的巫祝说，须以一份{adj}的{name}入蛊方能成……能帮我弄来吗？',
      en: 'The shaman says his gu-venom needs a {adj} {name} to mature — can you get him one?',
      hintZh: '（召唤一样{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
  material: [
    {
      zh: '国王下旨要一尊{adj}的{name}赏赐功臣，能帮我打造一尊吗？',
      en: 'The king decreed a {adj} {name} to honor the hero — can you forge one for me?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '拍卖行说，一尊{adj}的{name}能换一座城池，我想亲眼开开眼……能帮我打造一尊吗？',
      en: 'The auction house says a {adj} {name} could trade for a city — I would see such a thing. Can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '匠人夸口说他能做出{adj}的{name}，我偏不信……能帮我打造一尊来试试吗？',
      en: 'The artisan boasts he can craft a {adj} {name} — I do not believe him. Can you forge one to test?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '祠堂正缺一尊{adj}的{name}做镇物，族长急得直跺脚……能帮我打造一尊吗？',
      en: 'The shrine needs a {adj} {name} as its ward — the elder is stamping with worry. Can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '远客说，若能见到一尊{adj}的{name}便不虚此行……能帮我打造一尊吗？',
      en: 'A guest from afar says a {adj} {name} would make his journey worthwhile — can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '藏经阁的护法说，须有一尊{adj}的{name}方能开启密室……能帮我打造一尊吗？',
      en: 'The scripture vault\'s guardian says a {adj} {name} opens the secret chamber — can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '女儿出嫁，娘家要陪送一尊{adj}的{name}才体面……能帮我打造一尊吗？',
      en: 'My daughter weds, and a {adj} {name} as dowry would save our face — can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '老铸匠说，他平生未铸过{adj}的{name}，引为憾事……能帮我打造一尊让他了愿吗？',
      en: 'The old smith has never cast a {adj} {name} and rues it — can you forge one to grant his wish?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '佛寺开光，须以一尊{adj}的{name}镇山门……能帮我打造一尊吗？',
      en: 'The temple consecration needs a {adj} {name} to ward the gate — can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '赌坊老板说，他愿以一尊{adj}的{name}做镇场之宝……能帮我打造一尊吗？',
      en: 'The gambling house master wants a {adj} {name} as his house treasure — can you forge one?',
      hintZh: '（召唤一尊{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
  size: [
    {
      zh: '女儿缠着非要一只{adj}的{name}不可，能帮我弄一只来吗？',
      en: 'My daughter insists on a {adj} {name} and nothing else — can you get her one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '马戏班的台柱子说，要一只{adj}的{name}才镇得住场子……能帮我弄一只来吗？',
      en: 'The circus star says only a {adj} {name} can hold the crowd — can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '听说{adj}的{name}最是稀奇，我想亲眼开开眼……能帮我弄一只来吗？',
      en: 'They say a {adj} {name} is a marvel — I would see it for myself. Can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '孩子比谁家的{name}大，我家那只总被笑话……能帮我弄一只{adj}的来争口气吗？',
      en: 'The children compete over whose {name} is biggest, and mine is mocked — can you get me a {adj} one to win?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '园林展正缺一株{adj}的{name}撑场面，园主急得直转……能帮我弄一只来吗？',
      en: 'The garden show lacks a {adj} {name} for its centerpiece — the owner is pacing. Can you get him one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '茶馆说书人正讲一只{adj}的{name}的轶事，听客都欲亲睹……能帮我弄一只来吗？',
      en: 'The teahouse bard tells of a {adj} {name}, and the crowd craves a glimpse — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '游方僧人说，见一只{adj}的{name}便可为人添福寿……能帮我弄一只来吗？',
      en: 'The wandering monk says beholding a {adj} {name} adds years to one\'s life — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '邻家小儿夸口说他见过{adj}的{name}，我家孩子非要也瞧瞧……能帮我弄一只来吗？',
      en: 'The neighbor\'s child boasts of a {adj} {name}, and mine will not rest till he sees one too — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '驿站要摆一只{adj}的{name}做招牌，好让过往客商一眼便认得……能帮我弄一只来吗？',
      en: 'The relay inn would set a {adj} {name} by the road so travelers know us at a glance — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
    {
      zh: '族长说祠堂门前的石兽须换成{adj}的{name}才显威仪……能帮我弄一只来吗？',
      en: 'The elder says the shrine guardian stone should be a {adj} {name} to show our pride — can you get me one?',
      hintZh: '（召唤一只{adj}的{name}到TA身边）',
      hintEn: '(summon a {adj} {name} near)',
    },
  ],
};

/** 判定一个组合该用哪套模板 */
function comboTemplateKey(adj: string): keyof typeof comboTemplates {
  const rareColors = new Set([
    'crimson', 'scarlet', 'navy', 'violet', 'indigo', 'turquoise', 'teal',
    'magenta', 'maroon', 'ivory', 'coral', 'salmon', 'khaki', 'lavender',
    'peach', 'skyblue', 'olive', 'amber', 'sienna', 'chartreuse', 'plum',
    'marigold', 'royalblue',
  ]);
  const colors = new Set([
    'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink',
    'black', 'white', 'gold', 'brown', 'silver', 'gray',
  ]);
  if (rareColors.has(adj)) return 'rareColor';
  if (colors.has(adj)) return 'color';
  const behavior = new Set(['flying', 'swimming', 'aggressive', 'friendly', 'scared', 'sleepy', 'hungry', 'fast', 'slow']);
  if (behavior.has(adj)) return 'behavior';
  const state = new Set(['frozen', 'burning', 'wet', 'hot', 'cold', 'glowing', 'rotten']);
  if (state.has(adj)) return 'state';
  const material = new Set(['golden', 'wooden', 'stone', 'metallic', 'rubber', 'glassy', 'diamond', 'crystal']);
  if (material.has(adj)) return 'material';
  return 'size';
}

const comboQuestions: Question[] = allCombos.map((c) => {
  const ids = [c.adj, c.noun];
  const adjZh = adjZhName[c.adj] ?? c.adj;
  const entry = allEntries().find((e) => e.id === c.noun);
  const nounZh = entry?.zh.name ?? c.noun;
  const nounEn = entry?.en.name ?? c.noun;
  const tpls = comboTemplates[comboTemplateKey(c.adj)];
  const tpl = tpls.length === 1 ? tpls[0] : pickTemplate(tpls, `${c.adj}-${c.noun}`);
  return {
    id: `q-${c.adj}-${c.noun}`,
    typeId: c.noun,
    adjectives: [c.adj],
    cefr: medianTier(ids),
    freq: medianFreq(ids),
    prompt: {
      zh: tpl.zh.replace('{adj}', adjZh).replace('{name}', nounZh),
      en: tpl.en.replace('{adj}', c.adj).replace('{name}', nounEn),
    },
    hint: {
      zh: tpl.hintZh.replace('{adj}', adjZh).replace('{name}', nounZh),
      en: tpl.hintEn.replace('{adj}', c.adj).replace('{name}', nounEn),
    },
  };
});

// ---- 聚合导出 ----

/** 全部题目（情境多答案题 + 词条覆盖单答案题 + 形容词组合题） */
export const QUESTION_BANK: Question[] = [...situationalQuestions, ...nounQuestions, ...comboQuestions];

/** 按难度档 + 标准过滤题库 */
export function questionsByDifficulty(
  tier: DifficultyTier,
  standard: DifficultyStandard,
): Question[] {
  return QUESTION_BANK.filter((q) => (standard === 'cefr' ? q.cefr : q.freq) === tier);
}

/** 题库总量 */
export function questionCount(): number {
  return QUESTION_BANK.length;
}

/** 按 CEFR 标准各档位（基础/进阶/大师）的题目数，从 QUESTION_BANK 派生 */
export const CEFR_QUESTION_COUNTS: readonly [number, number, number] = (() => {
  const c: [number, number, number] = [0, 0, 0];
  for (const q of QUESTION_BANK) c[q.cefr - 1]++;
  return c;
})();

/** 按词频标准各档位（基础/进阶/大师）的题目数，从 QUESTION_BANK 派生 */
export const FREQ_QUESTION_COUNTS: readonly [number, number, number] = (() => {
  const c: [number, number, number] = [0, 0, 0];
  for (const q of QUESTION_BANK) c[q.freq - 1]++;
  return c;
})();
