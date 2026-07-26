/**
 * 颜色形容词。effect.color 直接携带 hex 值，供 AdjectiveSystem 应用为 colorOverride。
 */

import type { AdjectiveEntry } from '@/core/types/adjective';

function colorAdj(id: string, zh: string, en: string, hex: string): AdjectiveEntry {
  return {
    id,
    zh: { name: zh },
    en: { name: en },
    category: 'color',
    effect: { kind: 'color', color: hex },
    priority: 20,
  };
}

export const colorAdjectives: AdjectiveEntry[] = [
  colorAdj('red', '红', 'red', '#E03131'),
  colorAdj('orange', '橙', 'orange', '#F08C00'),
  colorAdj('yellow', '黄', 'yellow', '#F59F00'),
  colorAdj('green', '绿', 'green', '#37B24D'),
  colorAdj('cyan', '青', 'cyan', '#0CA6A6'),
  colorAdj('blue', '蓝', 'blue', '#1C7ED6'),
  colorAdj('purple', '紫', 'purple', '#845EF7'),
  colorAdj('pink', '粉', 'pink', '#F06595'),
  colorAdj('black', '黑', 'black', '#212529'),
  colorAdj('white', '白', 'white', '#F8F9FA'),
  colorAdj('gold', '金', 'gold', '#FFD43B'),
  colorAdj('brown', '棕', 'brown', '#8B5A2B'),
  colorAdj('silver', '银', 'silver', '#C0C0C0'),
  colorAdj('gray', '灰', 'gray', '#6C757D'),
  colorAdj('crimson', '绯红', 'crimson', '#A11D2A'),
  colorAdj('navy', '藏青', 'navy', '#1B2A49'),
  colorAdj('lime', '青绿', 'lime', '#A6E22E'),
  colorAdj('magenta', '品红', 'magenta', '#E040FB'),
  colorAdj('tan', '棕褐', 'tan', '#D2B48C'),
  colorAdj('ivory', '象牙', 'ivory', '#FFFFF0'),
  colorAdj('scarlet', '猩红', 'scarlet', '#FF2400'),
  colorAdj('maroon', '褐红', 'maroon', '#800000'),
  colorAdj('violet', '紫罗兰', 'violet', '#7F00FF'),
  colorAdj('indigo', '靛蓝', 'indigo', '#4B0082'),
  colorAdj('turquoise', '绿松', 'turquoise', '#40E0D0'),
  colorAdj('teal', '凫青', 'teal', '#008080'),
  colorAdj('olive', '橄榄', 'olive', '#808000'),
  colorAdj('marigold', '金盏', 'marigold', '#EAA221'),
  colorAdj('coral', '珊瑚', 'coral', '#FF7F50'),
  colorAdj('salmon', '鲑红', 'salmon', '#FA8072'),
  colorAdj('khaki', '卡其', 'khaki', '#F0E68C'),
  colorAdj('plum', '梅紫', 'plum', '#8E4585'),
  colorAdj('lavender', '薰衣草', 'lavender', '#B57EDC'),
  colorAdj('mint', '薄荷', 'mint', '#98FF98'),
  colorAdj('peach', '桃粉', 'peach', '#FFDAB9'),
  colorAdj('skyblue', '天蓝', 'skyblue', '#87CEEB'),
  colorAdj('royalblue', '宝蓝', 'royalblue', '#4169E1'),
  colorAdj('chocolate', '巧克力色', 'chocolate', '#D2691E'),
  colorAdj('sienna', '赭石', 'sienna', '#A0522D'),
  colorAdj('chartreuse', '黄绿', 'chartreuse', '#7FFF00'),
  colorAdj('cyan-bright', '亮青', 'cyan', '#00FFFF'),
  colorAdj('magenta-bright', '亮品红', 'magenta', '#FF00FF'),
  colorAdj('amber', '琥珀', 'amber', '#FFBF00'),
  colorAdj('crimson-red', '深红', 'crimson', '#DC143C'),
  colorAdj('amber-dark', '焦琥珀', 'amberdark', '#8B5A00'),
];
