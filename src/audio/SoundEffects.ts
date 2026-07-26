/**
 * 音效导演 —— 用 Web Audio 合成《涂鸦冒险家 无限》风格的游戏音效。
 *
 * 设计要点：
 *  - 复用 MusicDirector 的 AudioContext + InstrumentBank 音色，与音乐保持一致的纸艺音色。
 *  - 保留两个 SFX 专用原语：playSlide（滑频振荡器）、playNoise（噪声脉冲），
 *    用于 jump 的频率上滑、spawn/land 的噪声瞬态等无法用预渲染音色表达的效果。
 *  - 音量路由独立 sfxMaster 到 destination，与音乐分离，避免互相盖过。
 *  - 音量与静音偏好持久化到 SettingsStore，由 SettingsScene 统一管理；
 *    setSfxVolume/setMuted 供设置页实时调整。
 */

import { music } from './MusicDirector';
import { loadSettings, saveSettings, type SettingsData } from '@/core/data/settings/SettingsStore';
import type { InstrumentBank } from './instruments';

type SfxName =
  | 'spawn'        // 生成：上扬钟琴琶音 + 纸面沙沙
  | 'jump'         // 跳跃：短促上滑"啾"
  | 'land'         // 着地：低音拨弦 + 噪声冲击
  | 'interact'     // 拾取/交互：马林巴五度叮当
  | 'questComplete'// 挑战完成：钟琴+马林巴上行琶音
  | 'starite'      // Starite 收集：钟琴闪烁 + 三角铁
  | 'ui'           // UI 点击：木鱼单击
  | 'error';       // 错误/拒绝：下行小二度

export class SoundEffects {
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private bank: InstrumentBank | undefined;
  /** 设置缓存：初始值从 SettingsStore 读取，跨会话记忆 */
  private settings: SettingsData = loadSettings();

  /** 绑定/刷新 AudioContext 与 InstrumentBank（音乐启动后才有） */
  private ensure(): void {
    const ctx = music.getAudioContext();
    const bank = music.getInstruments();
    if (!ctx || !bank) return;
    this.ctx = ctx;
    this.bank = bank;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.currentSfxGain();
      // 音效限幅器：spawn/starite 等多音叠加时压制峰值，避免削波爆音
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 4;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  }

  /** 播放指定音效 */
  play(name: SfxName): void {
    this.ensure();
    if (!this.ctx || !this.master || !this.bank) return;
    const at = this.ctx.currentTime;
    switch (name) {
      case 'spawn':         this.playSpawn(at); break;
      case 'jump':          this.playJump(at); break;
      case 'land':          this.playLand(at); break;
      case 'interact':      this.playInteract(at); break;
      case 'questComplete': this.playQuestComplete(at); break;
      case 'starite':       this.playStarite(at); break;
      case 'ui':            this.playUi(at); break;
      case 'error':         this.playError(at); break;
    }
  }

  /** 设置音效音量（0..1），实时生效，持久化 */
  setSfxVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.settings = { ...this.settings, sfxVolume: v };
    saveSettings(this.settings);
    this.applySfxGain();
  }

  /** 设置主静音（音效侧），持久化。音乐侧由 MusicDirector.setMuted 同步 */
  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    saveSettings(this.settings);
    this.applySfxGain();
  }

  // ---- 各音效合成 ----

  /** 生成：钟琴上行琶音 C5-E5-G5-C6 + 纸面沙沙 */
  private playSpawn(at: number): void {
    if (!this.bank || !this.master) return;
    const notes = [72, 76, 79, 84];
    for (let i = 0; i < notes.length; i++) {
      this.bank.playGlock(notes[i], at + i * 0.05, 0.3, this.master);
    }
    // 纸面沙沙
    this.playNoise(at, 0.12, 0.1, 'bandpass', 3000, 1);
  }

  /** 跳跃：sine 300→700Hz 上滑"啾" + 起跳噪声咔哒 */
  private playJump(at: number): void {
    this.playSlide(300, 700, at, 0.12, 'sine', 0.32);
    // 起跳瞬态噪声
    this.playNoise(at, 0.005, 0.15, 'bandpass', 3000, 1);
  }

  /** 着地：低音拨弦 C2 + 低通噪声冲击 */
  private playLand(at: number): void {
    if (!this.bank || !this.master) return;
    this.bank.playBass(36, at, 0.4, this.master);
    this.playNoise(at, 0.08, 0.12, 'lowpass', 400, 0.7);
  }

  /** 拾取/交互：马林巴 C5+G5 完美五度 */
  private playInteract(at: number): void {
    if (!this.bank || !this.master) return;
    this.bank.playMarimba(72, at, 0.3, this.master);
    this.bank.playMarimba(79, at + 0.06, 0.25, this.master);
  }

  /** 挑战完成：钟琴上行琶音 + 马林巴低音和弦 + 高音点缀 */
  private playQuestComplete(at: number): void {
    if (!this.bank || !this.master) return;
    const notes = [72, 76, 79, 84];
    for (let i = 0; i < notes.length; i++) {
      this.bank.playGlock(notes[i], at + i * 0.08, 0.35, this.master);
    }
    // 马林巴低音和弦
    this.bank.playMarimba(48, at, 0.25, this.master);
    this.bank.playMarimba(55, at, 0.2, this.master);
    // 末尾高音点缀
    this.bank.playGlock(96, at + 0.32, 0.2, this.master);
  }

  /** Starite 收集：钟琴高音闪烁序列 + 三角铁振铃 */
  private playStarite(at: number): void {
    if (!this.bank || !this.master) return;
    const notes = [88, 84, 86, 91, 96];
    for (let i = 0; i < notes.length; i++) {
      this.bank.playGlock(notes[i], at + i * 0.06, 0.25, this.master);
    }
    // 三角铁长振铃
    this.bank.playPerc('triangle', at, 0.15, this.master);
  }

  /** UI 点击：木鱼单击 */
  private playUi(at: number): void {
    if (!this.bank || !this.master) return;
    this.bank.playPerc('woodblock', at, 0.22, this.master);
  }

  /** 错误/拒绝：低音拨弦 C2→B1 下行小二度 */
  private playError(at: number): void {
    if (!this.bank || !this.master) return;
    this.bank.playBass(36, at, 0.25, this.master);
    this.bank.playBass(35, at + 0.1, 0.25, this.master);
  }

  // ---- SFX 专用原语 ----

  /**
   * 滑频振荡器：用于 jump 的频率上滑、error 的下滑。
   * @param fromHz 起始频率
   * @param toHz   目标频率
   * @param at     调度起始时间
   * @param dur    衰减时长（秒）
   * @param type   波形
   * @param vol    峰值音量（0-1）
   */
  private playSlide(
    fromHz: number,
    toHz: number,
    at: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ): void {
    if (!this.ctx || !this.master) return;

    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + dur + 0.02);
  }

  /**
   * 噪声脉冲：用于 spawn 的纸面沙沙、land 的冲击、jump 的瞬态。
   * @param at       调度起始时间
   * @param dur      衰减时长（秒）
   * @param vol      峰值音量
   * @param filter   滤波器类型
   * @param freq      滤波器中心/截止频率
   * @param q        滤波器 Q 值
   */
  private playNoise(
    at: number,
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    freq: number,
    q: number,
  ): void {
    if (!this.ctx || !this.master) return;

    const bufferSize = Math.floor(dur * this.ctx.sampleRate);
    if (bufferSize <= 0) return;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    biquad.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    noise.connect(biquad);
    biquad.connect(gain);
    gain.connect(this.master);
    noise.start(at);
    noise.stop(at + dur + 0.02);
  }

  /** 当前音效应输出的 gain（静音时为 0，否则为 sfxVolume） */
  private currentSfxGain(): number {
    return this.settings.muted ? 0 : this.settings.sfxVolume;
  }

  /** 应用当前音效 gain 到 master（平滑过渡） */
  private applySfxGain(): void {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.currentSfxGain(), t, 0.08);
  }
}

/** 全局音效单例 */
export const sfx = new SoundEffects();
