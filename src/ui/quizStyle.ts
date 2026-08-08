/**
 * 简易问答模式共享视觉令牌。
 *
 * 复用主世界的纸片语汇：暖纸面、金色描边、墨色正文与手绘自然情境。
 * 问答模式用天空蓝 + 草地绿建立自己的「召唤试炼」氛围，但不另起一套学习软件色板。
 */

import {
  INK,
  PAPER_BG,
  PAPER_BG_ALT,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  SAFE_TOP,
  UI_FONT,
} from './paperStyle';

export { UI_FONT, SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT };

/** 独立问答情境的天空蓝与草地回退色；有生图背景时仅作为缺图兜底。 */
export const QUIZ_BG = '#5bbfd9';
export const QUIZ_BG_TOP = '#5bbfd9';
export const QUIZ_BG_BOTTOM = '#b9d66f';
export const QUIZ_CARD = PAPER_BG;
export const QUIZ_CARD_BRIGHT = '#fffdf0';
export const QUIZ_PANEL = '#f2ead7';
export const QUIZ_INK = INK;
export const QUIZ_INK_SOFT = 'rgba(43,43,43,.64)';
export const QUIZ_ACCENT = '#2d708c';
export const QUIZ_ACCENT_PRESS = '#205169';
export const QUIZ_ACCENT_SOFT = '#dcefeb';
export const QUIZ_YELLOW = '#f3c64e';
export const QUIZ_YELLOW_PRESS = '#d8951c';
export const QUIZ_CORAL = '#d95a3d';
export const QUIZ_DANGER = '#9d3a27';
export const QUIZ_DANGER_SOFT = '#f2d7cd';
export const QUIZ_SUCCESS = '#328c39';
export const QUIZ_SUCCESS_SOFT = '#dcebd7';
export const QUIZ_GOLD_DARK = '#6a3d08';
export const QUIZ_BORDER = QUIZ_GOLD_DARK;
export const QUIZ_BORDER_STRONG = '#3d2200';
/** 问答浮层用短纸片落差，避免大面积阴影压住自然背景。 */
export const QUIZ_SHADOW = '0 3px 0 rgba(61,34,0,.66)';
export const QUIZ_SHADOW_BAR = `0 2px 0 ${QUIZ_GOLD_DARK}`;
export const QUIZ_SHADOW_LIFT = '0 2px 0 rgba(61,34,0,.48)';
export const QUIZ_RADIUS_SM = '9px';
export const QUIZ_RADIUS_MD = '12px';
export const QUIZ_RADIUS_LG = '14px';
export const QUIZ_RADIUS_PILL = '999px';

export const QUIZ_TIER_STYLES: Readonly<Record<number, { bg: string; fg: string }>> = {
  1: { bg: '#d9f0dc', fg: '#235a3d' },
  2: { bg: '#ffe8a6', fg: '#6d4b00' },
  3: { bg: '#f7c8bf', fg: '#7e2b22' },
};

export const QUIZ_KB_BG = PAPER_BG;
export const QUIZ_KB_KEY = QUIZ_CARD_BRIGHT;
export const QUIZ_KB_KEY_SPECIAL = PAPER_BG_ALT;
export const QUIZ_KB_KEY_TEXT = INK;
export const QUIZ_KB_RADIUS = '9px';
export const QUIZ_KB_GAP = '5px';
export const QUIZ_KB_KEY_HEIGHT = '42px';
