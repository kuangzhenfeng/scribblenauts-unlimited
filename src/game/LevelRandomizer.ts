/**
 * 关卡内容随机化 —— 只改变可重复生成的运行时内容，不改变关卡结构契约。
 *
 * bounds、playerStart、terrain、transitions 和挑战模板保持稳定，避免随机布局
 * 破坏传送门与目标区域；预生成物体、NPC 位置和环境装饰由种子派生变化。
 * 同一关卡使用同一种子时结果一致，设置页刷新题目种子即可重新生成一套布局。
 */

import type { Decoration, LevelData, NpcSpawn, SpawnDef } from '@/core/types/level';
import { hashString, mulberry32, shuffle } from '@/util/rng';

const GROUND_BAND_HEIGHT = 320;
const POSITION_JITTER_X = 150;
const POSITION_JITTER_AIR_Y = 54;
const POSITION_JITTER_GROUND_Y = 36;

export function randomizeLevelContent(level: LevelData, seedSalt: string): LevelData {
  const rng = mulberry32(hashString(`level-layout:${level.id}:${seedSalt}`));
  return {
    ...level,
    spawns: randomizeSpawns(level.spawns, level, rng),
    npcs: randomizeNpcs(level.npcs, level, rng),
    decorations: randomizeDecorations(level.decorations, level, rng),
  };
}

function randomizeSpawns(spawns: SpawnDef[], level: LevelData, rng: () => number): SpawnDef[] {
  if (spawns.length === 0) return [];

  const movableSpawns = spawns.filter((spawn) => !spawn.fixed);
  const threshold = level.bounds.maxY - GROUND_BAND_HEIGHT;
  const groundTypes = shuffle(
    movableSpawns.filter((spawn) => spawn.y >= threshold).map((spawn) => spawn.typeId),
    rng,
  );
  const airTypes = shuffle(
    movableSpawns.filter((spawn) => spawn.y < threshold).map((spawn) => spawn.typeId),
    rng,
  );
  let groundIndex = 0;
  let airIndex = 0;

  const randomized = spawns.map((spawn) => {
    if (spawn.fixed) return { ...spawn };
    const isAir = spawn.y < threshold;
    const pool = isAir ? airTypes : groundTypes;
    const typeId = pool.length > 0
      ? pool[isAir ? airIndex++ : groundIndex++] ?? spawn.typeId
      : spawn.typeId;
    const x = clamp(
      spawn.x + centeredRandom(rng, POSITION_JITTER_X),
      level.bounds.minX + 70,
      level.bounds.maxX - 70,
    );
    const y = isAir
      ? clamp(
        spawn.y + centeredRandom(rng, POSITION_JITTER_AIR_Y),
        level.bounds.minY + 40,
        threshold - 12,
      )
      : clamp(
        spawn.y + centeredRandom(rng, POSITION_JITTER_GROUND_Y),
        threshold + 20,
        level.bounds.maxY,
      );
    return { ...spawn, typeId, x, y };
  });

  // 每关额外补少量主题内物体，避免只是把固定物体换位置。
  const ambientPool = groundTypes.length > 0 ? groundTypes : airTypes;
  const extraCount = Math.min(3, Math.max(1, Math.floor(spawns.length / 6)));
  for (let i = 0; i < extraCount && ambientPool.length > 0; i += 1) {
    randomized.push({
      typeId: ambientPool[Math.floor(rng() * ambientPool.length)]!,
      x: level.bounds.minX + 100 + rng() * Math.max(1, level.bounds.maxX - level.bounds.minX - 200),
      y: level.bounds.maxY - 40,
      layer: 0,
    });
  }
  return randomized;
}

function randomizeNpcs(npcs: NpcSpawn[], level: LevelData, rng: () => number): NpcSpawn[] {
  if (npcs.length === 0) return [];
  const movableNpcs = npcs.filter((npc) => !npc.fixed);
  const positions = shuffle(movableNpcs.map(({ x, y }) => ({ x, y })), rng);
  const threshold = level.bounds.maxY - GROUND_BAND_HEIGHT;
  let positionIndex = 0;
  return npcs.map((npc) => {
    if (npc.fixed) return { ...npc };
    const source = positions[positionIndex++]!;
    const isAir = source.y < threshold;
    return {
      ...npc,
      x: clamp(
        source.x + centeredRandom(rng, POSITION_JITTER_X),
        level.bounds.minX + 90,
        level.bounds.maxX - 90,
      ),
      y: isAir
        ? clamp(source.y + centeredRandom(rng, POSITION_JITTER_AIR_Y), level.bounds.minY + 40, threshold - 12)
        : clamp(source.y + centeredRandom(rng, POSITION_JITTER_GROUND_Y), threshold + 20, level.bounds.maxY),
    };
  });
}

function randomizeDecorations(
  decorations: Decoration[] | undefined,
  level: LevelData,
  rng: () => number,
): Decoration[] | undefined {
  if (!decorations) return undefined;
  return decorations.map((decoration) => ({
    ...decoration,
    x: clamp(
      decoration.x + centeredRandom(rng, 120),
      level.bounds.minX + 40,
      level.bounds.maxX - 40,
    ),
    y: clamp(
      decoration.y + centeredRandom(rng, 42),
      level.bounds.minY + 20,
      level.bounds.maxY,
    ),
    scale: decoration.scale === undefined
      ? undefined
      : clamp(decoration.scale * (0.9 + rng() * 0.2), 0.5, 2.2),
  }));
}

function centeredRandom(rng: () => number, span: number): number {
  return (rng() - 0.5) * span;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
