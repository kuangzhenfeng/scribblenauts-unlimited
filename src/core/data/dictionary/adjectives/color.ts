/**
 * 颜色形容词。effect.color 直接携带 hex 值，供 AdjectiveSystem 应用为 colorOverride。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

function colorAdj(id: string, zh: string, en: string, hex: string, zhAliases: string[] = [], enAliases: string[] = []): AdjectiveEntry {
  return {
    id,
    zh: { name: zh, aliases: zhAliases },
    en: { name: en, aliases: enAliases },
    category: 'color',
    effect: { kind: 'color', color: hex },
    priority: 20,
  };
}

export const colorAdjectives: AdjectiveEntry[] = [
  colorAdj('red', '红', 'red', '#E03131', ['红色', '红火', '朱红'], ['ruddy', 'reddish']),
  colorAdj('orange', '橙', 'orange', '#F08C00', ['橙色', '橘色', '橘黄'], ['tangerine']),
  colorAdj('yellow', '黄', 'yellow', '#F59F00', ['黄色', '姜黄'], []),
  colorAdj('green', '绿', 'green', '#37B24D', ['绿色', '草绿', '翠绿'], ['verdant']),
  colorAdj('cyan', '青', 'cyan', '#0CA6A6', ['青色', '青蓝', '碧青'], ['aqua']),
  colorAdj('blue', '蓝', 'blue', '#1C7ED6', ['蓝色', '蔚蓝', '湛蓝'], ['azure', 'cobalt']),
  colorAdj('purple', '紫', 'purple', '#845EF7', ['紫色', '酱紫', '绛紫'], []),
  colorAdj('pink', '粉', 'pink', '#F06595', ['粉色', '粉红', '桃红'], ['rose', 'rosy']),
  colorAdj('black', '黑', 'black', '#212529', ['黑色', '墨黑', '乌黑'], []),
  colorAdj('white', '白', 'white', '#F8F9FA', ['白色', '雪白'], ['snow']),
  colorAdj('gold', '金', 'gold', '#FFD43B', ['金色', '金黄', '灿金'], []),
  colorAdj('brown', '棕', 'brown', '#8B5A2B', ['棕色', '褐色', '咖啡色'], []),
  colorAdj('silver', '银', 'silver', '#C0C0C0', ['银色', '银白', '银光'], ['silvery']),
  colorAdj('gray', '灰', 'gray', '#6C757D', ['灰色', '灰白', '苍灰'], ['grey', 'ashen']),
  colorAdj('crimson', '绯红', 'crimson', '#A11D2A', ['深绯', '血绯'], ['bloodred', 'carmine']),
  colorAdj('navy', '藏青', 'navy blue', '#1B2A49', ['藏蓝', '深藏青'], []),
  colorAdj('lime', '青绿', 'lime', '#A6E22E', ['亮绿', '柠檬绿'], []),
  colorAdj('magenta', '品红', 'magenta', '#E040FB', ['洋红', '紫红'], ['fuchsia']),
  colorAdj('tan', '棕褐', 'tan', '#D2B48C', ['浅棕', '茶色'], ['tawny']),
  colorAdj('ivory', '象牙', 'ivory', '#FFFFF0', ['牙白', '乳白'], ['off-white', 'cream']),
  colorAdj('scarlet', '猩红', 'scarlet', '#FF2400', ['鲜红', '亮红'], ['vermilion']),
  colorAdj('maroon', '褐红', 'maroon', '#800000', ['栗红', '暗红'], ['burgundy', 'maroonred']),
  colorAdj('violet', '紫罗兰', 'violet', '#7F00FF', ['蓝紫', '青紫'], []),
  colorAdj('indigo', '靛蓝', 'indigo', '#4B0082', ['靛色', '深蓝紫'], []),
  colorAdj('turquoise', '绿松', 'turquoise', '#40E0D0', ['松绿', '绿松石'], []),
  colorAdj('teal', '凫青', 'teal', '#008080', ['凫色', '暗青'], []),
  colorAdj('olive', '橄榄', 'olive', '#808000', ['橄榄绿', '黄绿褐'], []),
  colorAdj('marigold', '金盏', 'marigold', '#EAA221', ['金盏花色', '金黄菊'], []),
  colorAdj('coral', '珊瑚', 'coral', '#FF7F50', ['珊瑚红', '珊瑚色'], ['coralred']),
  colorAdj('salmon', '鲑红', 'salmon', '#FA8072', ['鲑鱼色', '橙红'], ['salmonpink']),
  colorAdj('khaki', '卡其', 'khaki', '#F0E68C', ['卡其色', '土黄'], []),
  colorAdj('plum', '梅紫', 'plum', '#8E4585', ['李子紫', '深梅'], []),
  colorAdj('lavender', '薰衣草', 'lavender', '#B57EDC', ['淡紫', '薰衣紫'], ['lilac']),
  colorAdj('mint', '薄荷', 'mint', '#98FF98', ['薄荷绿', '淡绿'], ['mintgreen']),
  colorAdj('peach', '桃粉', 'peach', '#FFDAB9', ['桃色', '蜜桃色'], ['peachblow']),
  colorAdj('skyblue', '天蓝', 'sky blue', '#87CEEB', ['天空蓝', '晴空蓝'], ['celeste']),
  colorAdj('royalblue', '宝蓝', 'royal blue', '#4169E1', ['皇家蓝', '宝石蓝'], ['imperial blue']),
  colorAdj('chocolate', '巧克力色', 'chocolate', '#D2691E', ['巧克力', '可可色'], ['cocoa']),
  colorAdj('sienna', '赭石', 'sienna', '#A0522D', ['赭色', '黄土色'], ['ochre']),
  colorAdj('chartreuse', '黄绿', 'chartreuse', '#7FFF00', ['亮黄绿', '酸橙绿'], ['chartreuse-green']),
  colorAdj('amber', '琥珀', 'amber', '#FFBF00', ['琥珀色', '黄晶'], ['amberyellow']),
];
