/**
 * 题库 —— 800+ 题目的静态定义与难度查询。
 *
 * 三层结构，全部故事化题面（NPC 第一人称陈述困境/需求，不直白索物）：
 *
 * A. 情境多答案题（situationalQuestions）：核心创新。NPC 陈述一个生活困境
 *    （"好冷""天黑""饿""渴""怪物挡路"…），不点名目标物体；answers 声明
 *    2~6 个语义关联的合格答案（同功能/同场景/同类），玩家召唤任一即过关。
 *    难度取所有 answer 词 id 的最高档。
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

/** 取多个词 id 中 CEFR 难度最高的那一档（取大值） */
function maxTier(ids: string[]): DifficultyTier {
  let max: DifficultyTier = 1;
  for (const id of ids) {
    const m = getWordMeta(id);
    if (m.cefr > max) max = m.cefr;
  }
  return max;
}
/** 取多个词 id 中词频难度最高的那一档（取大值） */
function maxFreq(ids: string[]): DifficultyTier {
  let max: DifficultyTier = 1;
  for (const id of ids) {
    const m = getWordMeta(id);
    if (m.freq > max) max = m.freq;
  }
  return max;
}

// ---- A. 情境多答案题 ----
//
// 每条为一个生活困境场景：NPC 第一人称陈述需求，不点名目标；answers 为
// 2~6 个语义关联合格答案，任一即过关。难度取所有 answer 词 id 最高档。
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
];

const situationalQuestions: Question[] = scenarios.map((s) => {
  const answers = s.answers;
  const ids = answers.flatMap((a) => [a.typeId, ...(a.adjectives ?? [])]);
  return {
    id: `q-sit-${s.suffix}`,
    answers,
    cefr: maxTier(ids),
    freq: maxFreq(ids),
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
const categoryTemplates: Record<string, { zh: string; en: string; hintZh: string; hintEn: string }> = {
  creature: {
    zh: '小女一直缠着要一只{name}当伙伴，能帮我把TA请到身边来吗？',
    en: 'My little girl has been begging for a {name} as a companion — can you bring one to her?',
    hintZh: '（召唤一只{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  food: {
    zh: '我尝过{name}的滋味后就再忘不掉，能帮我弄一份来吗？',
    en: 'I cannot forget the taste of {name} — can you get me one?',
    hintZh: '（召唤一份{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  weapon: {
    zh: '听老兵说{name}是把利器，能让我见识见识吗？',
    en: 'The veterans say a {name} is a fine weapon — can you show me one?',
    hintZh: '（召唤一把{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  plant: {
    zh: '院子里正好缺一株{name}点缀，能帮我种上一株吗？',
    en: 'The yard could use a {name} — can you plant one for me?',
    hintZh: '（召唤一株{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  vehicle: {
    zh: '听说{name}能代步赶路，能给我弄一辆试试吗？',
    en: 'They say a {name} is good for travel — can you get me one to try?',
    hintZh: '（召唤一辆{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  element: {
    zh: '炼金术士急需{name}作为原料，能帮我搜集一些吗？',
    en: 'The alchemist needs {name} as a reagent — can you gather some?',
    hintZh: '（召唤一份{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  object: {
    zh: '书桌上还缺一样{name}，能帮我补上吗？',
    en: 'My desk is missing a {name} — can you complete it for me?',
    hintZh: '（召唤一样{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
  tool: {
    zh: '木匠活还差一样{name}，能帮我寻来吗？',
    en: 'My carpentry is short a {name} — can you find me one?',
    hintZh: '（召唤一样{name}到TA身边）',
    hintEn: '(summon a {name} near)',
  },
};

const nounQuestions: Question[] = allEntries().map((entry) => {
  const meta = getWordMeta(entry.id);
  const tpl = categoryTemplates[entry.category] ?? categoryTemplates.object;
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
// 颜色 × 常见名词（60 道，覆盖各档）
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
const comboTemplates: Record<string, { zh: string; en: string; hintZh: string; hintEn: string }> = {
  color: {
    zh: '我想画一只{adj}的{name}当模特，能帮我唤来一只吗？',
    en: 'I want to paint a {adj} {name} as a model — can you summon one for me?',
    hintZh: '（召唤一只{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
  rareColor: {
    zh: '听说{adj}色的{name}世间少见，能帮我寻一只来开开眼吗？',
    en: 'They say a {adj} {name} is a rare sight — can you find one for me?',
    hintZh: '（召唤一只{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
  behavior: {
    zh: '驯兽师夸口说他训练得出{adj}的{name}，我想亲眼瞧瞧……能弄一只来吗？',
    en: 'The tamer boasted he can train a {adj} {name} — I want to see it. Can you get one?',
    hintZh: '（召唤一只{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
  state: {
    zh: '厨房里要一样{adj}的{name}才成这道菜，能帮我弄来吗？',
    en: 'This recipe calls for a {adj} {name} — can you get me one?',
    hintZh: '（召唤一样{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
  material: {
    zh: '国王下旨要一尊{adj}的{name}赏赐功臣，能帮我打造一尊吗？',
    en: 'The king decreed a {adj} {name} to honor the hero — can you forge one for me?',
    hintZh: '（召唤一尊{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
  size: {
    zh: '女儿缠着非要一只{adj}的{name}不可，能帮我弄一只来吗？',
    en: 'My daughter insists on a {adj} {name} and nothing else — can you get her one?',
    hintZh: '（召唤一只{adj}的{name}到TA身边）',
    hintEn: '(summon a {adj} {name} near)',
  },
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
  const tpl = comboTemplates[comboTemplateKey(c.adj)];
  return {
    id: `q-${c.adj}-${c.noun}`,
    typeId: c.noun,
    adjectives: [c.adj],
    cefr: maxTier(ids),
    freq: maxFreq(ids),
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
