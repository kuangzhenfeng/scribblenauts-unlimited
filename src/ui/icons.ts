/**
 * 内联 Lucide 风格 SVG 图标 —— 零位图、零依赖（不装 lucide npm 包）。
 *
 * SVG 是矢量，符合项目"纯矢量程序美术"原则。返回内联 HTML 字符串，
 * 由 UI 浮层 innerHTML 注入。颜色用 currentColor，随父元素 color 变化。
 */

const svg = (paths: string, size = 18): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${paths}</svg>`;

/** 星之碎块（Starite）—— 五角星 */
export const ICON_STAR = svg(
  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  18,
);

/** 星之碎片（Shard）—— 小菱形 */
export const ICON_SHARD = svg(
  '<polygon points="12 2 22 12 12 22 2 12"></polygon>',
  16,
);

/** 笔记本（Book Open） */
export const ICON_BOOK = svg(
  '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
  18,
);

/** 物体计数（Box） */
export const ICON_OBJECTS = svg(
  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.96" x2="12" y2="12"></line>',
  16,
);
