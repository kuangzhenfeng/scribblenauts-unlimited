/**
 * 音色库 —— 用 Web Audio 合成《涂鸦冒险家 无限》风格的多乐器音色。
 *
 * 设计要点：
 *  - 衰减型打击/拨弦音色（钟琴/马林巴/拨弦/低音拨弦 + 5 种打击乐）用 OfflineAudioContext
 *    离线预渲染成 AudioBuffer，播放时 BufferSource + Gain 两节点 + playbackRate pitch-shift，
 *    长期复用、零 GC 压力（旧实现每步重建噪声 buffer 的问题消除）。
 *  - 持续型音色（木管）需实时 LFO vibrato，无法离线渲染，用振荡器组实时合成，每音约 6 节点。
 *  - 每个播放方法对 buffer null 做优雅降级（prerender 未完成时静默跳过），不中断游戏。
 *  - 所有预渲染 buffer 经 RMS 归一化到统一响度，消除各音色内部 master gain 烘焙不一致
 *    导致的"有的主题响、有的主题轻"问题（见 normalize）。
 *  - 本模块只管"怎么发声"，不知道 mood / tempo / step（职责单一，见设计原则）。
 */

import { log } from '@/util/log';

/** 旋律/和声/低音乐器名 */
export type InstrumentName = 'glock' | 'marimba' | 'pizz' | 'woodwind' | 'cbass';

/** 打击乐类型 */
export type PercussionType = 'woodblock' | 'triangle' | 'snap' | 'tambourine' | 'cowbell';

/** 各预渲染音色的参考 MIDI 音高（pitch-shift 的基准） */
const REF_GLOCK = 72; // C5
const REF_MARIMBA = 60; // C4
const REF_PIZZ = 67; // G4
const REF_CBASS = 36; // C2

/** MIDI 音高 → 频率（Hz） */
function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * RMS 归一化目标（所有预渲染音色统一到此响度，消除各乐器内部 master gain
 * 烘焙进 buffer 时不一致导致的"有的主题响、有的主题轻"问题）。
 * 取 0.06（约 -24 dBFS）：保守值，留出多声部叠加余量不削波。
 */
const TARGET_RMS = 0.06;

/**
 * 木管输出 trim：实时合成无 buffer 可归一化，两个振荡器全幅相加 RMS 偏高，
 * 用此 trim 拉低到与归一化后 buffer 相近的响度。
 */
const WOODWIND_TRIM = 0.12;

export class InstrumentBank {
  // 预渲染 buffer：null = 尚未渲染完成，播放时静默跳过
  private glock: AudioBuffer | null = null;
  private marimba: AudioBuffer | null = null;
  private pizz: AudioBuffer | null = null;
  private cbass: AudioBuffer | null = null;
  private readonly perc: Map<PercussionType, AudioBuffer | null> = new Map([
    ['woodblock', null],
    ['triangle', null],
    ['snap', null],
    ['tambourine', null],
    ['cowbell', null],
  ]);

  /** 是否正在/已完成预渲染，避免重复触发 */
  private rendering = false;
  private rendered = false;

  constructor(private readonly ctx: AudioContext) {}

  /** 预渲染所有 AudioBuffer，AudioContext 创建后调用一次。异步不阻塞主线程。 */
  async prerender(): Promise<void> {
    if (this.rendered || this.rendering) return;
    this.rendering = true;
    try {
      // 各 render 返回未归一化的原始 buffer，统一过 normalize 拉到相同 RMS
      const [g, m, p, b, ...percs] = await Promise.all([
        this.renderGlock(),
        this.renderMarimba(),
        this.renderPizz(),
        this.renderCbass(),
        this.renderPerc('woodblock'),
        this.renderPerc('triangle'),
        this.renderPerc('snap'),
        this.renderPerc('tambourine'),
        this.renderPerc('cowbell'),
      ]);
      this.glock = this.normalize(g, 'glock');
      this.marimba = this.normalize(m, 'marimba');
      this.pizz = this.normalize(p, 'pizz');
      this.cbass = this.normalize(b, 'cbass');
      const types: PercussionType[] = ['woodblock', 'triangle', 'snap', 'tambourine', 'cowbell'];
      percs.forEach((buf, i) => this.perc.set(types[i], this.normalize(buf, types[i])));
      this.rendered = true;
    } finally {
      this.rendering = false;
    }
  }

  // ---- 预渲染音色播放（BufferSource + Gain，pitch-shift） ----

  /** 钟琴：清脆高音，快衰减 */
  playGlock(midi: number, at: number, vol: number, dest: AudioNode): void {
    this.playBuffer(this.glock, REF_GLOCK, midi, at, vol, dest);
  }

  /** 马林巴：木质中音，共振峰 */
  playMarimba(midi: number, at: number, vol: number, dest: AudioNode): void {
    this.playBuffer(this.marimba, REF_MARIMBA, midi, at, vol, dest);
  }

  /** 拨弦：短促弦乐 */
  playPizz(midi: number, at: number, vol: number, dest: AudioNode): void {
    this.playBuffer(this.pizz, REF_PIZZ, midi, at, vol, dest);
  }

  /** 低音拨弦：低频弦乐 */
  playBass(midi: number, at: number, vol: number, dest: AudioNode): void {
    this.playBuffer(this.cbass, REF_CBASS, midi, at, vol, dest);
  }

  // ---- 实时合成音色 ----

  /**
   * 木管/木笛：sine 基频 + triangle 二次谐波 + LFO vibrato + 气声噪声混合。
   * 持续型音色需实时 LFO 调制，故不预渲染；输出经 WOODWIND_TRIM 拉到与归一化后
   * buffer 相近的响度。
   */
  playWoodwind(midi: number, at: number, dur: number, vol: number, dest: AudioNode): void {
    const freq = midiToFreq(midi);
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    const noiseGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = freq;
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;

    // vibrato：5Hz LFO，深度 3 cents 调制基频
    lfo.type = 'sine';
    lfo.frequency.value = 5;
    lfoGain.gain.value = freq * (2 ** (3 / 1200) - 1); // 3 cents 的频率偏移量
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // 气声噪声：白噪声 → bandpass → 低增益混合
    const noise = this.createNoiseSource(dur);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 0.5;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.gain.value = 0.04 * WOODWIND_TRIM;

    // ADSR：attack 30ms → sustain → release（dur 控制），输出经 trim 归一化
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol * WOODWIND_TRIM, at + 0.03);
    gain.gain.setValueAtTime(vol * WOODWIND_TRIM, at + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(at);
    osc2.start(at);
    lfo.start(at);
    noise.start(at);
    osc1.stop(at + dur + 0.02);
    osc2.stop(at + dur + 0.02);
    lfo.stop(at + dur + 0.02);
    noise.stop(at + dur + 0.02);
  }

  /** 打击乐：播放预渲染 buffer */
  playPerc(type: PercussionType, at: number, vol: number, dest: AudioNode): void {
    const buf = this.perc.get(type);
    if (!buf) return; // 未渲染完成，静默跳过
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(dest);
    src.start(at);
    src.stop(at + buf.duration + 0.02);
  }

  // ---- 预渲染实现 ----

  /** 钟琴：sine 谐波叠加（基频 + 2x/3x/4.2x），快衰减，金属质感 */
  private async renderGlock(): Promise<AudioBuffer> {
    const dur = 0.5;
    const off = this.makeOffline(dur);
    const ref = midiToFreq(REF_GLOCK);
    const master = off.createGain();
    master.gain.value = 0.6;
    master.connect(off.destination);

    // 谐波组：基频 + 2x + 3x + 4.2x（失谐四次，增加金属感）
    const harmonics: Array<[number, OscillatorType, number]> = [
      [1, 'sine', 0.6],
      [2, 'sine', 0.2],
      [3, 'sine', 0.08],
      [4.2, 'sine', 0.04],
    ];
    for (const [mult, type, g] of harmonics) {
      const osc = off.createOscillator();
      osc.type = type;
      osc.frequency.value = ref * mult;
      const env = off.createGain();
      env.gain.setValueAtTime(0.0001, 0);
      env.gain.exponentialRampToValueAtTime(g, 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, dur);
      osc.connect(env);
      env.connect(master);
      osc.start(0);
      osc.stop(dur);
    }
    return off.startRendering();
  }

  /** 马林巴：sine 谐波 + 失谐双音 + bandpass 共振峰，木质温暖 */
  private async renderMarimba(): Promise<AudioBuffer> {
    const dur = 0.6;
    const off = this.makeOffline(dur);
    const ref = midiToFreq(REF_MARIMBA);

    // 共振峰滤波器（模拟木琴体共鸣）
    const bandpass = off.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800;
    bandpass.Q.value = 2;
    bandpass.connect(off.destination);

    const master = off.createGain();
    master.gain.value = 0.5;
    master.connect(bandpass);

    // 谐波组：基频 + 2x + 4x + 失谐双音
    const partials: Array<[number, OscillatorType, number]> = [
      [1, 'sine', 0.5],
      [2, 'sine', 0.15],
      [4, 'sine', 0.05],
      [1.004, 'sine', 0.3], // 失谐 7 cents，温暖感
    ];
    for (const [mult, type, g] of partials) {
      const osc = off.createOscillator();
      osc.type = type;
      osc.frequency.value = ref * mult;
      const env = off.createGain();
      env.gain.setValueAtTime(0.0001, 0);
      env.gain.exponentialRampToValueAtTime(g, 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, dur);
      osc.connect(env);
      env.connect(master);
      osc.start(0);
      osc.stop(dur);
    }
    return off.startRendering();
  }

  /** 拨弦：sawtooth 双音微失谐 + lowpass + 起音噪声，短促 */
  private async renderPizz(): Promise<AudioBuffer> {
    const dur = 0.2;
    const off = this.makeOffline(dur);
    const ref = midiToFreq(REF_PIZZ);

    const lowpass = off.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2000;
    lowpass.Q.value = 0.7;
    lowpass.connect(off.destination);

    const master = off.createGain();
    master.gain.value = 0.3;
    master.connect(lowpass);

    // 双音微失谐（合奏感）
    for (const detune of [0, 8]) {
      const osc = off.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = ref;
      osc.detune.value = detune;
      const env = off.createGain();
      env.gain.setValueAtTime(0.0001, 0);
      env.gain.exponentialRampToValueAtTime(1, 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, dur * 0.75);
      osc.connect(env);
      env.connect(master);
      osc.start(0);
      osc.stop(dur);
    }

    // 起音噪声：5ms 带通，模拟拨弦瞬态
    const noiseBuf = off.createBuffer(1, Math.ceil(0.005 * off.sampleRate), off.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = off.createBufferSource();
    noise.buffer = noiseBuf;
    const nFilter = off.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 3000;
    nFilter.Q.value = 1;
    const nGain = off.createGain();
    nGain.gain.value = 0.15;
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(master);
    noise.start(0);
    noise.stop(0.005);

    return off.startRendering();
  }

  /** 低音拨弦：sawtooth + sine 强基频 + lowpass，低沉 */
  private async renderCbass(): Promise<AudioBuffer> {
    const dur = 0.3;
    const off = this.makeOffline(dur);
    const ref = midiToFreq(REF_CBASS);

    const lowpass = off.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 400;
    lowpass.Q.value = 0.5;
    lowpass.connect(off.destination);

    const master = off.createGain();
    master.gain.value = 0.4;
    master.connect(lowpass);

    const osc1 = off.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = ref;
    const osc2 = off.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = ref;
    const env = off.createGain();
    env.gain.setValueAtTime(0.0001, 0);
    env.gain.exponentialRampToValueAtTime(1, 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, dur * 0.83);
    osc1.connect(env);
    osc2.connect(env);
    env.connect(master);
    osc1.start(0);
    osc2.start(0);
    osc1.stop(dur);
    osc2.stop(dur);

    return off.startRendering();
  }

  /** 打击乐预渲染：按类型合成短脉冲 */
  private async renderPerc(type: PercussionType): Promise<AudioBuffer> {
    switch (type) {
      case 'woodblock':
        return this.renderWoodblock();
      case 'triangle':
        return this.renderTriangle();
      case 'snap':
        return this.renderSnap();
      case 'tambourine':
        return this.renderTambourine();
      case 'cowbell':
        return this.renderCowbell();
    }
  }

  /** 木鱼：sine 800Hz 短脉冲 + 噪声咔哒，60ms */
  private async renderWoodblock(): Promise<AudioBuffer> {
    const dur = 0.06;
    const off = this.makeOffline(dur);
    const osc = off.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const env = off.createGain();
    env.gain.setValueAtTime(0.5, 0);
    env.gain.exponentialRampToValueAtTime(0.0001, dur);
    osc.connect(env);
    env.connect(off.destination);
    osc.start(0);
    osc.stop(dur);

    // 短噪声咔哒
    const noise = this.makeNoiseBuffer(off, dur);
    const ns = off.createBufferSource();
    ns.buffer = noise;
    const nGain = off.createGain();
    nGain.gain.setValueAtTime(0.2, 0);
    nGain.gain.exponentialRampToValueAtTime(0.0001, dur * 0.5);
    ns.connect(nGain);
    nGain.connect(off.destination);
    ns.start(0);
    ns.stop(dur * 0.5);

    return off.startRendering();
  }

  /** 三角铁：sine 2637Hz 长振铃，400ms */
  private async renderTriangle(): Promise<AudioBuffer> {
    const dur = 0.4;
    const off = this.makeOffline(dur);
    const master = off.createGain();
    master.gain.value = 0.3;
    master.connect(off.destination);

    // 高频泛音叠加
    for (const mult of [1, 2.76, 5.4]) {
      const osc = off.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 2637 * mult;
      const env = off.createGain();
      const peak = mult === 1 ? 0.5 : 0.15;
      env.gain.setValueAtTime(0.0001, 0);
      env.gain.exponentialRampToValueAtTime(peak, 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, dur);
      osc.connect(env);
      env.connect(master);
      osc.start(0);
      osc.stop(dur);
    }
    return off.startRendering();
  }

  /** 响指：白噪声 → bandpass(1500Hz, Q3)，40ms */
  private async renderSnap(): Promise<AudioBuffer> {
    const dur = 0.04;
    const off = this.makeOffline(dur);
    const noise = this.makeNoiseBuffer(off, dur);
    const ns = off.createBufferSource();
    ns.buffer = noise;
    const bp = off.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 3;
    const gain = off.createGain();
    gain.gain.setValueAtTime(0.4, 0);
    gain.gain.exponentialRampToValueAtTime(0.0001, dur);
    ns.connect(bp);
    bp.connect(gain);
    gain.connect(off.destination);
    ns.start(0);
    ns.stop(dur);
    return off.startRendering();
  }

  /** 铃鼓：白噪声 → highpass(5kHz) + 多次短突发，120ms */
  private async renderTambourine(): Promise<AudioBuffer> {
    const dur = 0.12;
    const off = this.makeOffline(dur);
    const noise = this.makeNoiseBuffer(off, dur);
    const ns = off.createBufferSource();
    ns.buffer = noise;
    const hp = off.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const gain = off.createGain();
    gain.gain.value = 0.3;
    ns.connect(hp);
    hp.connect(gain);
    gain.connect(off.destination);
    // 多次短突发（开/关 gain 模拟抖动）
    const bursts = 4;
    const burstDur = dur / bursts;
    for (let i = 0; i < bursts; i++) {
      const t = i * burstDur;
      gain.gain.setValueAtTime(i % 2 === 0 ? 0.3 : 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + burstDur * 0.9);
    }
    ns.start(0);
    ns.stop(dur);
    return off.startRendering();
  }

  /** 牛铃：方波 540Hz + 800Hz 叠加，80ms */
  private async renderCowbell(): Promise<AudioBuffer> {
    const dur = 0.08;
    const off = this.makeOffline(dur);
    const master = off.createGain();
    master.gain.value = 0.35;
    master.connect(off.destination);

    for (const freq of [540, 800]) {
      const osc = off.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const env = off.createGain();
      env.gain.setValueAtTime(0.0001, 0);
      env.gain.exponentialRampToValueAtTime(1, 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, dur);
      osc.connect(env);
      env.connect(master);
      osc.start(0);
      osc.stop(dur);
    }
    return off.startRendering();
  }

  // ---- 底层工具 ----

  /**
   * RMS 归一化：把 buffer 峰值 RMS 拉到 TARGET_RMS，消除各音色烘焙时内部
   * master gain 不一致导致的响度差异。保留 buffer 形状与时长不变。
   * @param src 原始渲染 buffer
   * @param name  音色名（仅用于日志）
   */
  private normalize(src: AudioBuffer, name: string): AudioBuffer {
    const ch = src.numberOfChannels;
    const out = this.ctx.createBuffer(ch, src.length, src.sampleRate);
    for (let c = 0; c < ch; c++) {
      const inData = src.getChannelData(c);
      const outData = out.getChannelData(c);
      // 计算峰值 RMS（取整段绝对值的平均近似，对短打击乐与衰减音色均适用）
      let sum = 0;
      for (let i = 0; i < inData.length; i++) sum += inData[i] * inData[i];
      const rms = Math.sqrt(sum / Math.max(1, inData.length));
      // 当前响度（防 0），gain = 目标 / 当前
      const gain = rms > 1e-5 ? TARGET_RMS / rms : 1;
      // 硬限幅防归一化后个别采样点削波
      for (let i = 0; i < inData.length; i++) {
        let v = inData[i] * gain;
        if (v > 1) v = 1;
        else if (v < -1) v = -1;
        outData[i] = v;
      }
    }
    log.info('instrument normalized', { name, targetRms: TARGET_RMS });
    return out;
  }

  /** 创建 OfflineAudioContext */
  private makeOffline(dur: number): OfflineAudioContext {
    const sr = this.ctx.sampleRate;
    return new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
  }

  /** 在 OfflineAudioContext 中创建白噪声 buffer */
  private makeNoiseBuffer(off: OfflineAudioContext, dur: number): AudioBuffer {
    const buf = off.createBuffer(1, Math.ceil(dur * off.sampleRate), off.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 创建实时白噪声 BufferSource（木管气声用） */
  private createNoiseSource(dur: number): AudioBufferSourceNode {
    const buf = this.ctx.createBuffer(1, Math.ceil(dur * this.ctx.sampleRate), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /** 播放预渲染 buffer（pitch-shift + 增益） */
  private playBuffer(
    buf: AudioBuffer | null,
    refMidi: number,
    midi: number,
    at: number,
    vol: number,
    dest: AudioNode,
  ): void {
    if (!buf) return; // 未渲染完成，静默跳过
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 2 ** ((midi - refMidi) / 12);
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(dest);
    src.start(at);
    src.stop(at + buf.duration / src.playbackRate.value + 0.02);
  }
}
