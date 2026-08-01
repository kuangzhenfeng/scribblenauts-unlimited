/**
 * 虚拟触屏控制 —— 触屏设备自动显示的虚拟摇杆 + 动作按钮。
 *
 * 职责边界：只产生输入意图并注入 PlayerController（setVirtualMove/setVirtualJump/
 * setVirtualFire/triggerInteract/triggerShoot），不持有任何游戏逻辑。纯 DOM overlay + Pointer Events，
 * 不走 Phaser input pipeline，故不占 Phaser activePointers 槽。
 *
 * 多指：摇杆与按钮各自用独立 pointerId 跟踪（DOM Pointer Events 天然多指）。
 * 控制区 pointer-events:auto 拦截落在其上的触摸，不传到 canvas，MousePicker 不误触发。
 *
 * 显隐由 settings.touchControls 驱动：auto=触屏设备显示，on=强制显示，off=强制隐藏。
 */

import type { PlayerController } from '@/game/PlayerController';
import { loadSettings } from '@/core/data/settings/SettingsStore';
import { UI_FONT } from './paperStyle';
import { t } from '@/core/i18n/I18n';
import { ICON_ROTATE } from './icons';

/** 摇杆底座半径（px，屏幕 CSS 像素） */
const BASE_RADIUS = 60;
/** 摇杆 thumb 最大移动半径（底座内圈） */
const THUMB_RADIUS = 34;
/** 摇杆死区：归一化位移绝对值低于此值视为 0 */
const DEADZONE = 0.28;

export class TouchControls {
  private readonly container: HTMLDivElement;
  private readonly joystickBase: HTMLDivElement;
  private readonly joystickThumb: HTMLDivElement;
  private readonly jumpBtn: HTMLButtonElement;
  private readonly interactBtn: HTMLButtonElement;
  private readonly fireBtn: HTMLButtonElement;
  /** 摇杆当前锁定的 pointerId（仅第一根落在 base 上的手指） */
  private joystickPointerId: number | null = null;
  /** 摇杆底座圆心屏幕坐标 */
  private baseCenter = { x: 0, y: 0 };
  /** 当前是否显示 */
  private shown = false;

  constructor(private readonly player: PlayerController) {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:40',
      'display:none',
    ].join(';');

    // 左下虚拟摇杆（底座 + thumb）
    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = [
      'position:absolute',
      `left:max(28px,env(safe-area-inset-left))`,
      `bottom:max(28px,env(safe-area-inset-bottom))`,
      `width:${BASE_RADIUS * 2}px`,
      `height:${BASE_RADIUS * 2}px`,
      'border-radius:50%',
      'background:rgba(20,20,20,0.32)',
      'border:2px solid rgba(255,255,255,0.35)',
      'box-shadow:0 4px 14px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.1)',
      'pointer-events:auto',
      'touch-action:none',
    ].join(';');
    this.joystickThumb = document.createElement('div');
    this.joystickThumb.style.cssText = [
      'position:absolute',
      `left:${BASE_RADIUS - 22}px`,
      `top:${BASE_RADIUS - 22}px`,
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'background:radial-gradient(circle at 40% 35%,#fff8dd,#d77a10 80%)',
      'border:2px solid #3d2200',
      'box-shadow:0 3px 8px rgba(0,0,0,0.5)',
      'pointer-events:none',
      'transition:left 0.12s ease,top 0.12s ease',
    ].join(';');
    this.joystickBase.appendChild(this.joystickThumb);
    this.container.appendChild(this.joystickBase);

    // 右下动作按钮组：跳跃（上）+ 开火/交互（下并排）
    this.jumpBtn = this._makeActionBtn(t('touch.jump'), '#3ab5a0', '#0d3a30', '#0d3a30');
    this.jumpBtn.style.cssText += `;right:max(28px,env(safe-area-inset-right));bottom:max(108px,env(safe-area-inset-bottom));`;
    this.interactBtn = this._makeActionBtn(t('touch.interact'), '#efad19', '#3d2200', '#3d2200');
    this.interactBtn.innerHTML = ICON_ROTATE;
    this.interactBtn.style.cssText += `;right:max(96px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));`;
    this.fireBtn = this._makeActionBtn('开火', '#d45a3d', '#4a160f', '#fff3df');
    this.fireBtn.style.cssText += `;right:max(28px,env(safe-area-inset-right));bottom:max(28px,env(safe-area-inset-bottom));`;
    this.container.appendChild(this.jumpBtn);
    this.container.appendChild(this.interactBtn);
    this.container.appendChild(this.fireBtn);

    document.body.appendChild(this.container);

    this._attachJoystickEvents();
    this._attachButtonEvents(this.jumpBtn, () => player.setVirtualJump(true), () => player.setVirtualJump(false));
    this._attachButtonEvents(this.interactBtn, () => player.triggerInteract(), undefined);
    this._attachButtonEvents(
      this.fireBtn,
      () => player.setVirtualFire(true),
      () => player.setVirtualFire(false),
      () => player.triggerShoot(),
    );
  }

  /** 是否应显示：on 强制、off 强制隐藏、auto 用 pointer:coarse 判定触屏设备 */
  static shouldShow(): boolean {
    const pref = loadSettings().touchControls;
    if (pref === 'on') return true;
    if (pref === 'off') return false;
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  }

  show(): void {
    this.shown = true;
    this.container.style.display = 'block';
  }

  hide(): void {
    this.shown = false;
    this.container.style.display = 'none';
    // 隐藏时复位摇杆、跳跃与开火，避免残留输入
    this._resetJoystick();
    this.player.setVirtualJump(false);
    this.player.setVirtualFire(false);
  }

  get isVisible(): boolean {
    return this.shown;
  }

  /** 窗口尺寸/方向变化时重定位（CSS 已用 safe-area + 固定偏移，主要确保 baseCenter 重算） */
  onResize(): void {
    this._syncBaseCenter();
  }

  /** 构造一个圆形动作按钮 */
  private _makeActionBtn(label: string, glow: string, border: string, textColor: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute('aria-label', label);
    btn.style.cssText = [
      'position:absolute',
      'width:76px',
      'height:76px',
      'border-radius:50%',
      `background:radial-gradient(circle at 40% 35%,${glow}cc,${glow})`,
      `border:3px solid ${border}`,
      `color:${textColor}`,
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'font-weight:900',
      'letter-spacing:0.08em',
      'display:grid',
      'place-items:center',
      'box-shadow:0 5px 14px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.4)',
      'cursor:pointer',
      'pointer-events:auto',
      'touch-action:none',
      'user-select:none',
      'transition:transform 0.1s ease,filter 0.1s ease',
    ].join(';');
    return btn;
  }

  /** 摇杆 pointerdown/move/up 事件绑定 */
  private _attachJoystickEvents(): void {
    this.joystickBase.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.joystickBase.setPointerCapture(e.pointerId);
      this._syncBaseCenter();
      this._moveThumb(e.clientX, e.clientY);
      e.preventDefault();
    });
    this.joystickBase.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this._moveThumb(e.clientX, e.clientY);
      e.preventDefault();
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.joystickPointerId) return;
      this._resetJoystick();
      this.joystickPointerId = null;
      e.preventDefault();
    };
    this.joystickBase.addEventListener('pointerup', end);
    this.joystickBase.addEventListener('pointercancel', end);
  }

  /** 按钮 pointerdown/up 事件绑定（down/down 两个回调） */
  private _attachButtonEvents(
    btn: HTMLButtonElement,
    onDown: () => void,
    onUp?: () => void,
    onClick?: () => void,
  ): void {
    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      btn.setPointerCapture(e.pointerId);
      btn.style.transform = 'scale(0.92)';
      btn.style.filter = 'brightness(1.12)';
      onDown();
      e.preventDefault();
    });
    const release = (e: PointerEvent): void => {
      btn.style.transform = '';
      btn.style.filter = '';
      onUp?.();
      e.preventDefault();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('click', () => onClick?.());
  }

  /** 按当前指针位置移动 thumb 并注入 moveX */
  private _moveThumb(px: number, py: number): void {
    let dx = px - this.baseCenter.x;
    let dy = py - this.baseCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > THUMB_RADIUS) {
      dx = (dx / dist) * THUMB_RADIUS;
      dy = (dy / dist) * THUMB_RADIUS;
    }
    this.joystickThumb.style.left = `${BASE_RADIUS - 22 + dx}px`;
    this.joystickThumb.style.top = `${BASE_RADIUS - 22 + dy}px`;
    // 归一化 X 轴位移，应用死区
    const norm = dx / THUMB_RADIUS;
    this.player.setVirtualMove(Math.abs(norm) < DEADZONE ? 0 : norm);
  }

  /** 摇杆回中，清零移动输入 */
  private _resetJoystick(): void {
    this.joystickThumb.style.left = `${BASE_RADIUS - 22}px`;
    this.joystickThumb.style.top = `${BASE_RADIUS - 22}px`;
    this.player.setVirtualMove(0);
  }

  /** 同步底座圆心屏幕坐标（resize / 首次 pointerdown 时调用） */
  private _syncBaseCenter(): void {
    const r = this.joystickBase.getBoundingClientRect();
    this.baseCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}
