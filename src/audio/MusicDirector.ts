/**
 * 音乐导演 —— 调度 7 主题多声部旋律播放。
 *
 * 设计要点：
 *  - lookahead scheduler：setTimeout(tick, 90) 填充 0.25s 窗口，提前调度避免抖动。
 *  - 16 分音符为一步（60/tempo/4），短语 64 步 = 4 小节，10 段编排 = 640 步。
 *  - 5 声部（melody/harmony/bass/arpeggio/percussion）由 scores.ts 展平，配器由
 *    InstrumentBank（instruments.ts）合成。本模块只管"何时弹"与公开 API。
 *  - AudioContext 跨场景复用（TitleScene/WorldScene 不切断），SoundEffects 通过
 *    getAudioContext() / getInstruments() 共享同一 context 与音色。
 *  - 只在用户第一次交互后启动，符合浏览器自动播放策略。
 *  - 音量与静音偏好持久化到 SettingsStore（localStorage），跨会话记忆；
 *    SettingsScene 为唯一写入源，本模块只读 + 响应 setMusicVolume/setMuted。
 */

import { log } from '@/util/log';
import { loadSettings, saveSettings, type SettingsData } from '@/core/data/settings/SettingsStore';
import { InstrumentBank, type InstrumentName, type PercussionType } from './instruments';
import { flatten, getMoodData, VOICE_VOLUMES, type FlattenedScore, type MusicMood } from './scores';

// 重新导出 MusicMood，保持外部从 @/audio/MusicDirector 导入的调用点零改动
export type { MusicMood } from './scores';

/** 展平后乐谱的步数 */
const TOTAL_STEPS = 640;

export class MusicDirector {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private instruments: InstrumentBank | undefined;
  private timer: number | undefined;
  private nextNoteAt = 0;
  private step = 0;
  private mood: MusicMood = 'title';
  /** 设置缓存：初始值从 SettingsStore 读取，跨会话记忆 */
  private settings: SettingsData = loadSettings();
  private active = false;
  /** 当前 mood 展平后的乐谱（切换 mood 时重建） */
  private score: FlattenedScore = flatten('title');

  start(mood: MusicMood = this.mood): void {
    this.mood = mood;
    this.score = flatten(mood);
    this.ensureAudio();
    if (!this.context || !this.master) return;

    this.active = true;
    void this.context.resume();
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.currentMusicGain(), t);
    this.nextNoteAt = t;
    this.step = 0;
    this.schedule();
  }

  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.score = flatten(mood);
    if (!this.active || !this.context || !this.master) return;
    const t = this.context.currentTime;
    // 快速淡出 → 重置步数 → 淡入，避免硬切（尊重静音状态）
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    this.master.gain.linearRampToValueAtTime(this.currentMusicGain(), t + 0.5);
    this.nextNoteAt = t + 0.15;
    this.step = 0;
    log.info('music mood changed', { mood });
  }

  toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  /** 设置音乐音量（0..1），实时生效，持久化 */
  setMusicVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.settings = { ...this.settings, musicVolume: v };
    saveSettings(this.settings);
    this.applyMusicGain();
  }

  /** 设置主静音（同时控制音乐与音效），持久化 */
  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    saveSettings(this.settings);
    this.applyMusicGain();
  }

  /**
   * 暂停音乐调度（窗口失焦/游戏暂停时调用）。
   * 清空 scheduler 定时器并把 master 淡出到 0，避免点击爆音；
   * 不修改用户音量偏好，仅作用于活跃会话。
   */
  pause(): void {
    if (!this.active) return;
    this.active = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.master && this.context) {
      const t = this.context.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  /**
   * 从暂停恢复音乐调度。
   * 步数重置到 0，nextNoteAt 对齐当前时间，平滑淡入回目标音量。
   */
  resume(): void {
    if (this.active) return;
    if (!this.context || !this.master) return;
    this.active = true;
    void this.context.resume();
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.currentMusicGain(), t, 0.05);
    this.nextNoteAt = t;
    this.step = 0;
    this.schedule();
  }

  /** 暴露 AudioContext 供 SoundEffects 复用，避免创建多 context */
  getAudioContext(): AudioContext | undefined {
    this.ensureAudio();
    return this.context;
  }

  /** 暴露 InstrumentBank 供 SoundEffects 复用音色 */
  getInstruments(): InstrumentBank | undefined {
    this.ensureAudio();
    return this.instruments;
  }

  private ensureAudio(): void {
    if (this.context && this.master) return;
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;

    this.context = new AudioContextCtor();
    this.master = this.context.createGain();
    this.master.gain.value = this.currentMusicGain();
    // 主限幅器：多声部叠加时压制瞬态峰值，避免高密度段落（如 jungle dense 打击
    // + walking bass + melody 同拍）削波爆音；阈值 -6 dBFS，温和压缩保留动态
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    this.master.connect(limiter);
    limiter.connect(this.context.destination);
    this.instruments = new InstrumentBank(this.context);
    void this.instruments.prerender().then(() => {
      log.info('instrument buffers prerendered');
    });
  }

  /** 当前音乐应输出的 gain（静音时为 0，否则为 musicVolume） */
  private currentMusicGain(): number {
    return this.settings.muted ? 0 : this.settings.musicVolume;
  }

  /** 应用当前音乐 gain 到 master（活跃时平滑过渡，否则直接设值） */
  private applyMusicGain(): void {
    if (!this.master || !this.context) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.currentMusicGain(), t, 0.08);
  }

  private schedule(): void {
    if (this.timer !== undefined) return;

    const tick = (): void => {
      this.timer = undefined;
      if (!this.context || !this.master || !this.active) return;

      const tempo = getMoodData(this.mood).tempo;
      const lookAhead = 0.25;
      while (this.nextNoteAt < this.context.currentTime + lookAhead) {
        this.scheduleStep(this.step, this.nextNoteAt);
        this.step += 1;
        // 16 分音符为一步
        this.nextNoteAt += 60 / tempo / 4;
        // 循环：到 640 步回到 0
        if (this.step >= TOTAL_STEPS) this.step = 0;
      }
      this.timer = window.setTimeout(tick, 90);
    };

    tick();
  }

  private scheduleStep(step: number, at: number): void {
    if (!this.context || !this.master || !this.instruments) return;

    const i = step % TOTAL_STEPS;
    const data = getMoodData(this.mood);

    // 主旋律
    const melody = this.score.melody[i];
    if (melody > 0) {
      this.playInstrument(data.melodyInstrument, melody, at, VOICE_VOLUMES.melody);
    }

    // 和声伴奏
    const harmony = this.score.harmony[i];
    if (harmony > 0) {
      this.playInstrument(data.harmonyInstrument, harmony, at, VOICE_VOLUMES.harmony);
    }

    // 低音线
    const bass = this.score.bass[i];
    if (bass > 0) {
      this.playInstrument(data.bassInstrument, bass, at, VOICE_VOLUMES.bass);
    }

    // 琶音/装饰（与主旋律同乐器，高八度）
    const arp = this.score.arpeggio[i];
    if (arp > 0) {
      this.playInstrument(data.melodyInstrument, arp, at, VOICE_VOLUMES.arpeggio);
    }

    // 打击乐（0=休止，1=弱击，2=正常，3=重击）
    const perc = this.score.percussion[i];
    if (perc > 0) {
      this.instruments.playPerc(
        data.percussionType as PercussionType,
        at,
        VOICE_VOLUMES.percussion * (perc / 2),
        this.master,
      );
    }
  }

  /** 按乐器类型分发到 InstrumentBank */
  private playInstrument(name: InstrumentName, midi: number, at: number, vol: number): void {
    if (!this.instruments || !this.master) return;
    switch (name) {
      case 'glock':    this.instruments.playGlock(midi, at, vol, this.master); break;
      case 'marimba':  this.instruments.playMarimba(midi, at, vol, this.master); break;
      case 'pizz':     this.instruments.playPizz(midi, at, vol, this.master); break;
      case 'woodwind': this.instruments.playWoodwind(midi, at, 0.3, vol, this.master); break;
      case 'cbass':    this.instruments.playBass(midi, at, vol, this.master); break;
    }
  }
}

export const music = new MusicDirector();
