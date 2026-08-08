/**
 * Maxwell 家庭头像目录 —— 把“帮助家人”与可见的玩家奖励绑定。
 *
 * 原版 PC 的产品目标是 42 个孩子（Maxwell、Lily、40 个兄弟姐妹）与父母头像。
 * 当前项目先用稳定的 sibling-01..40 作为本地目录 id，避免虚构未核实的原版姓名；
 * 外观复用 human atlas 的服装叠层，Maxwell 默认继续使用自己的多帧动画。
 */

export const FAMILY_HELP_TARGET = 40;
export const FAMILY_LILY_STARITES = 60;
export const FAMILY_PARENT_STARITES = 106;
export const FAMILY_OBJECT_SHARD_TARGET = 217;

export interface FamilyAvatar {
  id: string;
  zh: string;
  en: string;
  rendererId: 'maxwell' | 'human';
  shirtColor?: string;
  pantsColor?: string;
  skinColor?: string;
}

const SIBLING_COLORS = [
  ['#3b6ea5', '#2b2b2b'],
  ['#7b4ab0', '#3e2866'],
  ['#d15b72', '#63314b'],
  ['#5aa34b', '#345c35'],
  ['#d49b2a', '#704b20'],
  ['#566573', '#273746'],
] as const;

const SIBLING_AVATARS: readonly FamilyAvatar[] = Array.from(
  { length: FAMILY_HELP_TARGET },
  (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const [shirtColor, pantsColor] = SIBLING_COLORS[index % SIBLING_COLORS.length];
    return {
      id: `sibling-${number}`,
      zh: index === 0 ? 'Edwin' : `兄弟姐妹 ${index + 1}`,
      en: index === 0 ? 'Edwin' : `Sibling ${index + 1}`,
      rendererId: 'human',
      shirtColor,
      pantsColor,
      skinColor: '#F2C9A0',
    };
  },
);

export const FAMILY_AVATARS: readonly FamilyAvatar[] = [
  {
    id: 'maxwell',
    zh: 'Maxwell',
    en: 'Maxwell',
    rendererId: 'maxwell',
    shirtColor: '#E74C3C',
    pantsColor: '#3A3A3A',
    skinColor: '#F2C9A0',
  },
  ...SIBLING_AVATARS,
  {
    id: 'lily',
    zh: 'Lily',
    en: 'Lily',
    rendererId: 'human',
    shirtColor: '#bd6fb5',
    pantsColor: '#4b3f72',
    skinColor: '#F2C9A0',
  },
  {
    id: 'edgar',
    zh: 'Edgar',
    en: 'Edgar',
    rendererId: 'human',
    shirtColor: '#9b3d20',
    pantsColor: '#33251d',
    skinColor: '#D9AA82',
  },
  {
    id: 'julie',
    zh: 'Julie',
    en: 'Julie',
    rendererId: 'human',
    shirtColor: '#5aa34b',
    pantsColor: '#345c35',
    skinColor: '#F2C9A0',
  },
];

const AVATAR_BY_ID = new Map(FAMILY_AVATARS.map((avatar) => [avatar.id, avatar]));

export interface FamilyProgressSnapshot {
  helpedCount: number;
  starites: number;
  completedObjectShardCount: number;
  unlockedAvatarIds: string[];
  selectedAvatarId: string;
}

/**
 * 用稳定的 completed slot 数代表已帮助的人数；同一 slot 重复读档不会重复解锁头像。
 * 选关重置会清除这些槽位，因此头像链也会回到对应的真实进度，而非残留假状态。
 */
export function familyProgress(
  starites: number,
  completedSlots: readonly string[],
  completedObjectShardCount: number,
  selectedAvatarId = 'maxwell',
): FamilyProgressSnapshot {
  const helpedCount = Math.min(FAMILY_HELP_TARGET, new Set(completedSlots).size);
  const unlockedAvatarIds = ['maxwell', ...SIBLING_AVATARS.slice(0, helpedCount).map((avatar) => avatar.id)];
  if (starites >= FAMILY_LILY_STARITES) unlockedAvatarIds.push('lily');
  if (starites >= FAMILY_PARENT_STARITES && completedObjectShardCount >= FAMILY_OBJECT_SHARD_TARGET) {
    unlockedAvatarIds.push('edgar', 'julie');
  }
  const selected = unlockedAvatarIds.includes(selectedAvatarId) ? selectedAvatarId : 'maxwell';
  return { helpedCount, starites, completedObjectShardCount, unlockedAvatarIds, selectedAvatarId: selected };
}

export function familyAvatarById(id: string): FamilyAvatar | undefined {
  return AVATAR_BY_ID.get(id);
}
