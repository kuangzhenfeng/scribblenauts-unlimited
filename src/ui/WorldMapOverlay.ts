/**
 * 世界地图浮层 —— 为宿主场景提供可复用的关卡节点选择界面。
 *
 * 组件只负责 DOM 展示、键盘/触屏交互与节点选择，不读取存档，也不依赖 Phaser。
 * 宿主通过 update() 注入最新的节点、解锁集合和当前关卡，再通过 onEnter 接入场景切换。
 */

import { ICON_CLOSE, ICON_LOCK, ICON_MAP, ICON_PLAY, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, TORN_EDGE, UI_FONT } from './paperStyle';

export interface WorldMapNode {
  id: string;
  title: string;
  subtitle?: string;
  /** 在地图舞台中的百分比坐标，范围外的值会被裁剪到 4%～96%。 */
  x: number;
  y: number;
  /** 可选主题色；未提供时使用项目默认墨色。 */
  accent?: string;
  /** 该节点已经获得的 Starite 数，可选。 */
  starites?: number;
  /** 该节点可获得的 Starite 总数，可选。 */
  maxStarites?: number;
}

export type WorldMapUnlockState = ReadonlySet<string> | readonly string[];

export interface WorldMapOverlayLabels {
  title: string;
  hint: string;
  close: string;
  enter: string;
  locked: string;
  current: string;
  empty: string;
  progress: string;
}

export interface WorldMapOverlayOptions {
  nodes: readonly WorldMapNode[];
  unlockedLevels: WorldMapUnlockState;
  currentLevelId?: string;
  onEnter: (node: WorldMapNode) => void;
  onClose?: () => void;
  labels?: Partial<WorldMapOverlayLabels>;
}

const DEFAULT_LABELS: WorldMapOverlayLabels = {
  title: '世界地图',
  hint: '选择一个已解锁的区域开始探索',
  close: '关闭世界地图',
  enter: '进入区域',
  locked: '尚未解锁',
  current: '当前位置',
  empty: '暂无可进入的区域',
  progress: 'Starite 进度',
};

let instanceCount = 0;

function toSet(values: WorldMapUnlockState): Set<string> {
  return values instanceof Set ? new Set(values) : new Set(values);
}

function clampPercent(value: number): number {
  return Math.min(96, Math.max(4, Number.isFinite(value) ? value : 50));
}

function iconBox(icon: string, color: string): HTMLSpanElement {
  const box = document.createElement('span');
  box.innerHTML = icon;
  box.style.cssText = `display:grid;place-items:center;width:30px;height:30px;color:${color};flex:none`;
  return box;
}

export class WorldMapOverlay {
  private readonly el: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly routeLayer: SVGSVGElement;
  private readonly nodesLayer: HTMLDivElement;
  private readonly selectedTitle: HTMLDivElement;
  private readonly selectedSubtitle: HTMLDivElement;
  private readonly selectedProgress: HTMLDivElement;
  private readonly enterButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly labels: WorldMapOverlayLabels;
  private readonly onEnter: (node: WorldMapNode) => void;
  private readonly onClose?: () => void;
  private readonly keyListener: (event: KeyboardEvent) => void;
  private nodes: readonly WorldMapNode[];
  private unlockedLevels: Set<string>;
  private currentLevelId: string | undefined;
  private selectedNodeId: string | undefined;
  private readonly nodeButtons = new Map<string, HTMLButtonElement>();
  private open = false;

  constructor(options: WorldMapOverlayOptions) {
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.onEnter = options.onEnter;
    this.onClose = options.onClose;
    this.nodes = options.nodes;
    this.unlockedLevels = toSet(options.unlockedLevels);
    this.currentLevelId = options.currentLevelId;
    this.selectedNodeId = this.getInitialSelection();

    instanceCount += 1;
    const titleId = `world-map-overlay-title-${instanceCount}`;
    this.el = document.createElement('div');
    this.el.className = 'world-map-overlay';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', titleId);
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:160',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:clamp(12px,3vw,32px)',
      'box-sizing:border-box',
      'background:rgba(34,43,25,0.58)',
      'font-family:' + UI_FONT,
      'color:' + INK,
      'pointer-events:auto',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .world-map-overlay__panel {
        position:relative;
        display:flex;
        flex-direction:column;
        gap:16px;
        width:min(1140px,100%);
        max-height:100%;
        padding:clamp(18px,3vw,28px);
        box-sizing:border-box;
        background:${PAPER_BG};
        box-shadow:${PAPER_SHADOW};
        ${TORN_EDGE};
        overflow:auto;
      }
      .world-map-overlay__header { display:flex;align-items:flex-start;gap:12px; }
      .world-map-overlay__heading { min-width:0;flex:1; }
      .world-map-overlay__title { margin:0;font-size:28px;font-weight:900;line-height:1.1;letter-spacing:.02em; }
      .world-map-overlay__hint { margin-top:5px;color:#5a554c;font-size:14px;line-height:1.4; }
      .world-map-overlay__close,
      .world-map-overlay__enter {
        display:inline-flex;align-items:center;justify-content:center;gap:7px;
        min-height:44px;box-sizing:border-box;padding:8px 14px;
        border:1px solid #6a3d08;border-radius:8px;
        font:800 14px/1.1 ${UI_FONT};cursor:pointer;
        transition:transform .16s ease,filter .16s ease,background .16s ease;
      }
      .world-map-overlay__close { width:44px;padding:9px;color:${INK};background:${PAPER_BG_ALT}; }
      .world-map-overlay__close:hover,.world-map-overlay__close:focus-visible { filter:brightness(1.06);transform:translateY(-1px); }
      .world-map-overlay__stage {
        position:relative;isolation:isolate;width:100%;aspect-ratio:16 / 9;min-height:320px;
        background:#dfe9d1;border:1px solid #6a3d08;box-sizing:border-box;overflow:hidden;
      }
      .world-map-overlay__stage::before,.world-map-overlay__stage::after {
        content:"";position:absolute;pointer-events:none;border-radius:50%;opacity:.34;
      }
      .world-map-overlay__stage::before { width:38%;height:72%;left:-10%;top:9%;background:#b6d59d;transform:rotate(-15deg); }
      .world-map-overlay__stage::after { width:42%;height:66%;right:-10%;bottom:-10%;background:#c9dca9;transform:rotate(18deg); }
      .world-map-overlay__routes { position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none; }
      .world-map-overlay__nodes { position:absolute;inset:0;z-index:2; }
      .world-map-overlay__node {
        position:absolute;display:flex;flex-direction:column;align-items:center;gap:3px;
        width:clamp(74px,10vw,104px);min-height:64px;padding:8px 6px;box-sizing:border-box;
        transform:translate(-50%,-50%) rotate(-1deg);
        border:1px solid #6a3d08;border-radius:10px;background:${PAPER_BG};color:${INK};
        box-shadow:0 3px 0 #6a3d08;
        font:800 11px/1.12 ${UI_FONT};cursor:pointer;
        transition:transform .16s ease,filter .16s ease,opacity .16s ease;
      }
      .world-map-overlay__node:nth-child(even) { transform:translate(-50%,-50%) rotate(1deg); }
      .world-map-overlay__node:hover:not(:disabled),.world-map-overlay__node:focus-visible { transform:translate(-50%,-55%) rotate(0deg) scale(1.04);filter:brightness(1.04); }
      .world-map-overlay__node[aria-current="true"] { outline:3px solid #f0bd3c;outline-offset:2px; }
      .world-map-overlay__node[aria-pressed="true"] { background:#f0bd3c; }
      .world-map-overlay__node:disabled { cursor:not-allowed;opacity:.62;filter:grayscale(.35); }
      .world-map-overlay__node-icon { display:grid;place-items:center;width:27px;height:27px;color:var(--node-accent,#3d2200); }
      .world-map-overlay__node-label { max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .world-map-overlay__node-state { display:flex;align-items:center;gap:3px;font-size:10px;color:#6a3d08; }
      .world-map-overlay__footer { display:flex;align-items:stretch;gap:14px;min-height:74px; }
      .world-map-overlay__selection { min-width:0;flex:1;padding:12px 14px;background:${PAPER_BG_ALT};border-radius:8px; }
      .world-map-overlay__selected-title { font-size:17px;font-weight:900;line-height:1.2; }
      .world-map-overlay__selected-subtitle { margin-top:3px;color:#5a554c;font-size:12px;line-height:1.35; }
      .world-map-overlay__selected-progress { margin-top:4px;color:#8a5300;font-size:11px;font-weight:800; }
      .world-map-overlay__enter { min-width:150px;flex:none;color:#fff8dd;background:#3f7b3a;box-shadow:0 3px 0 #1f4d22; }
      .world-map-overlay__enter:hover:not(:disabled),.world-map-overlay__enter:focus-visible { transform:translateY(-1px);filter:brightness(1.08); }
      .world-map-overlay__enter:disabled { cursor:not-allowed;opacity:.48;box-shadow:none; }
      .world-map-overlay button:focus-visible { outline:3px solid #f0bd3c;outline-offset:3px; }
      @media (max-width:640px) {
        .world-map-overlay__panel { padding:16px 14px;gap:11px; }
        .world-map-overlay__stage { min-height:250px; }
        .world-map-overlay__footer { align-items:stretch;flex-direction:column;gap:8px; }
        .world-map-overlay__enter { width:100%; }
      }
      @media (prefers-reduced-motion:reduce) {
        .world-map-overlay__node,.world-map-overlay__close,.world-map-overlay__enter { transition:none; }
      }
    `;
    this.el.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'world-map-overlay__panel';
    panel.addEventListener('click', (event) => event.stopPropagation());

    const header = document.createElement('div');
    header.className = 'world-map-overlay__header';
    header.appendChild(iconBox(ICON_MAP, '#3d7b3a'));

    const heading = document.createElement('div');
    heading.className = 'world-map-overlay__heading';
    const title = document.createElement('h2');
    title.id = titleId;
    title.className = 'world-map-overlay__title';
    title.textContent = this.labels.title;
    const hint = document.createElement('div');
    hint.className = 'world-map-overlay__hint';
    hint.textContent = this.labels.hint;
    heading.append(title, hint);

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'world-map-overlay__close';
    this.closeButton.innerHTML = ICON_CLOSE;
    this.closeButton.title = this.labels.close;
    this.closeButton.setAttribute('aria-label', this.labels.close);
    this.closeButton.addEventListener('click', () => this.close());
    header.append(heading, this.closeButton);

    this.stage = document.createElement('div');
    this.stage.className = 'world-map-overlay__stage';
    this.routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.routeLayer.classList.add('world-map-overlay__routes');
    this.routeLayer.setAttribute('viewBox', '0 0 100 100');
    this.routeLayer.setAttribute('aria-hidden', 'true');
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'world-map-overlay__nodes';
    this.stage.append(this.routeLayer, this.nodesLayer);

    const footer = document.createElement('div');
    footer.className = 'world-map-overlay__footer';
    const selection = document.createElement('div');
    selection.className = 'world-map-overlay__selection';
    selection.setAttribute('role', 'status');
    selection.setAttribute('aria-live', 'polite');
    this.selectedTitle = document.createElement('div');
    this.selectedTitle.className = 'world-map-overlay__selected-title';
    this.selectedSubtitle = document.createElement('div');
    this.selectedSubtitle.className = 'world-map-overlay__selected-subtitle';
    this.selectedProgress = document.createElement('div');
    this.selectedProgress.className = 'world-map-overlay__selected-progress';
    selection.append(this.selectedTitle, this.selectedSubtitle, this.selectedProgress);

    this.enterButton = document.createElement('button');
    this.enterButton.type = 'button';
    this.enterButton.className = 'world-map-overlay__enter';
    this.enterButton.innerHTML = `${ICON_PLAY}<span></span>`;
    this.enterButton.setAttribute('aria-label', this.labels.enter);
    this.enterButton.querySelector('span')!.textContent = this.labels.enter;
    this.enterButton.addEventListener('click', () => this.enterSelected());
    footer.append(selection, this.enterButton);

    panel.append(header, this.stage, footer);
    this.el.appendChild(panel);
    this.el.addEventListener('click', () => this.close());
    this.el.style.display = 'none';

    this.keyListener = (event) => this.handleKeyDown(event);
    window.addEventListener('keydown', this.keyListener);
    document.body.appendChild(this.el);
    this.render();
  }

  get element(): HTMLDivElement {
    return this.el;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** 更新节点、解锁状态和当前位置；不会读取或修改持久化数据。 */
  update(
    nodes: readonly WorldMapNode[],
    unlockedLevels: WorldMapUnlockState,
    currentLevelId?: string,
  ): void {
    this.nodes = nodes;
    this.unlockedLevels = toSet(unlockedLevels);
    this.currentLevelId = currentLevelId;
    this.selectedNodeId = this.getInitialSelection();
    this.render();
  }

  setCurrentLevel(currentLevelId: string | undefined): void {
    this.currentLevelId = currentLevelId;
    this.selectedNodeId = this.getInitialSelection();
    this.render();
  }

  show(): void {
    this.open = true;
    this.el.style.display = 'flex';
    const focusTarget = this.selectedNodeId ? this.nodeButtons.get(this.selectedNodeId) : undefined;
    (focusTarget ?? this.closeButton).focus();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.open = false;
    window.removeEventListener('keydown', this.keyListener);
    this.el.remove();
    this.nodeButtons.clear();
  }

  private getInitialSelection(): string | undefined {
    if (this.currentLevelId && this.unlockedLevels.has(this.currentLevelId)) return this.currentLevelId;
    return this.nodes.find((node) => this.unlockedLevels.has(node.id))?.id;
  }

  private render(): void {
    this.nodesLayer.innerHTML = '';
    this.routeLayer.innerHTML = '';
    this.nodeButtons.clear();

    for (let i = 1; i < this.nodes.length; i += 1) {
      const from = this.nodes[i - 1]!;
      const to = this.nodes[i]!;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(clampPercent(from.x)));
      line.setAttribute('y1', String(clampPercent(from.y)));
      line.setAttribute('x2', String(clampPercent(to.x)));
      line.setAttribute('y2', String(clampPercent(to.y)));
      line.setAttribute('stroke', '#a39372');
      line.setAttribute('stroke-width', '1.2');
      line.setAttribute('stroke-dasharray', '2 2');
      this.routeLayer.appendChild(line);
    }

    for (const node of this.nodes) {
      const unlocked = this.unlockedLevels.has(node.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'world-map-overlay__node';
      button.style.left = `${clampPercent(node.x)}%`;
      button.style.top = `${clampPercent(node.y)}%`;
      button.style.setProperty('--node-accent', node.accent ?? '#3d2200');
      button.disabled = !unlocked;
      button.setAttribute('aria-label', unlocked ? node.title : `${node.title}，${this.labels.locked}`);
      button.setAttribute('aria-current', node.id === this.currentLevelId ? 'true' : 'false');
      button.setAttribute('aria-pressed', node.id === this.selectedNodeId ? 'true' : 'false');
      if (node.id === this.currentLevelId) button.title = this.labels.current;

      const icon = document.createElement('span');
      icon.className = 'world-map-overlay__node-icon';
      icon.innerHTML = unlocked ? ICON_STAR : ICON_LOCK;
      const label = document.createElement('span');
      label.className = 'world-map-overlay__node-label';
      label.textContent = node.title;
      button.append(icon, label);

      if (node.starites !== undefined && node.maxStarites !== undefined) {
        const state = document.createElement('span');
        state.className = 'world-map-overlay__node-state';
        state.innerHTML = `${ICON_STAR}<span></span>`;
        state.querySelector('span')!.textContent = `${Math.max(0, node.starites)}/${Math.max(0, node.maxStarites)}`;
        button.appendChild(state);
      }

      button.addEventListener('click', () => {
        this.selectNode(node.id);
        this.onEnter(node);
      });
      this.nodeButtons.set(node.id, button);
      this.nodesLayer.appendChild(button);
    }

    this.updateSelectionView();
  }

  private selectNode(nodeId: string): void {
    const node = this.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || !this.unlockedLevels.has(node.id)) return;
    this.selectedNodeId = node.id;
    this.updateSelectionView();
  }

  private updateSelectionView(): void {
    for (const [id, button] of this.nodeButtons) {
      button.setAttribute('aria-pressed', id === this.selectedNodeId ? 'true' : 'false');
      button.setAttribute('aria-current', id === this.currentLevelId ? 'true' : 'false');
    }

    const selected = this.nodes.find((node) => node.id === this.selectedNodeId);
    if (!selected) {
      this.selectedTitle.textContent = this.labels.empty;
      this.selectedSubtitle.textContent = '';
      this.selectedProgress.textContent = '';
      this.enterButton.disabled = true;
      return;
    }

    this.selectedTitle.textContent = selected.title;
    this.selectedSubtitle.textContent = selected.subtitle ?? (selected.id === this.currentLevelId ? this.labels.current : '');
    this.selectedProgress.textContent =
      selected.starites !== undefined && selected.maxStarites !== undefined
        ? `${this.labels.progress} ${Math.max(0, selected.starites)}/${Math.max(0, selected.maxStarites)}`
        : '';
    this.enterButton.disabled = !this.unlockedLevels.has(selected.id);
  }

  private enterSelected(): void {
    const selected = this.nodes.find((node) => node.id === this.selectedNodeId);
    if (!selected || !this.unlockedLevels.has(selected.id)) return;
    this.onEnter(selected);
  }

  private close(): void {
    if (!this.open) return;
    this.hide();
    this.onClose?.();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.open) return;
    if (event.key === 'Escape' || event.code === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    const target = event.target;
    if (!(target instanceof Node) || !this.el.contains(target)) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const available = this.nodes.filter((node) => this.unlockedLevels.has(node.id));
    if (available.length === 0) return;
    const currentIndex = Math.max(0, available.findIndex((node) => node.id === this.selectedNodeId));
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = (currentIndex + delta + available.length) % available.length;
    const next = available[nextIndex]!;
    event.preventDefault();
    this.selectNode(next.id);
    this.nodeButtons.get(next.id)?.focus();
  }
}
