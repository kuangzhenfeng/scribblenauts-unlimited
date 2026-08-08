/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@/core/entity/Entity';
import { EntityHealthDisplay } from '@/ui/EntityHealthDisplay';

const camera = {
  worldToScreen: (x: number, y: number) => ({ x, y }),
} as never;

function entity(health: number, maxHealth = 50): Entity {
  return {
    id: 'e-health',
    typeId: 'human',
    state: {} as Entity['state'],
    drawParams: {},
    rendererId: 'human',
    layer: 1,
    critical: false,
    lastTouchedAt: 0,
    tags: {} as Entity['tags'],
    health,
    maxHealth,
    bodyPositionX: 100,
    bodyPositionY: 100,
    bodyAngle: 0,
    setBodyPosition: () => undefined,
    setBodyVelocity: () => undefined,
    applyImpulse: () => undefined,
  };
}

describe('EntityHealthDisplay', () => {
  it('只在对象受伤时显示四段局部生命圆点', () => {
    const display = new EntityHealthDisplay();
    display.render(entity(25), camera);

    expect(document.querySelectorAll('.entity-health-display__cell--filled')).toHaveLength(2);
    expect(document.querySelector('#entity-health-display')?.getAttribute('aria-label')).toBe('生命: 25/50');

    display.render(entity(50), camera);
    expect(document.querySelector('#entity-health-display')?.hasAttribute('hidden')).toBe(true);
    display.destroy();
  });
});
