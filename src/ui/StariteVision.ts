/**
 * Starite Vision —— Starite/碎片探测开关与目标高亮浮层。
 *
 * 世界坐标筛选、距离排序和标记均通过纯函数完成；DOM 外壳只消费结果。
 * 宿主可以传入任意世界坐标，并用 setProjectedPositions() 注入屏幕坐标，不依赖 Phaser。
 */

import { ICON_CLOSE, ICON_SHARD, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, SAFE_RIGHT, SAFE_TOP, TORN_EDGE, UI_FONT } from './paperStyle';

export type StariteCollectibleKind = 'starite' | 'shard';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface StariteCollectible extends WorldPoint {
  id: string;
  kind: StariteCollectibleKind;
  label?: string;
  collected?: boolean;
}

export interface StariteVisionTarget extends StariteCollectible {
  marked: boolean;
  distance?: number;
}

export type StariteTargetIds = ReadonlySet<string> | readonly string[];

export interface StariteVisionFilter {
  kind?: StariteCollectibleKind;
  origin?: WorldPoint;
  maxDistance?: number;
  markedIds?: StariteTargetIds;
  includeCollected?: boolean;
  limit?: number;
}

export interface StariteVisionProjection {
  x: number;
  y: number;
  visible?: boolean;
}

export type StariteVisionProjectionState =
  | ReadonlyMap<string, StariteVisionProjection>
  | Readonly<Record<string, StariteVisionProjection>>;

export interface StariteVisionLabels {
  enabled: string;
  disabled: string;
  title: string;
  starite: string;
  shard: string;
  noTargets: string;
  close: string;
}

export interface StariteVisionOptions {
  collectibles: readonly StariteCollectible[];
  enabled?: boolean;
  markedIds?: StariteTargetIds;
  onToggle?: (enabled: boolean) => void;
  onSelect?: (target: StariteVisionTarget) => void;
  labels?: Partial<StariteVisionLabels>;
}

const DEFAULT_LABELS: StariteVisionLabels = {
  enabled: 'Starite Vision 已开启',
  disabled: '开启 Starite Vision',
  title: '附近收藏品',
  starite: 'Starite',
  shard: '碎片',
  noTargets: '没有发现未收集的目标',
  close: '关闭目标列表',
};

let instanceCount = 0;

function toSet(values: StariteTargetIds | undefined): Set<string> {
  if (!values) return new Set();
  return values instanceof Set ? new Set(values) : new Set(values);
}

function distanceBetween(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toProjectionMap(state: StariteVisionProjectionState): Map<string, StariteVisionProjection> {
  if (state instanceof Map) return new Map(state);
  const result = new Map<string, StariteVisionProjection>();
  const record = state as Readonly<Record<string, StariteVisionProjection>>;
  for (const id of Object.keys(state)) {
    const projection = record[id];
    if (projection) result.set(id, projection);
  }
  return result;
}

/**
 * 纯逻辑筛选器：关闭探测时返回空数组，默认排除已收集目标，并按距离升序返回。
 * 返回的新对象不会修改输入收藏品。
 */
export function filterStariteVisionTargets(
  collectibles: readonly StariteCollectible[],
  enabled: boolean,
  filter: StariteVisionFilter = {},
): StariteVisionTarget[] {
  if (!enabled) return [];
  if (filter.maxDistance !== undefined && filter.maxDistance < 0) return [];
  if (filter.limit !== undefined && filter.limit <= 0) return [];

  const markedIds = toSet(filter.markedIds);
  const candidates = collectibles
    .filter((collectible) => filter.includeCollected || !collectible.collected)
    .filter((collectible) => !filter.kind || collectible.kind === filter.kind)
    .map((collectible) => {
      const distance = filter.origin ? distanceBetween(collectible, filter.origin) : undefined;
      return { ...collectible, marked: markedIds.has(collectible.id), distance };
    })
    .filter((target) => filter.maxDistance === undefined || (target.distance !== undefined && target.distance <= filter.maxDistance));

  if (filter.origin) {
    candidates.sort((a, b) => (a.distance! - b.distance!) || a.id.localeCompare(b.id));
  }
  if (filter.limit !== undefined) return candidates.slice(0, Math.floor(filter.limit));
  return candidates;
}

/** 纯逻辑标记器：返回带 marked 字段的新数组，不修改原始收藏品和输入集合。 */
export function markStariteVisionTargets(
  collectibles: readonly (StariteCollectible | StariteVisionTarget)[],
  ids: StariteTargetIds,
  marked = true,
): StariteVisionTarget[] {
  const targetIds = toSet(ids);
  return collectibles.map((collectible) => ({
    ...collectible,
    marked: targetIds.has(collectible.id) ? marked : ('marked' in collectible ? collectible.marked : false),
  }));
}

function iconFor(kind: StariteCollectibleKind): string {
  return kind === 'starite' ? ICON_STAR : ICON_SHARD;
}

export class StariteVision {
  private readonly el: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly toggleIcon: HTMLSpanElement;
  private readonly toggleLabel: HTMLSpanElement;
  private readonly countEl: HTMLSpanElement;
  private readonly listEl: HTMLDivElement;
  private readonly markerLayer: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly labels: StariteVisionLabels;
  private readonly onToggle?: (enabled: boolean) => void;
  private readonly onSelect?: (target: StariteVisionTarget) => void;
  private collectibles: readonly StariteCollectible[];
  private markedIds: Set<string>;
  private projections = new Map<string, StariteVisionProjection>();
  private enabled: boolean;
  private visible = true;

  constructor(options: StariteVisionOptions) {
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.onToggle = options.onToggle;
    this.onSelect = options.onSelect;
    this.collectibles = options.collectibles;
    this.markedIds = toSet(options.markedIds);
    this.enabled = options.enabled ?? false;

    instanceCount += 1;
    const labelId = `starite-vision-label-${instanceCount}`;
    this.el = document.createElement('div');
    this.el.className = 'starite-vision';
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-labelledby', labelId);
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:80',
      'pointer-events:none',
      'font-family:' + UI_FONT,
      'color:' + INK,
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .starite-vision__panel {
        position:fixed;top:${SAFE_TOP};right:${SAFE_RIGHT};
        display:flex;flex-direction:column;gap:8px;width:min(260px,calc(100vw - 28px));
        padding:10px 12px;background:${PAPER_BG};box-shadow:${PAPER_SHADOW};${TORN_EDGE};
        pointer-events:auto;
      }
      .starite-vision__toggle-row { display:flex;align-items:center;gap:8px; }
      .starite-vision__toggle {
        display:flex;align-items:center;gap:7px;min-width:0;flex:1;padding:8px 10px;
        color:#fff8dd;background:#3d2200;border:2px solid #6a3d08;border-radius:9px;
        font:800 13px/1.2 ${UI_FONT};cursor:pointer;transition:transform .16s ease,filter .16s ease,background .16s ease;
      }
      .starite-vision__toggle[data-enabled="true"] { color:#3d2200;background:#f0bd3c; }
      .starite-vision__toggle:hover,.starite-vision__toggle:focus-visible { transform:translateY(-1px);filter:brightness(1.06); }
      .starite-vision__toggle-icon { display:grid;place-items:center;width:20px;height:20px;flex:none; }
      .starite-vision__toggle-label { min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .starite-vision__close { width:34px;height:34px;padding:6px;display:grid;place-items:center;color:${INK};background:${PAPER_BG_ALT};border:2px solid #6a3d08;border-radius:8px;cursor:pointer; }
      .starite-vision__close:hover,.starite-vision__close:focus-visible { filter:brightness(1.06); }
      .starite-vision__meta { display:flex;align-items:center;justify-content:space-between;gap:8px;color:#5a554c;font-size:12px;font-weight:800; }
      .starite-vision__count { color:#8a5300; }
      .starite-vision__list { display:flex;flex-direction:column;gap:5px;max-height:180px;overflow:auto; }
      .starite-vision__empty { padding:8px 4px;color:#5a554c;font-size:12px;line-height:1.4; }
      .starite-vision__target {
        display:flex;align-items:center;gap:7px;width:100%;padding:6px 7px;box-sizing:border-box;
        color:${INK};background:rgba(255,255,255,.28);border:1px solid #c2b494;border-radius:7px;
        font:700 12px/1.2 ${UI_FONT};text-align:left;cursor:pointer;
      }
      .starite-vision__target[data-marked="true"] { background:#f6edc9;border-color:#d49b20; }
      .starite-vision__target:hover,.starite-vision__target:focus-visible { background:#f0e3bb; }
      .starite-vision__target-icon { display:grid;place-items:center;width:18px;height:18px;color:#a05a00;flex:none; }
      .starite-vision__target-label { min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .starite-vision__marker-layer { position:fixed;inset:0;pointer-events:none; }
      .starite-vision__marker {
        position:fixed;display:grid;place-items:center;width:34px;height:34px;padding:5px;box-sizing:border-box;
        transform:translate(-50%,-50%);color:#fff8dd;background:#a05a00;border:2px solid #6a3d08;border-radius:50%;
        box-shadow:0 2px 0 #6a3d08;cursor:pointer;pointer-events:auto;transition:transform .16s ease,filter .16s ease;
      }
      .starite-vision__marker[data-marked="true"] { color:#3d2200;background:#f0bd3c; }
      .starite-vision__marker:hover,.starite-vision__marker:focus-visible { transform:translate(-50%,-55%) scale(1.1);filter:brightness(1.08); }
      .starite-vision button:focus-visible { outline:3px solid #f0bd3c;outline-offset:2px; }
      @media (max-width:480px) {
        .starite-vision__panel { left:14px;right:14px;top:${SAFE_TOP};width:auto; }
        .starite-vision__list { max-height:140px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .starite-vision__toggle,.starite-vision__marker { transition:none; }
      }
    `;
    this.el.appendChild(style);

    this.markerLayer = document.createElement('div');
    this.markerLayer.className = 'starite-vision__marker-layer';

    this.panel = document.createElement('div');
    this.panel.className = 'starite-vision__panel';
    const toggleRow = document.createElement('div');
    toggleRow.className = 'starite-vision__toggle-row';
    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'starite-vision__toggle';
    this.toggleButton.setAttribute('role', 'switch');
    this.toggleButton.setAttribute('aria-labelledby', labelId);
    this.toggleIcon = document.createElement('span');
    this.toggleIcon.className = 'starite-vision__toggle-icon';
    this.toggleLabel = document.createElement('span');
    this.toggleLabel.className = 'starite-vision__toggle-label';
    this.toggleLabel.id = labelId;
    this.toggleButton.append(this.toggleIcon, this.toggleLabel);
    this.toggleButton.addEventListener('click', () => this.toggle());

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'starite-vision__close';
    this.closeButton.innerHTML = ICON_CLOSE;
    this.closeButton.title = this.labels.close;
    this.closeButton.setAttribute('aria-label', this.labels.close);
    this.closeButton.addEventListener('click', () => this.hide());
    toggleRow.append(this.toggleButton, this.closeButton);

    const meta = document.createElement('div');
    meta.className = 'starite-vision__meta';
    const title = document.createElement('span');
    title.textContent = this.labels.title;
    this.countEl = document.createElement('span');
    this.countEl.className = 'starite-vision__count';
    meta.append(title, this.countEl);
    this.listEl = document.createElement('div');
    this.listEl.className = 'starite-vision__list';
    this.listEl.setAttribute('role', 'list');
    this.panel.append(toggleRow, meta, this.listEl);
    this.el.append(this.markerLayer, this.panel);
    document.body.appendChild(this.el);
    this.render();
  }

  get element(): HTMLDivElement {
    return this.el;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get visibleTargets(): StariteVisionTarget[] {
    return filterStariteVisionTargets(this.collectibles, this.enabled, { markedIds: this.markedIds });
  }

  setCollectibles(collectibles: readonly StariteCollectible[]): void {
    this.collectibles = collectibles;
    const knownIds = new Set(collectibles.map((collectible) => collectible.id));
    this.markedIds = new Set([...this.markedIds].filter((id) => knownIds.has(id)));
    this.render();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.render();
    this.onToggle?.(enabled);
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  /** 设置宿主计算出的屏幕坐标；坐标单位为 viewport px。 */
  setProjectedPositions(projected: StariteVisionProjectionState): void {
    this.projections = toProjectionMap(projected);
    this.renderMarkers();
  }

  markTarget(id: string, marked = true): void {
    if (marked) this.markedIds.add(id);
    else this.markedIds.delete(id);
    this.render();
  }

  setMarkedTargets(ids: StariteTargetIds): void {
    this.markedIds = toSet(ids);
    this.render();
  }

  show(): void {
    this.visible = true;
    this.el.style.display = '';
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.el.remove();
  }

  private render(): void {
    const targets = this.visibleTargets;
    this.toggleButton.dataset.enabled = String(this.enabled);
    this.toggleButton.setAttribute('aria-checked', String(this.enabled));
    this.toggleButton.setAttribute('aria-label', this.enabled ? this.labels.enabled : this.labels.disabled);
    this.toggleIcon.innerHTML = ICON_STAR;
    this.toggleLabel.textContent = this.enabled ? this.labels.enabled : this.labels.disabled;
    this.countEl.textContent = String(targets.length);
    this.listEl.innerHTML = '';

    if (targets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'starite-vision__empty';
      empty.textContent = this.enabled ? this.labels.noTargets : this.labels.disabled;
      this.listEl.appendChild(empty);
    } else {
      for (const target of targets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'starite-vision__target';
        button.dataset.marked = String(target.marked);
        button.setAttribute('aria-label', target.label ?? `${target.kind === 'starite' ? this.labels.starite : this.labels.shard} ${target.id}`);
        const icon = document.createElement('span');
        icon.className = 'starite-vision__target-icon';
        icon.innerHTML = iconFor(target.kind);
        const label = document.createElement('span');
        label.className = 'starite-vision__target-label';
        label.textContent = target.label ?? `${target.kind === 'starite' ? this.labels.starite : this.labels.shard} ${target.id}`;
        button.append(icon, label);
        button.addEventListener('click', () => this.selectTarget(target));
        this.listEl.appendChild(button);
      }
    }
    this.renderMarkers();
  }

  private renderMarkers(): void {
    this.markerLayer.innerHTML = '';
    if (!this.enabled || !this.visible) return;
    for (const target of this.visibleTargets) {
      const projection = this.projections.get(target.id);
      if (!projection || projection.visible === false || !Number.isFinite(projection.x) || !Number.isFinite(projection.y)) continue;
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'starite-vision__marker';
      marker.style.left = `${projection.x}px`;
      marker.style.top = `${projection.y}px`;
      marker.dataset.marked = String(target.marked);
      marker.innerHTML = iconFor(target.kind);
      marker.setAttribute('aria-label', target.label ?? `${target.kind === 'starite' ? this.labels.starite : this.labels.shard} ${target.id}`);
      marker.addEventListener('click', () => this.selectTarget(target));
      this.markerLayer.appendChild(marker);
    }
  }

  private selectTarget(target: StariteVisionTarget): void {
    this.markedIds.add(target.id);
    const markedTarget: StariteVisionTarget = { ...target, marked: true };
    this.render();
    this.onSelect?.(markedTarget);
  }
}
