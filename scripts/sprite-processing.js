/**
 * Sprite 像素处理核心。
 *
 * 只处理两类明确的像素问题：
 * 1. 从外部连通的中性灰白背景；
 * 2. 透明区域的 RGB 边缘颜色扩展。
 * alpha 与 RGB 分离，颜色扩展不会改变透明度。
 */

const DEFAULT_NEUTRAL_RANGE = 36;
const DEFAULT_MIN_BRIGHTNESS = 96;

function isNeutralBackground(rgba, index, neutralRange, minBrightness, maxAlpha) {
  const alpha = rgba[index + 3];
  if (alpha === 0) return true;
  const red = rgba[index];
  const green = rgba[index + 1];
  const blue = rgba[index + 2];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return alpha <= maxAlpha
    && brightest >= minBrightness
    && brightest - darkest <= neutralRange;
}

/** 将外部连通的中性灰白区域设为透明，内部白色细节保持不变。 */
export function removeNeutralBackground(
  rgba,
  width,
  height,
  {
    neutralRange = DEFAULT_NEUTRAL_RANGE,
    minBrightness = DEFAULT_MIN_BRIGHTNESS,
    maxAlpha = 255,
  } = {},
) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    const rgbaIndex = pixelIndex * 4;
    if (!isNeutralBackground(rgba, rgbaIndex, neutralRange, minBrightness, maxAlpha)) return;
    visited[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const rgbaIndex = pixelIndex * 4;
    rgba[rgbaIndex] = 0;
    rgba[rgbaIndex + 1] = 0;
    rgba[rgbaIndex + 2] = 0;
    rgba[rgbaIndex + 3] = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dy !== 0) enqueue(x + dx, y + dy);
      }
    }
  }

  return rgba;
}

/** 在指定帧内向透明区域复制最近可见像素的 RGB，保持 alpha 不变。 */
export function bleedTransparentEdges(
  rgba,
  { width, height, frameWidth, frameHeight, frameCount = 1, radius = 2 },
) {
  const directions = [-1, 0, 1];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const frameStartX = frameIndex * frameWidth;
    const distances = new Uint16Array(frameWidth * frameHeight);
    distances.fill(0xffff);

    for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const imageIndex = ((y * width) + frameStartX + x) * 4;
        if (rgba[imageIndex + 3] !== 0) distances[y * frameWidth + x] = 0;
      }
    }

    for (let step = 1; step <= radius; step++) {
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const localIndex = y * frameWidth + x;
          if (distances[localIndex] !== 0xffff) continue;

          let sourceLocalIndex = -1;
          for (const dy of directions) {
            for (const dx of directions) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= frameWidth || ny < 0 || ny >= frameHeight) continue;
              const neighborIndex = ny * frameWidth + nx;
              if (distances[neighborIndex] === step - 1) {
                sourceLocalIndex = neighborIndex;
                break;
              }
            }
            if (sourceLocalIndex !== -1) break;
          }
          if (sourceLocalIndex === -1) continue;

          const sourceX = sourceLocalIndex % frameWidth;
          const sourceY = Math.floor(sourceLocalIndex / frameWidth);
          const sourceImageIndex = ((sourceY * width) + frameStartX + sourceX) * 4;
          const imageIndex = ((y * width) + frameStartX + x) * 4;
          rgba[imageIndex] = rgba[sourceImageIndex];
          rgba[imageIndex + 1] = rgba[sourceImageIndex + 1];
          rgba[imageIndex + 2] = rgba[sourceImageIndex + 2];
          distances[localIndex] = step;
        }
      }
    }
  }
  return rgba;
}
