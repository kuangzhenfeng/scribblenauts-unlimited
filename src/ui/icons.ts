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

/** Maxwell 头像（圆脸 + 小眼睛） */
export const ICON_MAXWELL = svg(
  '<circle cx="12" cy="12" r="10"></circle><circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none"></circle><path d="M9 15 q3 2.5 6 0"></path>',
  24,
);

/** 手持（Hand）—— 装备关系槽位 */
export const ICON_HAND = svg(
  '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5"></path><path d="M10 10V3.5a1.5 1.5 0 0 1 3 0V10"></path><path d="M13 10V5a1.5 1.5 0 0 1 3 0v6"></path><path d="M16 11V8a1.5 1.5 0 0 1 3 0v5c0 4-2.4 7-6.5 7H10c-2.8 0-5-2.2-5-5v-3a1.5 1.5 0 0 1 3 0v1"></path>',
  19,
);

/** 背部翅膀（Wing）—— 装备关系槽位 */
export const ICON_WING = svg(
  '<path d="M12 20c-2.5-4.5-6.5-7.3-9-7.5 1.2 3.6 3.7 6.4 7 7.5"></path><path d="M12 20c2.5-4.5 6.5-7.3 9-7.5-1.2 3.6-3.7 6.4-7 7.5"></path><path d="M12 20V5"></path><path d="M12 8C10 5 8 4 5 4c.3 2.5 1.8 4.2 4.2 5.2"></path><path d="M12 8c2-3 4-4 7-4-.3 2.5-1.8 4.2-4.2 5.2"></path>',
  19,
);

/** 面部（Face）—— 穿戴部位槽位 */
export const ICON_FACE = svg(
  '<circle cx="12" cy="12" r="8"></circle><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"></circle><path d="M9 15c2 1.5 4 1.5 6 0"></path>',
  19,
);

/** 头部（Head）—— 穿戴部位槽位 */
export const ICON_HEAD = svg(
  '<path d="M4 11h16"></path><path d="M6 11V8a6 6 0 0 1 12 0v3"></path><path d="M3 11h18v3H3z"></path>',
  19,
);

/** 身体（Body）—— 穿戴部位槽位 */
export const ICON_BODY = svg(
  '<path d="m8 4 4 3 4-3 4 3-2 6v7H6v-7L4 7z"></path><path d="M8 4v4h8V4"></path>',
  19,
);

/** 腿部（Legs）—— 穿戴部位槽位 */
export const ICON_LEGS = svg(
  '<path d="M8 4v8l-2 8H4l2-8V4"></path><path d="M16 4v8l2 8h2l-2-8V4"></path><path d="M7 4h10"></path>',
  19,
);

/** 脚部（Feet）—— 穿戴部位槽位 */
export const ICON_FEET = svg(
  '<path d="M5 5v9c0 2 2 3 5 3h3v3H4c-1 0-2-.8-2-2v-4c0-2 1-4 3-4V5z"></path><path d="M14 5v9c0 2 2 3 5 3h3v3h-9c-1 0-2-.8-2-2v-4c0-2 1-4 3-4V5z"></path>',
  19,
);

/** 全身（Full Body）—— 套装穿戴部位槽位 */
export const ICON_FULL_BODY = svg(
  '<circle cx="12" cy="5" r="3"></circle><path d="M7 22v-7l2-5h6l2 5v7"></path><path d="M9 13H5l-2 5"></path><path d="M15 13h4l2 5"></path>',
  19,
);

/** 骑乘（Saddle）—— 装备关系槽位 */
export const ICON_RIDE = svg(
  '<path d="M5 18h14"></path><path d="M7 18c0-4 1.8-7 5-7s5 3 5 7"></path><path d="M9 8h6"></path><path d="M10 5h4"></path><path d="M8 18v2"></path><path d="M16 18v2"></path>',
  19,
);

/** 铅笔（Pencil） */
export const ICON_PENCIL = svg(
  '<line x1="18" y1="2" x2="22" y2="6"></line><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"></path>',
  18,
);

/** 播放（Play）—— 使用笔记本 */
export const ICON_PLAY = svg(
  '<polygon points="6 3 20 12 6 21 6 3"></polygon>',
  18,
);

/** 新增（Plus）—— 创建物体 */
export const ICON_PLUS = svg(
  '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  18,
);

/** 魔法（Sparkles）—— 添加形容词 */
export const ICON_SPARKLES = svg(
  '<path d="m12 3-1.3 4.2a2 2 0 0 1-1.3 1.3L5.2 10 9.4 11.3a2 2 0 0 1 1.3 1.3L12 16.8l1.3-4.2a2 2 0 0 1 1.3-1.3l4.2-1.3-4.2-1.5a2 2 0 0 1-1.3-1.3L12 3Z"></path><path d="m19 16-.6 1.8a1.5 1.5 0 0 1-1 1L15.6 19l1.8.6a1.5 1.5 0 0 1 1 1L19 22l.6-1.8a1.5 1.5 0 0 1 1-1l1.8-.6-1.8-.6a1.5 1.5 0 0 1-1-1L19 16Z"></path>',
  18,
);

/** 编辑（Pencil Line）—— 编辑物体 */
export const ICON_EDIT = svg(
  '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path>',
  18,
);

/** 关闭（X）—— 关闭面板 */
export const ICON_CLOSE = svg(
  '<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>',
  18,
);

/** 背包（Backpack） */
export const ICON_BACKPACK = svg(
  '<path d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><line x1="12" y1="11" x2="12" y2="16"></line><line x1="9.5" y1="13.5" x2="14.5" y2="13.5"></line>',
  20,
);

/** 物体计数（Box） */
export const ICON_OBJECTS = svg(
  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.96" x2="12" y2="12"></line>',
  16,
);

/** 音量（Volume 2） */
export const ICON_VOLUME = svg(
  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>',
  19,
);

/** 静音（Volume X） */
export const ICON_VOLUME_OFF = svg(
  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>',
  19,
);

/** 雪花（Snowflake）—— 雪原主题 */
export const ICON_SNOWFLAKE = svg(
  '<line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><line x1="20" y1="16" x2="4" y2="8"></line><line x1="20" y1="8" x2="4" y2="16"></line><line x1="16" y1="3" x2="8" y2="6"></line><line x1="8" y1="3" x2="16" y2="6"></line><line x1="16" y1="21" x2="8" y2="18"></line><line x1="8" y1="21" x2="16" y2="18"></line>',
  18,
);

/** 太阳（Sun）—— 沙漠主题 */
export const ICON_SUN = svg(
  '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  18,
);

/** 火焰（Flame）—— 火山主题 */
export const ICON_FLAME = svg(
  '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 7.5 4 10 .5 1 1 2.5 1 4a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3z"></path>',
  18,
);

/** 锁（Lock）—— 关卡锁定状态 */
export const ICON_LOCK = svg(
  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
  18,
);

/** 解锁（Unlock）—— 批量开放全部关卡 */
export const ICON_UNLOCK = svg(
  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>',
  18,
);

/** 地图（Map）—— 选关按钮 */
export const ICON_MAP = svg(
  '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"></path><line x1="9" y1="4" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="20"></line>',
  18,
);

/** 重置（Rotate Ccw）—— 关卡进度重置按钮 */
export const ICON_RESET = svg(
  '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8"></path><path d="M3 3v5h5"></path>',
  18,
);

/** 设置（Gear）—— 设置入口 */
export const ICON_SETTINGS = svg(
  '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
  19,
);

/** 暂停（Pause）—— 两竖线 */
export const ICON_PAUSE = svg(
  '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>',
  22,
);

/** 左箭头（Arrow Left）—— 返回按钮 */
export const ICON_ARROW_LEFT = svg(
  '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
  18,
);

/** 垃圾桶（Trash 2）—— 清除存档 */
export const ICON_TRASH = svg(
  '<path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
  18,
);

/** 手机（Smartphone）—— 屏幕方向设置 */
export const ICON_SMARTPHONE = svg(
  '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line>',
  18,
);

/** 手柄（Gamepad）—— 触屏控制设置 */
export const ICON_GAMEPAD = svg(
  '<line x1="6" y1="11" x2="10" y2="11"></line><line x1="8" y1="9" x2="8" y2="13"></line><line x1="15" y1="12" x2="15.01" y2="12"></line><line x1="18" y1="10" x2="18.01" y2="10"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.7c-.017.27-.048.55-.088.83c-.14 1.05-.286 2.197-.286 3.47a4 4 0 0 0 6.845 2.836c.343-.345.515-.518.753-.652a2 2 0 0 1 1.74 0c.238.134.41.307.753.652a4 4 0 0 0 6.844-2.836c0-1.273-.145-2.42-.286-3.47c-.04-.28-.071-.56-.088-.83A4 4 0 0 0 17.32 5z"></path>',
  18,
);

/** 旋转（Rotate Cw）—— 旋转设备提示 */
export const ICON_ROTATE = svg(
  '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path>',
  22,
);

/** 语言（Languages）—— 界面语言切换 */
export const ICON_LANGUAGES = svg(
  '<path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-3-10-3 10"></path><path d="M17 18h4"></path>',
  18,
);

/** 退格（Delete / Backspace）—— 定制键盘退格键 */
export const ICON_BACKSPACE = svg(
  '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line>',
  20,
);

/** 清空（Eraser）—— 定制键盘清空键 */
export const ICON_CLEAR = svg(
  '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l5.6-5.6 8 8z"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path>',
  18,
);

/** 勾选（Check）—— 答对/确认 */
export const ICON_CHECK = svg(
  '<polyline points="20 6 9 17 4 12"></polyline>',
  20,
);

/** 键盘（Keyboard）—— 简易问答入口 */
export const ICON_KEYBOARD = svg(
  '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.01"></path><path d="M10 8h.01"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M8 12h.01"></path><path d="M12 12h.01"></path><path d="M16 12h.01"></path><path d="M7 16h10"></path>',
  18,
);

/** 奖杯（Trophy）—— 积分 */
export const ICON_TROPHY = svg(
  '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-0.85-3.25-2.03-3.79-.5-.23-.97-.66-.97-1.21v-2.34"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>',
  18,
);
