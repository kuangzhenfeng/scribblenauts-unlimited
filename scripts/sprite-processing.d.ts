export interface EdgeBleedOptions {
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frameCount?: number;
  radius?: number;
}

export interface NeutralBackgroundOptions {
  neutralRange?: number;
  minBrightness?: number;
  maxAlpha?: number;
}

export function removeNeutralBackground(
  rgba: Uint8Array,
  width: number,
  height: number,
  options?: NeutralBackgroundOptions,
): Uint8Array;

export function bleedTransparentEdges(
  rgba: Uint8Array,
  options: EdgeBleedOptions,
): Uint8Array;
