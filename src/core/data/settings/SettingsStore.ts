/**
 * 设置持久化 —— localStorage 封装。
 *
 * 集中管理音频音量与静音偏好，作为 SettingsScene 的单一写入源（DRY），
 * 消除 MusicDirector 旧实现自管 `scribblenauts.music.muted` 的散落逻辑。
 * 缺失或解析失败回退默认值，隐私模式等 localStorage 不可用时静默不报错。
 */

/** 界面语言：中文 / 英文（数据层词典/题库本就双语，运行期按此切换展示） */
export type Lang = 'zh' | 'en';

/** 屏幕方向偏好：auto=跟随设备，landscape=锁定横屏 */
export type OrientationPref = 'auto' | 'landscape';
/** 触屏控制：auto=触屏设备自动显示，on=强制显示，off=强制隐藏 */
export type TouchControlsPref = 'auto' | 'on' | 'off';

/** 设置数据 */
export interface SettingsData {
  /** 界面语言（UI 文案 + 词典/题库展示语言） */
  language: Lang;
  /** 音乐音量 0..1 */
  musicVolume: number;
  /** 音效音量 0..1 */
  sfxVolume: number;
  /** 主静音（同时控制音乐与音效） */
  muted: boolean;
  /** 屏幕方向偏好 */
  orientation: OrientationPref;
  /** 触屏虚拟控制显隐 */
  touchControls: TouchControlsPref;
}

const KEY = 'scribblenauts.settings';

const DEFAULTS: SettingsData = {
  language: 'zh',
  musicVolume: 0,
  sfxVolume: 0.3,
  muted: false,
  orientation: 'auto',
  touchControls: 'auto',
};

/** 读取设置，缺失/解析失败/环境不可用回退 DEFAULTS */
export function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SettingsData>;
    return {
      language: normalizeLanguage(parsed.language),
      musicVolume: clamp(parsed.musicVolume ?? DEFAULTS.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
      muted: Boolean(parsed.muted ?? DEFAULTS.muted),
      orientation: normalizeOrientation(parsed.orientation),
      touchControls: normalizeTouchControls(parsed.touchControls),
    };
  } catch {
    // localStorage 不可用（隐私模式等）或 JSON 解析失败
    return { ...DEFAULTS };
  }
}

/** 持久化设置，环境不可用时静默忽略 */
export function saveSettings(data: SettingsData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 忽略写入失败
  }
}

/** 钳制音量到 0..1 */
function clamp(v: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return DEFAULTS.musicVolume;
  return Math.max(0, Math.min(1, v));
}

/** 规范化语言偏好，非法值回退默认中文 */
function normalizeLanguage(v: unknown): Lang {
  return v === 'en' ? 'en' : 'zh';
}

/** 规范化方向偏好，非法值回退默认 */
function normalizeOrientation(v: unknown): OrientationPref {
  return v === 'landscape' ? 'landscape' : 'auto';
}

/** 规范化触屏控制偏好，非法值回退默认 */
function normalizeTouchControls(v: unknown): TouchControlsPref {
  return v === 'on' || v === 'off' ? v : 'auto';
}
