import type { AABB } from '@/core/types/level';
import type { EffectResult } from '@/core/rules/effects';

export interface EffectResultMatcher {
  kind?: EffectResult['kind'];
  targetId?: string;
  targetTypeId?: string;
  sourceTypeId?: string;
  ruleId?: string;
  region?: AABB;
}

export interface EffectResultQuery {
  has(query: EffectResultMatcher): boolean;
}

/** 记录当前关卡内已经发生过的 effect 结果，供挑战条件查询。 */
export class EffectResultLog {
  private readonly results: EffectResult[] = [];

  record(result: EffectResult): void {
    this.results.push(result);
  }

  has(query: EffectResultMatcher): boolean {
    return this.results.some((result) => {
      if (query.kind !== undefined && result.kind !== query.kind) return false;
      if (query.targetId !== undefined && result.targetId !== query.targetId) return false;
      if (query.targetTypeId !== undefined && result.targetTypeId !== query.targetTypeId) return false;
      if (query.sourceTypeId !== undefined && result.sourceTypeId !== query.sourceTypeId) return false;
      if (query.ruleId !== undefined && result.ruleId !== query.ruleId) return false;
      if (query.region !== undefined && !insideRegion(result.targetX, result.targetY, query.region)) return false;
      return true;
    });
  }

  clear(): void {
    this.results.length = 0;
  }
}

function insideRegion(x: number, y: number, region: AABB): boolean {
  return x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY;
}
