/**
 * UI 共享样式 —— 涂鸦手写纸片质感。
 *
 * UI 无衬线字体回退链（拉丁自托管 Inter + CJK 系统无衬线）：
 * Inter Variable 覆盖全字重，-apple-system/PingFang SC/微软雅黑/Noto Sans CJK 兜底 CJK。
 * 纸色面板 + 撕纸 clip-path 边缘 + 暖影 + 手放感轻微旋转。
 * 去掉 backdrop-filter:blur（玻璃感是现代风与纸片冲突）。
 */

/** UI 无衬线字体回退链 */
export const UI_FONT =
  '"Inter Variable","Inter",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif';

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

/**
 * 安全区偏移常量 —— 适配 iPhone 刘海/动态岛、底部 Home 条等。
 * 依赖 index.html 的 `viewport-fit=cover`，未启用 env() 时退化为固定 px。
 */
export const SAFE_TOP = 'max(14px,env(safe-area-inset-top))';
export const SAFE_BOTTOM = 'max(14px,env(safe-area-inset-bottom))';
export const SAFE_LEFT = 'max(14px,env(safe-area-inset-left))';
export const SAFE_RIGHT = 'max(14px,env(safe-area-inset-right))';

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
    `font-family:${UI_FONT}`,
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
    `font-family:${UI_FONT}`,
    `caret-color:${INK}`,
    ...extra,
  ].join(';');
}
