/**
 * 设置场景 —— 独立设置界面，纸片风格 DOM overlay。
 *
 * 由标题页右上角齿轮按钮进入。提供音频音量/静音、屏幕方向、触屏控制、
 * 难度档位与定义方式、清除存档。设置项遵循 YAGNI：只纳入真正有意义的配置。
 * 音乐在本页持续播放（MusicDirector 全局单例），拖动滑块可实时听到变化。
 *
 * 设计：多张撕纸便签卡叠放（音频/控制/难度/数据），每卡独立纸片质感 +
 * 手放感轻微旋转；统一组件词汇（toggle / 分段组 / 难度档位卡片），状态不
 * 仅靠颜色（toggle 拨片位移 + 背景变化）；滑块带填充进度条与自定义 thumb；
 * 入场错落淡入，尊重 prefers-reduced-motion。
 *
 * 样式经 `#settings-style` 注入（伪元素 / 状态类 / keyframes 无法用 cssText
 * 表达），DOM 用 className 复用，布局特例用行内 cssText。仅作用于本场景，
 * shutdown 时移除。
 */

import Phaser from 'phaser';
import { UI_FONT } from '@/ui/paperStyle';
import {
  ICON_ARROW_LEFT,
  ICON_VOLUME,
  ICON_VOLUME_OFF,
  ICON_TRASH,
  ICON_SMARTPHONE,
  ICON_GAMEPAD,
  ICON_SPARKLES,
  ICON_LANGUAGES,
  ICON_RESET,
} from '@/ui/icons';
import { music } from '@/audio/MusicDirector';
import { sfx } from '@/audio/SoundEffects';
import {
  loadSettings,
  saveSettings,
  type OrientationPref,
  type TouchControlsPref,
  type SettingsData,
  type Lang,
} from '@/core/data/settings/SettingsStore';
import { confirmDialog } from '@/ui/ConfirmDialog';
import { SaveStore } from '@/core/data/save/SaveStore';
import { t, setLang } from '@/core/i18n/I18n';
import type { DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { CEFR_WORD_COUNTS, FREQ_WORD_COUNTS } from '@/core/data/questions/word-metadata';
import { CEFR_QUESTION_COUNTS, FREQ_QUESTION_COUNTS } from '@/core/data/questions/bank';
import { generateSeed } from '@/util/rng';

/** 撕纸 clip-path 值（与 paperStyle.TORN_EDGE 同步，CSS 无法引用 JS 常量） */
const TORN_EDGE_CSS =
  'polygon(0% 4%,3% 0%,8% 3%,14% 1%,20% 4%,28% 0%,36% 3%,44% 1%,52% 4%,60% 0%,68% 3%,76% 1%,84% 4%,92% 0%,97% 3%,100% 1%,99% 96%,96% 100%,90% 97%,84% 99%,78% 96%,70% 100%,62% 97%,54% 99%,46% 96%,38% 100%,30% 97%,22% 99%,14% 96%,8% 100%,3% 97%,0% 99%)';

export class SettingsScene extends Phaser.Scene {
  private overlay!: HTMLDivElement;
  /** 静音开关时的滑块禁用态管理 */
  private sliders: HTMLInputElement[] = [];

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#f7f1e3');
    this._injectStyles();
    this._buildOverlay();
  }

  /** 注入本场景专用 stylesheet（伪元素 / 状态类 / keyframes），shutdown 时移除 */
  private _injectStyles(): void {
    if (document.getElementById('settings-style')) return;
    const style = document.createElement('style');
    style.id = 'settings-style';
    style.textContent = `
      /* —— 卡片：撕纸便签 —— */
      .set-card{
        position:relative;background:#f7f1e3;color:#2b2b2b;font-family:${UI_FONT};
        box-shadow:0 8px 20px rgba(60,40,20,0.25);
        clip-path:${TORN_EDGE_CSS};
        border-radius:14px;padding:22px 26px 20px;width:100%;
        max-width:640px;box-sizing:border-box;pointer-events:auto;
        animation:setCardIn .34s cubic-bezier(.22,1,.36,1) both;
      }
      /* —— 区段头 —— */
      .set-head{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px dashed rgba(43,43,43,0.22)}
      .set-badge{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none;color:rgba(43,43,43,0.7);background:#efe6cf;border:2px solid rgba(43,43,43,0.22)}
      .set-head-text{display:flex;flex-direction:column;gap:2px}
      .set-title{font-size:21px;font-weight:900;color:#2b2b2b;letter-spacing:0.06em}
      .set-desc{font-size:13px;color:rgba(43,43,43,0.6);line-height:1.35}
      /* —— 通用行 —— */
      .set-row{display:flex;align-items:center;gap:14px;margin-bottom:14px;pointer-events:auto}
      .set-row:last-child{margin-bottom:0}
      .set-label{font-size:17px;font-weight:700;color:#2b2b2b;min-width:88px}
      .set-value{font-size:14px;font-weight:900;color:#2b2b2b;min-width:42px;text-align:right;font-variant-numeric:tabular-nums}
      .set-sub{font-size:14px;font-weight:900;color:rgba(43,43,43,0.7);letter-spacing:0.04em;margin:14px 0 8px}
      .set-sub:first-of-type{margin-top:0}
      .set-hint{font-size:12px;color:rgba(43,43,43,0.6);line-height:1.45;margin-top:10px}
      /* —— 滑块：填充进度 + 自定义 thumb —— */
      .set-slider{
        -webkit-appearance:none;appearance:none;flex:1;height:12px;outline:none;cursor:pointer;
        background:linear-gradient(to right,#d77a10 0%,#d77a10 var(--pct,10%),#efe6cf var(--pct,10%),#efe6cf 100%);
        border:2px solid rgba(43,43,43,0.25);border-radius:999px;
      }
      .set-slider::-webkit-slider-thumb{
        -webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;
        background:#2b2b2b;border:3px solid #f7f1e3;box-shadow:0 2px 5px rgba(0,0,0,0.35);
        cursor:pointer;margin-top:-7px;transition:transform .12s ease;
      }
      .set-slider::-webkit-slider-thumb:hover{transform:scale(1.12)}
      .set-slider::-moz-range-thumb{
        width:22px;height:22px;border-radius:50%;background:#2b2b2b;border:3px solid #f7f1e3;
        box-shadow:0 2px 5px rgba(0,0,0,0.35);cursor:pointer;
      }
      .set-slider:disabled{opacity:0.4;cursor:not-allowed}
      /* —— toggle：拨片位移 + 背景变化（状态不仅靠颜色） —— */
      .set-toggle{
        position:relative;width:54px;height:30px;border-radius:999px;flex:none;padding:0;
        border:2px solid rgba(43,43,43,0.4);background:#efe6cf;cursor:pointer;
        transition:background .2s ease,border-color .2s ease;
      }
      .set-toggle[aria-checked="true"]{background:#d77a10;border-color:#5a1a04}
      .set-toggle-thumb{
        position:absolute;top:50%;left:3px;width:22px;height:22px;border-radius:50%;
        transform:translateY(-50%);background:#f7f1e3;
        box-shadow:0 2px 4px rgba(0,0,0,0.3);
        transition:transform .22s cubic-bezier(.22,1,.36,1);
      }
      .set-toggle[aria-checked="true"] .set-toggle-thumb{transform:translateY(-50%) translateX(24px)}
      /* —— 分段按钮组（统一词汇：二态/三态通用） —— */
      .set-seg{display:flex;gap:6px}
      .set-seg-btn{
        font-family:${UI_FONT};font-size:14px;font-weight:900;color:#2b2b2b;
        background:#efe6cf;border:2px solid rgba(43,43,43,0.3);border-radius:8px;
        padding:7px 14px;cursor:pointer;
        transition:transform .12s ease,filter .12s ease,background .15s ease,color .15s ease,border-color .15s ease;
      }
      .set-seg-btn:hover{filter:brightness(1.05);transform:translateY(-1px)}
      .set-seg-btn[aria-pressed="true"]{
        color:#fff8dd;background:linear-gradient(135deg,#d77a10,#b8360a);border-color:#5a1a04;
      }
      /* —— 难度档位卡片 —— */
      .set-tier{display:flex;gap:10px}
      .set-tier-btn{
        flex:1;padding:11px 6px;border-radius:12px;cursor:pointer;text-align:center;
        font-family:${UI_FONT};color:#2b2b2b;background:#efe6cf;
        border:2px solid rgba(43,43,43,0.3);
        transition:transform .14s ease,box-shadow .14s ease,background .15s ease,border-color .15s ease,color .15s ease;
      }
      .set-tier-btn:hover{transform:translateY(-2px)}
      .set-tier-btn[aria-pressed="true"]{
        background:linear-gradient(135deg,#f0c14b,#d9a730);border-color:#8a5a0a;color:#3d2200;
        box-shadow:0 4px 0 #a8771a,0 8px 18px rgba(138,90,10,0.25);transform:translateY(-2px);
      }
      .set-tier-name{font-size:15px;font-weight:900}
      .set-tier-desc{font-size:11px;opacity:0.75;margin-top:2px}
      /* —— 词库分布表 —— */
      .set-worddist{margin-top:14px;padding:12px 14px;background:#efe6cf;border:2px dashed rgba(43,43,43,0.22);border-radius:10px}
      .set-worddist-title{font-size:13px;font-weight:900;color:rgba(43,43,43,0.7);letter-spacing:0.04em;margin-bottom:8px}
      .set-worddist-grid{display:grid;grid-template-columns:auto repeat(3,1fr);gap:6px 10px;align-items:center}
      .set-wd-h{font-size:12px;font-weight:900;color:rgba(43,43,43,0.6);text-align:center}
      .set-wd-rl{font-size:13px;font-weight:900;color:#2b2b2b}
      .set-wd-c{font-size:18px;font-weight:900;color:#2b2b2b;text-align:center;font-variant-numeric:tabular-nums}
      .set-qdist{margin-top:10px}
      /* —— 危险行 —— */
      .set-danger-row{display:flex;align-items:center;gap:14px;pointer-events:auto}
      .set-danger-mid{flex:1;display:flex;flex-direction:column;gap:3px}
      .set-danger-label{font-size:17px;font-weight:700;color:#5a1a04;display:flex;align-items:center;gap:8px}
      .set-danger-desc{font-size:12px;color:rgba(43,43,43,0.6);line-height:1.4}
      /* —— 按钮 —— */
      .set-btn-ghost{
        display:flex;align-items:center;gap:8px;font-family:${UI_FONT};font-size:17px;font-weight:900;
        color:#2b2b2b;background:#f7f1e3;border:2px solid rgba(43,43,43,0.4);border-radius:999px;
        padding:8px 18px;cursor:pointer;box-shadow:0 8px 20px rgba(60,40,20,0.25);
        transition:transform .16s ease;
      }
      .set-btn-ghost:hover{transform:translateX(-2px)}
      .set-btn-danger{
        font-family:${UI_FONT};font-size:15px;font-weight:900;color:#fff8dd;
        background:linear-gradient(135deg,#e0531a,#b8360a);border:2px solid #5a1a04;border-radius:8px;
        padding:9px 20px;cursor:pointer;flex:none;
        box-shadow:0 4px 0 #7a2306,0 6px 14px rgba(90,26,4,0.3);
        transition:transform .12s ease,filter .12s ease;
      }
      .set-btn-danger:hover{transform:translateY(-1px);filter:brightness(1.06)}
      .set-btn-try{
        font-family:${UI_FONT};font-size:14px;font-weight:900;color:#2b2b2b;
        background:#efe6cf;border:2px solid rgba(43,43,43,0.4);border-radius:999px;
        padding:5px 14px;cursor:pointer;flex:none;
        transition:transform .12s ease,filter .12s ease;
      }
      .set-btn-try:hover{transform:translateY(-1px);filter:brightness(1.06)}
      /* —— 标题区 —— */
      .set-header{display:flex;flex-direction:column;align-items:center;gap:4px;margin:6px 0 22px}
      .set-h1{font-family:${UI_FONT};font-size:clamp(34px,5vw,46px);font-weight:900;color:#2b2b2b;letter-spacing:0.1em;text-shadow:2px 2px 0 rgba(60,40,20,0.18)}
      .set-subtitle{font-family:${UI_FONT};font-size:15px;color:rgba(43,43,43,0.6)}
      /* —— 焦点可见（a11y） —— */
      .set-card :focus-visible{outline:3px solid #d77a10;outline-offset:2px}
      /* —— 题目种子输入框 —— */
      .set-seed-input{
        font-family:${UI_FONT};font-size:14px;font-weight:900;color:#2b2b2b;
        background:#efe6cf;border:2px solid rgba(43,43,43,0.3);border-radius:8px;
        padding:7px 12px;min-width:120px;max-width:180px;flex:none;
        transition:border-color .15s ease,box-shadow .15s ease;
      }
      .set-seed-input:focus{border-color:#d77a10;box-shadow:0 0 0 3px rgba(215,122,16,0.2);outline:none}
      /* —— 入场动画 —— */
      @keyframes setCardIn{from{opacity:0;transform:translateY(10px) rotate(var(--rot,0deg)) scale(0.98)}to{opacity:1;transform:translateY(0) rotate(var(--rot,0deg)) scale(1)}}
      .set-cards > .set-card:nth-child(1){animation-delay:0ms}
      .set-cards > .set-card:nth-child(2){animation-delay:70ms}
      .set-cards > .set-card:nth-child(3){animation-delay:140ms}
      .set-cards > .set-card:nth-child(4){animation-delay:210ms}
      /* —— reduced motion —— */
      @media (prefers-reduced-motion:reduce){
        .set-card{animation:none !important}
        .set-toggle-thumb,.set-slider,.set-seg-btn,.set-tier-btn,.set-btn-ghost,.set-btn-danger,.set-btn-try{transition:none !important}
      }
    `;
    document.head.appendChild(style);
  }

  private _buildOverlay(): void {
    const settings = loadSettings();

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:100',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'padding:64px 20px 32px',
      'box-sizing:border-box',
      'overflow-y:auto',
    ].join(';');

    // 返回按钮（左上角，fixed）
    this.overlay.appendChild(this._backButton());

    // 标题区
    const header = document.createElement('div');
    header.className = 'set-header';
    const h1 = document.createElement('div');
    h1.className = 'set-h1';
    h1.textContent = t('settings.title');
    const sub = document.createElement('div');
    sub.className = 'set-subtitle';
    sub.textContent = t('settings.subtitle');
    header.appendChild(h1);
    header.appendChild(sub);
    this.overlay.appendChild(header);

    // 卡片叠放容器
    const cards = document.createElement('div');
    cards.className = 'set-cards';
    cards.style.cssText = ['display:flex', 'flex-direction:column', 'gap:20px', 'width:100%', 'align-items:center'].join(';');

    cards.appendChild(this._languageCard(settings));
    cards.appendChild(this._audioCard(settings));
    cards.appendChild(this._controlCard(settings));
    cards.appendChild(this._difficultyCard());
    cards.appendChild(this._dataCard());

    this.overlay.appendChild(cards);
    document.body.appendChild(this.overlay);

    // 初始化滑块禁用态与填充
    this._applySlidersDisabled(settings.muted);
  }

  /** 卡片工厂：统一纸片质感 + 手放感旋转（交替正负角度） */
  private _card(rotate: number, ...children: HTMLElement[]): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'set-card';
    card.style.setProperty('--rot', `${rotate}deg`);
    card.style.transform = `rotate(${rotate}deg)`;
    children.forEach((c) => card.appendChild(c));
    return card;
  }

  /** 区段头：圆形图标徽章 + 标题 + 说明 */
  private _head(icon: string, title: string, desc: string): HTMLDivElement {
    const head = document.createElement('div');
    head.className = 'set-head';
    const badge = document.createElement('div');
    badge.className = 'set-badge';
    badge.innerHTML = icon;
    const text = document.createElement('div');
    text.className = 'set-head-text';
    const t = document.createElement('div');
    t.className = 'set-title';
    t.textContent = title;
    const d = document.createElement('div');
    d.className = 'set-desc';
    d.textContent = desc;
    text.appendChild(t);
    text.appendChild(d);
    head.appendChild(badge);
    head.appendChild(text);
    return head;
  }

  private _backButton(): HTMLButtonElement {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'set-btn-ghost';
    back.style.cssText = ['position:fixed', 'top:22px', 'left:24px', 'z-index:101'].join(';');
    back.innerHTML = `${ICON_ARROW_LEFT}<span>${t('common.back')}</span>`;
    back.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._backToTitle();
    });
    return back;
  }

  // ——— 语言卡 ———

  private _languageCard(s: SettingsData): HTMLDivElement {
    const langSeg = this._segmented<Lang>({
      options: [
        { value: 'zh', text: t('settings.langZh') },
        { value: 'en', text: t('settings.langEn') },
      ],
      value: s.language,
      onSelect: (v) => {
        setLang(v);
        sfx.play('ui');
        // 切换语言后整页重渲染，即时反映新语言
        this._rerender();
      },
    });
    const langLabel = document.createElement('div');
    langLabel.className = 'set-label';
    langLabel.style.flex = '1';
    langLabel.textContent = t('settings.language');
    const langIcon = document.createElement('span');
    langIcon.innerHTML = ICON_LANGUAGES;
    langIcon.style.color = 'rgba(43,43,43,0.7)';
    const langRow = document.createElement('div');
    langRow.className = 'set-row';
    langRow.appendChild(langIcon);
    langRow.appendChild(langLabel);
    langRow.appendChild(langSeg);

    return this._card(0.5, this._head(ICON_LANGUAGES, t('settings.language'), t('settings.langZh') + ' / ' + t('settings.langEn')), langRow);
  }

  // ——— 音频卡 ———

  private _audioCard(s: SettingsData): HTMLDivElement {
    const musicRow = this._sliderRow({
      label: t('settings.musicVolume'),
      value: s.musicVolume,
      onInput: (v) => {
        music.setMusicVolume(v);
        this._persist({ musicVolume: v });
      },
    });
    this.sliders.push(musicRow.slider);
    const sfxRow = this._sliderRow({
      label: t('settings.sfxVolume'),
      value: s.sfxVolume,
      onInput: (v) => {
        sfx.setSfxVolume(v);
        this._persist({ sfxVolume: v });
      },
      onTry: () => sfx.play('interact'),
    });
    this.sliders.push(sfxRow.slider);

    // 静音 toggle
    const muteToggle = this._toggle(s.muted, (next) => {
      music.setMuted(next);
      sfx.setMuted(next);
      this._persist({ muted: next });
      this._applySlidersDisabled(next);
      if (!next) sfx.play('ui');
    });
    muteToggle.ariaLabel = t('settings.muted');
    const muteIcon = document.createElement('span');
    muteIcon.innerHTML = s.muted ? ICON_VOLUME_OFF : ICON_VOLUME;
    muteIcon.style.color = 'rgba(43,43,43,0.7)';
    muteToggle.addEventListener('click', () => {
      muteIcon.innerHTML = muteToggle.getAttribute('aria-checked') === 'true' ? ICON_VOLUME_OFF : ICON_VOLUME;
    });
    const muteLabel = document.createElement('div');
    muteLabel.className = 'set-label';
    muteLabel.style.flex = '1';
    muteLabel.textContent = t('settings.muted');
    const muteRow = document.createElement('div');
    muteRow.className = 'set-row';
    muteRow.style.marginTop = '4px';
    muteRow.appendChild(muteIcon);
    muteRow.appendChild(muteLabel);
    muteRow.appendChild(muteToggle);

    return this._card(-0.5, this._head(ICON_VOLUME, t('settings.audio'), t('settings.audioDesc')), musicRow.row, sfxRow.row, muteRow);
  }

  /**
   * 滑块行：标签 + 填充滑块 + 百分比 +（可选）试听按钮。
   * 返回行容器与 slider 引用，便于静音时统一置灰。
   */
  private _sliderRow(opts: {
    label: string;
    value: number;
    onInput: (v: number) => void;
    onTry?: () => void;
  }): { row: HTMLDivElement; slider: HTMLInputElement } {
    const row = document.createElement('div');
    row.className = 'set-row';

    const label = document.createElement('div');
    label.className = 'set-label';
    label.textContent = opts.label;
    row.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(opts.value);
    slider.className = 'set-slider';
    slider.setAttribute('aria-label', opts.label);
    this._applySliderFill(slider);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      this._applySliderFill(slider);
      opts.onInput(v);
    });
    row.appendChild(slider);

    const pct = document.createElement('div');
    pct.className = 'set-value';
    pct.textContent = `${Math.round(opts.value * 100)}%`;
    slider.addEventListener('input', () => {
      pct.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
    });
    row.appendChild(pct);

    if (opts.onTry) {
      const tryBtn = document.createElement('button');
      tryBtn.type = 'button';
      tryBtn.className = 'set-btn-try';
      tryBtn.textContent = t('settings.try');
      tryBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        opts.onTry!();
      });
      row.appendChild(tryBtn);
    }

    return { row, slider };
  }

  /** 更新滑块填充进度（CSS 变量 --pct） */
  private _applySliderFill(slider: HTMLInputElement): void {
    const v = parseFloat(slider.value);
    slider.style.setProperty('--pct', `${Math.round(v * 100)}%`);
  }

  /** toggle 组件：拨片位移 + 背景变化，状态不仅靠颜色 */
  private _toggle(checked: boolean, onToggle: (next: boolean) => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-toggle';
    btn.role = 'switch';
    btn.setAttribute('aria-checked', String(checked));
    const thumb = document.createElement('span');
    thumb.className = 'set-toggle-thumb';
    btn.appendChild(thumb);
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onToggle(next);
    });
    return btn;
  }

  /** 分段按钮组（统一词汇：二态/三态通用，选中态 aria-pressed） */
  private _segmented<T extends string>(opts: {
    options: { value: T; text: string }[];
    value: T;
    onSelect: (v: T) => void;
  }): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'set-seg';
    const btns: Record<string, HTMLButtonElement> = {};
    const apply = (v: T) => {
      for (const [k, b] of Object.entries(btns)) {
        b.setAttribute('aria-pressed', String(k === String(v)));
      }
    };
    opts.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-seg-btn';
      btn.textContent = opt.text;
      btn.setAttribute('aria-pressed', String(opt.value === opts.value));
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        apply(opt.value);
        opts.onSelect(opt.value);
      });
      btns[String(opt.value)] = btn;
      group.appendChild(btn);
    });
    return group;
  }

  // ——— 控制卡 ———

  private _controlCard(s: SettingsData): HTMLDivElement {
    // 屏幕方向：二态 toggle + 右侧状态文字
    const orientToggle = this._toggle(s.orientation === 'landscape', (next) => {
      const pref: OrientationPref = next ? 'landscape' : 'auto';
      orientStatus.textContent = next ? t('settings.landscape') : t('settings.auto');
      orientStatus.style.color = next ? '#d77a10' : 'rgba(43,43,43,0.6)';
      this._persist({ orientation: pref });
      this._applyOrientation(pref);
      sfx.play('ui');
    });
    const orientIcon = document.createElement('span');
    orientIcon.innerHTML = ICON_SMARTPHONE;
    orientIcon.style.color = 'rgba(43,43,43,0.7)';
    const orientLabel = document.createElement('div');
    orientLabel.className = 'set-label';
    orientLabel.style.flex = '1';
    orientLabel.textContent = t('settings.orientation');
    const orientStatus = document.createElement('span');
    orientStatus.style.cssText = ['font-size:14px', 'font-weight:900', `color:${s.orientation === 'landscape' ? '#d77a10' : 'rgba(43,43,43,0.6)'}`].join(';');
    orientStatus.textContent = s.orientation === 'landscape' ? t('settings.landscape') : t('settings.auto');
    const orientRow = document.createElement('div');
    orientRow.className = 'set-row';
    orientRow.appendChild(orientIcon);
    orientRow.appendChild(orientLabel);
    orientRow.appendChild(orientStatus);
    orientRow.appendChild(orientToggle);

    // 触屏控制：三态分段组
    const touchIcon = document.createElement('span');
    touchIcon.innerHTML = ICON_GAMEPAD;
    touchIcon.style.color = 'rgba(43,43,43,0.7)';
    const touchLabel = document.createElement('div');
    touchLabel.className = 'set-label';
    touchLabel.style.flex = '1';
    touchLabel.textContent = t('settings.touch');
    const touchSeg = this._segmented<TouchControlsPref>({
      options: [
        { value: 'auto', text: t('settings.touchAuto') },
        { value: 'on', text: t('settings.touchOn') },
        { value: 'off', text: t('settings.touchOff') },
      ],
      value: s.touchControls,
      onSelect: (v) => {
        this._persist({ touchControls: v });
        sfx.play('ui');
      },
    });
    const touchRow = document.createElement('div');
    touchRow.className = 'set-row';
    touchRow.appendChild(touchIcon);
    touchRow.appendChild(touchLabel);
    touchRow.appendChild(touchSeg);

    return this._card(0.4, this._head(ICON_GAMEPAD, t('settings.control'), t('settings.controlDesc')), orientRow, touchRow);
  }

  /** 持久化方向偏好并尝试锁定/解锁屏幕（best-effort，失败静默） */
  private _applyOrientation(pref: OrientationPref): void {
    // 部分浏览器/TS lib 未声明 lock，按 any 调用；iOS 非 PWA 不可用，失败静默
    const orient = screen.orientation as unknown as { lock?: (o: string) => Promise<void>; unlock?: () => void } | undefined;
    if (!orient) return;
    if (pref === 'landscape' && orient.lock) {
      orient.lock('landscape').catch(() => {
        // iOS Safari 非 PWA 不支持，静默失败，由 WorldScene 提供旋转提示兜底
      });
    } else if (orient.unlock) {
      orient.unlock();
    }
  }

  // ——— 难度卡 ———

  /**
   * 难度卡：先渲染完整结构（按钮未选中），异步读存档后选中当前项，
   * 避免旧实现 placeholder 空白闪现。
   */
  private _difficultyCard(): HTMLDivElement {
    const wrap = document.createElement('div');

    const stdSub = document.createElement('div');
    stdSub.className = 'set-sub';
    stdSub.textContent = t('settings.stdMethod');
    wrap.appendChild(stdSub);

    // 难度定义方式：先按默认 cefr 渲染，加载后修正
    const stdSeg = this._segmented<DifficultyStandard>({
      options: [
        { value: 'cefr', text: t('levelSelect.stdCefr') },
        { value: 'frequency', text: t('levelSelect.stdFrequency') },
      ],
      value: 'cefr',
      onSelect: (v) => {
        this._diff.standard = v;
        void this._saveDiff();
        sfx.play('ui');
      },
    });
    wrap.appendChild(stdSeg);

    const tierSub = document.createElement('div');
    tierSub.className = 'set-sub';
    tierSub.textContent = t('settings.tier');
    wrap.appendChild(tierSub);

    const tierGroup = document.createElement('div');
    tierGroup.className = 'set-tier';
    const tierOpts: { value: DifficultyTier; text: string; desc: string }[] = [
      { value: 1, text: t('levelSelect.tier1'), desc: t('levelSelect.tier1Desc') },
      { value: 2, text: t('levelSelect.tier2'), desc: t('levelSelect.tier2Desc') },
      { value: 3, text: t('levelSelect.tier3'), desc: t('levelSelect.tier3Desc') },
    ];
    const tierBtns: Record<number, HTMLButtonElement> = {};
    const applyTier = (v: DifficultyTier) => {
      for (const [k, b] of Object.entries(tierBtns)) {
        b.setAttribute('aria-pressed', String(Number(k) === v));
      }
    };
    tierOpts.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-tier-btn';
      btn.innerHTML = `<div class="set-tier-name">${opt.text}</div><div class="set-tier-desc">${opt.desc}</div>`;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        applyTier(opt.value);
        this._diff.tier = opt.value;
        void this._saveDiff();
        sfx.play('ui');
      });
      tierBtns[opt.value] = btn;
      tierGroup.appendChild(btn);
    });
    wrap.appendChild(tierGroup);

    // 词库分布：CEFR / 词频两种标准下各档位的单词数
    wrap.appendChild(this._wordDistribution());
    // 题目分布：CEFR / 词频两种标准下各档位的题目数
    wrap.appendChild(this._questionDistribution());

    const hint = document.createElement('div');
    hint.className = 'set-hint';
    hint.textContent = t('levelSelect.difficultyHint');
    wrap.appendChild(hint);

    // 题目种子行：显示当前种子 + 可输入新种子 + 一键刷新
    const seedSub = document.createElement('div');
    seedSub.className = 'set-sub';
    seedSub.textContent = t('settings.questionSeed');
    wrap.appendChild(seedSub);

    const seedRow = document.createElement('div');
    seedRow.className = 'set-row';

    const seedIcon = document.createElement('span');
    seedIcon.innerHTML = ICON_SPARKLES;
    seedIcon.style.color = 'rgba(43,43,43,0.7)';
    seedRow.appendChild(seedIcon);

    const seedLabel = document.createElement('div');
    seedLabel.className = 'set-label';
    seedLabel.style.flex = '1';
    seedLabel.textContent = t('settings.questionSeed');
    seedRow.appendChild(seedLabel);

    const seedInput = document.createElement('input');
    seedInput.type = 'text';
    seedInput.className = 'set-seed-input';
    seedInput.value = this._diff.questionSeed;
    seedInput.placeholder = t('settings.seedPh');
    seedInput.setAttribute('aria-label', t('settings.questionSeed'));
    seedInput.maxLength = 32;
    seedRow.appendChild(seedInput);

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'set-btn-try';
    refreshBtn.innerHTML = `${ICON_RESET}<span style="margin-left:6px">${t('settings.refreshSeed')}</span>`;
    refreshBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const next = generateSeed();
      seedInput.value = next;
      void this._applySeed(next);
    });
    seedRow.appendChild(refreshBtn);

    // 输入框失焦/回车提交：非空且与当前不同才换种子（空串视为不变，避免误清进度）
    const submit = () => {
      const v = seedInput.value.trim();
      if (v && v !== this._diff.questionSeed) {
        seedInput.value = v;
        void this._applySeed(v);
      } else {
        seedInput.value = this._diff.questionSeed;
      }
    };
    seedInput.addEventListener('change', (ev) => { ev.stopPropagation(); submit(); });
    seedInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); seedInput.blur(); }
    });
    wrap.appendChild(seedRow);

    const seedHint = document.createElement('div');
    seedHint.className = 'set-hint';
    seedHint.textContent = t('settings.questionSeedHint');
    wrap.appendChild(seedHint);

    // 异步读存档，修正选中态
    void this._loadDifficulty().then(({ tier, standard, questionSeed }) => {
      applyTier(tier);
      // 修正分段组选中态（先渲染用了默认 cefr）
      const stdText = standard === 'cefr' ? t('levelSelect.stdCefr') : t('levelSelect.stdFrequency');
      stdSeg.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.textContent === stdText));
      });
      // 修正种子输入框（先渲染用了默认种子）
      seedInput.value = questionSeed;
    });

    return this._card(-0.4, this._head(ICON_SPARKLES, t('settings.difficulty'), t('settings.difficultyDesc')), wrap);
  }

  /** 词库分布表：CEFR / 词频两种标准下各档位（基础/进阶/大师）的单词数 */
  private _wordDistribution(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'set-worddist';
    const title = document.createElement('div');
    title.className = 'set-worddist-title';
    title.textContent = t('settings.wordDist');
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'set-worddist-grid';
    // 表头行：左上角占位 + 三档标签
    grid.appendChild(document.createElement('div'));
    for (const label of [t('levelSelect.tier1'), t('levelSelect.tier2'), t('levelSelect.tier3')]) {
      const h = document.createElement('div');
      h.className = 'set-wd-h';
      h.textContent = label;
      grid.appendChild(h);
    }
    // CEFR 行
    const cefrLabel = document.createElement('div');
    cefrLabel.className = 'set-wd-rl';
    cefrLabel.textContent = t('settings.stdCefrShort');
    grid.appendChild(cefrLabel);
    for (const n of CEFR_WORD_COUNTS) {
      const c = document.createElement('div');
      c.className = 'set-wd-c';
      c.textContent = String(n);
      grid.appendChild(c);
    }
    // 词频行
    const freqLabel = document.createElement('div');
    freqLabel.className = 'set-wd-rl';
    freqLabel.textContent = t('settings.stdFreqShort');
    grid.appendChild(freqLabel);
    for (const n of FREQ_WORD_COUNTS) {
      const c = document.createElement('div');
      c.className = 'set-wd-c';
      c.textContent = String(n);
      grid.appendChild(c);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /** 题目分布表：CEFR / 词频两种标准下各档位（基础/进阶/大师）的题目数 */
  private _questionDistribution(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'set-worddist set-qdist';
    const title = document.createElement('div');
    title.className = 'set-worddist-title';
    title.textContent = t('settings.questionDist');
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'set-worddist-grid';
    // 表头行：左上角占位 + 三档标签
    grid.appendChild(document.createElement('div'));
    for (const label of [t('levelSelect.tier1'), t('levelSelect.tier2'), t('levelSelect.tier3')]) {
      const h = document.createElement('div');
      h.className = 'set-wd-h';
      h.textContent = label;
      grid.appendChild(h);
    }
    // CEFR 行
    const cefrLabel = document.createElement('div');
    cefrLabel.className = 'set-wd-rl';
    cefrLabel.textContent = t('settings.stdCefrShort');
    grid.appendChild(cefrLabel);
    for (const n of CEFR_QUESTION_COUNTS) {
      const c = document.createElement('div');
      c.className = 'set-wd-c';
      c.textContent = String(n);
      grid.appendChild(c);
    }
    // 词频行
    const freqLabel = document.createElement('div');
    freqLabel.className = 'set-wd-rl';
    freqLabel.textContent = t('settings.stdFreqShort');
    grid.appendChild(freqLabel);
    for (const n of FREQ_QUESTION_COUNTS) {
      const c = document.createElement('div');
      c.className = 'set-wd-c';
      c.textContent = String(n);
      grid.appendChild(c);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /** 难度区运行时态：加载完成前用默认值占位，加载后同步 */
  private _diff: { tier: DifficultyTier; standard: DifficultyStandard; questionSeed: string } = {
    tier: 1,
    standard: 'cefr',
    questionSeed: '',
  };

  private async _loadDifficulty(): Promise<{ tier: DifficultyTier; standard: DifficultyStandard; questionSeed: string }> {
    const data = await new SaveStore().load();
    this._diff.tier = data.difficultySetting.tier;
    this._diff.standard = data.difficultySetting.standard;
    this._diff.questionSeed = data.questionSeed;
    return this._diff;
  }

  private async _saveDiff(): Promise<void> {
    await new SaveStore().updateDifficultySetting(this._diff.tier, this._diff.standard);
  }

  /**
   * 应用新题目种子：持久化种子 + 清题目进度（换种子=换一轮题目，
   * 旧 completedSlots 对应的具体题目已不存在）。保留解锁与自制物体。
   */
  private async _applySeed(seed: string): Promise<void> {
    this._diff.questionSeed = seed;
    const store = new SaveStore();
    await store.updateQuestionSeed(seed);
    await store.clearChallengeProgress();
    sfx.play('ui');
  }

  // ——— 数据卡 ———

  private _dataCard(): HTMLDivElement {
    const iconBadge = document.createElement('div');
    iconBadge.className = 'set-badge';
    iconBadge.innerHTML = ICON_TRASH;

    const mid = document.createElement('div');
    mid.className = 'set-danger-mid';
    const label = document.createElement('div');
    label.className = 'set-danger-label';
    label.innerHTML = `${ICON_TRASH}<span>${t('settings.clearSave')}</span>`;
    const desc = document.createElement('div');
    desc.className = 'set-danger-desc';
    desc.textContent = t('settings.clearConfirmMsg');
    mid.appendChild(label);
    mid.appendChild(desc);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-btn-danger';
    btn.textContent = t('settings.clear');
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const ok = await confirmDialog({
        title: t('settings.clearConfirmTitle'),
        message: t('settings.clearConfirmMsg'),
        confirmText: t('settings.clear'),
      });
      if (!ok) return;
      await new SaveStore().clear();
      sfx.play('ui');
    });

    const row = document.createElement('div');
    row.className = 'set-danger-row';
    row.appendChild(iconBadge);
    row.appendChild(mid);
    row.appendChild(btn);

    return this._card(0.5, this._head(ICON_TRASH, t('settings.data'), t('settings.dataDesc')), row);
  }

  // ——— 通用辅助 ———

  /** 持久化单字段设置（合并当前设置后写回） */
  private _persist(patch: Partial<SettingsData>): void {
    saveSettings({ ...loadSettings(), ...patch });
  }

  /** 静音时置灰滑块，非静音时恢复 */
  private _applySlidersDisabled(muted: boolean): void {
    this.sliders.forEach((s) => {
      s.disabled = muted;
    });
  }

  /** 切换语言后整页重渲染：清空 overlay 重建，保留样式表 */
  private _rerender(): void {
    this.sliders = [];
    this.overlay?.remove();
    this._buildOverlay();
  }

  private _backToTitle(): void {
    this.overlay?.remove();
    this.scene.start('TitleScene');
  }

  shutdown(): void {
    this.overlay?.remove();
    document.getElementById('settings-style')?.remove();
  }
}
