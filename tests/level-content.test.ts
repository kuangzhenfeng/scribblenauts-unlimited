import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getEntry } from '@/core/data/dictionary/Dictionary';

interface RawChallenge {
  id: string;
  giverNpcId: string;
  puzzle: unknown;
  stages?: unknown;
}

interface RawLevel {
  id: string;
  type: string;
  theme: string;
  background?: string;
  bgm?: string;
  npcs: { id: string; typeId: string }[];
  spawns: { typeId: string }[];
  transitions?: { toLevelId: string }[];
  authoredChallenges?: RawChallenge[];
}

const levelDir = path.join(process.cwd(), 'src/core/data/levels');
const levels = fs.readdirSync(levelDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(levelDir, file), 'utf8')) as RawLevel);

function pngDimensions(file: string): { width: number; height: number } {
  const data = fs.readFileSync(file);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function challengeSignature(challenge: RawChallenge): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .filter((key) => key !== 'npcId' && key !== 'giverNpcId')
        .sort()
        .map((key) => [key, normalize(object[key])]),
    );
  };

  return JSON.stringify(normalize({ puzzle: challenge.puzzle, stages: challenge.stages }));
}

describe('关卡内容唯一性', () => {
  it('所有 authored challenge 都有唯一谜题指纹，避免跨关复制同一解法', () => {
    const seen = new Map<string, string>();
    for (const level of levels) {
      for (const challenge of level.authoredChallenges ?? []) {
        const signature = challengeSignature(challenge);
        const previous = seen.get(signature);
        expect(previous, `${level.id}/${challenge.id} duplicates ${previous ?? 'unknown'}`).toBeUndefined();
        seen.set(signature, `${level.id}/${challenge.id}`);
      }
    }
  });

  it('每个 authored challenge 都绑定当前关卡 NPC，开放区域至少有两个回返入口', () => {
    const levelIds = new Set(levels.map((level) => level.id));
    for (const level of levels) {
      const npcIds = new Set(level.npcs.map((npc) => npc.id));
      for (const challenge of level.authoredChallenges ?? []) {
        expect(npcIds.has(challenge.giverNpcId)).toBe(true);
      }
      for (const transition of level.transitions ?? []) {
        expect(levelIds.has(transition.toLevelId), `${level.id} points to missing ${transition.toLevelId}`).toBe(true);
      }
      if (level.type === 'overworld') {
        expect(level.transitions?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('所有关卡中的实体词条都能被运行时词典解析', () => {
    const walk = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(walk);
      if (!value || typeof value !== 'object') return [];
      const object = value as Record<string, unknown>;
      const ids = typeof object.typeId === 'string' ? [object.typeId] : [];
      return ids.concat(Object.values(object).flatMap(walk));
    };

    for (const level of levels) {
      for (const spawn of level.spawns) {
        expect(getEntry(spawn.typeId), `${level.id} spawn ${spawn.typeId}`).toBeDefined();
      }
      for (const npc of level.npcs) {
        expect(getEntry(npc.typeId), `${level.id} npc ${npc.typeId}`).toBeDefined();
      }
      for (const challenge of level.authoredChallenges ?? []) {
        for (const typeId of walk({ puzzle: challenge.puzzle, stages: challenge.stages })) {
          expect(getEntry(typeId), `${level.id}/${challenge.id} uses ${typeId}`).toBeDefined();
        }
      }
    }
  });

  it('authored challenge 不设置实体数量门槛', () => {
    const countConditions = (value: unknown): Record<string, unknown>[] => {
      if (Array.isArray(value)) return value.flatMap(countConditions);
      if (!value || typeof value !== 'object') return [];
      const object = value as Record<string, unknown>;
      const own = (object.kind === 'counter' || object.kind === 'object-present') && object.count !== undefined
        ? [object]
        : [];
      return own.concat(Object.values(object).flatMap(countConditions));
    };

    for (const level of levels) {
      for (const challenge of level.authoredChallenges ?? []) {
        expect(
          countConditions({ puzzle: challenge.puzzle, stages: challenge.stages }),
          `${level.id}/${challenge.id} must accept one matching entity`,
        ).toHaveLength(0);
      }
    }
  });

  it('每个选关区域都有独立背景板，且背景板键不会复用', () => {
    const mainLevels = levels.filter((level) => level.id !== 'quiz-arena');
    const backgrounds = mainLevels.map((level) => level.background);
    expect(backgrounds.every(Boolean)).toBe(true);
    expect(new Set(backgrounds).size).toBe(mainLevels.length);

    for (const level of mainLevels) {
      const background = level.background!;
      const farFile = path.join(process.cwd(), 'public/assets/backgrounds', `bg-far-${background}.png`);
      const nearFile = path.join(process.cwd(), 'public/assets/backgrounds', `bg-near-${background}.png`);
      expect(fs.existsSync(farFile)).toBe(true);
      expect(fs.existsSync(nearFile)).toBe(true);
      expect(pngDimensions(farFile)).toEqual({ width: 1920, height: 1080 });
      expect(pngDimensions(nearFile)).toEqual({ width: 1920, height: 200 });
    }

    const farHashes = mainLevels.map((level) => {
      const file = path.join(process.cwd(), 'public/assets/backgrounds', `bg-far-${level.background!}.png`);
      return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    });
    expect(new Set(farHashes).size).toBe(mainLevels.length);

    const nearHashes = mainLevels.map((level) => {
      const file = path.join(process.cwd(), 'public/assets/backgrounds', `bg-near-${level.background!}.png`);
      return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    });
    expect(new Set(nearHashes).size).toBe(mainLevels.length);
  });

  it('每个选关区域都绑定独立背景音乐键', () => {
    const mainLevels = levels.filter((level) => level.id !== 'quiz-arena');
    const bgms = mainLevels.map((level) => level.bgm);
    expect(bgms.every(Boolean)).toBe(true);
    expect(new Set(bgms).size).toBe(mainLevels.length);
  });
});
