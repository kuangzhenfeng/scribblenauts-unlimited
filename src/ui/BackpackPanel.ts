/**
 * Magic Backpack DOM 面板。
 *
 * 面板只负责查询、渲染和转发意图，不直接生成 Phaser 实体；主线程通过回调接线。
 */

import { ObjectLibrary, type ObjectLibraryItem, type ObjectLibrarySort } from '@/game/ObjectLibrary';
import { getLang } from '@/core/i18n/I18n';
import { ICON_BACKPACK, ICON_CLOSE, ICON_EDIT, ICON_TRASH } from './icons';
import { UI_FONT, PAPER_BG, PAPER_BG_ALT, INK, PAPER_SHADOW, TORN_EDGE } from './paperStyle';
import { confirmDialog } from './ConfirmDialog';

export interface BackpackPanelCallbacks {
  /** 主线程将 typeId 交给 ObjectLibrary.getSpawnCandidate 后生成。 */
  onSpawn: (typeId: string) => void;
  onEdit?: (typeId: string) => void | Promise<void>;
  onDuplicate?: (typeId: string) => void | Promise<void>;
  onDelete?: (typeId: string) => void | Promise<void>;
}

export class BackpackPanel {
  private readonly el: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly searchInput: HTMLInputElement;
  private readonly favoriteOnlyInput: HTMLInputElement;
  private readonly sortSelect: HTMLSelectElement;
  private readonly statusEl: HTMLDivElement;
  private visible = false;

  constructor(private readonly library: ObjectLibrary, private readonly cb: BackpackPanelCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'backpack-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.setAttribute('aria-label', '魔法背包');
    this.el.style.cssText = panelStyle();

    const style = document.createElement('style');
    style.textContent = `
      #backpack-panel * { box-sizing:border-box; }
      #backpack-panel :focus-visible { outline:3px solid #b56a0b; outline-offset:3px; }
      #backpack-panel .backpack-heading { display:flex; align-items:center; gap:9px; min-width:0; }
      #backpack-panel .backpack-heading h2 { margin:0; font-size:22px; line-height:1.15; }
      #backpack-panel .backpack-controls { display:grid; grid-template-columns:minmax(0,1fr) 142px; gap:8px; }
      #backpack-panel .backpack-filter { display:flex; align-items:center; min-height:44px; gap:8px; font-size:13px; font-weight:800; }
      #backpack-panel .backpack-filter input { width:20px; height:20px; accent-color:#3d2200; }
      #backpack-panel .backpack-list { display:flex; flex-direction:column; gap:8px; overflow:auto; min-height:0; }
      #backpack-panel .backpack-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; padding:10px; background:#fbf7ec; border-bottom:1px solid #c2b494; }
      #backpack-panel .backpack-item:last-child { border-bottom:0; }
      #backpack-panel .backpack-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; }
      #backpack-panel .backpack-status { min-height:18px; color:#3f7b3a; font-size:12px; line-height:1.4; }
      #backpack-panel .backpack-status[data-state="error"] { color:#8b2f18; }
      @media (max-width:520px) {
        #backpack-panel .backpack-controls { grid-template-columns:1fr; }
        #backpack-panel .backpack-item { grid-template-columns:1fr; }
        #backpack-panel .backpack-actions { justify-content:flex-start; }
      }
      @media (prefers-reduced-motion:reduce) { #backpack-panel button { transition:none !important; } }
    `;
    this.el.appendChild(style);

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(43,43,43,0.18)';
    const heading = document.createElement('div');
    heading.className = 'backpack-heading';
    const headingIcon = document.createElement('span');
    headingIcon.innerHTML = ICON_BACKPACK;
    headingIcon.style.color = '#3d2200';
    const headingText = document.createElement('h2');
    headingText.textContent = '魔法背包';
    heading.append(headingIcon, headingText);
    const close = document.createElement('button');
    close.type = 'button';
    close.innerHTML = ICON_CLOSE;
    close.title = '关闭魔法背包';
    close.setAttribute('aria-label', '关闭魔法背包');
    close.style.cssText = closeStyle();
    close.addEventListener('click', () => this.hide());
    header.append(heading, close);

    const controls = document.createElement('div');
    controls.className = 'backpack-controls';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = '搜索中英文名称或别名';
    this.searchInput.setAttribute('aria-label', '搜索背包');
    this.searchInput.style.cssText = inputStyle();
    this.searchInput.addEventListener('input', () => void this.refresh());

    this.sortSelect = document.createElement('select');
    this.sortSelect.setAttribute('aria-label', '背包排序');
    this.sortSelect.style.cssText = inputStyle();
    addOption(this.sortSelect, 'recent', '最近使用');
    addOption(this.sortSelect, 'frequent', '使用频率');
    addOption(this.sortSelect, 'name', '名称');
    this.sortSelect.addEventListener('change', () => void this.refresh());
    controls.append(this.searchInput, this.sortSelect);

    const filter = document.createElement('label');
    filter.className = 'backpack-filter';
    this.favoriteOnlyInput = document.createElement('input');
    this.favoriteOnlyInput.type = 'checkbox';
    this.favoriteOnlyInput.addEventListener('change', () => void this.refresh());
    filter.append(this.favoriteOnlyInput, document.createTextNode('只看收藏'));

    this.listEl = document.createElement('div');
    this.listEl.id = 'backpack-list';
    this.listEl.className = 'backpack-list';
    this.listEl.setAttribute('role', 'list');
    this.listEl.style.maxHeight = 'min(52vh,420px)';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'backpack-status';
    this.statusEl.setAttribute('aria-live', 'polite');

    this.el.append(header, controls, filter, this.statusEl, this.listEl);
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  async show(): Promise<void> {
    this.visible = true;
    this.el.style.display = 'flex';
    await this.refresh();
    this.searchInput.focus();
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  async toggle(): Promise<void> {
    if (this.visible) this.hide();
    else await this.show();
  }

  async refresh(): Promise<void> {
    try {
      const sort = this.sortSelect.value as ObjectLibrarySort;
      const items = await this.library.list({
        search: this.searchInput.value,
        favoritesOnly: this.favoriteOnlyInput.checked,
        sort,
      });
      this.render(items);
    } catch {
      this.setStatus('读取背包失败，请重试', 'error');
    }
  }

  /** 公开渲染入口，便于宿主或纯 DOM 测试使用。 */
  render(items: ObjectLibraryItem[]): void {
    this.listEl.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '还没有记录。召唤物体后，它会出现在这里。';
      empty.style.cssText = `padding:26px 12px;text-align:center;font-size:13px;color:${INK};opacity:0.7;line-height:1.5`;
      empty.setAttribute('role', 'status');
      this.listEl.appendChild(empty);
      return;
    }
    for (const item of items) this.listEl.appendChild(this.createItem(item));
  }

  private createItem(item: ObjectLibraryItem): HTMLDivElement {
    const row = document.createElement('div');
    row.setAttribute('role', 'listitem');
    row.dataset.typeId = item.typeId;
    row.className = 'backpack-item';

    const info = document.createElement('div');
    info.style.cssText = 'min-width:0';
    const name = document.createElement('div');
    name.textContent = getLang() === 'zh' ? item.zh.name : item.en.name;
    name.style.cssText = `font-size:15px;font-weight:900;color:${INK};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    const secondary = document.createElement('div');
    secondary.textContent = getLang() === 'zh'
      ? `${item.en.name} · ${item.record.useCount} 次${item.isCustom ? ' · 自定义' : ''}`
      : `${item.en.name} · used ${item.record.useCount}${item.isCustom ? ' · custom' : ''}`;
    secondary.style.cssText = 'font-size:11px;color:rgba(43,43,43,0.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    info.append(name, secondary);

    const actions = document.createElement('div');
    actions.className = 'backpack-actions';
    actions.appendChild(this.actionButton(item.record.favorite ? '已收藏' : '收藏', () => this.toggleFavorite(item.typeId), false, item.record.favorite ? '取消收藏' : '收藏', '状态已更新'));
    actions.appendChild(this.actionButton('生成', () => this.cb.onSpawn(item.typeId), true, '生成', '已生成'));
    if (item.isCustom && this.cb.onEdit) {
      actions.appendChild(this.actionButton(ICON_EDIT, () => this.cb.onEdit?.(item.typeId), false, '编辑', '已打开物体编辑器'));
    }
    if (item.isCustom && this.cb.onDuplicate) {
      actions.appendChild(this.actionButton('复制', () => this.cb.onDuplicate?.(item.typeId), false, '复制', '已复制'));
    }
    if (item.isCustom && this.cb.onDelete) {
      actions.appendChild(this.actionButton(ICON_TRASH, async () => {
        const confirmed = await confirmDialog({ title: '删除自定义物体', message: '删除后无法从背包恢复这个自定义物体。', confirmText: '删除' });
        if (!confirmed) return;
        await this.cb.onDelete?.(item.typeId);
        this.setStatus('已删除');
      }, false, '删除'));
    }
    row.append(info, actions);
    return row;
  }

  private async toggleFavorite(typeId: string): Promise<void> {
    await this.library.toggleFavorite(typeId);
    await this.refresh();
  }

  private actionButton(
    label: string,
    onClick: () => void | Promise<void>,
    primary = false,
    ariaLabel = label,
    feedback?: string,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = label.startsWith('<svg') ? label : '';
    if (!button.innerHTML) button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.style.cssText = actionStyle(primary);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      void (async () => {
        try {
          await onClick();
          if (feedback) this.setStatus(feedback);
        } catch {
          this.setStatus('操作失败，请重试', 'error');
        }
      })();
    });
    return button;
  }

  private setStatus(message: string, state: 'success' | 'error' = 'success'): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.state = state;
  }
}

function addOption(select: HTMLSelectElement, value: ObjectLibrarySort, text: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  select.appendChild(option);
}

function panelStyle(): string {
  return [
    'position:fixed',
    'top:max(16px,env(safe-area-inset-top))',
    'right:max(16px,env(safe-area-inset-right))',
    'bottom:max(16px,env(safe-area-inset-bottom))',
    'width:min(460px,calc(100vw - 32px))',
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'padding:20px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    TORN_EDGE,
    'z-index:51',
  ].join(';');
}

function inputStyle(): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'min-height:44px',
    'padding:8px 10px',
    'border:1px solid rgba(43,43,43,0.28)',
    'border-radius:8px',
    `background:${PAPER_BG_ALT}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:12px',
    'outline:none',
  ].join(';');
}

function closeStyle(): string {
  return `width:44px;height:44px;padding:10px;border:1px solid rgba(43,43,43,0.24);border-radius:8px;background:${PAPER_BG_ALT};color:${INK};cursor:pointer;flex:none`;
}

function actionStyle(primary: boolean): string {
  return [
    'min-width:44px',
    'min-height:44px',
    'padding:8px 10px',
    'border-radius:8px',
    'border:1px solid rgba(43,43,43,0.25)',
    `background:${primary ? INK : 'transparent'}`,
    `color:${primary ? PAPER_BG : INK}`,
    `font-family:${UI_FONT}`,
    'font-size:11px',
    'font-weight:800',
    'cursor:pointer',
  ].join(';');
}
