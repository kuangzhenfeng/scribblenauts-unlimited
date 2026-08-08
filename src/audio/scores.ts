/**
 * 乐谱数据 —— 10 个基础 mood + 每个关卡独立生成的多声部乐曲（"弹什么"）。
 *
 * 设计要点：
 *  - 16 分音符为一步，短语 64 步 = 4 小节（4/4 拍），10 段编排 = 640 步。
 *  - melody 手写（需要音乐性：跳跃音程、装饰音、休止、16 分节奏）；
 *    harmony/bass/arpeggio/percussion 从和弦进行 + mood 模式参数用辅助函数生成（DRY），
 *    避免手写 6720 个值且保证声部间和声一致。
 *  - 纯数据模块，不含任何合成逻辑（合成见 instruments.ts，调度见 MusicDirector.ts）。
 */

import type { InstrumentName, PercussionType } from './instruments';

type BaseMusicMood =
  | 'title'
  | 'meadow'
  | 'cave'
  | 'jungle'
  | 'snow'
  | 'desert'
  | 'volcano'
  | 'storybook'
  | 'clockwork'
  | 'aurora';

export type MusicMood = BaseMusicMood | `level:${string}`;

/** 短语长度（16 分音符步数，64 = 4 小节） */
export const PHRASE_LEN = 64;
/** 编排段数 */
export const ARRANGEMENT_LEN = 10;
/** 总步数 = 640 */
export const TOTAL_STEPS = PHRASE_LEN * ARRANGEMENT_LEN;

/** 和弦项：根音/三音/五音/七音（可选）+ 持续步数 */
interface ChordEntry {
  root: number;
  third: number;
  fifth: number;
  seventh?: number;
  steps: number;
}

/** 低音模式 */
type BassMode = 'walking' | 'pedal' | 'ostinato';

/** 打击乐密度 */
type PercDensity = 'sparse' | 'normal' | 'dense';

/** 单个乐段：手写主旋律 + 和弦进行 */
interface Phrase {
  melody: number[];
  chords: ChordEntry[];
}

/** 单个情绪的乐曲数据 */
interface MoodData {
  tempo: number;
  melodyInstrument: InstrumentName;
  harmonyInstrument: InstrumentName;
  bassInstrument: InstrumentName;
  percussionType: PercussionType;
  bassMode: BassMode;
  percDensity: PercDensity;
  phrases: { A: Phrase; B: Phrase; C: Phrase };
  arrangement: ('A' | 'B' | 'C')[];
}

// ---- 打击乐 16 步模式（1 小节，flatten 中按小节重复） ----
const PERC_PATTERNS: Record<PercDensity, number[]> = {
  // 稀疏：仅步 0 重击 + 步 8 弱击
  sparse:  [3, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  // 正常：步 0/8 正常 + 步 4/12 弱击
  normal:  [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
  // 密集：每 2 步交替，步 0 重击
  dense:   [3, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0],
};

// walking bass 的四音偏移模式：root, root+12, root+7, root+5
const WALKING_OFFSETS = [0, 12, 7, 5];
// ostinato 的四音偏移模式：root, root, root+7, root
const OSTINATO_OFFSETS = [0, 0, 7, 0];

/** 各 mood 乐曲 —— 旋律手写，和弦进行驱动和声伴奏/低音/琶音 */
const MOODS: Record<BaseMusicMood, MoodData> = {
  // 标题：C 大调，78 BPM，温馨音乐盒，I-vi-ii-V7 jazz turnaround
  title: {
    tempo: 78,
    melodyInstrument: 'glock',
    harmonyInstrument: 'woodwind',
    bassInstrument: 'cbass',
    percussionType: 'triangle',
    bassMode: 'walking',
    percDensity: 'sparse',
    phrases: {
      A: {
        // C-Am-Dm-G7
        melody: [
          72, 0, 76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 72, 74, 76, 0,
          69, 0, 72, 0, 76, 0, 81, 0, 76, 0, 72, 0, 69, 71, 72, 0,
          74, 0, 77, 0, 81, 0, 86, 0, 81, 0, 77, 0, 74, 76, 77, 0,
          67, 0, 62, 0, 59, 0, 62, 0, 67, 0, 74, 0, 79, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 45, third: 48, fifth: 52, steps: 16 },
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 43, third: 47, fifth: 50, seventh: 53, steps: 16 },
        ],
      },
      B: {
        // C-Em-F-G7
        melody: [
          72, 0, 76, 0, 79, 0, 84, 0, 88, 0, 84, 0, 79, 0, 76, 0,
          76, 0, 79, 0, 83, 0, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0,
          77, 0, 81, 0, 84, 0, 89, 0, 84, 0, 81, 0, 77, 0, 0, 0,
          79, 0, 74, 0, 71, 0, 74, 0, 79, 0, 86, 0, 91, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 52, third: 55, fifth: 59, steps: 16 },
          { root: 53, third: 57, fifth: 60, steps: 16 },
          { root: 43, third: 47, fifth: 50, seventh: 53, steps: 16 },
        ],
      },
      C: {
        // Am-Dm-G7-C
        melody: [
          69, 0, 72, 0, 76, 0, 81, 0, 84, 0, 81, 0, 76, 0, 72, 0,
          74, 0, 77, 0, 81, 0, 86, 0, 89, 0, 86, 0, 81, 0, 0, 0,
          67, 0, 71, 0, 74, 0, 79, 0, 83, 0, 79, 0, 74, 0, 71, 0,
          72, 0, 76, 0, 79, 0, 84, 0, 88, 0, 91, 0, 96, 0, 0, 0,
        ],
        chords: [
          { root: 45, third: 48, fifth: 52, steps: 16 },
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 43, third: 47, fifth: 50, seventh: 53, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 草地：G 大调，100 BPM，明快田园，I-IV-V-I
  meadow: {
    tempo: 100,
    melodyInstrument: 'marimba',
    harmonyInstrument: 'pizz',
    bassInstrument: 'cbass',
    percussionType: 'woodblock',
    bassMode: 'walking',
    percDensity: 'normal',
    phrases: {
      A: {
        // G-C-D-G
        melody: [
          74, 0, 0, 78, 0, 81, 0, 0, 78, 0, 74, 0, 0, 0, 71, 0,
          72, 0, 0, 76, 0, 79, 0, 0, 76, 0, 72, 0, 0, 0, 67, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 81, 0, 78, 0, 74, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 78, 74, 0, 0, 71, 0, 74, 0, 0, 0,
        ],
        chords: [
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 50, third: 54, fifth: 57, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      B: {
        // Em-C-D-G
        melody: [
          76, 0, 79, 0, 83, 0, 79, 0, 76, 0, 0, 0, 0, 0, 0, 0,
          72, 0, 76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 72, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 81, 0, 78, 0, 74, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 90, 0, 86, 0, 81, 0, 0, 0,
        ],
        chords: [
          { root: 40, third: 43, fifth: 47, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 50, third: 54, fifth: 57, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      C: {
        // G-D-C-G
        melody: [
          74, 78, 81, 0, 78, 74, 0, 0, 81, 0, 78, 0, 74, 0, 0, 0,
          81, 0, 86, 0, 81, 0, 78, 0, 74, 0, 78, 0, 81, 0, 0, 0,
          79, 0, 84, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 81, 0, 78, 0, 74, 0, 0, 0,
        ],
        chords: [
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 50, third: 54, fifth: 57, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 洞穴：A 小调，66 BPM，神秘回响，i-VI-III-VII
  cave: {
    tempo: 66,
    melodyInstrument: 'marimba',
    harmonyInstrument: 'woodwind',
    bassInstrument: 'cbass',
    percussionType: 'snap',
    bassMode: 'pedal',
    percDensity: 'sparse',
    phrases: {
      A: {
        // Am-F-C-G
        melody: [
          69, 0, 0, 0, 72, 0, 0, 0, 76, 0, 0, 0, 72, 0, 0, 0,
          69, 0, 0, 0, 65, 0, 0, 0, 69, 0, 0, 0, 72, 0, 0, 0,
          72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0, 76, 0, 0, 0,
          74, 0, 0, 0, 71, 0, 0, 0, 67, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 45, third: 48, fifth: 52, steps: 16 },
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      B: {
        // Am-Dm-Em-Am
        melody: [
          69, 0, 0, 0, 72, 0, 0, 0, 76, 0, 79, 0, 0, 0, 0, 0,
          74, 0, 0, 0, 77, 0, 0, 0, 81, 0, 0, 0, 77, 0, 0, 0,
          76, 0, 0, 0, 72, 0, 0, 0, 67, 0, 0, 0, 0, 0, 0, 0,
          69, 0, 0, 0, 72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0,
        ],
        chords: [
          { root: 45, third: 48, fifth: 52, steps: 16 },
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 40, third: 43, fifth: 47, steps: 16 },
          { root: 45, third: 48, fifth: 52, steps: 16 },
        ],
      },
      C: {
        // F-C-G-Am
        melody: [
          65, 0, 0, 0, 69, 0, 0, 0, 72, 0, 0, 0, 76, 0, 0, 0,
          72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0, 84, 0, 0, 0,
          79, 0, 0, 0, 74, 0, 0, 0, 71, 0, 0, 0, 67, 0, 0, 0,
          69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 48, fifth: 52, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 丛林：D 大调，108 BPM，热带明快，I-ii-V-I（maj7）
  jungle: {
    tempo: 108,
    melodyInstrument: 'marimba',
    harmonyInstrument: 'pizz',
    bassInstrument: 'cbass',
    percussionType: 'tambourine',
    bassMode: 'walking',
    percDensity: 'dense',
    phrases: {
      A: {
        // D-Em-A-D
        melody: [
          74, 78, 81, 0, 78, 74, 0, 78, 81, 0, 86, 0, 81, 78, 74, 0,
          76, 79, 83, 0, 79, 76, 0, 79, 83, 0, 88, 0, 83, 79, 76, 0,
          81, 0, 85, 0, 88, 0, 93, 0, 88, 0, 85, 0, 81, 0, 0, 0,
          78, 0, 81, 0, 86, 0, 90, 0, 93, 0, 90, 86, 81, 78, 74, 0,
        ],
        chords: [
          { root: 50, third: 54, fifth: 57, seventh: 61, steps: 16 },
          { root: 52, third: 55, fifth: 59, seventh: 62, steps: 16 },
          { root: 45, third: 49, fifth: 52, seventh: 56, steps: 16 },
          { root: 50, third: 54, fifth: 57, seventh: 61, steps: 16 },
        ],
      },
      B: {
        // G-Em-A-D
        melody: [
          83, 0, 86, 0, 90, 0, 86, 0, 83, 0, 79, 0, 0, 0, 0, 0,
          76, 0, 79, 0, 83, 0, 88, 0, 83, 0, 79, 0, 76, 0, 0, 0,
          81, 0, 85, 0, 88, 0, 93, 0, 88, 0, 85, 0, 81, 0, 0, 0,
          78, 0, 81, 0, 86, 0, 90, 0, 93, 0, 90, 0, 86, 0, 0, 0,
        ],
        chords: [
          { root: 43, third: 47, fifth: 50, seventh: 54, steps: 16 },
          { root: 52, third: 55, fifth: 59, seventh: 62, steps: 16 },
          { root: 45, third: 49, fifth: 52, seventh: 56, steps: 16 },
          { root: 50, third: 54, fifth: 57, seventh: 61, steps: 16 },
        ],
      },
      C: {
        // D-A-Em-D
        melody: [
          74, 0, 78, 81, 0, 86, 0, 81, 78, 0, 74, 0, 0, 0, 78, 0,
          81, 0, 85, 0, 88, 0, 93, 0, 0, 0, 88, 0, 85, 0, 81, 0,
          76, 0, 79, 0, 83, 0, 88, 0, 83, 0, 79, 0, 76, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 90, 0, 86, 0, 81, 0, 0, 0,
        ],
        chords: [
          { root: 50, third: 54, fifth: 57, seventh: 61, steps: 16 },
          { root: 45, third: 49, fifth: 52, seventh: 56, steps: 16 },
          { root: 52, third: 55, fifth: 59, seventh: 62, steps: 16 },
          { root: 50, third: 54, fifth: 57, seventh: 61, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 雪原：F 大调，72 BPM，空灵宁静，I-IV-I-V（静态开放）
  snow: {
    tempo: 72,
    melodyInstrument: 'glock',
    harmonyInstrument: 'woodwind',
    bassInstrument: 'cbass',
    percussionType: 'triangle',
    bassMode: 'pedal',
    percDensity: 'sparse',
    phrases: {
      A: {
        // F-Bb-F-C
        melody: [
          77, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0,
          77, 0, 0, 0, 0, 0, 0, 0, 82, 0, 0, 0, 0, 0, 0, 0,
          84, 0, 0, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 0, 0, 0,
          84, 0, 0, 0, 0, 0, 0, 0, 79, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 46, third: 50, fifth: 53, steps: 16 },
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
        ],
      },
      B: {
        // F-C-Bb-C
        melody: [
          77, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0,
          89, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0,
          82, 0, 0, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 0, 0, 0,
          84, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 46, third: 50, fifth: 53, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
        ],
      },
      C: {
        // F-Bb-C-F
        melody: [
          77, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0,
          89, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 0, 0,
          89, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0,
          77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 41, third: 45, fifth: 48, steps: 16 },
          { root: 46, third: 50, fifth: 53, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 41, third: 45, fifth: 48, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 沙漠：D 小调，96 BPM，神秘异域，i-VII-VI-V（Phrygian 色彩）
  desert: {
    tempo: 96,
    melodyInstrument: 'woodwind',
    harmonyInstrument: 'marimba',
    bassInstrument: 'cbass',
    percussionType: 'cowbell',
    bassMode: 'pedal',
    percDensity: 'sparse',
    phrases: {
      A: {
        // Dm-C-Bb-A
        melody: [
          62, 0, 0, 65, 0, 0, 69, 0, 0, 65, 0, 0, 62, 0, 0, 0,
          65, 0, 0, 69, 0, 0, 72, 0, 0, 69, 0, 0, 65, 0, 0, 0,
          65, 0, 0, 69, 0, 0, 74, 0, 0, 69, 0, 0, 65, 0, 0, 0,
          69, 0, 0, 72, 0, 0, 77, 0, 0, 72, 0, 0, 69, 0, 0, 0,
        ],
        chords: [
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 46, third: 50, fifth: 53, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
        ],
      },
      B: {
        // Dm-Gm-C-A（或 F）
        melody: [
          62, 0, 0, 65, 0, 0, 69, 0, 72, 0, 0, 69, 0, 0, 65, 0,
          65, 0, 0, 67, 0, 0, 70, 0, 74, 0, 0, 70, 0, 0, 67, 0,
          65, 0, 0, 69, 0, 0, 72, 0, 77, 0, 0, 72, 0, 0, 69, 0,
          69, 0, 0, 72, 0, 0, 77, 0, 81, 0, 0, 77, 0, 0, 72, 0,
        ],
        chords: [
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 43, third: 46, fifth: 50, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
        ],
      },
      C: {
        // Dm-A-Bb-Dm
        melody: [
          62, 0, 65, 0, 69, 0, 72, 0, 69, 0, 65, 0, 62, 0, 0, 0,
          69, 0, 72, 0, 77, 0, 81, 0, 77, 0, 72, 0, 69, 0, 0, 0,
          65, 0, 69, 0, 74, 0, 77, 0, 74, 0, 69, 0, 65, 0, 0, 0,
          62, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 50, third: 53, fifth: 57, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
          { root: 46, third: 50, fifth: 53, steps: 16 },
          { root: 50, third: 53, fifth: 57, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 火山：C 小调，112 BPM，紧张激烈，i-VI-iv-V
  volcano: {
    tempo: 112,
    melodyInstrument: 'pizz',
    harmonyInstrument: 'marimba',
    bassInstrument: 'cbass',
    percussionType: 'woodblock',
    bassMode: 'ostinato',
    percDensity: 'dense',
    phrases: {
      A: {
        // Cm-Ab-Fm-G
        melody: [
          60, 63, 67, 0, 63, 60, 0, 67, 0, 63, 60, 0, 67, 0, 63, 0,
          60, 63, 68, 0, 63, 60, 0, 68, 0, 63, 60, 0, 68, 0, 63, 0,
          61, 65, 68, 0, 65, 61, 0, 68, 0, 65, 61, 0, 68, 0, 65, 0,
          67, 0, 70, 0, 74, 0, 70, 0, 67, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 51, fifth: 55, steps: 16 },
          { root: 44, third: 48, fifth: 51, steps: 16 },
          { root: 41, third: 44, fifth: 48, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      B: {
        // Cm-Eb-Ab-G
        melody: [
          60, 63, 67, 0, 70, 0, 67, 0, 63, 60, 0, 0, 67, 0, 0, 0,
          63, 67, 70, 0, 75, 0, 70, 0, 67, 63, 0, 0, 70, 0, 0, 0,
          68, 0, 72, 0, 75, 0, 80, 0, 75, 0, 72, 0, 68, 0, 0, 0,
          67, 0, 70, 0, 74, 0, 70, 0, 67, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 51, fifth: 55, steps: 16 },
          { root: 51, third: 55, fifth: 58, steps: 16 },
          { root: 44, third: 48, fifth: 51, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      C: {
        // Cm-Fm-G-Cm
        melody: [
          60, 63, 67, 70, 0, 67, 0, 63, 60, 0, 0, 0, 0, 0, 67, 0,
          61, 0, 65, 0, 68, 0, 73, 0, 68, 0, 65, 0, 61, 0, 0, 0,
          67, 0, 70, 0, 74, 0, 79, 0, 74, 0, 70, 0, 67, 0, 0, 0,
          60, 0, 63, 0, 67, 0, 70, 0, 74, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 51, fifth: 55, steps: 16 },
          { root: 41, third: 44, fifth: 48, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 48, third: 51, fifth: 55, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 故事书：D 大调，92 BPM，钟琴与拨弦交替，像翻页一样轻快
  storybook: {
    tempo: 92,
    melodyInstrument: 'glock',
    harmonyInstrument: 'pizz',
    bassInstrument: 'cbass',
    percussionType: 'triangle',
    bassMode: 'walking',
    percDensity: 'normal',
    phrases: {
      A: {
        melody: [
          74, 0, 78, 0, 81, 0, 86, 0, 81, 0, 78, 0, 74, 0, 0, 0,
          76, 0, 79, 0, 83, 0, 88, 0, 83, 0, 79, 0, 76, 0, 0, 0,
          81, 0, 84, 0, 88, 0, 93, 0, 88, 0, 84, 0, 81, 0, 0, 0,
          86, 0, 83, 0, 79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0,
        ],
        chords: [
          { root: 50, third: 54, fifth: 57, steps: 16 },
          { root: 47, third: 50, fifth: 54, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
        ],
      },
      B: {
        melody: [
          81, 0, 86, 0, 90, 0, 93, 0, 90, 0, 86, 0, 81, 0, 0, 0,
          79, 0, 83, 0, 88, 0, 91, 0, 88, 0, 83, 0, 79, 0, 0, 0,
          78, 0, 81, 0, 86, 0, 90, 0, 86, 0, 81, 0, 78, 0, 0, 0,
          74, 0, 78, 0, 81, 0, 86, 0, 90, 0, 86, 0, 81, 0, 0, 0,
        ],
        chords: [
          { root: 42, third: 45, fifth: 49, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
          { root: 50, third: 54, fifth: 57, steps: 16 },
        ],
      },
      C: {
        melody: [
          74, 78, 81, 0, 86, 0, 81, 78, 0, 74, 0, 71, 0, 74, 0, 0,
          76, 79, 83, 0, 88, 0, 83, 79, 0, 76, 0, 72, 0, 76, 0, 0,
          81, 84, 88, 0, 93, 0, 88, 84, 0, 81, 0, 78, 0, 81, 0, 0,
          86, 0, 83, 0, 79, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 50, third: 54, fifth: 57, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
          { root: 47, third: 50, fifth: 54, steps: 16 },
          { root: 50, third: 54, fifth: 57, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },

  // 齿轮站：E 小调，124 BPM，拨弦短音与密集铜铃，强调机械节拍
  clockwork: {
    tempo: 124,
    melodyInstrument: 'pizz',
    harmonyInstrument: 'woodwind',
    bassInstrument: 'cbass',
    percussionType: 'cowbell',
    bassMode: 'ostinato',
    percDensity: 'dense',
    phrases: {
      A: {
        melody: [
          76, 76, 0, 79, 0, 76, 0, 83, 76, 0, 79, 0, 83, 0, 86, 0,
          74, 74, 0, 78, 0, 74, 0, 81, 74, 0, 78, 0, 81, 0, 85, 0,
          71, 71, 0, 76, 0, 71, 0, 79, 71, 0, 76, 0, 79, 0, 83, 0,
          72, 0, 76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 72, 0, 0, 0,
        ],
        chords: [
          { root: 40, third: 43, fifth: 47, steps: 16 },
          { root: 38, third: 41, fifth: 45, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
        ],
      },
      B: {
        melody: [
          83, 0, 86, 83, 0, 88, 0, 91, 0, 88, 83, 0, 79, 0, 83, 0,
          81, 0, 85, 81, 0, 88, 0, 90, 0, 88, 85, 0, 81, 0, 85, 0,
          79, 0, 83, 79, 0, 86, 0, 90, 0, 86, 83, 0, 79, 0, 83, 0,
          76, 0, 79, 0, 83, 0, 88, 0, 83, 0, 79, 0, 76, 0, 0, 0,
        ],
        chords: [
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
          { root: 47, third: 50, fifth: 54, steps: 16 },
          { root: 40, third: 43, fifth: 47, steps: 16 },
        ],
      },
      C: {
        melody: [
          76, 79, 83, 86, 0, 83, 0, 79, 76, 0, 0, 79, 83, 0, 86, 0,
          74, 78, 81, 85, 0, 81, 0, 78, 74, 0, 0, 78, 81, 0, 85, 0,
          71, 74, 79, 83, 0, 79, 0, 74, 71, 0, 0, 74, 79, 0, 83, 0,
          72, 76, 79, 84, 0, 79, 0, 76, 72, 0, 0, 0, 0, 0, 0, 0,
        ],
        chords: [
          { root: 40, third: 43, fifth: 47, steps: 16 },
          { root: 38, third: 41, fifth: 45, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 45, third: 49, fifth: 52, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'B', 'A'],
  },

  // 极光营地：C 大调，64 BPM，长音钟琴与稀疏三角铁，留出夜空感
  aurora: {
    tempo: 64,
    melodyInstrument: 'glock',
    harmonyInstrument: 'woodwind',
    bassInstrument: 'cbass',
    percussionType: 'triangle',
    bassMode: 'pedal',
    percDensity: 'sparse',
    phrases: {
      A: {
        melody: [
          72, 0, 0, 0, 79, 0, 0, 0, 84, 0, 0, 0, 79, 0, 0, 0,
          74, 0, 0, 0, 81, 0, 0, 0, 86, 0, 0, 0, 81, 0, 0, 0,
          76, 0, 0, 0, 83, 0, 0, 0, 88, 0, 0, 0, 83, 0, 0, 0,
          79, 0, 0, 0, 86, 0, 0, 0, 91, 0, 0, 0, 86, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 53, third: 57, fifth: 60, steps: 16 },
          { root: 55, third: 59, fifth: 62, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
        ],
      },
      B: {
        melody: [
          84, 0, 0, 0, 91, 0, 0, 0, 96, 0, 0, 0, 91, 0, 0, 0,
          83, 0, 0, 0, 90, 0, 0, 0, 95, 0, 0, 0, 90, 0, 0, 0,
          81, 0, 0, 0, 88, 0, 0, 0, 93, 0, 0, 0, 88, 0, 0, 0,
          79, 0, 0, 0, 86, 0, 0, 0, 91, 0, 0, 0, 86, 0, 0, 0,
        ],
        chords: [
          { root: 53, third: 57, fifth: 60, steps: 16 },
          { root: 55, third: 59, fifth: 62, steps: 16 },
          { root: 43, third: 47, fifth: 50, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
        ],
      },
      C: {
        melody: [
          72, 0, 0, 0, 84, 0, 0, 0, 91, 0, 0, 0, 84, 0, 0, 0,
          74, 0, 0, 0, 86, 0, 0, 0, 93, 0, 0, 0, 86, 0, 0, 0,
          76, 0, 0, 0, 88, 0, 0, 0, 95, 0, 0, 0, 88, 0, 0, 0,
          72, 0, 0, 0, 84, 0, 0, 0, 91, 0, 0, 0, 84, 0, 0, 0,
        ],
        chords: [
          { root: 48, third: 52, fifth: 55, steps: 16 },
          { root: 53, third: 57, fifth: 60, steps: 16 },
          { root: 55, third: 59, fifth: 62, steps: 16 },
          { root: 48, third: 52, fifth: 55, steps: 16 },
        ],
      },
    },
    arrangement: ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  },
};

/** 展平后的完整乐曲（640 步），供 scheduleStep 直接索引 */
export interface FlattenedScore {
  melody: number[];      // 640
  harmony: number[];     // 640
  bass: number[];        // 640
  arpeggio: number[];    // 640
  percussion: number[];  // 640（0=休止，1=弱击，2=正常，3=重击）
}

/**
 * 声部音量配比。
 *
 * 各声部经 instruments.ts 的 RMS 归一化后响度一致，这里只需按编曲层级
 * 分配感知权重：主旋律最突出，低音与和声为骨架，琶音/打击为装饰。
 * 打击乐额外除以 2 因 perc 数据为 1/2/3 重击编码（见 scheduleStep）。
 */
export const VOICE_VOLUMES = {
  melody: 0.5,
  harmony: 0.3,
  bass: 0.4,
  arpeggio: 0.22,
  percussion: 0.18,
} as const;

const LEVEL_SCALES = [
  [0, 2, 4, 5, 7, 9, 11], // 大调
  [0, 2, 3, 5, 7, 8, 10], // 自然小调
  [0, 2, 3, 5, 7, 9, 10], // 多利亚调式
  [0, 1, 3, 5, 7, 8, 10], // 异域小调
] as const;

const LEVEL_MELODIES: InstrumentName[] = ['glock', 'marimba', 'pizz', 'woodwind'];
const LEVEL_PERCUSSIONS: PercussionType[] = ['triangle', 'woodblock', 'snap', 'cowbell'];
const LEVEL_BASS_MODES: BassMode[] = ['walking', 'pedal', 'ostinato'];
const LEVEL_PERC_DENSITIES: PercDensity[] = ['sparse', 'normal', 'dense'];
const LEVEL_ARRANGEMENTS: Array<('A' | 'B' | 'C')[]> = [
  ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'C', 'A'],
  ['A', 'B', 'A', 'C', 'A', 'B', 'C', 'A', 'B', 'A'],
  ['A', 'C', 'B', 'A', 'C', 'A', 'B', 'C', 'A', 'B'],
];

const LEVEL_MOODS = new Map<`level:${string}`, MoodData>();

function hashLevelId(levelId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < levelId.length; i++) {
    hash ^= levelId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function levelNote(root: number, scale: readonly number[], degree: number, octave: number): number {
  const scaleSize = scale.length;
  const normalized = ((degree % scaleSize) + scaleSize) % scaleSize;
  const octaveOffset = Math.floor(degree / scaleSize);
  return root + scale[normalized] + (octave + octaveOffset) * 12;
}

/** 为每个关卡生成独立旋律、和弦、节拍与配器，不复用任何另一关卡的乐谱。 */
function buildLevelMood(levelId: string): MoodData {
  const seed = hashLevelId(levelId);
  const scale = LEVEL_SCALES[seed % LEVEL_SCALES.length];
  const root = 36 + (seed % 12);
  const stride = 1 + ((seed >>> 8) % 4);

  const makeMelody = (section: number): number[] => {
    const melody = new Array<number>(PHRASE_LEN).fill(0);
    const restEvery = 5 + ((seed >>> (section * 5)) % 4);
    for (let i = 0; i < PHRASE_LEN; i++) {
      if ((i + section * 3 + (seed % 7)) % restEvery === 0) continue;
      const degree = (seed % 7 + section * 3 + i * stride + Math.floor(i / 8) * (section + 1)) % 14;
      melody[i] = levelNote(root + 24, scale, degree, 0);
    }
    // 每个关卡的稳定标记音，避免不同 seed 恰好产生相同的短句。
    const markerIndex = 1 + ((seed >>> 16) % (PHRASE_LEN - 2));
    melody[markerIndex] = levelNote(root + 24, scale, (seed >>> 20) % 14, 0);
    return melody;
  };

  const makePhrase = (section: number): Phrase => {
    const chordDegrees = [
      (seed + section * 2) % 7,
      (seed >>> 3 + section) % 7,
      (seed >>> 7 + section * 2) % 7,
      (seed >>> 11 + section * 3) % 7,
    ];
    return {
      melody: makeMelody(section),
      chords: chordDegrees.map((degree) => ({
        root: levelNote(root, scale, degree, 0),
        third: levelNote(root, scale, degree + 2, 0),
        fifth: levelNote(root, scale, degree + 4, 0),
        seventh: levelNote(root, scale, degree + 6, 0),
        steps: 16,
      })),
    };
  };

  const arrangement = LEVEL_ARRANGEMENTS[(seed >>> 24) % LEVEL_ARRANGEMENTS.length];
  const rotation = seed % arrangement.length;
  return {
    tempo: 72 + (seed % 57),
    melodyInstrument: LEVEL_MELODIES[(seed >>> 4) % LEVEL_MELODIES.length],
    harmonyInstrument: LEVEL_MELODIES[(seed >>> 12) % LEVEL_MELODIES.length],
    bassInstrument: 'cbass',
    percussionType: LEVEL_PERCUSSIONS[(seed >>> 20) % LEVEL_PERCUSSIONS.length],
    bassMode: LEVEL_BASS_MODES[(seed >>> 25) % LEVEL_BASS_MODES.length],
    percDensity: LEVEL_PERC_DENSITIES[(seed >>> 28) % LEVEL_PERC_DENSITIES.length],
    phrases: { A: makePhrase(0), B: makePhrase(1), C: makePhrase(2) },
    arrangement: [...arrangement.slice(rotation), ...arrangement.slice(0, rotation)],
  };
}

/** 把关卡 bgm 键转换成不会与基础 mood 混淆的运行时音乐键。 */
export function levelMood(levelId: string): `level:${string}` {
  return `level:${levelId}`;
}

/** 获取 mood 数据（供调度器读取配器/速度） */
export function getMoodData(mood: MusicMood): MoodData {
  const baseMood = MOODS[mood as BaseMusicMood];
  if (baseMood) return baseMood;
  const levelId = mood.slice('level:'.length);
  const key = levelMood(levelId);
  let data = LEVEL_MOODS.get(key);
  if (!data) {
    data = buildLevelMood(levelId);
    LEVEL_MOODS.set(key, data);
  }
  return data;
}

/**
 * 把 MoodData 按 arrangement 展平为 640 步的连续乐谱。
 * melody 手写直接拷贝；harmony/bass/arpeggio/percussion 从和弦进行 + mood 模式生成。
 */
export function flatten(mood: MusicMood): FlattenedScore {
  const data = getMoodData(mood);
  const score: FlattenedScore = {
    melody: new Array(TOTAL_STEPS).fill(0),
    harmony: new Array(TOTAL_STEPS).fill(0),
    bass: new Array(TOTAL_STEPS).fill(0),
    arpeggio: new Array(TOTAL_STEPS).fill(0),
    percussion: new Array(TOTAL_STEPS).fill(0),
  };

  const percPattern = PERC_PATTERNS[data.percDensity];

  data.arrangement.forEach((key, seg) => {
    const phrase = data.phrases[key];
    const base = seg * PHRASE_LEN;

    // melody：手写数据直接拷贝
    for (let i = 0; i < PHRASE_LEN; i++) {
      score.melody[base + i] = phrase.melody[i];
    }

    // harmony/bass/arpeggio：从和弦进行生成
    let pos = 0;
    for (const chord of phrase.chords) {
      const steps = chord.steps;

      // harmony：每 8 步一个和弦音（根音 → 三音，低音区）
      score.harmony[base + pos] = chord.root;
      if (steps > 8) score.harmony[base + pos + 8] = chord.third;

      // bass：根据 bassMode
      switch (data.bassMode) {
        case 'walking':
          // root, root+12, root+7, root+5 每 4 步（walking bass）
          for (let i = 0; i < steps; i += 4) {
            const idx = (i / 4) % WALKING_OFFSETS.length;
            score.bass[base + pos + i] = chord.root + WALKING_OFFSETS[idx];
          }
          break;
        case 'pedal':
          // root 每 8 步（长持续 pedal tone）
          score.bass[base + pos] = chord.root;
          if (steps > 8) score.bass[base + pos + 8] = chord.root;
          break;
        case 'ostinato':
          // root, root, root+7, root 每 4 步（固定音型）
          for (let i = 0; i < steps; i += 4) {
            const idx = (i / 4) % OSTINATO_OFFSETS.length;
            score.bass[base + pos + i] = chord.root + OSTINATO_OFFSETS[idx];
          }
          break;
      }

      // arpeggio：每 4 步一个和弦音上行（高八度），稀疏装饰
      const tones = [chord.root, chord.third, chord.fifth, chord.seventh ?? chord.root + 12];
      for (let i = 0; i < steps; i += 4) {
        score.arpeggio[base + pos + i] = tones[(i / 4) % tones.length] + 12;
      }

      pos += steps;
    }

    // percussion：按小节重复打击乐模式
    for (let bar = 0; bar < PHRASE_LEN / 16; bar++) {
      const barBase = base + bar * 16;
      for (let i = 0; i < 16; i++) {
        score.percussion[barBase + i] = percPattern[i];
      }
    }
  });

  return score;
}
