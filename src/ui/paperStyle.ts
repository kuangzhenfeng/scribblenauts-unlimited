/**
 * UI 共享样式 —— 涂鸦手写纸片质感。
 *
 * 系统手写字体回退链（零 Web font，自包含）：macOS/Windows/Linux 各有命中，CJK 楷体兜底。
 * 纸色面板 + 撕纸 clip-path 边缘 + 暖影 + 手放感轻微旋转。
 * 去掉 backdrop-filter:blur（玻璃感是现代风与纸片冲突）。
 */

/** 手写字体回退链 */
export const HAND_FONT =
  '"Bradley Hand","Snell Roundhand","Segoe Script","Comic Sans MS","Kaiti","楷体","STKaiti",cursive';

/** 纸色主背景 */
export const PAPER_BG = '#f7f1e3';
/** 纸色稍深（面板内分区/选中态） */
export const PAPER_BG_ALT = '#efe6cf';
/** 墨色（文字/描边） */
export const INK = '#2b2b2b';
/** 墨水高亮（选中项） */
export const INK_HIGHLIGHT = 'rgba(43,43,43,0.08)';
/** 暖影 */
export const PAPER_SHADOW = '0 8px 20px rgba(60,40,20,0.25)';

/** 撕纸边缘 clip-path（不规则锯齿） */
export const TORN_EDGE =
  'clip-path:polygon(0% 4%,3% 0%,8% 3%,14% 1%,20% 4%,28% 0%,36% 3%,44% 1%,52% 4%,60% 0%,68% 3%,76% 1%,84% 4%,92% 0%,97% 3%,100% 1%,99% 96%,96% 100%,90% 97%,84% 99%,78% 96%,70% 100%,62% 97%,54% 99%,46% 96%,38% 100%,30% 97%,22% 99%,14% 96%,8% 100%,3% 97%,0% 99%)';

/** 纸色面板通用样式（撕边 + 暖影 + 手放感旋转） */
export function paperPanel(extra: string[] = [], rotate = -0.4): string {
  return [
    'position:fixed',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${HAND_FONT}`,
    TORN_EDGE,
    `transform:rotate(${rotate}deg)`,
    ...extra,
  ].join(';');
}

/** 手写输入框样式（透明背景 + 手写下划线） */
export function paperInput(extra: string[] = []): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'padding:10px 14px',
    'font-size:18px',
    `color:${INK}`,
    'background:transparent',
    'border:none',
    `border-bottom:2px solid ${INK}`,
    'outline:none',
    `font-family:${HAND_FONT}`,
    `caret-color:${INK}`,
    ...extra,
  ].join(';');
}
