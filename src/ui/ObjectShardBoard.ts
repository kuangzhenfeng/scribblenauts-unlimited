/**
 * Object Shard 面板 —— 展示跨关、非排他的八类物体召唤收集。
 *
 * 面板只消费宿主传入的任务目录与进度，不读取或修改存档；宿主在
 * GoalSystem 产生新任务时调用 update()，保证 UI 与领域状态单向同步。
 */

import { getLang } from '@/core/i18n/I18n';
import type { ObjectShardCategoryDef, ObjectShardTask } from '@/core/data/starite/object-shards';
import { ICON_CHECK, ICON_CLOSE, ICON_SHARD, ICON_STAR } from './icons';
import { INK, PAPER_BG, PAPER_BG_ALT, PAPER_SHADOW, TORN_EDGE, UI_FONT } from './paperStyle';

export interface ObjectShardBoardOptions {
  categories: readonly ObjectShardCategoryDef[];
  tasks: readonly ObjectShardTask[];
  completedTaskIds: readonly string[];
  objectShards: number;
  onClose?: () => void;
}

export interface ObjectShardBoardProgress {
  completedTaskIds: readonly string[];
  objectShards: number;
}

let instanceCount = 0;

function labelFor(def: ObjectShardCategoryDef): string {
  return getLang() === 'zh' ? def.zh : def.en;
}

function taskLabel(task: ObjectShardTask): string {
  return getLang() === 'zh' ? task.zh : task.en;
}

export class ObjectShardBoard {
  private readonly el: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly summaryEl: HTMLDivElement;
  private readonly categoriesEl: HTMLDivElement;
  private readonly tasksEl: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly categories: readonly ObjectShardCategoryDef[];
  private readonly tasks: readonly ObjectShardTask[];
  private readonly onClose?: () => void;
  private completedTaskIds: Set<string>;
  private objectShards: number;
  private open = false;

  constructor(options: ObjectShardBoardOptions) {
    this.categories = options.categories;
    this.tasks = options.tasks;
    this.completedTaskIds = new Set(options.completedTaskIds);
    this.objectShards = Math.max(0, Math.floor(options.objectShards));
    this.onClose = options.onClose;

    instanceCount += 1;
    const titleId = `object-shard-board-title-${instanceCount}`;
    this.el = document.createElement('div');
    this.el.id = 'object-shard-board';
    this.el.className = 'object-shard-board';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', titleId);
    this.el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:180',
      'display:none',
      'align-items:flex-start',
      'justify-content:flex-end',
      'padding:max(76px,calc(env(safe-area-inset-top) + 76px)) max(14px,env(safe-area-inset-right)) 14px',
      'box-sizing:border-box',
      'background:rgba(34,43,25,0.18)',
      `font-family:${UI_FONT}`,
      `color:${INK}`,
      'pointer-events:auto',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .object-shard-board__panel {
        display:flex;flex-direction:column;gap:12px;width:min(460px,calc(100vw - 28px));max-height:min(82vh,760px);
        padding:16px;background:${PAPER_BG};box-shadow:${PAPER_SHADOW};${TORN_EDGE};overflow:hidden;
      }
      .object-shard-board__header { display:flex;align-items:flex-start;gap:12px; }
      .object-shard-board__heading { flex:1;min-width:0; }
      .object-shard-board__title { margin:0;font-size:20px;line-height:1.1; }
      .object-shard-board__hint { margin:5px 0 0;color:#655d50;font-size:12px;line-height:1.4; }
      .object-shard-board__close { width:44px;height:44px;padding:9px;display:grid;place-items:center;flex:none;color:${INK};background:${PAPER_BG_ALT};border:1px solid #6a3d08;border-radius:8px;cursor:pointer; }
      .object-shard-board__summary { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#f6edc9;border:1px solid #d49b20;border-radius:8px;font-size:13px;font-weight:900; }
      .object-shard-board__summary-main,.object-shard-board__summary-reward { display:flex;align-items:center;gap:6px; }
      .object-shard-board__summary-main { color:#6b3ca3; }
      .object-shard-board__summary-reward { color:#8a5300;white-space:nowrap; }
      .object-shard-board__categories { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px; }
      .object-shard-board__category { padding:8px 6px;background:rgba(255,255,255,.3);border:1px solid #c2b494;border-radius:7px;text-align:center; }
      .object-shard-board__category[data-complete="true"] { background:#e6f2df;border-color:#72a35f; }
      .object-shard-board__category-label { display:block;font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .object-shard-board__category-count { display:block;margin-top:3px;color:#6b3ca3;font-size:12px;font-weight:900; }
      .object-shard-board__tasks { display:flex;flex-direction:column;gap:5px;min-height:0;overflow:auto;padding-right:2px; }
      .object-shard-board__task { display:flex;align-items:center;gap:7px;min-height:34px;padding:6px 8px;background:rgba(255,255,255,.2);border:1px solid #d2c6aa;border-radius:6px;font-size:12px; }
      .object-shard-board__task[data-completed="true"] { color:#55754b;background:#edf5e8;border-color:#a7c69a; }
      .object-shard-board__task-icon { display:grid;place-items:center;width:17px;height:17px;color:#9a6b10;flex:none; }
      .object-shard-board__task[data-completed="true"] .object-shard-board__task-icon { color:#4d8a3f; }
      .object-shard-board__task-label { min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .object-shard-board__task-category { color:#8a806d;font-size:10px;white-space:nowrap; }
      .object-shard-board button:focus-visible { outline:3px solid #f0bd3c;outline-offset:2px; }
      @media(max-width:600px) {
        .object-shard-board__panel { width:100%;max-height:86vh; }
        .object-shard-board__categories { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
    `;
    this.el.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'object-shard-board__panel';
    const header = document.createElement('header');
    header.className = 'object-shard-board__header';
    const heading = document.createElement('div');
    heading.className = 'object-shard-board__heading';
    this.titleEl = document.createElement('h2');
    this.titleEl.id = titleId;
    this.titleEl.className = 'object-shard-board__title';
    const hint = document.createElement('p');
    hint.className = 'object-shard-board__hint';
    hint.textContent = getLang() === 'zh'
      ? '跨关收集首次召唤的物体；10 个 Object Shard 自动兑换 1 个 Starite。'
      : 'Collect first-time summons across levels; 10 Object Shards become 1 Starite.';
    heading.append(this.titleEl, hint);
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'object-shard-board__close';
    this.closeButton.innerHTML = ICON_CLOSE;
    this.closeButton.setAttribute('aria-label', getLang() === 'zh' ? '关闭 Object Shard 面板' : 'Close Object Shards');
    this.closeButton.addEventListener('click', () => this.close());
    header.append(heading, this.closeButton);

    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'object-shard-board__summary';
    this.categoriesEl = document.createElement('div');
    this.categoriesEl.className = 'object-shard-board__categories';
    this.categoriesEl.setAttribute('role', 'list');
    this.tasksEl = document.createElement('div');
    this.tasksEl.className = 'object-shard-board__tasks';
    this.tasksEl.setAttribute('role', 'list');
    panel.append(header, this.summaryEl, this.categoriesEl, this.tasksEl);
    this.el.appendChild(panel);
    this.el.addEventListener('click', (event) => {
      if (event.target === this.el) this.close();
    });
    document.body.appendChild(this.el);
    this.render();
  }

  get element(): HTMLDivElement {
    return this.el;
  }

  get isOpen(): boolean {
    return this.open;
  }

  update(progress: ObjectShardBoardProgress): void {
    this.completedTaskIds = new Set(progress.completedTaskIds);
    this.objectShards = Math.max(0, Math.floor(progress.objectShards));
    this.render();
  }

  show(): void {
    this.open = true;
    this.el.style.display = 'flex';
    this.closeButton.focus();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }

  private close(): void {
    if (!this.open) return;
    this.hide();
    this.onClose?.();
  }

  private render(): void {
    const langZh = getLang() === 'zh';
    const completed = this.completedTaskIds;
    const completedCount = this.tasks.reduce((count, task) => count + (completed.has(task.id) ? 1 : 0), 0);
    this.titleEl.textContent = langZh ? 'Object Shard 收集' : 'Object Shard Collection';
    this.summaryEl.innerHTML = `${ICON_SHARD}<span class="object-shard-board__summary-main">${this.objectShards} / 10</span><span class="object-shard-board__summary-reward">${ICON_STAR}${langZh ? '每 10 个兑换 1 Starite' : '10 → 1 Starite'}</span>`;

    this.categoriesEl.innerHTML = '';
    for (const category of this.categories) {
      const categoryTasks = this.tasks.filter((task) => task.category === category.id);
      const categoryCompleted = categoryTasks.filter((task) => completed.has(task.id)).length;
      const item = document.createElement('div');
      item.className = 'object-shard-board__category';
      item.dataset.complete = String(categoryTasks.length > 0 && categoryCompleted === categoryTasks.length);
      item.setAttribute('role', 'listitem');
      const label = document.createElement('span');
      label.className = 'object-shard-board__category-label';
      label.textContent = labelFor(category);
      const count = document.createElement('span');
      count.className = 'object-shard-board__category-count';
      count.textContent = `${categoryCompleted}/${categoryTasks.length}`;
      item.append(label, count);
      this.categoriesEl.appendChild(item);
    }

    this.tasksEl.innerHTML = '';
    for (const task of this.tasks) {
      const done = completed.has(task.id);
      const item = document.createElement('div');
      item.className = 'object-shard-board__task';
      item.dataset.completed = String(done);
      item.setAttribute('role', 'listitem');
      const icon = document.createElement('span');
      icon.className = 'object-shard-board__task-icon';
      icon.innerHTML = done ? ICON_CHECK : ICON_SHARD;
      const label = document.createElement('span');
      label.className = 'object-shard-board__task-label';
      label.textContent = taskLabel(task);
      const category = document.createElement('span');
      category.className = 'object-shard-board__task-category';
      const def = this.categories.find((candidate) => candidate.id === task.category);
      category.textContent = def ? labelFor(def) : task.category;
      item.append(icon, label, category);
      this.tasksEl.appendChild(item);
    }

    this.el.setAttribute('aria-label', `${langZh ? 'Object Shard 收集' : 'Object Shard Collection'} ${completedCount}/${this.tasks.length}`);
  }
}
