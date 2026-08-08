import { describe, expect, it } from 'vitest';
import {
  FAMILY_HELP_TARGET,
  FAMILY_LILY_STARITES,
  FAMILY_OBJECT_SHARD_TARGET,
  FAMILY_PARENT_STARITES,
  familyProgress,
} from '@/core/data/family/avatars';

describe('family avatar progression', () => {
  it('unlocks one sibling avatar per distinct completed challenge slot', () => {
    const progress = familyProgress(0, ['a', 'a', 'b'], 0);

    expect(progress.helpedCount).toBe(2);
    expect(progress.unlockedAvatarIds).toEqual(['maxwell', 'sibling-01', 'sibling-02']);
  });

  it('unlocks Lily at the 60 Starite story milestone', () => {
    const progress = familyProgress(FAMILY_LILY_STARITES, [], 0);

    expect(progress.unlockedAvatarIds).toContain('lily');
    expect(progress.unlockedAvatarIds).not.toContain('edgar');
  });

  it('requires the complete sibling/help and collection thresholds for the family endpoints', () => {
    const slots = Array.from({ length: FAMILY_HELP_TARGET }, (_, index) => `slot-${index}`);
    const progress = familyProgress(FAMILY_PARENT_STARITES, slots, FAMILY_OBJECT_SHARD_TARGET, 'julie');

    expect(progress.helpedCount).toBe(FAMILY_HELP_TARGET);
    expect(progress.unlockedAvatarIds).toContain('edgar');
    expect(progress.unlockedAvatarIds).toContain('julie');
    expect(progress.selectedAvatarId).toBe('julie');
  });

  it('falls back to Maxwell when an old save points at a locked avatar', () => {
    expect(familyProgress(0, [], 0, 'lily').selectedAvatarId).toBe('maxwell');
  });
});
