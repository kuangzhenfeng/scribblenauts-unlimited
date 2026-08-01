/**
 * 简易问答模式共享视觉令牌。
 *
 * 颜色取自标题图：青蓝纸纹承载世界，米白纸面承载信息，亮黄只用于生成与连胜，
 * 钴蓝用于可交互状态，珊瑚红用于错误反馈，墨色统一描边与正文。
 */

import { UI_FONT, SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT } from './paperStyle';

export { UI_FONT, SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT };

export const QUIZ_BG = '#cceff2';
export const QUIZ_BG_TOP = '#35bfe6';
export const QUIZ_BG_BOTTOM = '#f5e9c9';
export const QUIZ_CARD = '#f7edcf';
export const QUIZ_CARD_BRIGHT = '#fff8e5';
export const QUIZ_PANEL = '#dff1ef';
export const QUIZ_INK = '#172535';
export const QUIZ_INK_SOFT = '#465d69';
export const QUIZ_ACCENT = '#175cb8';
export const QUIZ_ACCENT_PRESS = '#11478f';
export const QUIZ_ACCENT_SOFT = '#dce9f5';
export const QUIZ_YELLOW = '#ffd526';
export const QUIZ_YELLOW_PRESS = '#e8b912';
export const QUIZ_CORAL = '#f05a45';
export const QUIZ_DANGER = '#b92f24';
export const QUIZ_DANGER_SOFT = '#f8d9d2';
export const QUIZ_SUCCESS = '#176b4d';
export const QUIZ_SUCCESS_SOFT = '#dcefe3';
export const QUIZ_BORDER = '#233846';
export const QUIZ_BORDER_STRONG = '#172535';
export const QUIZ_STAGE_LINE = '#d9cba6';
export const QUIZ_SHADOW = '0 4px 0 rgba(23,37,53,0.18)';
export const QUIZ_SHADOW_BAR = '0 2px 0 rgba(23,37,53,0.18)';
export const QUIZ_SHADOW_LIFT = '0 3px 0 rgba(23,37,53,0.2)';
export const QUIZ_RADIUS_SM = '8px';
export const QUIZ_RADIUS_MD = '12px';
export const QUIZ_RADIUS_LG = '16px';
export const QUIZ_RADIUS_PILL = '999px';

export const QUIZ_TIER_STYLES: Readonly<Record<number, { bg: string; fg: string }>> = {
  1: { bg: '#d9f0dc', fg: '#235a3d' },
  2: { bg: '#ffe8a6', fg: '#6d4b00' },
  3: { bg: '#f7c8bf', fg: '#7e2b22' },
};

export const QUIZ_KB_BG = 'rgba(201,238,241,0.88)';
export const QUIZ_KB_KEY = '#f7edcf';
export const QUIZ_KB_KEY_SPECIAL = '#c5dfe1';
export const QUIZ_KB_KEY_TEXT = '#172535';
export const QUIZ_KB_RADIUS = '7px';
export const QUIZ_KB_GAP = '5px';
export const QUIZ_KB_KEY_HEIGHT = '44px';
