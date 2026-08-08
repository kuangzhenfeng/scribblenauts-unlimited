const MAP_COLUMNS = 7;
const MAP_MIN_PERCENT = 10;
const MAP_MAX_PERCENT = 90;

/** 世界地图节点布局；保持关卡顺序，以蛇形网格铺开完整关卡列表。 */
export function worldMapNodePosition(index: number, total: number): { x: number; y: number } {
  if (total <= 0) return { x: 50, y: 50 };

  const columns = Math.min(MAP_COLUMNS, total);
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const rowOffset = index % columns;
  const column = row % 2 === 0 ? rowOffset : columns - 1 - rowOffset;
  const x = columns === 1
    ? 50
    : MAP_MIN_PERCENT + (column / (columns - 1)) * (MAP_MAX_PERCENT - MAP_MIN_PERCENT);
  const y = rows === 1
    ? 50
    : MAP_MIN_PERCENT + (row / (rows - 1)) * (MAP_MAX_PERCENT - MAP_MIN_PERCENT);

  return { x, y };
}
